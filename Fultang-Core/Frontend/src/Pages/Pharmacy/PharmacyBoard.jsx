/* eslint-disable no-unused-vars */
import React from 'react';

export function PharmacyBoard ()  {
  const medicines = [
    { id: 1, name: 'para', quantity: 8, price: 2000, status: 'Valid', expirationDate: 'Dec,12,2001', description: 'Head ache' },
    { id: 1, name: 'para', quantity: 8, price: 2000, status: 'Valid', expirationDate: 'Dec,12,2001', description: 'Head ache' },
    { id: 1, name: 'para', quantity: 8, price: 2000, status: 'Valid', expirationDate: 'Dec,12,2001', description: 'Head ache' },
    { id: 1, name: 'para', quantity: 8, price: 2000, status: 'Valid', expirationDate: 'Dec,12,2001', description: 'Head ache' },
    { id: 1, name: 'para', quantity: 8, price: 2000, status: 'Valid', expirationDate: 'Dec,12,2001', description: 'Head ache' },
    
  ];

  return (
    <div className="overflow-x-auto rounded-lg">
      <table className="w-full">
        <thead className="bg-gradient-to-r from-[#1A73A3] to-[#50C2B9] text-white">
          <tr>
            <th className="p-3 text-left">No.</th>
            <th className="p-3 text-left">Medicines Name</th>
            <th className="p-3 text-left">Quantity</th>
            <th className="p-3 text-left">Price</th>
            <th className="p-3 text-left">Status</th>
            <th className="p-3 text-left">Expiration Date</th>
            <th className="p-3 text-left">Description</th>
          </tr>
        </thead>
        <tbody>
          {medicines.map((medicine, index) => (
            <tr key={medicine.id} className={index % 2 === 0 ? 'bg-[#F4F6FF]' : 'bg-white'}>
              <td className="p-3">{medicine.id}</td>
              <td className="p-3">{medicine.name}</td>
              <td className="p-3">{medicine.quantity}</td>
              <td className="p-3">{medicine.price}</td>
              <td className="p-3">
                <span className="px-3 py-1 rounded-full bg-[#0CA73F] text-white text-sm">
                  {medicine.status}
                </span>
              </td>
              <td className="p-3">{medicine.expirationDate}</td>
              <td className="p-3">{medicine.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
