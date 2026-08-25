import { useState } from "react";
import { format } from "date-fns";
import {
  FaTimes,
  FaUser,
  FaCalendar,
  FaMoneyBillWave,
  FaCheckCircle,
  FaTimesCircle,
  FaFileInvoice,
  FaSpinner,
} from "react-icons/fa";
import PropTypes from "prop-types";

export function InvoiceDetailsModal({
  isOpen,
  onClose,
  invoice,
  validateInvoice,
  refreshInvoice,
}) {
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen || !invoice) return null;

  const handleValidateInvoice = async (invoiceId) => {
    setIsLoading(true);
    try {
      await validateInvoice(invoiceId);
      await refreshInvoice(); // Recharger les détails après validation
      invoice.isAccounted = true;
    } catch (error) {
      console.error("Error validating invoice:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 backdrop-blur-sm transition-all duration-300">
      <div className="bg-white rounded-lg shadow-xl w-[700px] relative">
        {/* Overlay de chargement */}
        {isLoading && (
          <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-50">
            <FaSpinner className="animate-spin text-primary-start text-4xl" />
          </div>
        )}

        <div className="flex justify-between items-center bg-gradient-to-r from-primary-start to-primary-end p-4">
          <h2 className="text-2xl font-bold text-white">Invoice Details</h2>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200"
            disabled={isLoading}
          >
            <FaTimes size={24} />
          </button>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-2 gap-4">
            <DetailItem
              icon={<FaFileInvoice />}
              label="Invoice ID"
              value={invoice.billCode}
            />
            <DetailItem
              icon={<FaCalendar />}
              label="Date"
              value={format(new Date(invoice.date), "PPP 'at' p")}
            />
            <DetailItem
              icon={<FaMoneyBillWave />}
              label="Amount"
              value={`${invoice.amount} FCFA`}
            />
            <DetailItem
              icon={
                invoice.isAccounted ? (
                  <FaCheckCircle className="text-green-500" />
                ) : (
                  <FaTimesCircle className="text-red-500" />
                )
              }
              label="Validated"
              value={invoice.isAccounted ? "Yes" : "No"}
            />
            <DetailItem
              icon={<FaUser />}
              label="Operator"
              value={`${invoice.operator.first_name} ${invoice.operator.last_name}`}
            />
          </div>

          {/* Invoice Items */}
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-2">Invoice Items</h3>
            <table className="w-full border-separate border-spacing-y-2">
              <thead>
                <tr className="bg-gray-200">
                  <th className="p-2 text-left">Designation</th>
                  <th className="p-2 text-left">Quantity</th>
                  <th className="p-2 text-left">Unit Price</th>
                  <th className="p-2 text-left">Total</th>
                </tr>
              </thead>
              <tbody>
                {invoice.bill_items &&
                  invoice.bill_items.map((item) => (
                    <tr key={item.id} className="bg-gray-100">
                      <td className="p-2">{item.designation}</td>
                      <td className="p-2">{item.quantity}</td>
                      <td className="p-2">{item.unityPrice} FCFA</td>
                      <td className="p-2">{item.total} FCFA</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* Validation Button */}
          <div className="mt-6 flex justify-end">
            {invoice.isAccounted ? (
              <button
                onClick={onClose}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition duration-300"
              >
                OK
              </button>
            ) : (
              <button
                onClick={() => handleValidateInvoice(invoice.id)}
                className="flex items-center px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isLoading}
              >
                {isLoading ? (
                  <FaSpinner className="animate-spin mr-2" />
                ) : (
                  <FaCheckCircle className="mr-2" />
                )}
                Validate Invoice
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailItem({ icon, label, value }) {
  return (
    <div className="flex items-center space-x-2">
      <div className="text-primary-start">{icon}</div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="font-semibold">{value}</p>
      </div>
    </div>
  );
}
DetailItem.propTypes = {
  icon: PropTypes.element.isRequired,
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
};

InvoiceDetailsModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  invoice: PropTypes.object,
  validateInvoice: PropTypes.func.isRequired,
  refreshInvoice: PropTypes.func.isRequired, // Ajout de refreshInvoice comme prop obligatoire
};
