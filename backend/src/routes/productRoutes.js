const express = require("express");
const router = express.Router();
const { protect, admin } = require("../middleware/authMiddleware");

const {
  createProduct,
  getProducts,
  getProductById,
  getProductSharePage,
} = require("../controllers/productController");

router.post("/", protect, admin, createProduct);
router.get("/", getProducts);
router.get("/share/:id", getProductSharePage);
router.get("/:id", getProductById);

module.exports = router;
