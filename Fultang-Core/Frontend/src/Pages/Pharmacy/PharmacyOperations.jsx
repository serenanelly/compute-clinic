import React from 'react';
import { FiPlusCircle, FiList, FiFileText } from 'react-icons/fi';

export function PharmacyOperations() {
  return (
    <div className="p-6 space-y-4">
      <h3 className="text-xl font-medium text-gray-900">Quick Operations</h3>
      
      <div className="space-y-3">
        <button className="flex items-center gap-3 w-full p-4 bg-white shadow-sm hover:shadow-md rounded-xl transition-shadow">
          <div className="p-2 rounded-full bg-[#3244BD] text-white">
            <FiPlusCircle className="w-5 h-5" />
          </div>
          <span className="text-[#3244BD]">Add Medicines</span>
        </button>

        <button className="flex items-center gap-3 w-full p-4 bg-white shadow-sm hover:shadow-md rounded-xl transition-shadow">
          <div className="p-2 rounded-full bg-[#3244BD] text-white">
            <FiFileText className="w-5 h-5" />
          </div>
          <span className="text-[#3244BD]">Add a New Bill</span>
        </button>

        <button className="flex items-center gap-3 w-full p-4 bg-white shadow-sm hover:shadow-md rounded-xl transition-shadow">
          <div className="p-2 rounded-full bg-[#3244BD] text-white">
            <FiList className="w-5 h-5" />
          </div>
          <span className="text-[#3244BD]">List of Bills</span>
        </button>
      </div>

      
      <div className="mt-8 p-4 bg-gradient-to-r from-primary-start to-primary-end rounded-lg text-white">
        <h3 className="text-xl font-bold">Save, Secured and Efficient Medications</h3>
        <img 
                        src="/doctorimage.png" 
                        alt="doctor" 
                        className="w-full h-full object-cover"
                    />
      
      </div>
    </div>
  );
}

export default PharmacyOperations;