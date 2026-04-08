const { ensureCloudinaryConfigured } = require("../config/cloudinary");

function uploadBufferToCloudinary(fileBuffer, options = {}) {
  const cloudinary = ensureCloudinaryConfigured();

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: "auto",
        folder: process.env.CLOUDINARY_FOLDER || "perfumeland/attachments",
        ...options,
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(result);
      }
    );

    stream.end(fileBuffer);
  });
}

exports.uploadAttachment = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Debes enviar un archivo." });
    }

    const result = await uploadBufferToCloudinary(req.file.buffer, {
      filename_override: req.file.originalname,
      use_filename: true,
      unique_filename: true,
    });

    return res.json({
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      url: result.secure_url || result.url,
      publicId: result.public_id,
      width: result.width || null,
      height: result.height || null,
    });
  } catch (error) {
    console.error("uploadAttachment error:", error);
    return res.status(error.statusCode || 500).json({
      error: error.message || "No se pudo subir el archivo.",
    });
  }
};
