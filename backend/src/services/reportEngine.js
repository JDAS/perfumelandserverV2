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

function isEmptyValue(value) {
  return (
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}

function matchesFilter(record, filter) {
  const { field, operator, value } = filter || {};
  if (!field) return true;

  const currentValue = getValueAtPath(record, field);

  switch (operator) {
    case "eq":
      return currentValue === value;
    case "ne":
      return currentValue !== value;
    case "gt":
      return currentValue > value;
    case "gte":
      return currentValue >= value;
    case "lt":
      return currentValue < value;
    case "lte":
      return currentValue <= value;
    case "contains":
      return String(currentValue || "")
        .toLowerCase()
        .includes(String(value || "").toLowerCase());
    case "in": {
      const values = Array.isArray(value)
        ? value
        : String(value || "")
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean);
      return values.includes(currentValue);
    }
    case "isEmpty":
      return isEmptyValue(currentValue);
    case "notEmpty":
      return !isEmptyValue(currentValue);
    default:
      return true;
  }
}

function applyPostFilters(records = [], filters = []) {
  if (!filters.length) return records;
  return records.filter((record) => filters.every((filter) => matchesFilter(record, filter)));
}

function getFieldDefinition(objectDefinition, fieldName) {
  return (objectDefinition.fields || []).find((field) => field.apiName === fieldName) || null;
}

function getDefaultColumns(objectDefinition) {
  return (objectDefinition.fields || []).slice(0, 6).map((field) => field.apiName);
}

function getSelectedColumns(reportDefinition, objectDefinition) {
  return reportDefinition.columns?.length
    ? reportDefinition.columns
    : getDefaultColumns(objectDefinition);
}

function splitReportFilters(reportDefinition, objectDefinition) {
  const mongoFilters = [];
  const postFilters = [];

  for (const filter of reportDefinition.filters || []) {
    const fieldDefinition = getFieldDefinition(objectDefinition, filter.field);
    if (fieldDefinition?.type === "formula") {
      postFilters.push(filter);
      continue;
    }

    mongoFilters.push(filter);
  }

  return { mongoFilters, postFilters };
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

function analyzeReportDefinition(reportDefinition, objectDefinition) {
  const selectedColumns = getSelectedColumns(reportDefinition, objectDefinition);
  const groupBy = reportDefinition.groupBy || [];
  const metrics = reportDefinition.metrics || [];
  const filterFields = (reportDefinition.filters || [])
    .map((filter) => filter.field)
    .filter(Boolean);
  const outputFields = new Set(
    groupBy.length > 0 || metrics.length > 0 ? [] : selectedColumns
  );
  const requiredFields = new Set(filterFields);

  groupBy.forEach((group) => outputFields.add(group.field));
  metrics
    .map((metric) => metric.field)
    .filter((field) => field && field !== "*")
    .forEach((field) => outputFields.add(field));
  outputFields.forEach((field) => requiredFields.add(field));

  const formulaFields = [...requiredFields].filter(
    (field) => getFieldDefinition(objectDefinition, field)?.type === "formula"
  );

  const lookupFields = [...requiredFields].filter(
    (field) => getFieldDefinition(objectDefinition, field)?.type === "lookup"
  );

  return {
    selectedColumns,
    outputFields: [...outputFields].filter(Boolean),
    requiredFields: [...requiredFields].filter(Boolean),
    needsFormulaResolution: formulaFields.length > 0,
    needsLookupResolution: lookupFields.length > 0,
    canUseMongoAggregation:
      formulaFields.length === 0 &&
      (groupBy.length > 0 || metrics.length > 0),
    canUseProjectedFind: formulaFields.length === 0,
  };
}

function buildProjection(fields = []) {
  if (!fields.length) return null;

  return fields.reduce((projection, field) => {
    projection[field] = 1;
    return projection;
  }, { _id: 1 });
}

async function loadSourceRecords(reportDefinition, objectDefinition, query, analysis) {
  const RecordModel = getCustomRecordModel(reportDefinition.sourceObject);
  const projection = analysis.canUseProjectedFind
    ? buildProjection(analysis.requiredFields)
    : null;

  const rawRecords = await RecordModel.find(query, projection).lean();

  let records = rawRecords;

  if (analysis.needsLookupResolution) {
    records = await resolveLookupData(records, objectDefinition);
  }

  if (analysis.needsFormulaResolution) {
    records = records.map((record) => applyFormulaFields(objectDefinition.fields, record));
  }

  return {
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

  const selectedColumns = getSelectedColumns(reportDefinition, objectDefinition);

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

function buildNumericExpression(field) {
  if (field === "*") return 1;
  if (!field) return 0;

  return {
    $convert: {
      input: `$${field}`,
      to: "double",
      onError: 0,
      onNull: 0,
    },
  };
}

function buildDateGroupingExpression(field, dateGroup) {
  if (dateGroup === "none") {
    return { $ifNull: [`$${field}`, ""] };
  }

  const format =
    dateGroup === "year"
      ? "%Y"
      : dateGroup === "month"
        ? "%Y-%m"
        : "%Y-%m-%d";

  return {
    $let: {
      vars: {
        normalizedDate: {
          $convert: {
            input: `$${field}`,
            to: "date",
            onError: null,
            onNull: null,
          },
        },
      },
      in: {
        $ifNull: [
          {
            $dateToString: {
              format,
              date: "$$normalizedDate",
              timezone: "UTC",
            },
          },
          { $ifNull: [`$${field}`, ""] },
        ],
      },
    },
  };
}

function buildMetricAccumulator(metric) {
  switch (metric.operation) {
    case "count":
      return { $sum: 1 };
    case "sum":
      return { $sum: buildNumericExpression(metric.field) };
    case "avg":
      return { $avg: buildNumericExpression(metric.field) };
    case "min":
      return { $min: buildNumericExpression(metric.field) };
    case "max":
      return { $max: buildNumericExpression(metric.field) };
    default:
      return { $sum: 0 };
  }
}

function buildMetricProjection(metric) {
  if (metric.operation === "avg") {
    return {
      $round: [{ $ifNull: [`$${metric.id}`, 0] }, 2],
    };
  }

  return {
    $ifNull: [`$${metric.id}`, 0],
  };
}

function buildRowsSummary(metrics, rows) {
  const summary = {};

  for (const metric of metrics) {
    if (metric.operation === "count" || metric.operation === "sum") {
      summary[metric.id] = rows.reduce(
        (total, row) => total + coerceNumeric(row[metric.id]),
        0
      );
    }
  }

  return summary;
}

async function applyGroupedLookupLabels(rows, reportDefinition, objectDefinition, analysis) {
  if (!rows.length) return rows;
  if (!analysis.needsLookupResolution) {
    return rows.map((row) => {
      const nextRow = { ...row };
      for (const group of reportDefinition.groupBy || []) {
        nextRow[`${group.field}__label`] = row[group.field];
      }
      return nextRow;
    });
  }

  const lookupResolved = await resolveLookupData(rows, objectDefinition);

  return lookupResolved.map((row) => {
    const nextRow = { ...row };

    for (const group of reportDefinition.groupBy || []) {
      const fieldDef = getFieldDefinition(objectDefinition, group.field);
      nextRow[`${group.field}__label`] = resolveGroupDisplayValue(
        row,
        fieldDef,
        row[group.field]
      );
    }

    delete nextRow._lookup;
    return nextRow;
  });
}

async function executeMongoAggregatedReport(
  reportDefinition,
  objectDefinition,
  query,
  analysis
) {
  const RecordModel = getCustomRecordModel(reportDefinition.sourceObject);
  const groupBy = reportDefinition.groupBy || [];
  const metrics = reportDefinition.metrics || [];
  const pipeline = [{ $match: query }];

  if (groupBy.length > 0) {
    const groupStage = { _id: {} };
    for (const group of groupBy) {
      groupStage._id[group.field] = buildDateGroupingExpression(
        group.field,
        group.dateGroup || "none"
      );
    }

    for (const metric of metrics) {
      groupStage[metric.id] = buildMetricAccumulator(metric);
    }

    const projectStage = { _id: 0 };
    for (const group of groupBy) {
      projectStage[group.field] = `$_id.${group.field}`;
    }
    for (const metric of metrics) {
      projectStage[metric.id] = buildMetricProjection(metric);
    }

    pipeline.push({ $group: groupStage }, { $project: projectStage });

    const rawRows = await RecordModel.aggregate(pipeline).allowDiskUse(true);
    const rows = await applyGroupedLookupLabels(
      rawRows,
      reportDefinition,
      objectDefinition,
      analysis
    );

    return {
      columns: buildReportColumns(reportDefinition, objectDefinition),
      rows: sortRows(rows, reportDefinition.sort || []),
      summary: buildRowsSummary(metrics, rows),
    };
  }

  const groupStage = { _id: null };
  for (const metric of metrics) {
    groupStage[metric.id] = buildMetricAccumulator(metric);
  }

  const projectStage = { _id: 0 };
  for (const metric of metrics) {
    projectStage[metric.id] = buildMetricProjection(metric);
  }

  pipeline.push({ $group: groupStage }, { $project: projectStage });

  const [summaryRow = {}] = await RecordModel.aggregate(pipeline).allowDiskUse(true);
  const normalizedSummaryRow = metrics.reduce((row, metric) => {
    row[metric.id] = summaryRow[metric.id] ?? 0;
    return row;
  }, {});

  return {
    columns: buildReportColumns(reportDefinition, objectDefinition),
    rows: [normalizedSummaryRow],
    summary: normalizedSummaryRow,
  };
}

async function executeReportDefinition(reportDefinition) {
  const objectDefinition = await CustomObject.findOne({
    apiName: reportDefinition.sourceObject,
  }).lean();

  if (!objectDefinition) {
    const error = new Error(`Objeto fuente no encontrado: ${reportDefinition.sourceObject}`);
    error.statusCode = 404;
    throw error;
  }

  const { mongoFilters, postFilters } = splitReportFilters(
    reportDefinition,
    objectDefinition
  );
  const query = buildMongoQuery(mongoFilters);
  const analysis = analyzeReportDefinition(reportDefinition, objectDefinition);

  let finalResult;
  let totalSourceRecords;

  if (analysis.canUseMongoAggregation && postFilters.length === 0) {
    const RecordModel = getCustomRecordModel(reportDefinition.sourceObject);
    totalSourceRecords = await RecordModel.countDocuments(query);
    finalResult = await executeMongoAggregatedReport(
      reportDefinition,
      objectDefinition,
      query,
      analysis
    );
  } else {
    const { records } = await loadSourceRecords(
      reportDefinition,
      objectDefinition,
      query,
      analysis
    );
    const filteredRecords = applyPostFilters(records, postFilters);
    totalSourceRecords = filteredRecords.length;

    finalResult =
      (reportDefinition.groupBy || []).length > 0
        ? buildGroupedRows(reportDefinition, objectDefinition, filteredRecords)
        : buildUngroupedRows(reportDefinition, objectDefinition, filteredRecords);
  }

  return {
    report: {
      _id: reportDefinition._id,
      name: reportDefinition.name,
      apiName: reportDefinition.apiName,
      sourceObject: reportDefinition.sourceObject,
    },
    sourceObject: reportDefinition.sourceObject,
    sourceObjectLabel: objectDefinition.name,
    totalSourceRecords,
    columns: finalResult.columns,
    rows: finalResult.rows,
    summary: finalResult.summary,
  };
}

module.exports = {
  executeReportDefinition,
};
