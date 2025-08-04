'use client';

import { useState, useEffect } from 'react';
import { MapPin, AlertTriangle } from 'lucide-react';

interface ThreatLocation {
  id: string;
  country: string;
  city: string;
  threatCount: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  lastSeen: string;
}

export function ThreatMap() {
  const [threats, setThreats] = useState<ThreatLocation[]>([
    {
      id: '1',
      country: 'United States',
      city: 'New York',
      threatCount: 23,
      severity: 'high',
      lastSeen: '2 minutes ago'
    },
    {
      id: '2',
      country: 'United Kingdom',
      city: 'London',
      threatCount: 15,
      severity: 'medium',
      lastSeen: '5 minutes ago'
    },
    {
      id: '3',
      country: 'Germany',
      city: 'Berlin',
      threatCount: 8,
      severity: 'low',
      lastSeen: '12 minutes ago'
    },
    {
      id: '4',
      country: 'Japan',
      city: 'Tokyo',
      threatCount: 31,
      severity: 'critical',
      lastSeen: '1 minute ago'
    },
    {
      id: '5',
      country: 'Brazil',
      city: 'São Paulo',
      threatCount: 19,
      severity: 'medium',
      lastSeen: '8 minutes ago'
    }
  ]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  useEffect(() => {
    // Simulate real-time updates
    const interval = setInterval(() => {
      setThreats(prev => prev.map(threat => ({
        ...threat,
        threatCount: threat.threatCount + Math.floor(Math.random() * 3),
        lastSeen: Math.random() > 0.7 ? 'Just now' : threat.lastSeen
      })));
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className=\"bg-white rounded-lg p-6 border border-gray-200 slide-up\">
      <div className=\"flex items-center justify-between mb-4\">
        <h3 className=\"text-lg font-semibold text-gray-900\">Global Threat Map</h3>
        <div className=\"flex items-center space-x-2\">
          <div className=\"w-2 h-2 bg-green-500 rounded-full pulse-glow\"></div>
          <span className=\"text-sm text-gray-500\">Live</span>
        </div>
      </div>
      
      <div className=\"space-y-4 max-h-80 overflow-y-auto\">
        {threats.map((threat) => (
          <div key={threat.id} className=\"flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors\">
            <div className=\"flex items-center space-x-3\">
              <MapPin className=\"w-4 h-4 text-gray-500\" />
              <div>
                <p className=\"font-medium text-gray-900\">{threat.city}, {threat.country}</p>
                <p className=\"text-sm text-gray-500\">{threat.lastSeen}</p>
              </div>
            </div>
            
            <div className=\"flex items-center space-x-3\">
              <div className=\"text-right\">
                <p className=\"font-semibold text-gray-900\">{threat.threatCount}</p>
                <p className=\"text-xs text-gray-500\">threats</p>
              </div>
              <div className={`px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(threat.severity)}`}>
                {threat.severity}
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <div className=\"mt-4 pt-4 border-t border-gray-200\">
        <div className=\"flex items-center justify-between text-sm\">
          <span className=\"text-gray-500\">Total Global Threats</span>
          <span className=\"font-semibold text-gray-900\">
            {threats.reduce((sum, threat) => sum + threat.threatCount, 0)}
          </span>
        </div>
      </div>
    </div>
  );
}