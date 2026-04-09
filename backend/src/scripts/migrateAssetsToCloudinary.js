require("dotenv").config({ path: require("path").join(__dirname, "../../.env") });

const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const { ensureCloudinaryConfigured } = require("../config/cloudinary");
const { getCustomRecordModel } = require("../models/CustomRecord");

const DRY_RUN = !process.argv.includes("--write");
const TARGET_DB_NAME = process.env.MIGRATION_TARGET_DB || "test";
const FRONTEND_PUBLIC_DIR = path.resolve(__dirname, "../../..", "frontend", "public");
const LEGACY_ASSETS_PREFIX = "/assets/";

function normalizeSlashes(value) {
  return String(value || "").replace(/\\/g, "/");
}

function resolveLocalAssetPath(fileUrl) {
  const normalizedUrl = normalizeSlashes(fileUrl);
  if (!normalizedUrl.startsWith(LEGACY_ASSETS_PREFIX)) {
    return null;
  }

  const relativePath = normalizedUrl.replace(/^\//, "");
  return path.join(FRONTEND_PUBLIC_DIR, relativePath);
}

function sanitizePathSegment(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9/_-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function getUploadOptions(fileUrl) {
  const relativeAssetPath = normalizeSlashes(fileUrl).replace(/^\/assets\//, "");
  const parsed = path.posix.parse(relativeAssetPath);
  const subfolder = sanitizePathSegment(parsed.dir);
  const publicId = sanitizePathSegment(parsed.name) || "file";
  const baseFolder = process.env.CLOUDINARY_FOLDER || "perfumeland/attachments";

  return {
    resource_type: "image",
    folder: subfolder ? `${baseFolder}/legacy-assets/${subfolder}` : `${baseFolder}/legacy-assets`,
    public_id: publicId,
    overwrite: true,
    unique_filename: false,
    use_filename: false,
  };
}

async function main() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error("MONGO_URI no esta configurado.");
  }

  await mongoose.connect(mongoUri, { dbName: TARGET_DB_NAME });

  const AttachmentRecord = getCustomRecordModel("attachments");

  const attachments = await AttachmentRecord.find({
    file_url: { $regex: "^/assets/" },
    isactive: { $ne: false },
  })
    .sort({ linked_object: 1, linked_record_id: 1, _id: 1 })
    .lean();

  const summary = {
    dryRun: DRY_RUN,
    targetDb: TARGET_DB_NAME,
    totalCandidates: attachments.length,
    migrated: 0,
    updated: 0,
    alreadyCloudinary: 0,
    missingLocalFile: 0,
    skippedNonLegacy: 0,
    failures: 0,
    samples: [],
  };

  let cloudinary = null;
  if (!DRY_RUN) {
    cloudinary = ensureCloudinaryConfigured();
  }

  for (const attachment of attachments) {
    const currentUrl = attachment.file_url || "";
    const localPath = resolveLocalAssetPath(currentUrl);

    if (!localPath) {
      summary.skippedNonLegacy += 1;
      continue;
    }

    if (!fs.existsSync(localPath)) {
      summary.missingLocalFile += 1;
      if (summary.samples.length < 10) {
        summary.samples.push({
          _id: String(attachment._id),
          file_url: currentUrl,
          issue: "missing_local_file",
          localPath,
        });
      }
      continue;
    }

    if (DRY_RUN) {
      summary.migrated += 1;
      if (summary.samples.length < 10) {
        summary.samples.push({
          _id: String(attachment._id),
          file_url: currentUrl,
          localPath,
          uploadOptions: getUploadOptions(currentUrl),
        });
      }
      continue;
    }

    try {
      const result = await cloudinary.uploader.upload(localPath, getUploadOptions(currentUrl));
      const secureUrl = result.secure_url || result.url;

      await AttachmentRecord.updateOne(
        { _id: attachment._id },
        {
          $set: {
            file_url: secureUrl,
            cloudinary_public_id: result.public_id,
            cloudinary_resource_type: result.resource_type || "image",
            legacy_file_url: attachment.legacy_file_url || currentUrl,
          },
        }
      );

      summary.updated += 1;
      if (summary.samples.length < 10) {
        summary.samples.push({
          _id: String(attachment._id),
          previousUrl: currentUrl,
          newUrl: secureUrl,
          publicId: result.public_id,
        });
      }
    } catch (error) {
      summary.failures += 1;
      if (summary.samples.length < 10) {
        summary.samples.push({
          _id: String(attachment._id),
          file_url: currentUrl,
          localPath,
          issue: "upload_failed",
          error: error.message,
        });
      }
    }
  }

  console.log(JSON.stringify(summary, null, 2));
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("migrateAssetsToCloudinary error:", error);
  try {
    await mongoose.disconnect();
  } catch {
    // Ignore disconnect errors on failure path.
  }
  process.exit(1);
});
