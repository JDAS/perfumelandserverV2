const ReportDefinition = require("../models/ReportDefinition");
const { executeReportDefinition } = require("../services/reportEngine");

function normalizeApiName(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

exports.listReports = async (req, res) => {
  const reports = await ReportDefinition.find()
    .sort({ createdAt: -1, _id: -1 })
    .lean();

  res.json(reports);
};

exports.getReportById = async (req, res) => {
  const report = await ReportDefinition.findById(req.params.id).lean();
  if (!report) {
    return res.status(404).json({ error: "Reporte no encontrado" });
  }
  return res.json(report);
};

exports.createReport = async (req, res) => {
  try {
    const payload = {
      ...req.body,
      apiName: normalizeApiName(req.body.apiName || req.body.name),
      createdBy: req.user?._id || null,
      updatedBy: req.user?._id || null,
    };

    const report = await ReportDefinition.create(payload);
    return res.status(201).json(report);
  } catch (error) {
    console.error("createReport error:", error);
    return res.status(400).json({ error: error.message });
  }
};

exports.updateReport = async (req, res) => {
  try {
    const current = await ReportDefinition.findById(req.params.id);
    if (!current) {
      return res.status(404).json({ error: "Reporte no encontrado" });
    }

    current.set({
      ...req.body,
      apiName: normalizeApiName(req.body.apiName || current.apiName || req.body.name),
      updatedBy: req.user?._id || null,
    });

    await current.save();
    return res.json(current);
  } catch (error) {
    console.error("updateReport error:", error);
    return res.status(400).json({ error: error.message });
  }
};

exports.deleteReport = async (req, res) => {
  const deleted = await ReportDefinition.findByIdAndDelete(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: "Reporte no encontrado" });
  }
  return res.json({ success: true });
};

exports.runReport = async (req, res) => {
  try {
    const report = await ReportDefinition.findById(req.params.id).lean();
    if (!report) {
      return res.status(404).json({ error: "Reporte no encontrado" });
    }

    const data = await executeReportDefinition(report);
    return res.json(data);
  } catch (error) {
    console.error("runReport error:", error);
    return res.status(error.statusCode || 500).json({ error: error.message });
  }
};
