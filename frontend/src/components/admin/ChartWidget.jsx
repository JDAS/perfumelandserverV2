import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const SERIES_COLORS = ["#1d4ed8", "#9333ea", "#ea580c", "#059669", "#db2777"];

function buildChartData(widget, reportData) {
  if (!reportData?.rows?.length) return [];

  const xField =
    widget.xField ||
    reportData.columns?.find((column) => column.type === "group")?.id;
  const series = widget.series?.length
    ? widget.series
    : reportData.columns
        ?.filter((column) => column.type === "metric")
        .map((column) => column.id) || [];

  if (!xField || !series.length) return [];

  return reportData.rows.map((row) => ({
    ...row,
    _label: row[`${xField}__label`] || row[xField] || "Sin valor",
    ...Object.fromEntries(
      series.map((serie) => [serie, Number(row[serie] || 0)])
    ),
  }));
}

export default function ChartWidget({ widget, reportData }) {
  const data = buildChartData(widget, reportData);
  const xField =
    widget.xField ||
    reportData?.columns?.find((column) => column.type === "group")?.id;
  const series = widget.series?.length
    ? widget.series
    : reportData?.columns
        ?.filter((column) => column.type === "metric")
        .map((column) => column.id) || [];

  if (!data.length || !xField || !series.length) {
    return (
      <p className="text-sm text-gray-500">
        Configura el eje y las series para ver la grafica.
      </p>
    );
  }

  if (widget.chartType === "pie") {
    const firstSeries = series[0];
    return (
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey={firstSeries}
              nameKey="_label"
              innerRadius={54}
              outerRadius={94}
            >
              {data.map((entry, index) => (
                <Cell
                  key={`${entry._label}-${index}`}
                  fill={SERIES_COLORS[index % SERIES_COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  const sharedProps = {
    data,
    margin: { top: 8, right: 8, left: 0, bottom: 0 },
  };

  const content =
    widget.chartType === "line" ? (
      <LineChart {...sharedProps}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="_label" tick={{ fill: "#64748b", fontSize: 12 }} />
        <YAxis tick={{ fill: "#64748b", fontSize: 12 }} />
        <Tooltip />
        <Legend />
        {series.map((serie, index) => (
          <Line
            key={serie}
            type="monotone"
            dataKey={serie}
            stroke={SERIES_COLORS[index % SERIES_COLORS.length]}
            strokeWidth={2.5}
            dot={false}
          />
        ))}
      </LineChart>
    ) : widget.chartType === "area" ? (
      <AreaChart {...sharedProps}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="_label" tick={{ fill: "#64748b", fontSize: 12 }} />
        <YAxis tick={{ fill: "#64748b", fontSize: 12 }} />
        <Tooltip />
        <Legend />
        {series.map((serie, index) => (
          <Area
            key={serie}
            type="monotone"
            dataKey={serie}
            stroke={SERIES_COLORS[index % SERIES_COLORS.length]}
            fill={SERIES_COLORS[index % SERIES_COLORS.length]}
            fillOpacity={0.18}
          />
        ))}
      </AreaChart>
    ) : (
      <BarChart {...sharedProps}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="_label" tick={{ fill: "#64748b", fontSize: 12 }} />
        <YAxis tick={{ fill: "#64748b", fontSize: 12 }} />
        <Tooltip />
        <Legend />
        {series.map((serie, index) => (
          <Bar
            key={serie}
            dataKey={serie}
            fill={SERIES_COLORS[index % SERIES_COLORS.length]}
            radius={[8, 8, 0, 0]}
          />
        ))}
      </BarChart>
    );

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        {content}
      </ResponsiveContainer>
    </div>
  );
}
