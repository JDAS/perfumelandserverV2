const express = require("express");
const router = express.Router();

const {
  register,
  getBootstrapStatus,
  bootstrapAdmin,
  login,
  updatePreferences,
  listUsers,
  adminCreateUser,
} = require("../controllers/authController");
const { protect, admin } = require("../middleware/authMiddleware");

router.post("/register", register);
router.get("/bootstrap-status", getBootstrapStatus);
router.post("/bootstrap-admin", bootstrapAdmin);
router.post("/login", login);
router.put("/preferences", protect, updatePreferences);
router.get("/users", protect, admin, listUsers);
router.post("/users", protect, admin, adminCreateUser);

module.exports = router;
