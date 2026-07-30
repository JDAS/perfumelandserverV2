const express = require("express");
const cors = require("cors");

const app = express();
const productRoutes = require("./routes/productRoutes");
const authRoutes = require("./routes/authRoutes");
const customObjectRoutes = require("./routes/customObjectRoutes");
const customRecordRoutes = require("./routes/customRecordRoutes");
const suiteRoutes = require("./routes/suiteRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const storefrontSettingsRoutes = require("./routes/storefrontSettingsRoutes");
const reportRoutes = require("./routes/reportRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const automationFlowRoutes = require("./routes/automationFlowRoutes");
const integrationLabRoutes = require("./routes/integrationLabRoutes");
const { createCorsOptions } = require("./config/cors");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");
const { applySecurityHeaders } = require("./middleware/securityHeaders");

app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(cors(createCorsOptions()));
app.use(applySecurityHeaders);
app.use(express.json({ limit: "1mb" }));

app.use("/api/products", productRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/custom-objects", customObjectRoutes);
app.use("/api/custom-records", customRecordRoutes);
app.use("/api/suites", suiteRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/storefront-settings", storefrontSettingsRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/dashboards", dashboardRoutes);
app.use("/api/automation-flows", automationFlowRoutes);
app.use("/api/integration-lab", integrationLabRoutes);

app.get("/api/test", (_req, res) => {
  res.json({ message: "API funcionando" });
});

app.use(notFound);
app.use(errorHandler);

module.exports = app;
