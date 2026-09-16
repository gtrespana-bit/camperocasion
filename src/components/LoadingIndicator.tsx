'use client';

import { useTranslations } from 'next-intl';

interface LoadingIndicatorProps {
  count?: number;
}

export const LoadingIndicator = ({ count = 6 }: LoadingIndicatorProps) => {
  const t = useTranslations('common');
  
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div 
          key={i} 
          className="bg-white rounded-xl overflow-hidden border border-gray-100 shadow-sm animate-pulse"
        >
          <div className="aspect-square bg-gray-200" />
          <div className="p-4 space-y-2">
            <div className="h-4 bg-gray-200 rounded w-3/4" />
            <div className="h-6 bg-gray-200 rounded w-1/2" />
            <div className="h-3 bg-gray-200 rounded w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
};