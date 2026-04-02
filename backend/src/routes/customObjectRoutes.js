const express = require("express");
const router = express.Router();

const {
  createObject,
  getObjects,
  getObjectByApiName,
  updateObject,
} = require("../controllers/customObjectController");

router.post("/", createObject);
router.get("/", getObjects);
router.get("/:apiName", getObjectByApiName);
router.put("/:apiName", updateObject);

module.exports = router;