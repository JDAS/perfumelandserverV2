const { getCustomRecordModel } = require("../models/CustomRecord");
const { calculatePayments } = require("../utils/paymentEngine");
const CustomObject = require("../models/CustomObject");

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

function normalizePaymentKeyword(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

function formatDateOnly(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function buildPaymentPlanStatus(plan, todayString) {
    const plannedAmount = Number(plan.planned_amount || 0);
    const paidAmount = Number(plan.paid_amount || 0);

    if (plannedAmount > 0 && paidAmount >= plannedAmount) {
        return "Paid";
    }

    if (paidAmount > 0) {
        return "Partial";
    }

    if (plan.due_date && plan.due_date < todayString) {
        return "Overdue";
    }

    return "Pending";
}

function applyPaymentsToInstallments(installments, payments = []) {
    const assignments = [];

    for (const payment of payments) {
        let remainingPayment = Number(payment?.amount || 0);
        let firstTouchedInstallment = null;

        if (!Number.isFinite(remainingPayment) || remainingPayment <= 0) {
            assignments.push({
                paymentId: String(payment?._id || ""),
                installmentNumber: null,
            });
            continue;
        }

        for (const installment of installments) {
            if (remainingPayment <= 0) break;

            const plannedAmount = Number(installment.planned_amount || 0);
            const paidAmount = Number(installment.paid_amount || 0);
            const remainingInstallment = Math.max(plannedAmount - paidAmount, 0);

            if (remainingInstallment <= 0) continue;

            const appliedAmount = Math.min(remainingPayment, remainingInstallment);

            if (appliedAmount <= 0) continue;

            installment.paid_amount = paidAmount + appliedAmount;
            installment.last_payment_date =
                formatDateOnly(payment?.date) || installment.last_payment_date || null;

            if (firstTouchedInstallment === null) {
                firstTouchedInstallment = installment.installment_number;
            }

            remainingPayment -= appliedAmount;
        }

        assignments.push({
            paymentId: String(payment?._id || ""),
            installmentNumber: firstTouchedInstallment,
        });
    }

    return assignments;
}

async function clearGeneratedPaymentPlans({
    planObjectApiName,
    paymentObjectApiName,
    saleLookupField,
    paymentPlanLookupField,
    saleId,
}) {
    if (!saleId || !planObjectApiName) return;

    const PaymentPlanModel = getCustomRecordModel(planObjectApiName);
    await PaymentPlanModel.deleteMany({ [saleLookupField]: String(saleId) });

    if (paymentObjectApiName && paymentPlanLookupField) {
        const PaymentModel = getCustomRecordModel(paymentObjectApiName);
        await PaymentModel.updateMany(
            { [saleLookupField]: String(saleId) },
            { $unset: { [paymentPlanLookupField]: 1 } }
        );
    }
}

async function generatePaymentPlanRecords(config = {}, record) {
    const {
        totalField = "total",
        typeField = "type",
        creditTypeField = "credittype",
        quotesField = "quotes",
        salesDateField = "saledate",
        targetObject = "payment_plan",
        paymentObject = "payment",
        saleLookupField = "sale_id",
        installmentNumberField = "installment_number",
        dueDateField = "due_date",
        plannedAmountField = "planned_amount",
        paidAmountField = "paid_amount",
        statusField = "status",
        lastPaymentDateField = "last_payment_date",
        versionField = "version",
        paymentPlanLookupField = "payment_plan_id",
    } = config;

    const saleId = String(record?._id || "");
    if (!saleId) return;

    const normalizedType = normalizePaymentKeyword(record?.[typeField]);
    const salesDate = record?.[salesDateField];
    const total = Number(record?.[totalField]);

    if (
        !["credito", "contado"].includes(normalizedType) ||
        !Number.isFinite(total) ||
        total <= 0 ||
        !salesDate
    ) {
        await clearGeneratedPaymentPlans({
            planObjectApiName: targetObject,
            paymentObjectApiName: paymentObject,
            saleLookupField,
            paymentPlanLookupField,
            saleId,
        });
        return;
    }

    const installments = calculatePayments({
        total,
        type: normalizedType,
        creditType: normalizePaymentKeyword(record?.[creditTypeField]),
        quotes: record?.[quotesField],
        salesDate,
    });

    const PaymentPlanModel = getCustomRecordModel(targetObject);
    const PaymentModel = getCustomRecordModel(paymentObject);

    const [existingPlans, payments] = await Promise.all([
        PaymentPlanModel.find({ [saleLookupField]: saleId }).lean(),
        PaymentModel.find({ [saleLookupField]: saleId })
            .sort({ date: 1, createdAt: 1, _id: 1 })
            .lean(),
    ]);

    const nextVersion =
        existingPlans.reduce(
            (maxVersion, item) => Math.max(maxVersion, Number(item?.[versionField] || 0)),
            0
        ) + 1;

    const planDrafts = installments.map((item) => ({
        [saleLookupField]: saleId,
        [installmentNumberField]: item.number,
        [dueDateField]: item.fecha,
        [plannedAmountField]: item.expectedAmount,
        [paidAmountField]: 0,
        [statusField]: "Pending",
        [lastPaymentDateField]: null,
        [versionField]: nextVersion,
    }));

    const assignments = applyPaymentsToInstallments(planDrafts, payments);
    const todayString = formatDateOnly(new Date());

    for (const planDraft of planDrafts) {
        planDraft[statusField] = buildPaymentPlanStatus(planDraft, todayString);
    }

    await PaymentPlanModel.deleteMany({ [saleLookupField]: saleId });

    const createdPlans =
        planDrafts.length > 0 ? await PaymentPlanModel.create(planDrafts) : [];

    if (payments.length > 0) {
        const installmentIdByNumber = new Map(
            createdPlans.map((doc) => [
                Number(doc?.[installmentNumberField]),
                String(doc?._id),
            ])
        );

        const bulkOps = assignments
            .filter((item) => item.paymentId)
            .map((item) => {
                const linkedPlanId =
                    item.installmentNumber !== null
                        ? installmentIdByNumber.get(Number(item.installmentNumber)) || null
                        : null;

                return {
                    updateOne: {
                        filter: { _id: item.paymentId },
                        update: linkedPlanId
                            ? { $set: { [paymentPlanLookupField]: linkedPlanId } }
                            : { $unset: { [paymentPlanLookupField]: 1 } },
                    },
                };
            });

        if (bulkOps.length > 0) {
            await PaymentModel.bulkWrite(bulkOps);
        }
    }
}

async function setSaleItemPrice(config = {}, context) {
    const {
        objectDefinition,
        record,
        logger = console,
    } = context;

    const {
        productLookupField = "product",
        saleLookupField = "sale",
        cashPriceSourceField = "price",
        targetField = "price",
        listPriceTargetField = "list_price",
        costTargetField = "cost_snapshot",
        saleTypeField = "type",
        creditKeyword = "credito",
        creditSurcharge = 5000,
        stockObject = "stock",
        stockProductField = "product",
        stockCostField = "wholesaleprice",
    } = config;

    const productId = record?.[productLookupField];
    const saleId = record?.[saleLookupField];

    if (!productId || !saleId) {
        return record;
    }

    const productFieldDef = (objectDefinition?.fields || []).find(
        (field) =>
            field.apiName === productLookupField &&
            field.type === "lookup" &&
            field.referenceTo
    );
    const saleFieldDef = (objectDefinition?.fields || []).find(
        (field) =>
            field.apiName === saleLookupField &&
            field.type === "lookup" &&
            field.referenceTo
    );

    if (!productFieldDef?.referenceTo || !saleFieldDef?.referenceTo) {
        logger.warn?.(
            `[Trigger setSaleItemPrice] Lookups invalidos en ${objectDefinition?.apiName || "sale_item"}`
        );
        return record;
    }

    const ProductModel = getCustomRecordModel(productFieldDef.referenceTo);
    const SaleModel = getCustomRecordModel(saleFieldDef.referenceTo);
    const StockModel = getCustomRecordModel(stockObject);

    const [productRecord, saleRecord, latestStockRecord] = await Promise.all([
        ProductModel.findById(productId).lean(),
        SaleModel.findById(saleId).lean(),
        StockModel.findOne({ [stockProductField]: String(productId) })
            .sort({ createdAt: -1, _id: -1 })
            .lean(),
    ]);

    if (!productRecord || !saleRecord) {
        return record;
    }

    const cashPrice = Number(productRecord?.[cashPriceSourceField]);

    if (!Number.isFinite(cashPrice)) {
        return record;
    }

    const normalizedSaleType = normalizePaymentKeyword(saleRecord?.[saleTypeField]);
    const surcharge = Number(creditSurcharge) || 0;
    const nextPrice =
        normalizedSaleType === normalizePaymentKeyword(creditKeyword)
            ? cashPrice + surcharge
            : cashPrice;

    const nextRecord = {
        ...record,
        [targetField]: nextPrice,
    };

    if (listPriceTargetField) {
        nextRecord[listPriceTargetField] = nextPrice;
    }

    if (costTargetField) {
        const latestCost = Number(latestStockRecord?.[stockCostField]);
        if (Number.isFinite(latestCost)) {
            nextRecord[costTargetField] = latestCost;
        }
    }

    return nextRecord;
}

async function setSalePaymentStatus(config = {}, context) {
    const { record } = context;
    const {
        statusField = "status",
        totalField = "total",
        totalPaidField = "total_paid",
        targetField = "payment_status",
        canceledValue = "Cancelada",
        draftValue = "Borrador",
        pendingValue = "Pendiente",
        partialValue = "Parcial",
        paidValue = "Pagada",
    } = config;

    const currentStatus = String(record?.[statusField] || "");
    const total = Number(record?.[totalField] || 0);
    const totalPaid = Number(record?.[totalPaidField] || 0);

    let nextStatus = pendingValue;

    if (currentStatus === canceledValue) {
        nextStatus = canceledValue;
    } else if (currentStatus === draftValue) {
        nextStatus = draftValue;
    } else if (total > 0 && totalPaid >= total) {
        nextStatus = paidValue;
    } else if (totalPaid > 0) {
        nextStatus = partialValue;
    }

    return {
        ...record,
        [targetField]: nextStatus,
    };
}

async function syncSaleItemStatus(config = {}, context) {
    const { record } = context;
    const {
        saleIdField = "_id",
        saleStatusField = "status",
        targetObject = "sale_item",
        saleLookupField = "sale",
        targetStatusField = "sale_status",
        completedStatus = "Completada",
        productLookupField = "product",
        productObject = "product",
        soldField = "sold",
    } = config;

    const saleId = String(record?.[saleIdField] || "");
    const nextStatus = record?.[saleStatusField];

    if (!saleId || !nextStatus) {
        return record;
    }

    const SaleItemModel = getCustomRecordModel(targetObject);
    const ProductModel = getCustomRecordModel(productObject);

    const saleItems = await SaleItemModel.find({ [saleLookupField]: saleId }).lean();

    if (!saleItems.length) {
        return record;
    }

    await SaleItemModel.updateMany(
        { [saleLookupField]: saleId },
        { $set: { [targetStatusField]: nextStatus } }
    );

    const affectedProductIds = [
        ...new Set(
            saleItems
                .map((item) => String(item?.[productLookupField] || ""))
                .filter(Boolean)
        ),
    ];

    if (!affectedProductIds.length) {
        return record;
    }

    const completedItems = await SaleItemModel.aggregate([
        {
            $match: {
                [productLookupField]: { $in: affectedProductIds },
                [targetStatusField]: completedStatus,
            },
        },
        {
            $group: {
                _id: `$${productLookupField}`,
                totalQuantity: { $sum: { $ifNull: ["$quantity", 0] } },
            },
        },
    ]);

    const soldByProduct = new Map(
        completedItems.map((item) => [String(item._id), Number(item.totalQuantity || 0)])
    );

    const bulkOps = affectedProductIds.map((productId) => ({
        updateOne: {
            filter: { _id: productId },
            update: {
                $set: {
                    [soldField]: soldByProduct.get(String(productId)) || 0,
                },
            },
        },
    }));

    if (bulkOps.length > 0) {
        await ProductModel.bulkWrite(bulkOps);
    }

    return record;
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
        case "generatePaymentPlan": {
            await generatePaymentPlanRecords(config, record);
            return record;
        }
        case "setSaleItemPrice": {
            return setSaleItemPrice(config, context);
        }
        case "syncSaleItemStatus": {
            return syncSaleItemStatus(config, context);
        }
        case "setSalePaymentStatus": {
            return setSalePaymentStatus(config, context);
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

        const relatedObjectDefinition = await CustomObject.findOne({
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
