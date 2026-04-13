const express = require("express");
const router = express.Router();

const {
  register,
  login,
  updatePreferences,
} = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");

router.post("/register", register);
router.post("/login", login);
router.put("/preferences", protect, updatePreferences);

module.exports = router;
