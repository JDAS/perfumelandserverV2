function ListViewSelector({ views, currentView, onChange }) {
  return (
    <select
      value={currentView}
      onChange={(e) => onChange(e.target.value)}
      className="border p-2 rounded"
    >
      {views.map((v) => (
        <option key={v.apiName} value={v.apiName}>
          {v.name}
        </option>
      ))}
    </select>
  );
}

export default ListViewSelector;