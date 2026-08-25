import React, { useState, useEffect } from 'react';
import { RefreshCw, Activity } from 'lucide-react';

export const LaboratoryHeader = ({ title, subtitle, icon: IconComponent }) => {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 800);
    // You can also pass a prop function here if you need to actually refresh data
  };

  return (
    <div className="flex justify-between items-center mb-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800 flex items-center">
          {IconComponent && <IconComponent className="w-7 h-7 mr-2 text-primary-start" />}
          {title}
        </h2>
        <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleRefresh}
          className={`p-2 text-gray-400 hover:text-primary-start hover:bg-white rounded-lg border border-gray-200 transition-all shadow-sm`}
          title="Rafraîchir"
        >
          <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>
    </div>
  );
};
