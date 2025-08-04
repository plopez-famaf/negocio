'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface ChartData {
  time: string;
  threats: number;
  verifications: number;
}

interface RealTimeChartProps {
  data: ChartData[];
}

export function RealTimeChart({ data }: RealTimeChartProps) {
  return (
    <div className=\"bg-white rounded-lg p-6 border border-gray-200 slide-up\">
      <h3 className=\"text-lg font-semibold text-gray-900 mb-4\">Real-time Activity</h3>
      <div className=\"h-80\">
        <ResponsiveContainer width=\"100%\" height=\"100%\">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray=\"3 3\" stroke=\"#f0f0f0\" />
            <XAxis 
              dataKey=\"time\" 
              stroke=\"#666\"
              fontSize={12}
            />
            <YAxis 
              stroke=\"#666\"
              fontSize={12}
            />
            <Tooltip 
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
              }}
            />
            <Legend />
            <Line 
              type=\"monotone\" 
              dataKey=\"threats\" 
              stroke=\"#ef4444\" 
              strokeWidth={2}
              dot={{ fill: '#ef4444', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, stroke: '#ef4444', strokeWidth: 2 }}
              name=\"Threats Detected\"
            />
            <Line 
              type=\"monotone\" 
              dataKey=\"verifications\" 
              stroke=\"#10b981\" 
              strokeWidth={2}
              dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, stroke: '#10b981', strokeWidth: 2 }}
              name=\"Identity Verifications\"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}