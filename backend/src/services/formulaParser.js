const KEYWORDS = new Set(['AND', 'OR', 'NOT', 'TRUE', 'FALSE', 'NULL']);

function tokenize(input = '') {
  const tokens = [];
  let i = 0;

  while (i < input.length) {
    const ch = input[i];

    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }

    if (ch === '"' || ch === "'") {
      const quote = ch;
      i += 1;
      let value = '';

      while (i < input.length) {
        const current = input[i];
        if (current === '\\') {
          const next = input[i + 1];
          if (next === undefined) break;
          value += next;
          i += 2;
          continue;
        }
        if (current === quote) {
          i += 1;
          break;
        }
        value += current;
        i += 1;
      }

      tokens.push({ type: 'string', value });
      continue;
    }

    if (/\d/.test(ch) || (ch === '.' && /\d/.test(input[i + 1] || ''))) {
      let value = ch;
      i += 1;
      while (i < input.length && /[\d.]/.test(input[i])) {
        value += input[i];
        i += 1;
      }
      if ((value.match(/\./g) || []).length > 1) {
        throw new Error(`Número inválido: ${value}`);
      }
      tokens.push({ type: 'number', value: Number(value) });
      continue;
    }

    const twoChar = input.slice(i, i + 2);
    const threeChar = input.slice(i, i + 3).toUpperCase();

    if (['>=', '<=', '!=', '==', '&&', '||'].includes(twoChar)) {
      tokens.push({ type: 'operator', value: twoChar });
      i += 2;
      continue;
    }

    if (['(', ')', ','].includes(ch)) {
      tokens.push({ type: ch });
      i += 1;
      continue;
    }

    if (['+', '-', '*', '/', '>', '<', '='].includes(ch)) {
      tokens.push({ type: 'operator', value: ch });
      i += 1;
      continue;
    }

    if (/[_A-Za-z]/.test(ch)) {
      let value = ch;
      i += 1;
      while (i < input.length && /[_A-Za-z0-9.]/.test(input[i])) {
        value += input[i];
        i += 1;
      }
      const upper = value.toUpperCase();
      if (KEYWORDS.has(upper)) {
        tokens.push({ type: 'keyword', value: upper });
      } else {
        tokens.push({ type: 'identifier', value });
      }
      continue;
    }

    throw new Error(`Carácter no soportado en fórmula: ${ch}`);
  }

  return tokens;
}

class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.position = 0;
  }

  current() {
    return this.tokens[this.position] || null;
  }

  match(type, value = undefined) {
    const token = this.current();
    if (!token || token.type !== type) return false;
    if (value !== undefined && token.value !== value) return false;
    this.position += 1;
    return token;
  }

  expect(type, value = undefined, message = 'Fórmula inválida') {
    const token = this.match(type, value);
    if (!token) {
      throw new Error(message);
    }
    return token;
  }

  parse() {
    const expression = this.parseOrExpression();
    if (this.current()) {
      throw new Error(`Token inesperado: ${this.current().value || this.current().type}`);
    }
    return expression;
  }

  parseOrExpression() {
    let node = this.parseAndExpression();
    while (true) {
      if (this.match('keyword', 'OR') || this.match('operator', '||')) {
        node = { type: 'BinaryExpression', operator: 'OR', left: node, right: this.parseAndExpression() };
        continue;
      }
      break;
    }
    return node;
  }

  parseAndExpression() {
    let node = this.parseEqualityExpression();
    while (true) {
      if (this.match('keyword', 'AND') || this.match('operator', '&&')) {
        node = { type: 'BinaryExpression', operator: 'AND', left: node, right: this.parseEqualityExpression() };
        continue;
      }
      break;
    }
    return node;
  }

  parseEqualityExpression() {
    let node = this.parseComparisonExpression();
    while (true) {
      if (this.match('operator', '==') || this.match('operator', '=')) {
        node = { type: 'BinaryExpression', operator: '==', left: node, right: this.parseComparisonExpression() };
        continue;
      }
      if (this.match('operator', '!=')) {
        node = { type: 'BinaryExpression', operator: '!=', left: node, right: this.parseComparisonExpression() };
        continue;
      }
      break;
    }
    return node;
  }

  parseComparisonExpression() {
    let node = this.parseTermExpression();
    while (true) {
      const token = this.current();
      if (token?.type === 'operator' && ['>', '<', '>=', '<='].includes(token.value)) {
        this.position += 1;
        node = { type: 'BinaryExpression', operator: token.value, left: node, right: this.parseTermExpression() };
        continue;
      }
      break;
    }
    return node;
  }

  parseTermExpression() {
    let node = this.parseFactorExpression();
    while (true) {
      const token = this.current();
      if (token?.type === 'operator' && ['+', '-'].includes(token.value)) {
        this.position += 1;
        node = { type: 'BinaryExpression', operator: token.value, left: node, right: this.parseFactorExpression() };
        continue;
      }
      break;
    }
    return node;
  }

  parseFactorExpression() {
    let node = this.parseUnaryExpression();
    while (true) {
      const token = this.current();
      if (token?.type === 'operator' && ['*', '/'].includes(token.value)) {
        this.position += 1;
        node = { type: 'BinaryExpression', operator: token.value, left: node, right: this.parseUnaryExpression() };
        continue;
      }
      break;
    }
    return node;
  }

  parseUnaryExpression() {
    if (this.match('keyword', 'NOT')) {
      return { type: 'UnaryExpression', operator: 'NOT', argument: this.parseUnaryExpression() };
    }
    if (this.match('operator', '-')) {
      return { type: 'UnaryExpression', operator: '-', argument: this.parseUnaryExpression() };
    }
    if (this.match('operator', '+')) {
      return { type: 'UnaryExpression', operator: '+', argument: this.parseUnaryExpression() };
    }
    return this.parsePrimaryExpression();
  }

  parsePrimaryExpression() {
    const current = this.current();
    if (!current) {
      throw new Error('Expresión incompleta');
    }

    if (this.match('(')) {
      const expression = this.parseOrExpression();
      this.expect(')', undefined, 'Falta cerrar paréntesis');
      return expression;
    }

    if (current.type === 'number') {
      this.position += 1;
      return { type: 'Literal', value: current.value };
    }

    if (current.type === 'string') {
      this.position += 1;
      return { type: 'Literal', value: current.value };
    }

    if (current.type === 'keyword' && ['TRUE', 'FALSE', 'NULL'].includes(current.value)) {
      this.position += 1;
      const map = { TRUE: true, FALSE: false, NULL: null };
      return { type: 'Literal', value: map[current.value] };
    }

    if (current.type === 'identifier') {
      this.position += 1;
      const identifier = current.value;
      if (this.match('(')) {
        const args = [];
        if (!this.match(')')) {
          do {
            args.push(this.parseOrExpression());
          } while (this.match(','));
          this.expect(')', undefined, 'Falta cerrar la llamada de función');
        }
        return {
          type: 'CallExpression',
          callee: identifier.toUpperCase(),
          arguments: args,
        };
      }
      return { type: 'Identifier', name: identifier };
    }

    throw new Error(`Token no soportado: ${current.value || current.type}`);
  }
}

function parseFormula(expression = '') {
  if (!String(expression).trim()) {
    throw new Error('La fórmula está vacía');
  }
  const parser = new Parser(tokenize(expression));
  return parser.parse();
}

module.exports = {
  tokenize,
  parseFormula,
};
