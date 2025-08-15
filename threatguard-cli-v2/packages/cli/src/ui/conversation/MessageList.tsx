import React, { useMemo, useRef, useEffect } from 'react';
import { Box, Text, Spacer } from 'ink';
import { ChatMessage } from '../../conversation/interface/ChatManager.js';

export interface MessageListProps {
  messages: ChatMessage[];
  isProcessing: boolean;
  maxVisibleMessages?: number;
}

export interface MessageDisplayProps {
  message: ChatMessage;
  isLatest: boolean;
}

/**
 * Individual message display component with rich formatting
 */
const MessageDisplay: React.FC<MessageDisplayProps> = ({ message, isLatest }) => {
  const getMessageIcon = (type: ChatMessage['type']): string => {
    switch (type) {
      case 'user': return '👤';
      case 'bot': return '🤖';
      case 'system': return '⚙️';
      case 'error': return '❌';
      default: return '💬';
    }
  };

  const getMessageColor = (type: ChatMessage['type']): string => {
    switch (type) {
      case 'user': return 'cyan';
      case 'bot': return 'green';
      case 'system': return 'yellow';
      case 'error': return 'red';
      default: return 'white';
    }
  };

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);

    if (diffSecs < 60) return 'now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatMessageContent = (content: string): React.ReactNode[] => {
    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];

    lines.forEach((line, lineIndex) => {
      // Handle command blocks (lines starting with 'Command:' or 'threatguard')
      if (line.trim().startsWith('Command:') || line.trim().startsWith('threatguard')) {
        elements.push(
          <Box key={`command-${lineIndex}`} marginLeft={2} marginY={0}>
            <Text backgroundColor="gray" color="black" bold>
              {' '}{line.trim()}{' '}
            </Text>
          </Box>
        );
      }
      // Handle bullet points
      else if (line.trim().startsWith('•') || line.trim().startsWith('-')) {
        elements.push(
          <Box key={`bullet-${lineIndex}`} marginLeft={2}>
            <Text color="yellow">{line.substring(0, 1)}</Text>
            <Text> {line.substring(1).trim()}</Text>
          </Box>
        );
      }
      // Handle numbered lists
      else if (/^\d+\./.test(line.trim())) {
        const match = line.trim().match(/^(\d+\.)(.*)/);
        if (match) {
          elements.push(
            <Box key={`numbered-${lineIndex}`} marginLeft={2}>
              <Text color="cyan" bold>{match[1]}</Text>
              <Text>{match[2]}</Text>
            </Box>
          );
        }
      }
      // Handle headers (lines with emoji or starting with uppercase)
      else if (line.trim().match(/^[🔍🛡️⚠️💡📊🎯✅❌]/)) {
        elements.push(
          <Text key={`header-${lineIndex}`} bold color="white">
            {line.trim()}
          </Text>
        );
      }
      // Regular content
      else if (line.trim()) {
        elements.push(
          <Text key={`text-${lineIndex}`}>
            {line}
          </Text>
        );
      }
      // Empty lines for spacing
      else {
        elements.push(
          <Box key={`space-${lineIndex}`} height={1} />
        );
      }
    });

    return elements;
  };

  const renderMetadata = (metadata?: ChatMessage['metadata']): React.ReactNode => {
    if (!metadata) return null;

    const items: React.ReactNode[] = [];

    // Processing time
    if (metadata.processingTime !== undefined) {
      items.push(
        <Text key="time" color="gray" dimColor>
          {metadata.processingTime}ms
        </Text>
      );
    }

    // Confidence level
    if (metadata.confidence) {
      const confidenceColor = 
        metadata.confidence === 'very_high' || metadata.confidence === 'high' ? 'green' :
        metadata.confidence === 'medium' ? 'yellow' : 'red';
      
      items.push(
        <Text key="confidence" color={confidenceColor}>
          {metadata.confidence}
        </Text>
      );
    }

    // Intent
    if (metadata.intent) {
      items.push(
        <Text key="intent" color="blue" dimColor>
          {metadata.intent}
        </Text>
      );
    }

    // Safety level
    if (metadata.safety?.safetyLevel) {
      const safetyColor = 
        metadata.safety.safetyLevel === 'safe' ? 'green' :
        metadata.safety.safetyLevel === 'low' ? 'yellow' :
        metadata.safety.safetyLevel === 'medium' ? 'yellow' :
        metadata.safety.safetyLevel === 'high' ? 'red' : 'red';
      
      items.push(
        <Text key="safety" color={safetyColor}>
          {metadata.safety.safetyLevel} risk
        </Text>
      );
    }

    if (items.length === 0) return null;

    return (
      <Box marginTop={0} marginLeft={6}>
        <Text color="gray" dimColor>
          [{items.map((item, index) => (
            <React.Fragment key={index}>
              {item}
              {index < items.length - 1 && <Text> • </Text>}
            </React.Fragment>
          ))}]
        </Text>
      </Box>
    );
  };

  return (
    <Box flexDirection="column" marginBottom={message.type === 'system' ? 0 : 1}>
      {/* Message header */}
      <Box>
        <Text color={getMessageColor(message.type)} bold>
          {getMessageIcon(message.type)} 
        </Text>
        <Text color={getMessageColor(message.type)} bold marginLeft={1}>
          {message.type === 'user' ? 'You' : 
           message.type === 'bot' ? 'ThreatGuard' :
           message.type === 'system' ? 'System' : 'Error'}
        </Text>
        <Spacer />
        <Text color="gray" dimColor>
          {formatTimestamp(message.timestamp)}
        </Text>
      </Box>

      {/* Message content */}
      <Box flexDirection="column" marginLeft={3} marginTop={0}>
        {formatMessageContent(message.content)}
      </Box>

      {/* Metadata */}
      {renderMetadata(message.metadata)}

      {/* Safety warnings for bot messages */}
      {message.type === 'bot' && message.metadata?.safety?.potentialRisks && message.metadata.safety.potentialRisks.length > 0 && (
        <Box marginLeft={3} marginTop={1} borderStyle="round" borderColor="yellow" paddingX={1}>
          <Box flexDirection="column">
            <Text color="yellow" bold>⚠️ Risks:</Text>
            {message.metadata.safety.potentialRisks.slice(0, 3).map((risk, index) => (
              <Text key={index} color="yellow">
                • {risk}
              </Text>
            ))}
          </Box>
        </Box>
      )}

      {/* Command preview for confirmations */}
      {message.type === 'bot' && message.metadata?.command && message.metadata.safety?.requiresConfirmation && (
        <Box marginLeft={3} marginTop={1} borderStyle="single" borderColor="cyan" paddingX={1}>
          <Box flexDirection="column">
            <Text color="cyan" bold>🔍 Command Preview:</Text>
            <Text color="white" backgroundColor="gray">
              {' '}{message.metadata.command.previewCommand}{' '}
            </Text>
            <Text color="gray" marginTop={1}>
              Estimated time: {message.metadata.command.estimatedExecutionTime ? 
                `${Math.ceil(message.metadata.command.estimatedExecutionTime / 1000)}s` : 'unknown'}
            </Text>
          </Box>
        </Box>
      )}
    </Box>
  );
};

/**
 * Message list component with virtual scrolling and auto-scroll
 */
export const MessageList: React.FC<MessageListProps> = ({ 
  messages, 
  isProcessing,
  maxVisibleMessages = 50 
}) => {
  const scrollRef = useRef<any>();

  // Optimize for large message lists
  const visibleMessages = useMemo(() => {
    if (messages.length <= maxVisibleMessages) {
      return messages;
    }
    return messages.slice(-maxVisibleMessages);
  }, [messages, maxVisibleMessages]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    // Auto-scroll behavior would be handled by the terminal
    // In a real terminal environment, this would ensure the latest message is visible
  }, [messages.length]);

  // Show empty state
  if (messages.length === 0 && !isProcessing) {
    return (
      <Box flexGrow={1} justifyContent="center" alignItems="center">
        <Box flexDirection="column" alignItems="center">
          <Text color="gray" bold>
            🤖 ThreatGuard Chat
          </Text>
          <Text color="gray" marginTop={1}>
            Your conversation will appear here
          </Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box ref={scrollRef} flexDirection="column" paddingX={1} paddingY={1}>
      {/* Truncation indicator */}
      {messages.length > maxVisibleMessages && (
        <Box marginBottom={2} justifyContent="center">
          <Text color="gray" dimColor>
            ··· {messages.length - maxVisibleMessages} earlier messages ···
          </Text>
        </Box>
      )}

      {/* Message list */}
      {visibleMessages.map((message, index) => (
        <MessageDisplay
          key={message.id}
          message={message}
          isLatest={index === visibleMessages.length - 1}
        />
      ))}

      {/* Processing indicator */}
      {isProcessing && (
        <Box marginTop={1}>
          <Text color="blue">
            🤖 <Text dimColor>ThreatGuard is thinking</Text>
          </Text>
          <Text color="blue" marginLeft={1}>
            <Text dimColor>...</Text>
          </Text>
        </Box>
      )}

      {/* Scroll indicator for large conversations */}
      {messages.length > 10 && (
        <Box marginTop={2} justifyContent="center">
          <Text color="gray" dimColor>
            Message {Math.min(visibleMessages.length, messages.length)} of {messages.length}
            {messages.length > maxVisibleMessages && " (showing recent)"}
          </Text>
        </Box>
      )}
    </Box>
  );
};

export default MessageList;