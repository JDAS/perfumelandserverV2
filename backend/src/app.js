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
app.get("/api/test", (req, res) => {
  res.json({ message: "API funcionando 🚀" });
});

module.exports = app;