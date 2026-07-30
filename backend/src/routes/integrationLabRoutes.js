const express = require("express");
const {
  authenticate,
  exercise,
  health,
  issueToken,
  listAttempts,
  listScenarios,
  requireAdminKey,
  requireEnabled,
  resetScenario,
  upsertScenario,
} = require("../controllers/integrationLabController");

const router = express.Router();

router.use(requireEnabled);
router.get("/health", health);
router.post("/oauth/token", express.urlencoded({ extended: false }), issueToken);

router.get("/scenarios", requireAdminKey, listScenarios);
router.put("/scenarios/:key", requireAdminKey, upsertScenario);
router.post("/scenarios/:key/reset", requireAdminKey, resetScenario);
router.get("/scenarios/:key/attempts", requireAdminKey, listAttempts);

router.all("/auth/:mode/exercise/:key", authenticate, exercise);

module.exports = router;
