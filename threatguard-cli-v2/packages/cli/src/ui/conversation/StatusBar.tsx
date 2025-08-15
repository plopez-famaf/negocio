import React, { useMemo } from 'react';
import { Box, Text, Spacer } from 'ink';
import { ChatSession } from '../../conversation/interface/ChatManager.js';

export interface StatusBarProps {
  session: ChatSession | null;
  isProcessing?: boolean;
  error?: string | null;
  stats?: {
    messagesCount: number;
    sessionDuration: number;
    avgResponseTime: number;
  };
}

/**
 * Status bar component showing session information and system status
 */
export const StatusBar: React.FC<StatusBarProps> = ({
  session,
  isProcessing = false,
  error = null,
  stats,
}) => {
  /**
   * Format duration in human-readable format
   */
  const formatDuration = (milliseconds: number): string => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  };

  /**
   * Format response time
   */
  const formatResponseTime = (milliseconds: number): string => {
    if (milliseconds < 1000) {
      return `${Math.round(milliseconds)}ms`;
    }
    return `${(milliseconds / 1000).toFixed(1)}s`;
  };

  /**
   * Get session state indicator
   */
  const getStateIndicator = (): { icon: string; color: string; text: string } => {
    if (error) {
      return { icon: '❌', color: 'red', text: 'Error' };
    }
    
    if (!session) {
      return { icon: '🔄', color: 'blue', text: 'Initializing' };
    }

    if (isProcessing) {
      return { icon: '⚡', color: 'yellow', text: 'Processing' };
    }

    switch (session.currentState) {
      case 'idle':
        return { icon: '✅', color: 'green', text: 'Ready' };
      case 'processing':
        return { icon: '⚡', color: 'yellow', text: 'Processing' };
      case 'waiting_confirmation':
        return { icon: '⚠️', color: 'yellow', text: 'Awaiting Confirmation' };
      case 'executing_command':
        return { icon: '🔄', color: 'blue', text: 'Executing' };
      case 'waiting_clarification':
        return { icon: '❓', color: 'cyan', text: 'Needs Clarification' };
      case 'error':
        return { icon: '❌', color: 'red', text: 'Error' };
      default:
        return { icon: '⚪', color: 'gray', text: 'Unknown' };
    }
  };

  /**
   * Get authentication status indicator
   */
  const getAuthStatus = (): { icon: string; color: string; text: string } => {
    if (!session) {
      return { icon: '⚪', color: 'gray', text: 'Unknown' };
    }

    switch (session.context.session.authenticationStatus) {
      case 'authenticated':
        return { icon: '🔐', color: 'green', text: 'Authenticated' };
      case 'unauthenticated':
        return { icon: '🔓', color: 'yellow', text: 'Guest Mode' };
      case 'expired':
        return { icon: '⏰', color: 'red', text: 'Session Expired' };
      default:
        return { icon: '❓', color: 'gray', text: 'Unknown' };
    }
  };

  /**
   * Get performance indicator color
   */
  const getPerformanceColor = (responseTime: number): string => {
    if (responseTime < 200) return 'green';
    if (responseTime < 500) return 'yellow';
    if (responseTime < 1000) return 'red';
    return 'red';
  };

  const stateIndicator = getStateIndicator();
  const authStatus = getAuthStatus();

  return (
    <Box 
      borderStyle="single" 
      borderColor={error ? 'red' : stateIndicator.color}
      paddingX={1}
    >
      <Box width="100%" justifyContent="space-between" alignItems="center">
        {/* Left section - Application and state */}
        <Box>
          <Text color="green" bold>
            🛡️ ThreatGuard Chat
          </Text>
          <Text color="gray" marginLeft={1}>
            •
          </Text>
          <Text color={stateIndicator.color} marginLeft={1}>
            {stateIndicator.icon} {stateIndicator.text}
          </Text>
        </Box>

        {/* Center section - Session info */}
        {session && (
          <Box>
            <Text color="cyan">
              Session: {session.sessionId.substring(0, 8)}...
            </Text>
            {session.userId && (
              <>
                <Text color="gray" marginLeft={1}>•</Text>
                <Text color="blue" marginLeft={1}>
                  User: {session.userId}
                </Text>
              </>
            )}
          </Box>
        )}

        {/* Right section - Stats and auth */}
        <Box>
          {/* Authentication status */}
          <Text color={authStatus.color}>
            {authStatus.icon} {authStatus.text}
          </Text>

          {/* Session stats */}
          {stats && session && (
            <>
              <Text color="gray" marginLeft={2}>•</Text>
              <Text color="white" marginLeft={1}>
                {stats.messagesCount} msg
              </Text>
              
              <Text color="gray" marginLeft={1}>•</Text>
              <Text color="white" marginLeft={1}>
                {formatDuration(stats.sessionDuration)}
              </Text>

              {stats.avgResponseTime > 0 && (
                <>
                  <Text color="gray" marginLeft={1}>•</Text>
                  <Text color={getPerformanceColor(stats.avgResponseTime)} marginLeft={1}>
                    {formatResponseTime(stats.avgResponseTime)} avg
                  </Text>
                </>
              )}
            </>
          )}

          {/* Error indicator */}
          {error && (
            <>
              <Text color="gray" marginLeft={2}>•</Text>
              <Text color="red" marginLeft={1}>
                ❌ Error
              </Text>
            </>
          )}

          {/* Processing indicator */}
          {isProcessing && (
            <>
              <Text color="gray" marginLeft={2}>•</Text>
              <Text color="yellow" marginLeft={1}>
                ⚡ Processing...
              </Text>
            </>
          )}
        </Box>
      </Box>

      {/* Second row for additional information */}
      {(error || session?.pendingConfirmation) && (
        <Box marginTop={1} borderTop borderColor="gray" paddingTop={1}>
          {/* Error details */}
          {error && (
            <Box>
              <Text color="red" bold>Error: </Text>
              <Text color="red">{error}</Text>
            </Box>
          )}

          {/* Pending confirmation details */}
          {session?.pendingConfirmation && (
            <Box>
              <Text color="yellow" bold>⏳ Pending: </Text>
              <Text color="white">
                {session.pendingConfirmation.prompt}
              </Text>
              <Spacer />
              <Text color="gray" dimColor>
                Timeout: {Math.ceil((session.pendingConfirmation.timeout - 
                  (Date.now() - new Date(session.pendingConfirmation.createdAt).getTime())) / 1000)}s
              </Text>
            </Box>
          )}
        </Box>
      )}

      {/* Third row for current topic/context */}
      {session?.context.session.currentTopic && (
        <Box marginTop={1} borderTop borderColor="gray" paddingTop={1}>
          <Text color="cyan" bold>Context: </Text>
          <Text color="white">
            {session.context.session.currentTopic.replace('_', ' ')}
          </Text>
          
          {/* Recent activity summary */}
          {session.context.recentIntents.length > 0 && (
            <>
              <Text color="gray" marginLeft={2}>•</Text>
              <Text color="gray" marginLeft={1}>
                Recent: {session.context.recentIntents.slice(0, 3).join(' → ')}
              </Text>
            </>
          )}
        </Box>
      )}

      {/* Debug information (only in development) */}
      {process.env.NODE_ENV === 'development' && session && (
        <Box marginTop={1} borderTop borderColor="gray" paddingTop={1}>
          <Text color="gray" dimColor>
            Debug: State={session.currentState} | 
            Entities={session.context.recentEntities.length} | 
            Commands={session.context.recentCommands.length}
            {session.context.errorCount > 0 && ` | Errors=${session.context.errorCount}`}
          </Text>
        </Box>
      )}
    </Box>
  );
};

export default StatusBar;