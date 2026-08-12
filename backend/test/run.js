require("./triggerMotor.test");
require("./triggerMotorFlows.test");
require("./customRecordQueryService.test");
require("./automationFlowService.test");
require("./automationFlowCrud.test");
require("./customRecordService.test");
require("./quoteConversionService.test");
require("./rollupEngine.test");
require("./supplierCatalogService.test");
require("./supplierCatalogSyncService.test");
require("./clientSummaryService.test");
require("./salePaymentSummaryService.test");
require("./salesPaymentHighlightService.test");
require("./priceReviewReportService.test");
require("./campaignPerformanceService.test");
require("./sellerCampaignPerformanceService.test");
require("./cashProfitabilityReportService.test");
require("./inventoryReconciliationReportService.test");
require("./financialSummaryService.test");
require("./cashAvailableReportService.test");
require("./integrationLabService.test");
require("./campaignSyncService.test");

const { run } = require("./helpers/testHarness");

run();
