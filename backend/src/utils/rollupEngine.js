const CustomObject = require("../models/CustomObject");
const { getCustomRecordModel } = require("../models/CustomRecord");
const { runTriggers } = require("../services/triggerMotor");

function buildFilterCondition({ filterField, filterOperator, filterValue }) {
  if (
    !filterField ||
    filterValue === undefined ||
    filterValue === null ||
    filterValue === ""
  ) {
    return {};
  }

  switch (filterOperator) {
    case "ne":
      return { [filterField]: { $ne: filterValue } };
    case "gt":
      return { [filterField]: { $gt: filterValue } };
    case "gte":
      return { [filterField]: { $gte: filterValue } };
    case "lt":
      return { [filterField]: { $lt: filterValue } };
    case "lte":
      return { [filterField]: { $lte: filterValue } };
    case "contains":
      return { [filterField]: { $regex: String(filterValue), $options: "i" } };
    case "eq":
    default:
      return { [filterField]: filterValue };
  }
}

function computeRollupValue(records, operation, fieldToAggregate) {
  if (operation === "count") {
    return records.length;
  }

  const values = records
    .map((record) => Number(record[fieldToAggregate]))
    .filter((value) => !Number.isNaN(value));

  if (values.length === 0) {
    return 0;
  }

  switch (operation) {
    case "sum":
      return values.reduce((acc, value) => acc + value, 0);
    case "avg":
      return values.reduce((acc, value) => acc + value, 0) / values.length;
    case "min":
      return Math.min(...values);
    case "max":
      return Math.max(...values);
    default:
      return 0;
  }
}

async function recalculateRollupsForParent({
  parentObjectApiName,
  parentRecordId,
}) {
  if (!parentRecordId) return;

  const parentObject = await CustomObject.findOne({
    apiName: parentObjectApiName,
  });

  if (!parentObject) return;

  const rollupFields = (parentObject.fields || []).filter(
    (field) =>
      field.type === "rollup" &&
      field.rollup?.relatedObject &&
      field.rollup?.relatedField
  );

  if (!rollupFields.length) return;

  const ParentModel = getCustomRecordModel(parentObjectApiName);
  const previousParentRecord = await ParentModel.findById(parentRecordId).lean();
  if (!previousParentRecord) return;

  const updateData = {};

  for (const field of rollupFields) {
    const ChildModel = getCustomRecordModel(field.rollup.relatedObject);

    const query = {
      [field.rollup.relatedField]: String(parentRecordId),
      ...buildFilterCondition(field.rollup),
    };

    const childRecords = await ChildModel.find(query).lean();

    updateData[field.apiName] = computeRollupValue(
      childRecords,
      field.rollup.operation,
      field.rollup.fieldToAggregate
    );
  }

  const hasChanges = Object.entries(updateData).some(
    ([key, value]) => previousParentRecord?.[key] !== value
  );

  if (!hasChanges) {
    return;
  }

  const updatedParentRecord = await ParentModel.findByIdAndUpdate(parentRecordId, updateData, {
    returnDocument: "before",
    runValidators: false,
    lean: true,
  });

  const nextParentRecord = {
    ...(updatedParentRecord || previousParentRecord),
    ...updateData,
  };

  await runTriggers({
    objectDefinition: parentObject,
    when: "afterUpdate",
    objectApiName: parentObjectApiName,
    record: nextParentRecord,
    previousRecord: previousParentRecord,
  });
}

async function recalculateParentRollupsFromChild({
  childObjectApiName,
  childRecord,
  previousChildRecord = null,
}) {
  const parentObjects = await CustomObject.find({
    "fields.type": "rollup",
  });

  for (const parentObject of parentObjects) {
    const matchingRollups = (parentObject.fields || []).filter(
      (field) =>
        field.type === "rollup" &&
        field.rollup?.relatedObject === childObjectApiName
    );

    if (!matchingRollups.length) continue;

    const parentIds = new Set();

    for (const rollupField of matchingRollups) {
      const relatedField = rollupField.rollup.relatedField;

      const currentParentId = childRecord?.[relatedField];
      const previousParentId = previousChildRecord?.[relatedField];

      if (
        currentParentId !== undefined &&
        currentParentId !== null &&
        currentParentId !== ""
      ) {
        parentIds.add(String(currentParentId));
      }

      if (
        previousParentId !== undefined &&
        previousParentId !== null &&
        previousParentId !== ""
      ) {
        parentIds.add(String(previousParentId));
      }
    }

    for (const parentId of parentIds) {
      await recalculateRollupsForParent({
        parentObjectApiName: parentObject.apiName,
        parentRecordId: parentId,
      });
    }
  }
}

module.exports = {
  recalculateRollupsForParent,
  recalculateParentRollupsFromChild,
};
