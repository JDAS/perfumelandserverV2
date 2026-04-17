const DashboardDefinition = require("../models/DashboardDefinition");
const ReportDefinition = require("../models/ReportDefinition");
const { createHttpError } = require("../utils/httpError");

function normalizeApiName(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

async function enrichDashboard(dashboard) {
  const reportIds = (dashboard.widgets || [])
    .map((widget) => widget.reportId)
    .filter(Boolean);

  const reports = await ReportDefinition.find({ _id: { $in: reportIds } }).lean();
  const reportMap = new Map(reports.map((report) => [String(report._id), report]));

  return {
    ...dashboard,
    widgets: (dashboard.widgets || []).map((widget) => ({
      ...widget,
      report: reportMap.get(String(widget.reportId)) || null,
    })),
  };
}

exports.listDashboards = async (req, res) => {
  const dashboards = await DashboardDefinition.find()
    .sort({ createdAt: -1, _id: -1 })
    .lean();

  const enriched = await Promise.all(dashboards.map(enrichDashboard));
  return res.json(enriched);
};

exports.getDashboardById = async (req, res) => {
  const dashboard = await DashboardDefinition.findById(req.params.id).lean();
  if (!dashboard) {
    throw createHttpError(404, "Dashboard no encontrado");
  }

  return res.json(await enrichDashboard(dashboard));
};

exports.createDashboard = async (req, res) => {
  const payload = {
    ...req.body,
    apiName: normalizeApiName(req.body.apiName || req.body.name),
    createdBy: req.user?._id || null,
    updatedBy: req.user?._id || null,
  };

  const dashboard = await DashboardDefinition.create(payload);
  return res.status(201).json(await enrichDashboard(dashboard.toObject()));
};

exports.updateDashboard = async (req, res) => {
  const current = await DashboardDefinition.findById(req.params.id);
  if (!current) {
    throw createHttpError(404, "Dashboard no encontrado");
  }

  current.set({
    ...req.body,
    apiName: normalizeApiName(req.body.apiName || current.apiName || req.body.name),
    updatedBy: req.user?._id || null,
  });

  await current.save();
  return res.json(await enrichDashboard(current.toObject()));
};

exports.deleteDashboard = async (req, res) => {
  const deleted = await DashboardDefinition.findByIdAndDelete(req.params.id);
  if (!deleted) {
    throw createHttpError(404, "Dashboard no encontrado");
  }
  return res.json({ success: true });
};
