import { useEffect } from "react";
import axiosInstanceAccountant from "../../../Utils/axiosInstanceAccountant";

export default function IncomeStatement({ year }) {
  const expenses = [
    { code: "60", label: "Achats de biens et services", amount: 2500000 },
    { code: "63", label: "Impôts et taxes", amount: 350000 },
    { code: "64", label: "Charges de personnel", amount: 4200000 },
    { code: "66", label: "Charges financières", amount: 180000 },
    { code: "68", label: "Amortissements", amount: 420000 },
  ];

  const income = [
    { code: "70", label: "Ventes (chiffre d'affaires)", amount: 8250000 },
    { code: "74", label: "Subventions d'exploitation", amount: 150000 },
    { code: "76", label: "Produits financiers", amount: 75000 },
  ];

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await axiosInstanceAccountant.get(
          `/budget-exercise/get_income_statement/`
        );

        console.log(response);
      } catch (error) {
        console.log(error);
      }
    }
    fetchData();
  }, []);

  const formatAmount = (amount) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "XAF",
    }).format(amount);
  };

  const totalExpenses = expenses.reduce((sum, item) => sum + item.amount, 0);
  const totalIncome = income.reduce((sum, item) => sum + item.amount, 0);
  const netResult = totalIncome - totalExpenses;

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        {/* Expenses Side */}
        <div>
          <h3 className="text-lg font-semibold mb-4 text-secondary">Charges</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Code
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Libellé
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Montant
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {expenses.map((item) => (
                  <tr key={item.code} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-mono text-sm">{item.code}</td>
                    <td className="px-4 py-2 text-sm">{item.label}</td>
                    <td className="px-4 py-2 text-right text-sm">
                      {formatAmount(item.amount)}
                    </td>
                  </tr>
                ))}
                <tr className="font-semibold bg-gray-50">
                  <td colSpan={2} className="px-4 py-2">
                    Total des charges
                  </td>
                  <td className="px-4 py-2 text-right">
                    {formatAmount(totalExpenses)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Income Side */}
        <div>
          <h3 className="text-lg font-semibold mb-4 text-secondary">
            Produits
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Code
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Libellé
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Montant
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {income.map((item) => (
                  <tr key={item.code} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-mono text-sm">{item.code}</td>
                    <td className="px-4 py-2 text-sm">{item.label}</td>
                    <td className="px-4 py-2 text-right text-sm">
                      {formatAmount(item.amount)}
                    </td>
                  </tr>
                ))}
                <tr className="font-semibold bg-gray-50">
                  <td colSpan={2} className="px-4 py-2">
                    Total des produits
                  </td>
                  <td className="px-4 py-2 text-right">
                    {formatAmount(totalIncome)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="mt-8 p-4 bg-gray-50 rounded-lg">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-secondary">
            Résultat net de l'exercice
          </h3>
          <span
            className={`text-xl font-bold ${
              netResult >= 0 ? "text-green-600" : "text-red-600"
            }`}
          >
            {formatAmount(netResult)}
          </span>
        </div>
      </div>
    </div>
  );
}
