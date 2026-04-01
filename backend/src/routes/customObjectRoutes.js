const express = require("express");
const router = express.Router();

const {
  createObject,
  getObjects,
} = require("../controllers/customObjectController");

router.post("/", createObject);
router.get("/", getObjects);

module.exports = router;