import React from 'react';
import { Text } from 'ink';

interface ProgressBarProps {
  percentage: number;
  width?: number;
  color?: 'green' | 'yellow' | 'red' | 'blue' | 'cyan' | 'magenta';
  showPercentage?: boolean;
  filled?: string;
  empty?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  percentage,
  width = 20,
  color = 'green',
  showPercentage = false,
  filled = '█',
  empty = '░',
}) => {
  const clampedPercentage = Math.max(0, Math.min(100, percentage));
  const filledWidth = Math.round((clampedPercentage / 100) * width);
  const emptyWidth = width - filledWidth;

  const filledBar = filled.repeat(filledWidth);
  const emptyBar = empty.repeat(emptyWidth);

  return (
    <Text>
      <Text color={color}>{filledBar}</Text>
      <Text color="gray">{emptyBar}</Text>
      {showPercentage && (
        <Text color="white"> {clampedPercentage.toFixed(1)}%</Text>
      )}
    </Text>
  );
};