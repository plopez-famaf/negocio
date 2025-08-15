import React from 'react';
import { Box, Text } from 'ink';
import type { AlertProps } from '../types/index.js';

export const Alert: React.FC<AlertProps> = ({ type, title, children, onClose }) => {
  const getAlertStyle = () => {
    switch (type) {
      case 'success':
        return {
          color: 'green' as const,
          symbol: '✅',
          border: '─',
        };
      case 'warning':
        return {
          color: 'yellow' as const,
          symbol: '⚠️',
          border: '─',
        };
      case 'error':
        return {
          color: 'red' as const,
          symbol: '❌',
          border: '─',
        };
      case 'info':
      default:
        return {
          color: 'blue' as const,
          symbol: 'ℹ️',
          border: '─',
        };
    }
  };

  const { color, symbol, border } = getAlertStyle();

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={color} padding={1}>
      <Box marginBottom={title ? 1 : 0}>
        <Text color={color}>
          {symbol} {title && <Text bold>{title}</Text>}
        </Text>
        {onClose && (
          <Box marginLeft="auto">
            <Text color="gray">[Press 'x' to close]</Text>
          </Box>
        )}
      </Box>
      
      <Box>
        <Text>{children}</Text>
      </Box>
    </Box>
  );
};