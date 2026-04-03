import { useSearchParams } from "react-router-dom";

export function useListViewParams(defaults = {}) {
  const [searchParams, setSearchParams] = useSearchParams();

  const view = searchParams.get("view") || defaults.view || "all";
  const page = Number(searchParams.get("page") || defaults.page || 1);
  const limit = Number(searchParams.get("limit") || defaults.limit || 10);
  const search = searchParams.get("search") || defaults.search || "";
  const sort = searchParams.get("sort") || defaults.sort || "createdAt";
  const order = searchParams.get("order") || defaults.order || "desc";

  const updateParams = (updates) => {
    const next = new URLSearchParams(searchParams);

    Object.entries(updates).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") {
        next.delete(key);
      } else {
        next.set(key, String(value));
      }
    });

    setSearchParams(next);
  };

  return {
    view,
    page,
    limit,
    search,
    sort,
    order,
    updateParams,
  };
}