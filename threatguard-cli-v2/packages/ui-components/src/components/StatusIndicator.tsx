import React from 'react';
import { Text } from 'ink';

interface StatusIndicatorProps {
  status: 'online' | 'offline' | 'degraded' | 'unknown';
  showText?: boolean;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({ 
  status, 
  showText = true 
}) => {
  const getStatusDisplay = () => {
    switch (status) {
      case 'online':
        return {
          color: 'green' as const,
          symbol: '●',
          text: 'Online',
        };
      case 'offline':
        return {
          color: 'red' as const,
          symbol: '●',
          text: 'Offline',
        };
      case 'degraded':
        return {
          color: 'yellow' as const,
          symbol: '●',
          text: 'Degraded',
        };
      case 'unknown':
      default:
        return {
          color: 'gray' as const,
          symbol: '●',
          text: 'Unknown',
        };
    }
  };

  const { color, symbol, text } = getStatusDisplay();

  return (
    <Text color={color}>
      {symbol} {showText && text}
    </Text>
  );
};