const express = require("express");
const router = express.Router();

const {
  createRecord,
  getRecords,
} = require("../controllers/customRecordController");

// 🔥 dinámico por objeto
router.post("/:object", createRecord);
router.get("/:object", getRecords);

module.exports = router;