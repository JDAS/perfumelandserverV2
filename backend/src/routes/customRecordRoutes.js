const express = require("express");
const router = express.Router();

const {
  createRecord,
  getRecords,
  getRecordById,
  updateRecord,
  deleteRecord,
} = require("../controllers/customRecordController");

router.post("/:object", createRecord);
router.get("/:object", getRecords);
router.get("/:object/:id", getRecordById);
router.put("/:object/:id", updateRecord);
router.delete("/:object/:id", deleteRecord);

module.exports = router;