/* eslint-disable no-unused-vars */
import React from 'react';
import { FiFilter } from 'react-icons/fi';

export function PharmacyFilter() {
    return (
      <div className="flex justify-between items-center p-4">
        <h2 className="text-xl font-semibold">Recently Added Medicine</h2>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-4 py-2 bg-[#F4F6FF] rounded-lg">
            <span>Filter</span>
            <FiFilter />
          </button>
        </div>
      </div>
    );
  }
  