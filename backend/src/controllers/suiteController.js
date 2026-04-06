const {
  listSuites,
  installSuite,
} = require("../services/suiteInstallerService");

exports.getSuites = async (_req, res) => {
  try {
    res.json(listSuites());
  } catch (error) {
    console.error("getSuites error:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.installSuite = async (req, res) => {
  try {
    const result = await installSuite(req.params.suiteId);
    res.json(result);
  } catch (error) {
    console.error("installSuite error:", error);
    res.status(error.statusCode || 500).json({ error: error.message });
  }
};
