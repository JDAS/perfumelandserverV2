const ReportDefinition = require("../models/ReportDefinition");
const { executeReportDefinition } = require("../services/reportEngine");
const { executeFinancialSummaryReport } = require("../services/financialSummaryService");
const { executeSellerYearPerformanceReport } = require("../services/sellerYearPerformanceService");
const { executePaymentsByDayReport } = require("../services/paymentsByDayReportService");
const { executePriceReviewReport } = require("../services/priceReviewReportService");
const { executeUpcomingPaymentsReport } = require("../services/upcomingPaymentsReportService");
const { executeStreetInvestmentReport } = require("../services/streetInvestmentReportService");
const { executeCampaignPerformanceReport } = require("../services/campaignPerformanceService");
const { createHttpError } = require("../utils/httpError");

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
    throw createHttpError(404, "Reporte no encontrado");
  }
  return res.json(report);
};

exports.createReport = async (req, res) => {
  const payload = {
    ...req.body,
    apiName: normalizeApiName(req.body.apiName || req.body.name),
    createdBy: req.user?._id || null,
    updatedBy: req.user?._id || null,
  };

  const report = await ReportDefinition.create(payload);
  return res.status(201).json(report);
};

exports.updateReport = async (req, res) => {
  const current = await ReportDefinition.findById(req.params.id);
  if (!current) {
    throw createHttpError(404, "Reporte no encontrado");
  }

  current.set({
    ...req.body,
    apiName: normalizeApiName(req.body.apiName || current.apiName || req.body.name),
    updatedBy: req.user?._id || null,
  });

  await current.save();
  return res.json(current);
};

exports.deleteReport = async (req, res) => {
  const deleted = await ReportDefinition.findByIdAndDelete(req.params.id);
  if (!deleted) {
    throw createHttpError(404, "Reporte no encontrado");
  }
  return res.json({ success: true });
};

exports.runReport = async (req, res) => {
  const report = await ReportDefinition.findById(req.params.id).lean();
  if (!report) {
    throw createHttpError(404, "Reporte no encontrado");
  }

  let data;
  if (report.engine === "financial_summary") {
    data = await executeFinancialSummaryReport(report, req.query || {});
  } else if (report.engine === "seller_year_performance") {
    data = await executeSellerYearPerformanceReport(report, req.query || {});
  } else if (report.engine === "payments_by_day") {
    data = await executePaymentsByDayReport(report, req.query || {});
  } else if (report.engine === "price_review") {
    data = await executePriceReviewReport(report, req.query || {});
  } else if (report.engine === "upcoming_payments") {
    data = await executeUpcomingPaymentsReport(report, req.query || {});
  } else if (report.engine === "street_investment") {
    data = await executeStreetInvestmentReport(report, req.query || {});
  } else if (report.engine === "campaign_performance") {
    data = await executeCampaignPerformanceReport(report, req.query || {});
  } else {
    data = await executeReportDefinition(report);
  }

  return res.json(data);
};
