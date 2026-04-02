const express = require("express");
const router = express.Router();

const {
  createObject,
  getObjects,
  getObjectByApiName,
  updateObject,
  deleteObject,
} = require("../controllers/customObjectController");

router.post("/", createObject);
router.get("/", getObjects);
router.get("/:apiName", getObjectByApiName);
router.put("/:apiName", updateObject);
router.delete("/:apiName", deleteObject);

module.exports = router;