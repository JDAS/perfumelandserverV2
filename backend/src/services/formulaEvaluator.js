const { parseFormula } = require('./formulaParser');

function toBoolean(value) {
  return Boolean(value);
}

function asNumber(value) {
  const numberValue = Number(value);
  return Number.isNaN(numberValue) ? 0 : numberValue;
}

function formatDateValue(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

const FORMULA_FUNCTIONS = {
  IF: (condition, valueTrue, valueFalse) => (condition ? valueTrue : valueFalse),
  AND: (...args) => args.every(Boolean),
  OR: (...args) => args.some(Boolean),
  NOT: (arg) => !Boolean(arg),
  ISBLANK: (arg) => arg === undefined || arg === null || arg === '',
  ROUND: (value, decimals = 0) => {
    const factor = Math.pow(10, asNumber(decimals));
    return Math.round(asNumber(value) * factor) / factor;
  },
  TEXT: (value) => (value === undefined || value === null ? '' : String(value)),
  VALUE: (value) => {
    const num = Number(value);
    return Number.isNaN(num) ? null : num;
  },
  CONCAT: (...args) => args.map((arg) => (arg === undefined || arg === null ? '' : String(arg))).join(''),
  TODAY: () => formatDateValue(new Date()),
  NOW: () => new Date().toISOString(),
};

function evaluateAst(node, context = {}) {
  if (!node) return null;

  switch (node.type) {
    case 'Literal':
      return node.value;

    case 'Identifier':
      return context[node.name];

    case 'UnaryExpression': {
      const value = evaluateAst(node.argument, context);
      switch (node.operator) {
        case 'NOT':
          return !toBoolean(value);
        case '-':
          return -asNumber(value);
        case '+':
          return asNumber(value);
        default:
          throw new Error(`Operador unario no soportado: ${node.operator}`);
      }
    }

    case 'BinaryExpression': {
      const left = evaluateAst(node.left, context);
      const right = evaluateAst(node.right, context);

      switch (node.operator) {
        case '+':
          if (typeof left === 'string' || typeof right === 'string') {
            return `${left ?? ''}${right ?? ''}`;
          }
          return asNumber(left) + asNumber(right);
        case '-':
          return asNumber(left) - asNumber(right);
        case '*':
          return asNumber(left) * asNumber(right);
        case '/':
          return asNumber(right) === 0 ? null : asNumber(left) / asNumber(right);
        case '>':
          return left > right;
        case '<':
          return left < right;
        case '>=':
          return left >= right;
        case '<=':
          return left <= right;
        case '==':
          return left == right; // intentional to support string/number parity from UI inputs
        case '!=':
          return left != right;
        case 'AND':
          return toBoolean(left) && toBoolean(right);
        case 'OR':
          return toBoolean(left) || toBoolean(right);
        default:
          throw new Error(`Operador no soportado: ${node.operator}`);
      }
    }

    case 'CallExpression': {
      const fn = FORMULA_FUNCTIONS[node.callee];
      if (!fn) {
        throw new Error(`Función no soportada: ${node.callee}`);
      }
      const args = node.arguments.map((arg) => evaluateAst(arg, context));
      return fn(...args);
    }

    default:
      throw new Error(`Nodo AST no soportado: ${node.type}`);
  }
}

function castFormulaResult(value, returnType = 'text') {
  if (value === undefined) return null;

  switch (returnType) {
    case 'number': {
      const num = Number(value);
      return Number.isNaN(num) ? null : num;
    }
    case 'boolean':
      return Boolean(value);
    case 'date':
      return value ? formatDateValue(value) : '';
    case 'text':
    default:
      return value === null ? '' : String(value);
  }
}

function evaluateFormulaExpression(expression, context = {}, options = {}) {
  const ast = parseFormula(expression);
  const rawValue = evaluateAst(ast, context);
  if (options.returnType) {
    return castFormulaResult(rawValue, options.returnType);
  }
  return rawValue;
}

module.exports = {
  FORMULA_FUNCTIONS,
  evaluateAst,
  evaluateFormulaExpression,
  castFormulaResult,
};
