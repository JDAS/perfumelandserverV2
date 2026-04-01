const express = require("express");
const router = express.Router();
const { protect, admin } = require("../middleware/authMiddleware");

const {
  createProduct,
  getProducts,
} = require("../controllers/productController");

router.post("/", protect, admin, createProduct);
router.get("/", getProducts);

module.exports = router;