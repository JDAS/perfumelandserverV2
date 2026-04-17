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

router.use(protect, admin);

router.get("/", listDashboards);
router.get("/:id", getDashboardById);
router.post("/", createDashboard);
router.put("/:id", updateDashboard);
router.delete("/:id", deleteDashboard);

module.exports = router;
