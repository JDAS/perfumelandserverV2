const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
const mongoose = require("mongoose");

const connectDB = require("../config/db");
const { getCustomRecordModel } = require("../models/CustomRecord");

const DRY_RUN = !process.argv.includes("--write");

function isCloudinaryUrl(value) {
  return /^https:\/\/res\.cloudinary\.com\//i.test(String(value || ""));
}

async function main() {
  await connectDB();

  const AttachmentModel = getCustomRecordModel("attachments");
  const attachments = await AttachmentModel.find({
    linked_object: "product",
    isactive: { $ne: false },
  }).lean();

  const grouped = new Map();

  for (const attachment of attachments) {
    const linkedRecordId = String(attachment.linked_record_id || attachment.linkedrecordid || "");
    const fileName = String(attachment.file_name || "");
    if (!linkedRecordId || !fileName) continue;

    const key = `${linkedRecordId}::${fileName}`;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key).push(attachment);
  }

  const toDeactivate = [];

  for (const group of grouped.values()) {
    const hasCloudinary = group.some((attachment) => isCloudinaryUrl(attachment.file_url));
    if (!hasCloudinary) continue;

    for (const attachment of group) {
      if (!isCloudinaryUrl(attachment.file_url)) {
        toDeactivate.push(String(attachment._id));
      }
    }
  }

  if (!DRY_RUN && toDeactivate.length > 0) {
    await AttachmentModel.updateMany(
      { _id: { $in: toDeactivate } },
      { $set: { isactive: false, legacy_cleanup_reason: "replaced_by_cloudinary" } }
    );
  }

  console.log(
    JSON.stringify(
      {
        dryRun: DRY_RUN,
        totalAttachments: attachments.length,
        deactivatedCandidates: toDeactivate.length,
        sampleIds: toDeactivate.slice(0, 20),
      },
      null,
      2
    )
  );

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
