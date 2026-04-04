const { parseFormula } = require('./formulaParser');

function collectIdentifiers(node, identifiers = new Set()) {
  if (!node) return identifiers;

  switch (node.type) {
    case 'Identifier':
      identifiers.add(node.name);
      break;
    case 'UnaryExpression':
      collectIdentifiers(node.argument, identifiers);
      break;
    case 'BinaryExpression':
      collectIdentifiers(node.left, identifiers);
      collectIdentifiers(node.right, identifiers);
      break;
    case 'CallExpression':
      for (const arg of node.arguments || []) {
        collectIdentifiers(arg, identifiers);
      }
      break;
    default:
      break;
  }

  return identifiers;
}

function buildFormulaDependencyMap(fields = []) {
  const fieldNames = new Set(fields.map((field) => field.apiName));
  const formulaFields = fields.filter((field) => field.type === 'formula');
  const formulaNames = new Set(formulaFields.map((field) => field.apiName));
  const dependencyMap = new Map();

  for (const field of formulaFields) {
    const ast = parseFormula(field.formula?.expression || '');
    const refs = Array.from(collectIdentifiers(ast)).filter((name) => fieldNames.has(name));
    dependencyMap.set(field.apiName, {
      apiName: field.apiName,
      ast,
      references: refs,
      formulaDependencies: refs.filter((name) => formulaNames.has(name)),
      rawDependencies: refs.filter((name) => !formulaNames.has(name)),
    });
  }

  return dependencyMap;
}

function topologicalSortFormulaFields(fields = []) {
  const dependencyMap = buildFormulaDependencyMap(fields);
  const temp = new Set();
  const perm = new Set();
  const order = [];
  const path = [];

  function visit(nodeName) {
    if (perm.has(nodeName)) return;
    if (temp.has(nodeName)) {
      const cycleStart = path.indexOf(nodeName);
      const cycle = [...path.slice(cycleStart), nodeName];
      throw new Error(`Dependencia circular en fórmulas: ${cycle.join(' -> ')}`);
    }

    temp.add(nodeName);
    path.push(nodeName);
    const node = dependencyMap.get(nodeName);
    for (const dependency of node?.formulaDependencies || []) {
      visit(dependency);
    }
    path.pop();
    temp.delete(nodeName);
    perm.add(nodeName);
    if (node) order.push(node);
  }

  for (const key of dependencyMap.keys()) {
    visit(key);
  }

  return order;
}

module.exports = {
  collectIdentifiers,
  buildFormulaDependencyMap,
  topologicalSortFormulaFields,
};
