const {
  listSuites,
  installSuite,
} = require("../services/suiteInstallerService");

exports.getSuites = async (_req, res) => {
  res.json(listSuites());
};

exports.installSuite = async (req, res) => {
  const result = await installSuite(req.params.suiteId);
  res.json(result);
};
