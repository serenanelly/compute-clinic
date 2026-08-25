import React, { useState } from 'react';
import { Search, Edit2, Trash2, Settings } from 'lucide-react';

export default function PharmacistPage() {
    const [medications] = useState([
        {
            id: 1,
            name: 'para',
            quantity: 8,
            price: 2000,
            status: 'Valid',
            expirationDate: 'Dec,12,2001',
            description: 'Head ache'
        },
        {
            id: 2,
            name: 'para',
            quantity: 8,
            price: 2000,
            status: 'Valid',
            expirationDate: 'Dec,12,2001',
            description: 'Head ache'
        },
        {
            id: 3,
            name: 'para',
            quantity: 8,
            price: 2000,
            status: 'Valid',
            expirationDate: 'Dec,12,2001',
            description: 'Head ache'
        },
        {
            id: 4,
            name: 'para',
            quantity: 8,
            price: 2000,
            status: 'Valid',
            expirationDate: 'Dec,12,2001',
            description: 'Head ache'
        },
        {
            id: 5,
            name: 'para',
            quantity: 8,
            price: 2000,
            status: 'Valid',
            expirationDate: 'Dec,12,2001',
            description: 'Head ache'
        }
    ]);

    return (
        <div className="p-6 max-w-full min-h-screen bg-gray-50">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Pharmacist</h1>
                <div className="flex items-center gap-4">
                    <button className="p-2 rounded-full bg-gray-100">
                        <Settings className="w-5 h-5 text-gray-600" />
                    </button>
                    <button className="p-2 rounded-full bg-gray-100">
                        <Search className="w-5 h-5 text-gray-600" />
                    </button>
                    <div className="flex items-center gap-2">
                        <span className="text-gray-700">Username.N</span>
                        <div className="w-8 h-8 bg-blue-500 rounded-full"></div>
                    </div>
                </div>
            </div>

            {/* Search Bar */}
            <div className="flex items-center justify-between mb-6">
                <div className="relative flex-1 max-w-2xl">
                    <input
                        type="text"
                        placeholder="Search by Name/description/date & price"
                        className="w-full pl-4 pr-12 py-2 border rounded-lg"
                    />
                    <button className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1 bg-blue-600 text-white rounded-lg">
                        Search
                    </button>
                </div>
                <button className="ml-4 p-2 border rounded-lg">
                    <span className="font-medium">Filter</span>
                </button>
            </div>

            {/* Medication List */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="flex justify-between items-center p-4 border-b">
                    <h2 className="text-lg font-medium">List of All Medication (5)</h2>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-gradient-to-r from-teal-500 to-blue-500 text-white">
                                <th className="py-3 px-4 text-left">No.</th>
                                <th className="py-3 px-4 text-left">Medicines Name</th>
                                <th className="py-3 px-4 text-left">Quantity</th>
                                <th className="py-3 px-4 text-left">Price</th>
                                <th className="py-3 px-4 text-left">Status</th>
                                <th className="py-3 px-4 text-left">Expiration Date</th>
                                <th className="py-3 px-4 text-left">Description</th>
                                <th className="py-3 px-4 text-left"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {medications.map((med) => (
                                <tr key={med.id} className="border-b bg-gray-50">
                                    <td className="py-3 px-4">{med.id}</td>
                                    <td className="py-3 px-4">{med.name}</td>
                                    <td className="py-3 px-4">{med.quantity}</td>
                                    <td className="py-3 px-4">{med.price}</td>
                                    <td className="py-3 px-4">
                                        <span className="px-3 py-1 rounded-full bg-green-100 text-green-800">
                                            {med.status}
                                        </span>
                                    </td>
                                    <td className="py-3 px-4">{med.expirationDate}</td>
                                    <td className="py-3 px-4">{med.description}</td>
                                    <td className="py-3 px-4">
                                        <div className="flex gap-2">
                                            <button className="text-blue-600 hover:text-blue-800">
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button className="text-red-600 hover:text-red-800">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="flex justify-center items-center p-4 border-t">
                    <button className="p-1 rounded hover:bg-gray-100">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <span className="mx-4">1/2</span>
                    <button className="p-1 rounded hover:bg-gray-100">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
}