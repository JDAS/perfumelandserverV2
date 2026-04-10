const CustomObject = require("../models/CustomObject");
const { getCustomRecordModel } = require("../models/CustomRecord");
const { applyFormulaFields } = require("../utils/formulaEngine");
const { resolveLookupData } = require("./customRecordService");

function buildFilterCondition(filter) {
  const { field, operator, value } = filter || {};
  if (!field) return null;

  switch (operator) {
    case "eq":
      return { [field]: value };
    case "ne":
      return { [field]: { $ne: value } };
    case "gt":
      return { [field]: { $gt: value } };
    case "gte":
      return { [field]: { $gte: value } };
    case "lt":
      return { [field]: { $lt: value } };
    case "lte":
      return { [field]: { $lte: value } };
    case "contains":
      return { [field]: { $regex: String(value || ""), $options: "i" } };
    case "in":
      return {
        [field]: {
          $in: Array.isArray(value)
            ? value
            : String(value || "")
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean),
        },
      };
    case "isEmpty":
      return {
        $or: [
          { [field]: { $exists: false } },
          { [field]: null },
          { [field]: "" },
        ],
      };
    case "notEmpty":
      return {
        $and: [
          { [field]: { $exists: true } },
          { [field]: { $ne: null } },
          { [field]: { $ne: "" } },
        ],
      };
    default:
      return null;
  }
}

function buildMongoQuery(filters = []) {
  const conditions = filters.map(buildFilterCondition).filter(Boolean);
  if (!conditions.length) return {};
  return { $and: conditions };
}

function getFieldDefinition(objectDefinition, fieldName) {
  return (objectDefinition.fields || []).find((field) => field.apiName === fieldName) || null;
}

function getValueAtPath(record, fieldName) {
  if (fieldName === "*") return 1;
  return record?.[fieldName];
}

function coerceNumeric(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function normalizeDateGroupValue(value, dateGroup = "none") {
  if (!value || dateGroup === "none") return value ?? "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  if (dateGroup === "year") return `${year}`;
  if (dateGroup === "month") return `${year}-${month}`;
  return `${year}-${month}-${day}`;
}

function resolveGroupDisplayValue(record, fieldDefinition, rawValue) {
  if (fieldDefinition?.type === "lookup") {
    return record?._lookup?.[fieldDefinition.apiName]?.label || rawValue || "Sin valor";
  }

  return rawValue ?? "Sin valor";
}

function buildGroupRowKey(groupValues) {
  return groupValues.map((item) => String(item)).join("||");
}

function finalizeMetricValue(metric, accumulator) {
  const operation = metric.operation;

  if (operation === "avg") {
    const sum = accumulator.__avgSums?.[metric.id] || 0;
    const count = accumulator.__avgCounts?.[metric.id] || 0;
    return count > 0 ? Number((sum / count).toFixed(2)) : 0;
  }

  if (operation === "count") {
    return accumulator[metric.id] || 0;
  }

  return accumulator[metric.id] ?? 0;
}

function applyMetricToAccumulator(accumulator, metric, record) {
  const value = getValueAtPath(record, metric.field);

  switch (metric.operation) {
    case "count":
      accumulator[metric.id] = (accumulator[metric.id] || 0) + 1;
      break;
    case "sum":
      accumulator[metric.id] = (accumulator[metric.id] || 0) + coerceNumeric(value);
      break;
    case "avg":
      accumulator.__avgSums = accumulator.__avgSums || {};
      accumulator.__avgCounts = accumulator.__avgCounts || {};
      accumulator.__avgSums[metric.id] =
        (accumulator.__avgSums[metric.id] || 0) + coerceNumeric(value);
      accumulator.__avgCounts[metric.id] = (accumulator.__avgCounts[metric.id] || 0) + 1;
      accumulator[metric.id] = 0;
      break;
    case "min": {
      const numeric = coerceNumeric(value);
      accumulator[metric.id] =
        accumulator[metric.id] === undefined
          ? numeric
          : Math.min(accumulator[metric.id], numeric);
      break;
    }
    case "max": {
      const numeric = coerceNumeric(value);
      accumulator[metric.id] =
        accumulator[metric.id] === undefined
          ? numeric
          : Math.max(accumulator[metric.id], numeric);
      break;
    }
    default:
      break;
  }
}

function sortRows(rows, sortDefinitions = []) {
  if (!sortDefinitions.length) return rows;

  return [...rows].sort((left, right) => {
    for (const sortDef of sortDefinitions) {
      const direction = sortDef.direction === "asc" ? 1 : -1;
      const leftValue = left?.[sortDef.field];
      const rightValue = right?.[sortDef.field];

      if (leftValue === rightValue) continue;
      if (leftValue === undefined || leftValue === null) return 1;
      if (rightValue === undefined || rightValue === null) return -1;

      if (typeof leftValue === "number" && typeof rightValue === "number") {
        return (leftValue - rightValue) * direction;
      }

      return String(leftValue).localeCompare(String(rightValue), "es") * direction;
    }

    return 0;
  });
}

async function loadSourceRecords(reportDefinition) {
  const objectDefinition = await CustomObject.findOne({
    apiName: reportDefinition.sourceObject,
  }).lean();

  if (!objectDefinition) {
    const error = new Error(`Objeto fuente no encontrado: ${reportDefinition.sourceObject}`);
    error.statusCode = 404;
    throw error;
  }

  const RecordModel = getCustomRecordModel(reportDefinition.sourceObject);
  const query = buildMongoQuery(reportDefinition.filters || []);
  const rawRecords = await RecordModel.find(query).lean();
  const lookupResolved = await resolveLookupData(rawRecords, objectDefinition);
  const records = lookupResolved.map((record) =>
    applyFormulaFields(objectDefinition.fields, record)
  );

  return {
    objectDefinition,
    records,
  };
}

function buildReportColumns(reportDefinition, objectDefinition) {
  const groupColumns = (reportDefinition.groupBy || []).map((group) => ({
    id: group.field,
    label: group.label || getFieldDefinition(objectDefinition, group.field)?.label || group.field,
    type: "group",
  }));

  const metricColumns = (reportDefinition.metrics || []).map((metric) => ({
    id: metric.id,
    label: metric.label,
    type: "metric",
    format: metric.format || "number",
  }));

  if (groupColumns.length || metricColumns.length) {
    return [...groupColumns, ...metricColumns];
  }

  const selectedColumns = reportDefinition.columns?.length
    ? reportDefinition.columns
    : (objectDefinition.fields || []).slice(0, 6).map((field) => field.apiName);

  return selectedColumns.map((column) => {
    const fieldDef = getFieldDefinition(objectDefinition, column);
    return {
      id: column,
      label: fieldDef?.label || column,
      type: fieldDef?.type || "text",
    };
  });
}

function buildUngroupedRows(reportDefinition, objectDefinition, records) {
  const columns = buildReportColumns(reportDefinition, objectDefinition);

  if ((reportDefinition.metrics || []).length > 0) {
    const accumulator = {};
    for (const record of records) {
      for (const metric of reportDefinition.metrics) {
        applyMetricToAccumulator(accumulator, metric, record);
      }
    }

    const summaryRow = {};
    for (const metric of reportDefinition.metrics) {
      summaryRow[metric.id] = finalizeMetricValue(metric, accumulator);
    }

    return {
      columns,
      rows: [summaryRow],
      summary: summaryRow,
    };
  }

  const rows = records.map((record) => {
    const row = {};
    for (const column of columns) {
      row[column.id] = record[column.id];
      if (record?._lookup?.[column.id]?.label) {
        row[`${column.id}__label`] = record._lookup[column.id].label;
      }
    }
    return row;
  });

  return {
    columns,
    rows: sortRows(rows, reportDefinition.sort || []),
    summary: {},
  };
}

function buildGroupedRows(reportDefinition, objectDefinition, records) {
  const groupBy = reportDefinition.groupBy || [];
  const metrics = reportDefinition.metrics || [];
  const groups = new Map();

  for (const record of records) {
    const groupValues = groupBy.map((group) => {
      const fieldDef = getFieldDefinition(objectDefinition, group.field);
      const rawValue = normalizeDateGroupValue(
        getValueAtPath(record, group.field),
        group.dateGroup || "none"
      );

      return {
        field: group.field,
        rawValue,
        displayValue: resolveGroupDisplayValue(record, fieldDef, rawValue),
      };
    });

    const key = buildGroupRowKey(groupValues.map((item) => item.rawValue));
    if (!groups.has(key)) {
      const base = {};
      for (const item of groupValues) {
        base[item.field] = item.rawValue;
        base[`${item.field}__label`] = item.displayValue;
      }
      groups.set(key, base);
    }

    const accumulator = groups.get(key);
    for (const metric of metrics) {
      applyMetricToAccumulator(accumulator, metric, record);
    }
  }

  const rows = [...groups.values()].map((row) => {
    const nextRow = { ...row };
    for (const metric of metrics) {
      nextRow[metric.id] = finalizeMetricValue(metric, row);
    }
    delete nextRow.__avgSums;
    delete nextRow.__avgCounts;
    return nextRow;
  });

  const summary = {};
  for (const metric of metrics) {
    if (metric.operation === "count" || metric.operation === "sum") {
      summary[metric.id] = rows.reduce(
        (total, row) => total + coerceNumeric(row[metric.id]),
        0
      );
    }
  }

  return {
    columns: buildReportColumns(reportDefinition, objectDefinition),
    rows: sortRows(rows, reportDefinition.sort || []),
    summary,
  };
}

async function executeReportDefinition(reportDefinition) {
  const { objectDefinition, records } = await loadSourceRecords(reportDefinition);

  const result =
    (reportDefinition.groupBy || []).length > 0
      ? buildGroupedRows(reportDefinition, objectDefinition, records)
      : buildUngroupedRows(reportDefinition, objectDefinition, records);

  return {
    report: {
      _id: reportDefinition._id,
      name: reportDefinition.name,
      apiName: reportDefinition.apiName,
      sourceObject: reportDefinition.sourceObject,
    },
    sourceObject: reportDefinition.sourceObject,
    sourceObjectLabel: objectDefinition.name,
    totalSourceRecords: records.length,
    columns: result.columns,
    rows: result.rows,
    summary: result.summary,
  };
}

module.exports = {
  executeReportDefinition,
};
