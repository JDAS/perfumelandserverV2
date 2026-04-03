export function normalizeApiName(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s_]/g, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_");
}

export function getDefaultListView(objectDef) {
  const listViews = objectDef?.listViews || [];
  return listViews.find((view) => view.isDefault) || listViews[0] || null;
}

export function getVisibleFields(objectDef, visibilityKey = "visibleInList") {
  return (objectDef?.fields || []).filter((field) => field[visibilityKey] !== false);
}

export function getListColumns(objectDef, listView) {
  const fields = objectDef?.fields || [];
  const requestedColumns = listView?.columns?.length
    ? listView.columns
    : getVisibleFields(objectDef, "visibleInList").slice(0, 5).map((field) => field.apiName);

  return requestedColumns
    .map((apiName) => fields.find((field) => field.apiName === apiName))
    .filter(Boolean);
}

export function getFormFields(objectDef) {
  return getVisibleFields(objectDef, "visibleInForm");
}

export function getDetailFields(objectDef) {
  return getVisibleFields(objectDef, "visibleInDetail");
}

export function splitFieldsIntoColumns(fieldList = []) {
  const col1 = [];
  const col2 = [];

  fieldList.forEach((item, index) => {
    if (index % 2 === 0) {
      col1.push(item);
    } else {
      col2.push(item);
    }
  });

  return { col1, col2 };
}

export function isBlankBlock(value) {
  return typeof value === "string" && value.startsWith("__blank__");
}

export function getBackToListSearch(searchParams, objectApiName) {
  const next = new URLSearchParams(searchParams);
  if (!next.get("tab")) {
    next.set("tab", objectApiName);
  }
  return next.toString();
}

export function formatFieldValue(field, value) {
  if (value === undefined || value === null || value === "") {
    return "-";
  }

  switch (field?.type) {
    case "boolean":
      return value ? "Sí" : "No";
    case "date":
      try {
        return new Date(value).toLocaleDateString();
      } catch {
        return String(value);
      }
    default:
      return String(value);
  }
}
