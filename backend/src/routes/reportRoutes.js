const express = require("express");
const { protect, admin } = require("../middleware/authMiddleware");
const {
  listReports,
  getReportById,
  createReport,
  updateReport,
  deleteReport,
  runReport,
} = require("../controllers/reportController");

const router = express.Router();

router.use(protect, admin);

router.get("/", listReports);
router.get("/:id", getReportById);
router.get("/:id/run", runReport);
router.post("/", createReport);
router.put("/:id", updateReport);
router.delete("/:id", deleteReport);

module.exports = router;
