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

router.use(protect);

router.get("/", listReports);
router.get("/:id", getReportById);
router.get("/:id/run", runReport);
router.post("/", admin, createReport);
router.put("/:id", admin, updateReport);
router.delete("/:id", admin, deleteReport);

module.exports = router;
