import React, { useState } from 'react';
import { PharmacyDashboard } from './PharmacyDashboard';
import { PharmacyNavbar } from './PharmacyNavBar';

export function PharmacyMedication () {
  const [formData, setFormData] = useState({
    medicineName: '',
    quantity: '',
    price: '',
    status: 'Valid',
    expirationDate: {
      dd: '',
      mm: '',
      yyyy: ''
    },
    description: ''
  });

  const [showPreview, setShowPreview] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    // Handle form submission
  };

  return (
    <PharmacyDashboard >
      <div className="min-h-screen bg-gray-50">
        <PharmacyNavbar username="Username.N" />
        
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-6">Add Medications</h2>
          
          <div className="flex gap-6">
            {/* Form Section */}
            <div className="flex-1 bg-white rounded-lg p-6 shadow-sm">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Medicine Name
                  </label>
                  <input
                    type="text"
                    className="w-full p-2 border rounded-md"
                    value={formData.medicineName}
                    onChange={(e) => setFormData({...formData, medicineName: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Quantity
                  </label>
                  <input
                    type="number"
                    className="w-full p-2 border rounded-md"
                    value={formData.quantity}
                    onChange={(e) => setFormData({...formData, quantity: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Price
                  </label>
                  <input
                    type="number"
                    className="w-full p-2 border rounded-md"
                    value={formData.price}
                    onChange={(e) => setFormData({...formData, price: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <input
                    type="text"
                    className="w-full p-2 border rounded-md"
                    value={formData.status}
                    readOnly
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Expiration Date
                  </label>
                  <div className="flex gap-4">
                    <input
                      type="text"
                      placeholder="DD"
                      className="w-20 p-2 border rounded-md"
                      value={formData.expirationDate.dd}
                      onChange={(e) => setFormData({
                        ...formData,
                        expirationDate: {...formData.expirationDate, dd: e.target.value}
                      })}
                    />
                    <input
                      type="text"
                      placeholder="MM"
                      className="w-20 p-2 border rounded-md"
                      value={formData.expirationDate.mm}
                      onChange={(e) => setFormData({
                        ...formData,
                        expirationDate: {...formData.expirationDate, mm: e.target.value}
                      })}
                    />
                    <input
                      type="text"
                      placeholder="YYYY"
                      className="w-24 p-2 border rounded-md"
                      value={formData.expirationDate.yyyy}
                      onChange={(e) => setFormData({
                        ...formData,
                        expirationDate: {...formData.expirationDate, yyyy: e.target.value}
                      })}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    className="w-full p-2 border rounded-md h-24"
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setShowPreview(true)}
                  className="w-full py-2 px-4 bg-gradient-to-r from-primary-start to-primary-end text-white rounded-md hover:opacity-90 transition-opacity"
                >
                  Preview
                </button>
              </form>
            </div>

            {/* Preview Section */}
            {showPreview && (
              <div className="flex-1 bg-white rounded-lg p-6 shadow-sm">
                <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
                  <div className="flex justify-between">
                    <span className="font-medium">Medicine Name</span>
                    <span>{formData.medicineName || 'Para'}</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="font-medium">Quantity</span>
                    <span>{formData.quantity || '80'}</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="font-medium">Price</span>
                    <span>{formData.price || '5000'} XAF</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="font-medium">Status</span>
                    <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                      Valid
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="font-medium">Description</span>
                    <span>{formData.description || 'Head Ache'}</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="font-medium">Expiration</span>
                    <span>12/12/2024</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="font-medium">Registered On</span>
                    <span>12/12/2024</span>
                  </div>

                  <div className="space-y-3 pt-4">
                    <button className="w-full py-2 px-4 bg-gradient-to-r from-primary-start to-primary-end text-white rounded-md hover:opacity-90 transition-opacity">
                      Submit
                    </button>
                    <button className="w-full py-2 px-4 border border-red-500 text-red-500 rounded-md hover:bg-red-50 transition-colors">
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </PharmacyDashboard>
  );
};

