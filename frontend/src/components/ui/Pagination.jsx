function Pagination({ pagination, onChangePage }) {
  if (!pagination) return null;

  return (
    <div className="flex items-center justify-between gap-4 pt-4 text-sm text-gray-600 flex-wrap">
      <p>
        Página {pagination.page} de {pagination.totalPages} · {pagination.total} registros
      </p>

      <div className="flex gap-2">
        <button
          type="button"
          className="rounded border px-3 py-1 disabled:opacity-50"
          disabled={!pagination.hasPrevPage}
          onClick={() => onChangePage(pagination.page - 1)}
        >
          Anterior
        </button>
        <button
          type="button"
          className="rounded border px-3 py-1 disabled:opacity-50"
          disabled={!pagination.hasNextPage}
          onClick={() => onChangePage(pagination.page + 1)}
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}

export default Pagination;
