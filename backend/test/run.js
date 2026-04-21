require("./triggerMotor.test");
require("./customRecordQueryService.test");
require("./customRecordService.test");
require("./quoteConversionService.test");
require("./rollupEngine.test");
require("./supplierCatalogService.test");
require("./supplierCatalogSyncService.test");
require("./clientSummaryService.test");

const { run } = require("./helpers/testHarness");

run();
