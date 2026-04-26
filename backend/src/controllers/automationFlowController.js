const {
  listFlows,
  getFlowById,
  createFlow,
  updateFlow,
  deleteFlow,
} = require("../services/automationFlowService");

exports.listAutomationFlows = async (req, res) => {
  const flows = await listFlows({
    objectApiName: req.query.objectApiName,
    when: req.query.when,
    isActive:
      req.query.isActive === "true"
        ? true
        : req.query.isActive === "false"
          ? false
          : undefined,
  });

  return res.json(flows);
};

exports.getAutomationFlowById = async (req, res) => {
  const flow = await getFlowById(req.params.id);
  return res.json(flow);
};

exports.createAutomationFlow = async (req, res) => {
  const flow = await createFlow(req.body || {});
  return res.status(201).json(flow);
};

exports.updateAutomationFlow = async (req, res) => {
  const flow = await updateFlow(req.params.id, req.body || {});
  return res.json(flow);
};

exports.deleteAutomationFlow = async (req, res) => {
  const result = await deleteFlow(req.params.id);
  return res.json(result);
};
