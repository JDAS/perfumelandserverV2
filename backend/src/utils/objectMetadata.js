const RESERVED_FIELD_NAMES = ["_id", "createdAt", "updatedAt", "__v"];

const FIELD_TYPES = [
  "text",
  "textarea",
  "number",
  "select",
  "date",
  "boolean",
  "email",
  "phone",
  "url",
  "lookup",
];

function normalizeApiName(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s_]/g, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_");
}

function createDefaultField() {
  return {
    label: "Name",
    apiName: "name",
    type: "text",
    required: true,
    options: [],
    referenceTo: "",
    visibleInList: true,
    visibleInDetail: true,
    visibleInForm: true,
  };
}

function createDefaultListView() {
  return {
    label: "Todos",
    apiName: "all",
    isDefault: true,
    columns: ["name"],
    filters: [],
    sortBy: "createdAt",
    sortOrder: "desc",
  };
}

function createDefaultLayout(fields = ["name"]) {
  return [
    {
      label: "principal",
      apiName: "principal",
      sections: [
        {
          label: "Detalles",
          type: "fields",
          columns: 2,
          fields,
          relatedObject: "",
          relatedField: "",
          relatedColumns: [],
        },
      ],
    },
  ];
}

function sanitizeField(rawField = {}, index = 0) {
  const label = String(rawField.label || `Campo ${index + 1}`).trim();
  const apiName = normalizeApiName(rawField.apiName || label);
  const type = FIELD_TYPES.includes(rawField.type) ? rawField.type : "text";

  return {
    label,
    apiName,
    type,
    required: Boolean(rawField.required),
    options:
      type === "select"
        ? Array.from(
            new Set(
              (rawField.options || [])
                .map((opt) => String(opt).trim())
                .filter(Boolean)
            )
          )
        : [],
    referenceTo:
      type === "lookup"
        ? normalizeApiName(rawField.referenceTo || "")
        : "",
    visibleInList: rawField.visibleInList !== false,
    visibleInDetail: rawField.visibleInDetail !== false,
    visibleInForm: rawField.visibleInForm !== false,
  };
}

function ensureDefaultListViews(listViews = [], fields = []) {
  if (Array.isArray(listViews) && listViews.length > 0) {
    const sanitized = listViews.map((view, index) => ({
      label: String(view.label || `Vista ${index + 1}`).trim(),
      apiName: normalizeApiName(
        view.apiName || view.label || `view_${index + 1}`
      ),
      isDefault: Boolean(view.isDefault),
      columns:
        Array.isArray(view.columns) && view.columns.length > 0
          ? view.columns
          : fields.slice(0, 5).map((field) => field.apiName),
      filters: Array.isArray(view.filters) ? view.filters : [],
      sortBy: view.sortBy || "createdAt",
      sortOrder: view.sortOrder === "asc" ? "asc" : "desc",
    }));

    if (!sanitized.some((view) => view.isDefault)) {
      sanitized[0].isDefault = true;
    }

    return sanitized.map((view, index) => ({
      ...view,
      isDefault: index === sanitized.findIndex((item) => item.isDefault),
    }));
  }

  const defaultView = createDefaultListView();
  defaultView.columns = fields.slice(0, 5).map((field) => field.apiName);

  if (defaultView.columns.length === 0) {
    defaultView.columns = ["name"];
  }

  return [defaultView];
}

function sanitizeObjectPayload(payload = {}, existingObject = null) {
  const name = String(
    payload.name || existingObject?.name || "Nuevo Objeto"
  ).trim();

  const apiName = normalizeApiName(
    payload.apiName || existingObject?.apiName || name
  );

  const fieldsInput =
    Array.isArray(payload.fields) && payload.fields.length > 0
      ? payload.fields
      : existingObject?.fields?.length
      ? existingObject.fields
      : [createDefaultField()];

  const fields = fieldsInput.map(sanitizeField);

  const layoutInput =
    Array.isArray(payload.layout) && payload.layout.length > 0
      ? payload.layout
      : existingObject?.layout?.length
      ? existingObject.layout
      : createDefaultLayout(fields.map((field) => field.apiName));

  const layout = layoutInput.map((layoutItem, index) => ({
    label: String(layoutItem.label || `Layout ${index + 1}`).trim(),
    apiName: normalizeApiName(
      layoutItem.apiName || layoutItem.label || `layout_${index + 1}`
    ),
    sections:
      Array.isArray(layoutItem.sections) && layoutItem.sections.length > 0
        ? layoutItem.sections.map((section, sectionIndex) => ({
            label: String(section.label || `Sección ${sectionIndex + 1}`).trim(),
            type: section.type === "relatedList" ? "relatedList" : "fields",
            columns: Number(section.columns) === 2 ? 2 : 1,
            fields: Array.isArray(section.fields) ? section.fields : [],
            relatedObject:
              section.type === "relatedList"
                ? normalizeApiName(section.relatedObject || "")
                : "",
            relatedField:
              section.type === "relatedList"
                ? normalizeApiName(section.relatedField || "")
                : "",
            relatedColumns:
              section.type === "relatedList" &&
              Array.isArray(section.relatedColumns)
                ? section.relatedColumns
                : [],
          }))
        : createDefaultLayout(fields.map((field) => field.apiName))[0].sections,
  }));

  const listViews = ensureDefaultListViews(
    payload.listViews ?? existingObject?.listViews,
    fields
  );

  return {
    name,
    pluralLabel: String(
      payload.pluralLabel || existingObject?.pluralLabel || name
    ).trim(),
    description: String(
      payload.description || existingObject?.description || ""
    ).trim(),
    apiName,
    active: payload.active ?? existingObject?.active ?? true,
    tabsEnabled: payload.tabsEnabled ?? existingObject?.tabsEnabled ?? true,
    fields,
    layout,
    listViews,
  };
}

function validateObjectMetadata(payload = {}) {
  const errors = [];

  if (!payload.name) {
    errors.push("El nombre del objeto es obligatorio");
  }

  if (!payload.apiName) {
    errors.push("El apiName del objeto es obligatorio");
  }

  const fieldApiNames = new Set();

  for (const field of payload.fields || []) {
    if (!field.label) {
      errors.push("Todos los campos deben tener label");
    }

    if (!field.apiName) {
      errors.push(
        `El campo ${field.label || "sin nombre"} debe tener apiName`
      );
      continue;
    }

    if (RESERVED_FIELD_NAMES.includes(field.apiName)) {
      errors.push(`El campo ${field.apiName} no está permitido`);
    }

    if (fieldApiNames.has(field.apiName)) {
      errors.push(`El campo ${field.apiName} está duplicado`);
    }

    fieldApiNames.add(field.apiName);

    if (!FIELD_TYPES.includes(field.type)) {
      errors.push(
        `El tipo ${field.type} no es válido para el campo ${field.apiName}`
      );
    }

    if (
      field.type === "select" &&
      (!Array.isArray(field.options) || field.options.length === 0)
    ) {
      errors.push(`El campo select ${field.apiName} debe tener opciones`);
    }

    if (field.type === "lookup" && !field.referenceTo) {
      errors.push(`El campo lookup ${field.apiName} debe tener referenceTo`);
    }
  }

  const layoutApiNames = new Set();

  for (const layout of payload.layout || []) {
    if (layoutApiNames.has(layout.apiName)) {
      errors.push(`El layout ${layout.apiName} está duplicado`);
    }

    layoutApiNames.add(layout.apiName);

    for (const section of layout.sections || []) {
      if (section.type === "relatedList") {
        if (!section.relatedObject) {
          errors.push(
            `La sección relacionada ${section.label || "sin nombre"} debe tener relatedObject`
          );
        }

        if (!section.relatedField) {
          errors.push(
            `La sección relacionada ${section.label || "sin nombre"} debe tener relatedField`
          );
        }

        if (
          section.relatedColumns &&
          !Array.isArray(section.relatedColumns)
        ) {
          errors.push(
            `La sección relacionada ${section.label || "sin nombre"} tiene relatedColumns inválido`
          );
        }

        continue;
      }

      for (const item of section.fields || []) {
        if (typeof item === "string" && item.startsWith("__blank__")) {
          continue;
        }

        if (!fieldApiNames.has(item)) {
          errors.push(`El campo ${item} usado en layout no existe en el objeto`);
        }
      }
    }
  }

  const listViewApiNames = new Set();

  for (const view of payload.listViews || []) {
    if (!view.apiName) {
      errors.push("Todas las vistas deben tener apiName");
      continue;
    }

    if (listViewApiNames.has(view.apiName)) {
      errors.push(`La vista ${view.apiName} está duplicada`);
    }

    listViewApiNames.add(view.apiName);

    for (const column of view.columns || []) {
      if (!fieldApiNames.has(column)) {
        errors.push(`La columna ${column} de la vista ${view.apiName} no existe`);
      }
    }

    if (
      view.sortBy &&
      view.sortBy !== "createdAt" &&
      view.sortBy !== "updatedAt" &&
      !fieldApiNames.has(view.sortBy)
    ) {
      errors.push(
        `El campo de orden ${view.sortBy} de la vista ${view.apiName} no existe`
      );
    }
  }

  return errors;
}

module.exports = {
  RESERVED_FIELD_NAMES,
  FIELD_TYPES,
  normalizeApiName,
  sanitizeObjectPayload,
  validateObjectMetadata,
  createDefaultField,
  createDefaultLayout,
  createDefaultListView,
};