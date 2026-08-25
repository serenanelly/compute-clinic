"use client";

import { useEffect, useState } from "react";
import axiosInstanceAccountant from "../../../Utils/axiosInstanceAccountant";
import {
  FaBalanceScale,
  FaChartLine,
  FaCoins,
  FaFileInvoice,
  FaChevronDown,
  FaChevronUp,
} from "react-icons/fa";

export default function BalanceSheet({ year }) {
  const [balanceSheetData, setBalanceSheetData] = useState({ data: [] });
  const [expandedCategories, setExpandedCategories] = useState({});

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await axiosInstanceAccountant.get(
          `/budget-exercise/get_balance_sheet/`
        );
        console.log(response.data);
        setBalanceSheetData(response.data);
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

  const toggleCategory = (category) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  const renderCategoryCard = (data, title, icon) => (
    <div key={title} className="bg-white rounded-lg shadow-md p-4 mb-4">
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => toggleCategory(title)}
      >
        <div className="flex items-center">
          {icon}
          <h3 className="text-lg font-semibold text-secondary ml-2">{title}</h3>
        </div>
        {expandedCategories[title] ? (
          <FaChevronUp className="text-gray-500" />
        ) : (
          <FaChevronDown className="text-gray-500" />
        )}
      </div>
      {expandedCategories[title] && (
        <div className="mt-4">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="px-2 py-1 text-left text-sm font-medium text-gray-600">
                  Code
                </th>
                <th className="px-2 py-1 text-left text-sm font-medium text-gray-600">
                  Libellé
                </th>
                <th className="px-2 py-1 text-right text-sm font-medium text-gray-600">
                  Montant
                </th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => (
                <tr key={item.accountNo} className="hover:bg-gray-50">
                  <td className="px-2 py-1 text-sm font-mono">
                    {item.accountNo}
                  </td>
                  <td className="px-2 py-1 text-sm">{item.label}</td>
                  <td className="px-2 py-1 text-right text-sm">
                    {formatAmount(item.amount)}
                  </td>
                </tr>
              ))}
              <tr className="bg-gray-50 font-semibold">
                <td colSpan={2} className="px-2 py-1">
                  Total
                </td>
                <td className="px-2 py-1 text-right">
                  {formatAmount(data.total)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const renderSummary = (summaryData) => (
    <div className="bg-white rounded-lg shadow-md p-4 mb-6">
      <div className="flex items-center mb-4">
        <FaChartLine className="text-secondary text-xl" />
        <h3 className="text-lg font-semibold text-secondary ml-2">Summary</h3>
      </div>
      <table className="w-full">
        <thead>
          <tr className="border-b">
            <th className="px-2 py-1 text-left text-sm font-medium text-gray-600">
              Item
            </th>
            <th className="px-2 py-1 text-right text-sm font-medium text-gray-600">
              Value
            </th>
          </tr>
        </thead>
        <tbody>
          {summaryData.map((item, index) => (
            <tr key={index} className="hover:bg-gray-50">
              <td className="px-2 py-1 text-sm">{item.item}</td>
              <td className="px-2 py-1 text-right text-sm">
                {item.value !== null ? formatAmount(item.value) : "N/A"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const assetCategories = [
    "IMMOBILIZED ACTIVE",
    "CIRCULANT ACTIVE",
    "ACTIVE TREASURY",
  ];
  const liabilityCategories = [
    "EQUITY",
    "FINANCIAL DEBT",
    "CIRCULANT PASSIVE",
    "PASSIVE TREASURY",
  ];

  return (
    <div className="container mx-auto p-4">
      {/* Summary Section at the Top */}
      {balanceSheetData.data.find((section) => Array.isArray(section.data)) &&
        renderSummary(
          balanceSheetData.data.find((section) => Array.isArray(section.data))
            .data
        )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Assets Side */}
        <div>
          <div className="flex items-center mb-4">
            <FaCoins className="text-secondary text-xl" />
            <h2 className="text-xl font-bold text-secondary ml-2">Assets</h2>
          </div>
          {balanceSheetData.data
            .filter((section) => assetCategories.includes(section.category))
            .map((section) =>
              renderCategoryCard(
                section,
                section.category,
                <FaFileInvoice className="text-secondary text-lg" />
              )
            )}
        </div>

        {/* Liabilities and Equity Side */}
        <div>
          <div className="flex items-center mb-4">
            <FaBalanceScale className="text-secondary text-xl" />
            <h2 className="text-xl font-bold text-secondary ml-2">
              Liabilities & Equity
            </h2>
          </div>
          {balanceSheetData.data
            .filter((section) => liabilityCategories.includes(section.category))
            .map((section) =>
              renderCategoryCard(
                section,
                section.category,
                <FaFileInvoice className="text-secondary text-lg" />
              )
            )}
        </div>
      </div>
    </div>
  );
}
