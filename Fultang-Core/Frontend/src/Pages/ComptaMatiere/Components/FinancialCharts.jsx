import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

export default function FinancialCharts({ data }) {
  // Exemple de données formatées pour les graphiques
  const assetData = [
    {
      name: "Immobilized Assets",
      value: data?.assetCategories?.[0]?.total || 0,
    },
    {
      name: "Circulating Assets",
      value: data?.assetCategories?.[1]?.total || 0,
    },
    { name: "Treasury Assets", value: data?.assetCategories?.[2]?.total || 0 },
  ];

  const liabilityData = [
    { name: "Equity", value: data?.liabilityCategories?.[0]?.total || 0 },
    {
      name: "Financial Debt",
      value: data?.liabilityCategories?.[1]?.total || 0,
    },
    {
      name: "Circulating Liabilities",
      value: data?.liabilityCategories?.[2]?.total || 0,
    },
    {
      name: "Treasury Liabilities",
      value: data?.liabilityCategories?.[3]?.total || 0,
    },
  ];

  const colors = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042"]; // Couleurs pour les graphiques

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* Graphique en camembert pour les actifs */}
      <div className="p-6 bg-white rounded-lg shadow-md">
        <h4 className="text-lg font-semibold mb-4 text-secondary">
          Assets Distribution
        </h4>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={assetData}
              cx="50%"
              cy="50%"
              outerRadius={100}
              fill="#8884d8"
              dataKey="value"
              label
            >
              {assetData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={colors[index % colors.length]}
                />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Graphique en barres pour les passifs */}
      <div className="p-6 bg-white rounded-lg shadow-md">
        <h4 className="text-lg font-semibold mb-4 text-secondary">
          Liabilities Structure
        </h4>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={liabilityData}>
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="value" fill="#8884d8" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Graphique linéaire pour l'évolution des actifs et passifs */}
      <div className="col-span-2 p-6 bg-white rounded-lg shadow-md">
        <h4 className="text-lg font-semibold mb-4 text-secondary">
          Assets vs Liabilities Over Time
        </h4>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data?.timeSeriesData || []}>
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="assets" fill="#0088FE" />
            <Bar dataKey="liabilities" fill="#FF8042" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
