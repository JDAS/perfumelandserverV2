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

const { run } = require("./helpers/testHarness");

run();
