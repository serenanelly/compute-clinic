import { format } from "date-fns";
import {
  FaTimes,
  FaUser,
  FaCalendar,
  FaMoneyBillWave,
  FaCheckCircle,
  FaTimesCircle,
} from "react-icons/fa";

export function ViewBillDetailsModal({ isOpen, onClose, billDetails }) {
  if (!isOpen || !billDetails) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 backdrop-blur-sm transition-all duration-300">
      <div className="bg-white rounded-lg shadow-xl w-[700px]">
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="flex justify-between items-center bg-gradient-to-r from-primary-start to-primary-end p-4">
            <h2 className="text-2xl font-bold text-white">Bill Details</h2>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-200"
            >
              <FaTimes size={24} />
            </button>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 gap-4">
              <DetailItem
                icon={<FaUser />}
                label="Bill Code"
                value={billDetails.billCode}
              />
              <DetailItem
                icon={<FaCalendar />}
                label="Date"
                value={format(new Date(billDetails.date), "PPP 'at' p")}
              />
              <DetailItem
                icon={<FaMoneyBillWave />}
                label="Amount"
                value={`$${billDetails.amount.toFixed(2)}`}
              />
              <DetailItem
                icon={
                  billDetails.isAccounted ? (
                    <FaCheckCircle className="text-green-500" />
                  ) : (
                    <FaTimesCircle className="text-red-500" />
                  )
                }
                label="Accounted"
                value={billDetails.isAccounted ? "Yes" : "No"}
              />
              <DetailItem
                icon={<FaUser />}
                label="Operation"
                value={billDetails.operation.name}
              />
              <DetailItem
                icon={<FaUser />}
                label="Operator"
                value={
                  billDetails.operator.first_name +
                  " " +
                  billDetails.operator.last_name
                }
              />
              <DetailItem
                icon={<FaUser />}
                label="Patient"
                value={
                  billDetails.patient ? billDetails.patient.toString() : "N/A"
                }
              />
              <DetailItem
                icon={<FaUser />}
                label="Source"
                value={billDetails.operator.role}
              />
            </div>
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
