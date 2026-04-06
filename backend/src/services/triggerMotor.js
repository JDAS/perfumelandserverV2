const { getCustomRecordModel } = require("../models/CustomRecord");
const { calculatePayments } = require("../utils/paymentEngine");

function getValueByPath(obj, path) {
    if (!obj || !path) return undefined;
    return path.split(".").reduce((acc, key) => acc?.[key], obj);
}

function isEmptyValue(value) {
    return (
        value === undefined ||
        value === null ||
        value === "" ||
        (Array.isArray(value) && value.length === 0)
    );
}

function valuesAreEqual(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
}

function isGroup(node) {
    return node && typeof node === "object" && Array.isArray(node.conditions);
}

function evaluateCondition(condition, record, previousRecord = null) {
    const { field, operator, value } = condition || {};
    const currentValue = getValueByPath(record, field);
    const oldValue = getValueByPath(previousRecord, field);

    switch (operator) {
        case "eq":
            return valuesAreEqual(currentValue, value);

        case "ne":
            return !valuesAreEqual(currentValue, value);

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

        case "changed":
            return !valuesAreEqual(currentValue, oldValue);

        case "isEmpty":
            return isEmptyValue(currentValue);

        case "isNotEmpty":
            return !isEmptyValue(currentValue);

        default:
            return false;
    }
}

function evaluateConditions(conditions, record, previousRecord = null) {
    if (!conditions) return true;

    // 🔹 Caso antiguo: array = AND
    if (Array.isArray(conditions)) {
        return conditions.every((condition) =>
            evaluateCondition(condition, record, previousRecord)
        );
    }

    // 🔹 Nuevo formato
    const { operator = "AND", conditions: subConditions = [] } = conditions;

    if (!Array.isArray(subConditions) || subConditions.length === 0) {
        return true;
    }

    if (operator === "AND") {
        return subConditions.every((cond) =>
            isGroup(cond)
                ? evaluateConditions(cond, record, previousRecord)
                : evaluateCondition(cond, record, previousRecord)
        );
    }

    if (operator === "OR") {
        return subConditions.some((cond) =>
            isGroup(cond)
                ? evaluateConditions(cond, record, previousRecord)
                : evaluateCondition(cond, record, previousRecord)
        );
    }

    return true;
}

function applyTemplateValue(template, record, previousRecord = null) {
    if (typeof template === "string") {
        const fullMatch = template.match(/^\s*\{\{(.*?)\}\}\s*$/);

        // Si TODO el valor es un template, devolver el valor crudo
        if (fullMatch) {
            const cleanPath = String(fullMatch[1] || "").trim();

            if (cleanPath.startsWith("previous.")) {
                return getValueByPath(
                    previousRecord,
                    cleanPath.replace(/^previous\./, "")
                );
            }

            return getValueByPath(record, cleanPath);
        }

        // Si el template está mezclado con texto, devolver string interpolado
        return template.replace(/\{\{(.*?)\}\}/g, (_, path) => {
            const cleanPath = String(path || "").trim();

            if (cleanPath.startsWith("previous.")) {
                return getValueByPath(
                    previousRecord,
                    cleanPath.replace(/^previous\./, "")
                ) ?? "";
            }

            return getValueByPath(record, cleanPath) ?? "";
        });
    }

    if (Array.isArray(template)) {
        return template.map((item) =>
            applyTemplateValue(item, record, previousRecord)
        );
    }

    if (template && typeof template === "object") {
        return Object.fromEntries(
            Object.entries(template).map(([key, value]) => [
                key,
                applyTemplateValue(value, record, previousRecord),
            ])
        );
    }

    return template;
}

function resolveRelativeDateKeyword(value) {
    if (typeof value !== "string") return value;

    const trimmed = value.trim().toLowerCase();
    const match = trimmed.match(/^today(?:\s*([+-])\s*(\d+))?$/i);

    if (!match) {
        return value;
    }

    const sign = match[1] || "+";
    const rawOffset = Number(match[2] || 0);
    const offset = sign === "-" ? -rawOffset : rawOffset;
    const now = new Date();

    return new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + offset
    );
}

async function executeAction(action, context) {
    const { type, config = {} } = action || {};
    const {
        objectApiName,
        objectDefinition,
        record,
        previousRecord,
        logger = console,
    } = context;

    switch (type) {
        case "updateField": {
            if (!config.field) return record;

            const targetField = (objectDefinition?.fields || []).find(
                (field) => field.apiName === config.field
            );
            const resolvedValue = applyTemplateValue(
                config.value,
                record,
                previousRecord
            );
            const nextRecord = { ...record };
            nextRecord[config.field] =
                targetField?.type === "date"
                    ? resolveRelativeDateKeyword(resolvedValue)
                    : resolvedValue;

            return nextRecord;
        }

        case "copyFromLookup": {
            const { lookupField, sourceField, sourcePath, targetField } = config || {};

            if (!targetField) {
                return record;
            }

            let resolvedValue;

            // Nuevo modo flexible: sourcePath
            if (sourcePath) {
                resolvedValue = await resolveLookupPathValue({
                    objectDefinition,
                    record,
                    sourcePath,
                });
            } else if (lookupField && sourceField) {
                // Compatibilidad con modo viejo
                const lookupValue = record?.[lookupField];
                if (!lookupValue) return record;

                const lookupFieldDef = (objectDefinition?.fields || []).find(
                    (field) =>
                        field.apiName === lookupField &&
                        field.type === "lookup" &&
                        field.referenceTo
                );

                if (!lookupFieldDef?.referenceTo) {
                    logger.warn?.(
                        `[Trigger copyFromLookup] El campo ${lookupField} no es un lookup válido en ${objectApiName}`
                    );
                    return record;
                }

                const RelatedModel = getCustomRecordModel(lookupFieldDef.referenceTo);
                const relatedRecord = await RelatedModel.findById(lookupValue).lean();

                if (!relatedRecord) return record;
                resolvedValue = relatedRecord[sourceField];
            } else {
                return record;
            }

            const nextRecord = { ...record };
            nextRecord[targetField] = resolvedValue;

            return nextRecord;
        }

        case "createRecord": {
            if (!config.object) return record;

            const RelatedModel = getCustomRecordModel(config.object);

            let values = { ...(config.values || {}) };

            values = applyTemplateValue(values, record, previousRecord);

            if (config.mapFromRecord && typeof config.mapFromRecord === "object") {
                Object.entries(config.mapFromRecord).forEach(([targetField, sourcePath]) => {
                    values[targetField] = getValueByPath(record, sourcePath);
                });
            }

            await RelatedModel.create(values);
            return record;
        }

        case "log": {
            const message = applyTemplateValue(
                config.message || "Trigger ejecutado",
                record,
                previousRecord
            );

            logger.log("[Trigger log]", {
                objectApiName,
                recordId: record?._id || null,
                message,
            });

            return record;
        }
        case "generatePayments": {
            const {
                totalField = "total",
                productsField = "products",
                typeField = "type",
                creditTypeField = "creditType",
                quotesField = "quotes",
                salesDateField = "salesDate",
                targetField = "payments",
            } = config || {};

            const rawTotal =
                record?.[totalField] ??
                record?.[config?.total] ??
                null;
            const type = record?.[typeField];
            const creditType = record?.[creditTypeField];
            const quotes = record?.[quotesField];
            const salesDate = record?.[salesDateField];

            let total = Number(rawTotal);

            if (!Number.isFinite(total)) {
                const legacyProducts = record?.[productsField] || [];
                if (Array.isArray(legacyProducts) && legacyProducts.length > 0) {
                    total = legacyProducts.reduce((sum, product) => {
                        const quantity = Number(product?.quantity || 0);
                        const unitPrice = Number(product?.unitprice || 0);
                        const discount = Number(product?.discount || 0);
                        return sum + (unitPrice - discount) * quantity;
                    }, 0);
                }
            }

            if (!Number.isFinite(total) || !type || !salesDate) {
                return record;
            }

            const payments = calculatePayments({
                total,
                type,
                creditType,
                quotes,
                salesDate,
            });

            const nextRecord = { ...record };
            nextRecord[targetField] = payments;

            return nextRecord;
        }

        default:
            return record;
    }
}

async function runTriggers({
    objectDefinition,
    when,
    objectApiName,
    record,
    previousRecord = null,
    logger = console,
}) {
    const triggers = (objectDefinition?.automationTriggers || [])
        .filter((trigger) => trigger?.isActive && trigger?.when === when)
        .sort((a, b) => (a.runOrder || 0) - (b.runOrder || 0));

    let workingRecord = { ...(record || {}) };

    for (const trigger of triggers) {
        const shouldRun = evaluateConditions(
            trigger.conditions || [],
            workingRecord,
            previousRecord
        );

        if (!shouldRun) continue;

        try {
            for (const action of trigger.actions || []) {
                workingRecord = await executeAction(action, {
                    objectApiName,
                    objectDefinition,
                    record: workingRecord,
                    previousRecord,
                    logger,
                });
            }
        } catch (error) {
            logger.error(`Trigger error [${trigger.name}]`, error);

            if (trigger.stopOnError) {
                throw error;
            }
        }
    }

    return workingRecord;
}
async function resolveLookupPathValue({
    objectDefinition,
    record,
    sourcePath,
}) {
    if (!objectDefinition || !record || !sourcePath) return undefined;

    const parts = String(sourcePath).split(".").filter(Boolean);
    if (parts.length < 2) return undefined;

    let currentObjectDefinition = objectDefinition;
    let currentRecord = record;

    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isLast = i === parts.length - 1;

        if (isLast) {
            return currentRecord?.[part];
        }

        const fieldDef = (currentObjectDefinition.fields || []).find(
            (field) => field.apiName === part
        );

        if (!fieldDef || fieldDef.type !== "lookup" || !fieldDef.referenceTo) {
            return undefined;
        }

        const lookupId = currentRecord?.[part];
        if (!lookupId) return undefined;

        const RelatedModel = getCustomRecordModel(fieldDef.referenceTo);
        const relatedRecord = await RelatedModel.findById(lookupId).lean();
        if (!relatedRecord) return undefined;

        const RelatedObjectModel = require("../models/CustomObject");
        const relatedObjectDefinition = await RelatedObjectModel.findOne({
            apiName: fieldDef.referenceTo,
        }).lean();

        if (!relatedObjectDefinition) return undefined;

        currentRecord = relatedRecord;
        currentObjectDefinition = relatedObjectDefinition;
    }

    return undefined;
}

module.exports = {
    runTriggers,
    evaluateCondition,
    evaluateConditions,
    applyTemplateValue,
};
