const express = require("express");
const multer = require("multer");
const { protect } = require("../middleware/authMiddleware");
const { uploadAttachment } = require("../controllers/uploadController");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

router.use(protect);
router.post("/attachments", upload.single("file"), uploadAttachment);

module.exports = router;
