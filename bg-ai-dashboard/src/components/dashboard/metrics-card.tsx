'use client';

import { ReactNode } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface MetricsCardProps {
  title: string;
  value: string;
  icon: ReactNode;
  trend: string;
  trendDirection: 'up' | 'down' | 'neutral';
  color: 'red' | 'orange' | 'green' | 'blue';
}

const colorClasses = {
  red: {
    bg: 'bg-red-50',
    iconBg: 'bg-red-100',
    iconColor: 'text-red-600',
    trend: 'text-red-600'
  },
  orange: {
    bg: 'bg-orange-50',
    iconBg: 'bg-orange-100',
    iconColor: 'text-orange-600',
    trend: 'text-orange-600'
  },
  green: {
    bg: 'bg-green-50',
    iconBg: 'bg-green-100',
    iconColor: 'text-green-600',
    trend: 'text-green-600'
  },
  blue: {
    bg: 'bg-blue-50',
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    trend: 'text-blue-600'
  }
};

export function MetricsCard({ title, value, icon, trend, trendDirection, color }: MetricsCardProps) {
  const colors = colorClasses[color];
  
  const TrendIcon = trendDirection === 'up' ? TrendingUp : 
                   trendDirection === 'down' ? TrendingDown : 
                   Minus;

  return (
    <div className={`${colors.bg} rounded-lg p-6 border border-gray-200 slide-up`}>
      <div className=\"flex items-center justify-between mb-4\">
        <div className={`${colors.iconBg} p-3 rounded-lg`}>
          <div className={colors.iconColor}>
            {icon}
          </div>
        </div>
        <div className=\"flex items-center space-x-1\">
          <TrendIcon className={`w-4 h-4 ${colors.trend}`} />
          <span className={`text-sm font-medium ${colors.trend}`}>
            {trend}
          </span>
        </div>
      </div>
      
      <div>
        <p className=\"text-2xl font-bold text-gray-900 mb-1\">{value}</p>
        <p className=\"text-gray-600 text-sm\">{title}</p>
      </div>
    </div>
  );
}