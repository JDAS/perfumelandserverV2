const express = require("express");
const router = express.Router();
const { protect, admin } = require("../middleware/authMiddleware");
const {
  getSuites,
  installSuite,
} = require("../controllers/suiteController");

router.use(protect, admin);

router.get("/", getSuites);
router.post("/:suiteId/install", installSuite);

module.exports = router;
