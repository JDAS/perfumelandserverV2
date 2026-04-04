const { evaluateAst, castFormulaResult } = require('./formulaEvaluator');
const { topologicalSortFormulaFields } = require('./dependencyService');

function applyFormulaFields(fields = [], record = {}) {
  const result = { ...record };
  const orderedFormulaFields = topologicalSortFormulaFields(fields);

  for (const formulaNode of orderedFormulaFields) {
    const field = fields.find((item) => item.apiName === formulaNode.apiName);
    if (!field) continue;
    try {
      const value = evaluateAst(formulaNode.ast, result);
      result[field.apiName] = castFormulaResult(value, field.formula?.returnType || 'text');
    } catch (_error) {
      result[field.apiName] = null;
    }
  }

  return result;
}

function removeFormulaFields(fields = [], data = {}) {
  const clean = { ...data };
  for (const field of fields) {
    if (field.type === 'formula') {
      delete clean[field.apiName];
    }
  }
  return clean;
}

module.exports = {
  applyFormulaFields,
  removeFormulaFields,
};
