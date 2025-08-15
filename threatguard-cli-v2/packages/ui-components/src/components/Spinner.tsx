import React, { useState, useEffect } from 'react';
import { Text } from 'ink';

interface SpinnerProps {
  type?: 'dots' | 'line' | 'arrow' | 'bounce';
  color?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({ 
  type = 'dots', 
  color = 'cyan' 
}) => {
  const [frame, setFrame] = useState(0);

  const spinnerFrames = {
    dots: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
    line: ['|', '/', '-', '\\'],
    arrow: ['←', '↖', '↑', '↗', '→', '↘', '↓', '↙'],
    bounce: ['⠁', '⠂', '⠄', '⠂'],
  };

  const frames = spinnerFrames[type];

  useEffect(() => {
    const interval = setInterval(() => {
      setFrame(prev => (prev + 1) % frames.length);
    }, 100);

    return () => clearInterval(interval);
  }, [frames.length]);

  return (
    <Text color={color}>
      {frames[frame]}
    </Text>
  );
};