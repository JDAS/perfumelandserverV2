const { parseFormula } = require('./formulaParser');
const { collectIdentifiers, topologicalSortFormulaFields } = require('./dependencyService');
const { FORMULA_FUNCTIONS } = require('./formulaEvaluator');

function validateFormulaField(field, fields = []) {
  const errors = [];
  const fieldNames = new Set(fields.map((item) => item.apiName));
  const currentFieldName = field?.apiName;

  try {
    const ast = parseFormula(field?.formula?.expression || '');
    const identifiers = Array.from(collectIdentifiers(ast));

    for (const identifier of identifiers) {
      if (!fieldNames.has(identifier)) {
        errors.push(`La fórmula ${currentFieldName} referencia el campo inexistente ${identifier}`);
      }
      if (identifier === currentFieldName) {
        errors.push(`La fórmula ${currentFieldName} no puede referenciarse a sí misma`);
      }
    }

    validateFunctionCalls(ast, currentFieldName, errors);
  } catch (error) {
    errors.push(`La fórmula ${currentFieldName} es inválida: ${error.message}`);
  }

  return errors;
}

function validateFunctionCalls(node, fieldApiName, errors) {
  if (!node) return;

  if (node.type === 'CallExpression') {
    const fnName = node.callee;
    if (!FORMULA_FUNCTIONS[fnName]) {
      errors.push(`La fórmula ${fieldApiName} usa la función no soportada ${fnName}`);
    }
  }

  switch (node.type) {
    case 'UnaryExpression':
      validateFunctionCalls(node.argument, fieldApiName, errors);
      break;
    case 'BinaryExpression':
      validateFunctionCalls(node.left, fieldApiName, errors);
      validateFunctionCalls(node.right, fieldApiName, errors);
      break;
    case 'CallExpression':
      for (const arg of node.arguments || []) {
        validateFunctionCalls(arg, fieldApiName, errors);
      }
      break;
    default:
      break;
  }
}

function validateAllFormulaFields(fields = []) {
  const errors = [];
  const formulaFields = fields.filter((field) => field.type === 'formula');

  for (const field of formulaFields) {
    errors.push(...validateFormulaField(field, fields));
  }

  if (errors.length === 0) {
    try {
      topologicalSortFormulaFields(fields);
    } catch (error) {
      errors.push(error.message);
    }
  }

  return errors;
}

module.exports = {
  validateFormulaField,
  validateAllFormulaFields,
};
