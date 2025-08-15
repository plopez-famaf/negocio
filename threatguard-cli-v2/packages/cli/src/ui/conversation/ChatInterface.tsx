import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { ChatManager, ChatSession, ChatMessage, ChatResponse, Suggestion } from '../../conversation/interface/ChatManager.js';
import { MessageList } from './MessageList.js';
import { InputBox } from './InputBox.js';
import { EnhancedInputBox } from './EnhancedInputBox.js';
import { SuggestionPanel } from './SuggestionPanel.js';
import { StatusBar } from './StatusBar.js';
import { ConfirmationDialog, ConfirmationRequest } from './ConfirmationDialog.js';
import { AutocompletionEngine } from '../../conversation/ui/AutocompletionEngine.js';
import { Logger } from '@threatguard/core';

export interface ChatInterfaceProps {
  chatManager: ChatManager;
  logger: Logger;
  userId?: string;
  initialMessage?: string;
  onExit?: () => void;
  autocompletionEngine?: AutocompletionEngine;
  enableEnhancedInput?: boolean;
}

export interface ChatInterfaceState {
  session: ChatSession | null;
  messages: ChatMessage[];
  suggestions: Suggestion[];
  isProcessing: boolean;
  showConfirmation: boolean;
  showSuggestions: boolean;
  currentInput: string;
  error: string | null;
  stats: {
    messagesCount: number;
    sessionDuration: number;
    avgResponseTime: number;
  };
}

/**
 * Main chat interface component for interactive conversation
 * Provides full-featured terminal chat experience with suggestions and safety features
 */
export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  chatManager,
  logger,
  userId,
  initialMessage,
  onExit,
  autocompletionEngine,
  enableEnhancedInput = true,
}) => {
  // Core state management
  const [state, setState] = useState<ChatInterfaceState>({
    session: null,
    messages: [],
    suggestions: [],
    isProcessing: false,
    showConfirmation: false,
    showSuggestions: true,
    currentInput: '',
    error: null,
    stats: {
      messagesCount: 0,
      sessionDuration: 0,
      avgResponseTime: 0,
    },
  });

  // Refs for managing focus and scrolling
  const { exit } = useApp();
  const inputRef = useRef<any>();
  const startTimeRef = useRef<number>(Date.now());
  const responseTimes = useRef<number[]>([]);

  // Initialize chat session
  useEffect(() => {
    initializeChatSession();
  }, []);

  // Handle initial message if provided
  useEffect(() => {
    if (initialMessage && state.session && state.messages.length <= 1) {
      handleUserInput(initialMessage);
    }
  }, [initialMessage, state.session]);

  // Update session stats periodically
  useEffect(() => {
    const interval = setInterval(updateSessionStats, 1000);
    return () => clearInterval(interval);
  }, [state.session]);

  /**
   * Initialize chat session with welcome message
   */
  const initializeChatSession = async (): Promise<void> => {
    try {
      logger.debug('Initializing chat session', { userId });
      
      const session = await chatManager.startChatSession(userId);
      
      setState(prev => ({
        ...prev,
        session,
        messages: [...session.messageHistory],
        suggestions: [],
        error: null,
      }));

      // Generate initial suggestions
      const welcomeSuggestions = await chatManager.suggestionEngine.generateWelcomeSuggestions(session.context);
      
      setState(prev => ({
        ...prev,
        suggestions: welcomeSuggestions,
      }));

      logger.info('Chat session initialized', {
        sessionId: session.sessionId,
        welcomeMessages: session.messageHistory.length,
        initialSuggestions: welcomeSuggestions.length,
      });

    } catch (error) {
      logger.error('Failed to initialize chat session', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
      });

      setState(prev => ({
        ...prev,
        error: 'Failed to start chat session. Please try again.',
      }));
    }
  };

  /**
   * Handle user input processing
   */
  const handleUserInput = useCallback(async (input: string): Promise<void> => {
    if (!state.session || state.isProcessing || !input.trim()) {
      return;
    }

    const requestStartTime = Date.now();
    
    setState(prev => ({
      ...prev,
      isProcessing: true,
      currentInput: '',
      error: null,
    }));

    try {
      logger.debug('Processing user input', {
        sessionId: state.session.sessionId,
        inputLength: input.length,
        currentState: state.session.currentState,
      });

      // Process message through ChatManager
      const response: ChatResponse = await chatManager.processMessage(state.session.sessionId, input);
      
      // Calculate response time
      const responseTime = Date.now() - requestStartTime;
      responseTimes.current.push(responseTime);
      if (responseTimes.current.length > 10) {
        responseTimes.current.shift(); // Keep only last 10 response times
      }

      // Update session state
      const updatedSession = chatManager.getChatSession(state.session.sessionId);
      
      setState(prev => ({
        ...prev,
        session: updatedSession || prev.session,
        messages: updatedSession?.messageHistory || prev.messages,
        suggestions: response.suggestions,
        isProcessing: false,
        showConfirmation: response.requiresConfirmation,
      }));

      logger.debug('User input processed', {
        sessionId: state.session.sessionId,
        responseTime,
        suggestionsCount: response.suggestions.length,
        requiresConfirmation: response.requiresConfirmation,
      });

    } catch (error) {
      logger.error('Failed to process user input', {
        sessionId: state.session.sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
        input: input.substring(0, 100),
      });

      setState(prev => ({
        ...prev,
        isProcessing: false,
        error: 'Failed to process your message. Please try again.',
      }));
    }
  }, [state.session, state.isProcessing, chatManager, logger]);

  /**
   * Handle suggestion selection
   */
  const handleSuggestionSelect = useCallback(async (suggestion: Suggestion): Promise<void> => {
    logger.debug('Suggestion selected', {
      sessionId: state.session?.sessionId,
      suggestionId: suggestion.id,
      action: suggestion.action,
    });

    await handleUserInput(suggestion.action);
  }, [handleUserInput, state.session, logger]);

  /**
   * Handle confirmation response
   */
  const handleConfirmation = useCallback(async (confirmed: boolean): Promise<void> => {
    if (!state.session) return;

    const response = confirmed ? 'yes' : 'no';
    
    setState(prev => ({
      ...prev,
      showConfirmation: false,
    }));

    await handleUserInput(response);
  }, [state.session, handleUserInput]);

  /**
   * Update session statistics
   */
  const updateSessionStats = useCallback((): void => {
    if (!state.session) return;

    const duration = Date.now() - startTimeRef.current;
    const avgResponseTime = responseTimes.current.length > 0
      ? responseTimes.current.reduce((sum, time) => sum + time, 0) / responseTimes.current.length
      : 0;

    setState(prev => ({
      ...prev,
      stats: {
        messagesCount: prev.messages.length,
        sessionDuration: duration,
        avgResponseTime,
      },
    }));
  }, [state.session, state.messages.length]);

  /**
   * Handle keyboard shortcuts
   */
  useInput((input, key) => {
    // Global shortcuts
    if (key.ctrl && input === 'c') {
      handleExit();
      return;
    }

    if (key.ctrl && input === 'd') {
      handleExit();
      return;
    }

    // Toggle suggestions panel
    if (key.ctrl && input === 's') {
      setState(prev => ({
        ...prev,
        showSuggestions: !prev.showSuggestions,
      }));
      return;
    }

    // Clear conversation
    if (key.ctrl && input === 'l') {
      handleClearConversation();
      return;
    }

    // Show help
    if (key.f1) {
      handleUserInput('help keyboard shortcuts');
      return;
    }
  });

  /**
   * Handle exit
   */
  const handleExit = useCallback(async (): Promise<void> => {
    if (state.session) {
      try {
        await chatManager.endChatSession(state.session.sessionId);
        logger.info('Chat session ended', {
          sessionId: state.session.sessionId,
          duration: Date.now() - startTimeRef.current,
          messageCount: state.messages.length,
        });
      } catch (error) {
        logger.error('Failed to end chat session', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    if (onExit) {
      onExit();
    } else {
      exit();
    }
  }, [state.session, state.messages.length, chatManager, logger, onExit, exit]);

  /**
   * Handle clear conversation
   */
  const handleClearConversation = useCallback(async (): Promise<void> => {
    if (state.session) {
      try {
        // End current session and start new one
        await chatManager.endChatSession(state.session.sessionId);
        await initializeChatSession();
        
        logger.debug('Conversation cleared and restarted');
      } catch (error) {
        logger.error('Failed to clear conversation', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }, [state.session, chatManager, logger]);

  // Error state display
  if (state.error) {
    return (
      <Box flexDirection="column" height="100%">
        <StatusBar 
          session={null}
          isProcessing={false}
          error={state.error}
          stats={state.stats}
        />
        <Box flexGrow={1} justifyContent="center" alignItems="center">
          <Box flexDirection="column" alignItems="center">
            <Text color="red">❌ {state.error}</Text>
            <Text color="gray" marginTop={1}>
              Press Ctrl+C to exit or wait for automatic retry...
            </Text>
          </Box>
        </Box>
      </Box>
    );
  }

  // Loading state display
  if (!state.session) {
    return (
      <Box flexDirection="column" height="100%">
        <StatusBar 
          session={null}
          isProcessing={true}
          stats={state.stats}
        />
        <Box flexGrow={1} justifyContent="center" alignItems="center">
          <Text color="blue">🔄 Initializing ThreatGuard Chat...</Text>
        </Box>
      </Box>
    );
  }

  // Main chat interface
  return (
    <Box flexDirection="column" height="100%">
      {/* Status bar */}
      <StatusBar 
        session={state.session}
        isProcessing={state.isProcessing}
        stats={state.stats}
      />

      {/* Main content area */}
      <Box flexGrow={1} flexDirection="row">
        {/* Chat area */}
        <Box flexDirection="column" flexGrow={1} marginRight={state.showSuggestions ? 1 : 0}>
          {/* Message history */}
          <Box flexGrow={1}>
            <MessageList 
              messages={state.messages}
              isProcessing={state.isProcessing}
            />
          </Box>

          {/* Input area */}
          {enableEnhancedInput && autocompletionEngine ? (
            <EnhancedInputBox
              ref={inputRef}
              value={state.currentInput}
              onSubmit={handleUserInput}
              onInputChange={(value) => setState(prev => ({ ...prev, currentInput: value }))}
              disabled={state.isProcessing || state.showConfirmation}
              placeholder={state.showConfirmation ? "Waiting for confirmation..." : "Type your message..."}
              suggestions={state.suggestions}
              context={state.session?.context}
              autocompletionEngine={autocompletionEngine}
              showCompletionPreview={true}
              completionDelay={300}
            />
          ) : (
            <InputBox
              ref={inputRef}
              value={state.currentInput}
              onSubmit={handleUserInput}
              onInputChange={(value) => setState(prev => ({ ...prev, currentInput: value }))}
              disabled={state.isProcessing || state.showConfirmation}
              placeholder={state.showConfirmation ? "Waiting for confirmation..." : "Type your message..."}
              suggestions={state.suggestions}
            />
          )}
        </Box>

        {/* Suggestions panel */}
        {state.showSuggestions && (
          <SuggestionPanel
            suggestions={state.suggestions}
            onSelect={handleSuggestionSelect}
            isProcessing={state.isProcessing}
            showConfirmation={state.showConfirmation}
          />
        )}
      </Box>

      {/* Confirmation dialog overlay */}
      {state.showConfirmation && state.session?.pendingConfirmation && (
        <ConfirmationDialog
          confirmation={{
            id: state.session.pendingConfirmation.id,
            prompt: state.session.pendingConfirmation.prompt,
            command: state.session.pendingConfirmation.command.previewCommand,
            timeout: state.session.pendingConfirmation.timeout,
            createdAt: state.session.pendingConfirmation.createdAt,
            riskLevel: state.session.pendingConfirmation.safety.safetyLevel,
            risks: state.session.pendingConfirmation.safety.potentialRisks,
            context: {
              description: state.session.pendingConfirmation.command.description,
              estimatedTime: state.session.pendingConfirmation.command.estimatedExecutionTime,
            },
          }}
          onConfirm={() => handleConfirmation(true)}
          onCancel={() => handleConfirmation(false)}
        />
      )}

      {/* Help text */}
      <Box borderStyle="single" borderTop={false} borderLeft={false} borderRight={false} paddingX={1}>
        <Text color="gray" dimColor>
          💡 Press F1 for help • Ctrl+S toggle suggestions • Ctrl+L clear • Ctrl+C exit
          {enableEnhancedInput && autocompletionEngine && " • Tab: smart completion • ↑↓: navigate completions"}
        </Text>
      </Box>
    </Box>
  );
};

export default ChatInterface;