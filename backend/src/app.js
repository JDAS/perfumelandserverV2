const express = require("express");
const cors = require("cors");

const app = express();
const productRoutes = require("./routes/productRoutes");
const authRoutes = require("./routes/authRoutes");

// Middlewares
app.use(cors());
app.use(express.json());
app.use("/api/products", productRoutes);
app.use("/api/auth", authRoutes);

// Test route
app.get("/api/health", (req, res) => {
  res.json({ message: "API working ✅" });
});

module.exports = app;