const CustomObject = require("../models/CustomObject");
const { getCustomRecordModel } = require("../models/CustomRecord");

exports.getRecords = async (req, res) => {
  try {
    const { object } = req.params;
    const {
      view = "all",
      search = "",
      sort = "createdAt",
      order = "desc",
      page = 1,
      limit = 10,
    } = req.query;

    const customObject = await CustomObject.findOne({ apiName: object });

    if (!customObject) {
      return res.status(404).json({ error: "Objeto no encontrado" });
    }

    const RecordModel = getCustomRecordModel(object);

    const numericPage = Number(page) || 1;
    const numericLimit = Number(limit) || 10;
    const skip = (numericPage - 1) * numericLimit;

    const mongoQuery = {};

    const activeView =
      customObject.listViews?.find((v) => v.apiName === view) ||
      customObject.listViews?.find((v) => v.isDefault) ||
      null;

    if (search && search.trim()) {
      const searchableFields = (customObject.fields || [])
        .filter((f) => ["text", "textarea", "select", "date", "number", "email", "phone"].includes(f.type))
        .map((f) => f.apiName);

      if (searchableFields.length > 0) {
        mongoQuery.$or = searchableFields.map((field) => ({
          [field]: { $regex: search.trim(), $options: "i" },
        }));
      }
    }

    if (activeView && Array.isArray(activeView.filters) && activeView.filters.length > 0) {
      const filterConditions = [];

      activeView.filters.forEach((filter) => {
        const { field, operator, value } = filter || {};
        if (!field || value === undefined || value === null || value === "") return;

        switch (operator) {
          case "eq":
            filterConditions.push({ [field]: value });
            break;
          case "ne":
            filterConditions.push({ [field]: { $ne: value } });
            break;
          case "gt":
            filterConditions.push({ [field]: { $gt: value } });
            break;
          case "gte":
            filterConditions.push({ [field]: { $gte: value } });
            break;
          case "lt":
            filterConditions.push({ [field]: { $lt: value } });
            break;
          case "lte":
            filterConditions.push({ [field]: { $lte: value } });
            break;
          case "contains":
            filterConditions.push({
              [field]: { $regex: String(value), $options: "i" },
            });
            break;
          default:
            break;
        }
      });

      if (filterConditions.length > 0) {
        if (mongoQuery.$and) {
          mongoQuery.$and.push(...filterConditions);
        } else {
          mongoQuery.$and = filterConditions;
        }
      }
    }

    const sortConfig = {};
    sortConfig[sort] = order === "asc" ? 1 : -1;

    const total = await RecordModel.countDocuments(mongoQuery);

    const records = await RecordModel.find(mongoQuery)
      .sort(sortConfig)
      .skip(skip)
      .limit(numericLimit);

    res.json({
      records,
      total,
      page: numericPage,
      pages: Math.ceil(total / numericLimit),
      view,
      sort,
      order,
      limit: numericLimit,
    });
  } catch (error) {
    console.error("getRecords error:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.getRecordById = async (req, res) => {
  try {
    const { object, id } = req.params;
    const RecordModel = getCustomRecordModel(object);
    const record = await RecordModel.findById(id);

    if (!record) {
      return res.status(404).json({ error: "Registro no encontrado" });
    }

    res.json(record);
  } catch (error) {
    console.error("getRecordById error:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.createRecord = async (req, res) => {
  try {
    const { object } = req.params;
    const RecordModel = getCustomRecordModel(object);

    const record = await RecordModel.create(req.body);
    res.status(201).json(record);
  } catch (error) {
    console.error("createRecord error:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.updateRecord = async (req, res) => {
  try {
    const { object, id } = req.params;
    const RecordModel = getCustomRecordModel(object);

    const record = await RecordModel.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!record) {
      return res.status(404).json({ error: "Registro no encontrado" });
    }

    res.json(record);
  } catch (error) {
    console.error("updateRecord error:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.deleteRecord = async (req, res) => {
  try {
    const { object, id } = req.params;
    const RecordModel = getCustomRecordModel(object);

    const record = await RecordModel.findByIdAndDelete(id);

    if (!record) {
      return res.status(404).json({ error: "Registro no encontrado" });
    }

    res.json({ message: "Registro eliminado correctamente" });
  } catch (error) {
    console.error("deleteRecord error:", error);
    res.status(500).json({ error: error.message });
  }
};