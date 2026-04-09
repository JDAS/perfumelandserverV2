const express = require("express");
const {
  getStorefrontSettings,
  updateStorefrontSettings,
} = require("../controllers/storefrontSettingsController");
const { protect, admin } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", getStorefrontSettings);
router.put("/", protect, admin, updateStorefrontSettings);

module.exports = router;
