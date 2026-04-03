import { getDefaultListView, getListColumns } from "./metadataEngine";

export function buildListQuery({ searchParams, objectDef }) {
  const defaultView = getDefaultListView(objectDef);
  const viewApiName = searchParams.get("view") || defaultView?.apiName || "all";
  const currentView = (objectDef?.listViews || []).find((view) => view.apiName === viewApiName) || defaultView;

  return {
    viewApiName,
    currentView,
    search: searchParams.get("search") || "",
    page: Number(searchParams.get("page") || 1),
    limit: Number(searchParams.get("limit") || 10),
    sortBy: searchParams.get("sortBy") || currentView?.sortBy || "createdAt",
    sortOrder: searchParams.get("sortOrder") || currentView?.sortOrder || "desc",
    columns: getListColumns(objectDef, currentView),
  };
}

export function buildRecordListRequest({ objectDef, listState }) {
  return {
    search: listState.search,
    page: listState.page,
    limit: listState.limit,
    sortBy: listState.sortBy,
    sortOrder: listState.sortOrder,
    filters: JSON.stringify(listState.currentView?.filters || []),
  };
}
export function getColumns(object, viewApiName) {
  const view = object.listViews?.find(v => v.apiName === viewApiName);

  if (!view) return [];

  return view.columns.map(col =>
    object.fields.find(f => f.apiName === col)
  );
}
