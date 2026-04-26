const express = require("express");
const { protect, admin } = require("../middleware/authMiddleware");
const {
  listAutomationFlows,
  getAutomationFlowById,
  createAutomationFlow,
  updateAutomationFlow,
  deleteAutomationFlow,
} = require("../controllers/automationFlowController");

const router = express.Router();

router.use(protect, admin);

router.get("/", listAutomationFlows);
router.get("/:id", getAutomationFlowById);
router.post("/", createAutomationFlow);
router.put("/:id", updateAutomationFlow);
router.delete("/:id", deleteAutomationFlow);

module.exports = router;
