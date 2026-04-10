const express = require("express");
const { protect, admin } = require("../middleware/authMiddleware");
const {
  listDashboards,
  getDashboardById,
  createDashboard,
  updateDashboard,
  deleteDashboard,
} = require("../controllers/dashboardController");

const router = express.Router();

router.use(protect);

router.get("/", listDashboards);
router.get("/:id", getDashboardById);
router.post("/", admin, createDashboard);
router.put("/:id", admin, updateDashboard);
router.delete("/:id", admin, deleteDashboard);

module.exports = router;
