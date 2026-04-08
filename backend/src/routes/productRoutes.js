const express = require("express");
const router = express.Router();
const { protect, admin } = require("../middleware/authMiddleware");

const {
  createProduct,
  getProducts,
  getProductById,
} = require("../controllers/productController");

router.post("/", protect, admin, createProduct);
router.get("/", getProducts);
router.get("/:id", getProductById);

module.exports = router;
