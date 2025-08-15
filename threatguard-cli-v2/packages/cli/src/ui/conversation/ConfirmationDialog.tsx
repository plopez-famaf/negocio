import React, { useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';

export interface ConfirmationRequest {
  id: string;
  prompt: string;
  command?: string;
  timeout: number;
  createdAt: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  risks?: string[];
  context?: Record<string, any>;
}

export interface ConfirmationDialogProps {
  confirmation: ConfirmationRequest;
  onConfirm: () => void;
  onCancel: () => void;
  width?: number;
}

interface ConfirmationDialogState {
  selectedOption: 'confirm' | 'cancel';
  timeRemaining: number;
  isExpired: boolean;
}

/**
 * Safety validation interface for confirming high-risk operations
 * Provides clear risk visualization and timeout handling
 */
export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  confirmation,
  onConfirm,
  onCancel,
  width = 70,
}) => {
  const [state, setState] = useState<ConfirmationDialogState>({
    selectedOption: 'cancel',
    timeRemaining: confirmation.timeout,
    isExpired: false,
  });

  // Update countdown timer
  useEffect(() => {
    const startTime = new Date(confirmation.createdAt).getTime();
    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = now - startTime;
      const remaining = Math.max(0, confirmation.timeout - elapsed);
      
      setState(prev => ({
        ...prev,
        timeRemaining: remaining,
        isExpired: remaining === 0,
      }));

      if (remaining === 0) {
        clearInterval(interval);
        // Auto-cancel when expired
        setTimeout(() => onCancel(), 100);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [confirmation.createdAt, confirmation.timeout, onCancel]);

  /**
   * Format time remaining
   */
  const formatTimeRemaining = (milliseconds: number): string => {
    const seconds = Math.ceil(milliseconds / 1000);
    if (seconds <= 0) return 'EXPIRED';
    if (seconds === 1) return '1 second';
    return `${seconds} seconds`;
  };

  /**
   * Get risk level indicator
   */
  const getRiskIndicator = (): { color: string; icon: string; text: string } => {
    switch (confirmation.riskLevel) {
      case 'critical':
        return { color: 'red', icon: '🔴', text: 'CRITICAL RISK' };
      case 'high':
        return { color: 'yellow', icon: '🟡', text: 'HIGH RISK' };
      case 'medium':
        return { color: 'yellow', icon: '🟠', text: 'MEDIUM RISK' };
      case 'low':
        return { color: 'green', icon: '🟢', text: 'LOW RISK' };
      default:
        return { color: 'white', icon: '⚪', text: 'UNKNOWN RISK' };
    }
  };

  /**
   * Handle keyboard input
   */
  useInput((input, key) => {
    if (state.isExpired) return;

    // Handle Enter key
    if (key.return) {
      if (state.selectedOption === 'confirm') {
        onConfirm();
      } else {
        onCancel();
      }
      return;
    }

    // Handle Escape key - always cancel
    if (key.escape) {
      onCancel();
      return;
    }

    // Handle Tab to toggle selection
    if (key.tab) {
      setState(prev => ({
        ...prev,
        selectedOption: prev.selectedOption === 'confirm' ? 'cancel' : 'confirm',
      }));
      return;
    }

    // Handle arrow keys
    if (key.leftArrow || key.rightArrow) {
      setState(prev => ({
        ...prev,
        selectedOption: prev.selectedOption === 'confirm' ? 'cancel' : 'confirm',
      }));
      return;
    }

    // Handle direct key presses
    if (input === 'y' || input === 'Y') {
      setState(prev => ({ ...prev, selectedOption: 'confirm' }));
      onConfirm();
      return;
    }

    if (input === 'n' || input === 'N') {
      setState(prev => ({ ...prev, selectedOption: 'cancel' }));
      onCancel();
      return;
    }
  });

  const riskIndicator = getRiskIndicator();

  return (
    <Box
      position="absolute"
      top={0}
      left={0}
      width="100%"
      height="100%"
      justifyContent="center"
      alignItems="center"
      backgroundColor="black"
    >
      <Box
        width={width}
        borderStyle="double"
        borderColor={state.isExpired ? 'red' : riskIndicator.color}
        paddingX={2}
        paddingY={1}
        flexDirection="column"
      >
        {/* Header */}
        <Box justifyContent="center" marginBottom={1}>
          <Text color={riskIndicator.color} bold>
            {riskIndicator.icon} CONFIRMATION REQUIRED {riskIndicator.icon}
          </Text>
        </Box>

        {/* Risk level indicator */}
        <Box justifyContent="center" marginBottom={2}>
          <Text color={riskIndicator.color} bold backgroundColor={riskIndicator.color === 'red' ? 'red' : undefined}>
            {riskIndicator.color === 'red' ? ` ${riskIndicator.text} ` : riskIndicator.text}
          </Text>
        </Box>

        {/* Main prompt */}
        <Box flexDirection="column" marginBottom={2}>
          <Text color="white" bold wrap="wrap">
            {confirmation.prompt}
          </Text>
        </Box>

        {/* Risk details if available */}
        {confirmation.risks && confirmation.risks.length > 0 && (
          <Box flexDirection="column" marginBottom={2}>
            <Text color="yellow" bold>⚠️ Potential Risks:</Text>
            {confirmation.risks.slice(0, 4).map((risk, index) => (
              <Box key={index} marginLeft={2}>
                <Text color="yellow">• {risk}</Text>
              </Box>
            ))}
            {confirmation.risks.length > 4 && (
              <Box marginLeft={2}>
                <Text color="gray">... and {confirmation.risks.length - 4} more risks</Text>
              </Box>
            )}
          </Box>
        )}

        {/* Command preview if available */}
        {confirmation.command && (
          <Box flexDirection="column" marginBottom={2}>
            <Text color="cyan" bold>🔍 Command:</Text>
            <Box marginLeft={2} paddingX={1} backgroundColor="gray">
              <Text color="black" bold>
                {confirmation.command.length > 50 
                  ? `${confirmation.command.substring(0, 50)}...` 
                  : confirmation.command}
              </Text>
            </Box>
          </Box>
        )}

        {/* Timeout warning */}
        <Box justifyContent="center" marginBottom={2}>
          <Text color={state.timeRemaining < 5000 ? 'red' : 'yellow'}>
            ⏰ Time remaining: {formatTimeRemaining(state.timeRemaining)}
          </Text>
        </Box>

        {/* Action buttons */}
        {!state.isExpired ? (
          <Box justifyContent="center" gap={4}>
            <Box
              borderStyle="single"
              borderColor={state.selectedOption === 'cancel' ? 'red' : 'gray'}
              paddingX={2}
              backgroundColor={state.selectedOption === 'cancel' ? 'red' : undefined}
            >
              <Text
                color={state.selectedOption === 'cancel' ? 'white' : 'red'}
                bold={state.selectedOption === 'cancel'}
              >
                {state.selectedOption === 'cancel' ? '▶ ' : '  '}Cancel (N)
              </Text>
            </Box>

            <Box
              borderStyle="single"
              borderColor={state.selectedOption === 'confirm' ? 'green' : 'gray'}
              paddingX={2}
              backgroundColor={state.selectedOption === 'confirm' ? 'green' : undefined}
            >
              <Text
                color={state.selectedOption === 'confirm' ? 'white' : 'green'}
                bold={state.selectedOption === 'confirm'}
              >
                {state.selectedOption === 'confirm' ? '▶ ' : '  '}Confirm (Y)
              </Text>
            </Box>
          </Box>
        ) : (
          <Box justifyContent="center">
            <Text color="red" bold>
              ❌ CONFIRMATION EXPIRED - Operation Cancelled
            </Text>
          </Box>
        )}

        {/* Controls help */}
        {!state.isExpired && (
          <Box marginTop={2} borderTop borderColor="gray" paddingTop={1}>
            <Box justifyContent="center">
              <Text color="gray" dimColor>
                ←→ Tab navigate • Enter select • Y confirm • N cancel • Esc cancel
              </Text>
            </Box>
          </Box>
        )}

        {/* Additional context if available */}
        {confirmation.context && Object.keys(confirmation.context).length > 0 && (
          <Box marginTop={1} borderTop borderColor="gray" paddingTop={1}>
            <Text color="gray" bold>Additional Context:</Text>
            <Box flexDirection="column" marginLeft={2}>
              {Object.entries(confirmation.context).slice(0, 3).map(([key, value]) => (
                <Text key={key} color="gray">
                  • {key}: {String(value)}
                </Text>
              ))}
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default ConfirmationDialog;