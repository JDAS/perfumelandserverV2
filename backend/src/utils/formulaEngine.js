function IF(condition, valueTrue, valueFalse) {
  return condition ? valueTrue : valueFalse;
}

function TODAY() {
  return new Date().toISOString().split("T")[0];
}

function NOW() {
  return new Date().toISOString();
}

function evaluateFormula(expression, record) {
  try {
    const fn = new Function(
      "record",
      "IF",
      "TODAY",
      "NOW",
      `
      with (record) {
        return ${expression};
      }
      `
    );

    return fn(record, IF, TODAY, NOW);
  } catch (error) {
    return null;
  }
}

function applyFormulaFields(fields = [], record = {}) {
  const result = { ...record };

  for (const field of fields) {
    if (field.type !== "formula") continue;

    const value = evaluateFormula(field.formula?.expression, result);
    result[field.apiName] = value;
  }

  return result;
}

function removeFormulaFields(fields = [], data = {}) {
  const clean = { ...data };

  for (const field of fields) {
    if (field.type === "formula") {
      delete clean[field.apiName];
    }
  }

  return clean;
}

module.exports = {
  applyFormulaFields,
  removeFormulaFields,
};