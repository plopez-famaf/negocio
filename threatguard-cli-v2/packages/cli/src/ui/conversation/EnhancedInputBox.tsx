import React, { useState, useCallback, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Box, Text, useInput } from 'ink';
import { Suggestion } from '../../conversation/interface/ChatManager.js';
import { AutocompletionEngine, CompletionCandidate, AutocompletionRequest, AutocompletionResult } from '../../conversation/ui/AutocompletionEngine.js';
import type { ConversationContext } from '../../conversation/types/Context.js';

export interface EnhancedInputBoxProps {
  value: string;
  onSubmit: (input: string) => void;
  onInputChange: (input: string) => void;
  disabled?: boolean;
  placeholder?: string;
  suggestions?: Suggestion[];
  maxLength?: number;
  showHistory?: boolean;
  context?: ConversationContext;
  autocompletionEngine?: AutocompletionEngine;
  showCompletionPreview?: boolean;
  completionDelay?: number;
}

export interface EnhancedInputBoxRef {
  focus: () => void;
  clear: () => void;
  setValue: (value: string) => void;
  acceptCompletion: () => void;
  cycleCompletions: () => void;
}

interface EnhancedInputState {
  cursorPosition: number;
  showCompletions: boolean;
  selectedCompletion: number;
  inputHistory: string[];
  historyIndex: number;
  isComposing: boolean;
  completionCandidates: CompletionCandidate[];
  completionResult: AutocompletionResult | null;
  showPreview: boolean;
  previewText: string;
  isLoadingCompletions: boolean;
  lastCompletionInput: string;
}

/**
 * Enhanced input box with advanced auto-completion, intelligent suggestions, and real-time preview
 */
export const EnhancedInputBox = forwardRef<EnhancedInputBoxRef, EnhancedInputBoxProps>((props, ref) => {
  const {
    value,
    onSubmit,
    onInputChange,
    disabled = false,
    placeholder = "Type your message...",
    suggestions = [],
    maxLength = 500,
    showHistory = true,
    context,
    autocompletionEngine,
    showCompletionPreview = true,
    completionDelay = 300,
  } = props;

  const [state, setState] = useState<EnhancedInputState>({
    cursorPosition: value.length,
    showCompletions: false,
    selectedCompletion: 0,
    inputHistory: [],
    historyIndex: -1,
    isComposing: false,
    completionCandidates: [],
    completionResult: null,
    showPreview: false,
    previewText: '',
    isLoadingCompletions: false,
    lastCompletionInput: '',
  });

  const inputRef = useRef<string>(value);
  const completionTimeoutRef = useRef<NodeJS.Timeout>();
  const debounceTimeoutRef = useRef<NodeJS.Timeout>();

  // Update input ref when value changes
  useEffect(() => {
    inputRef.current = value;
    setState(prev => ({
      ...prev,
      cursorPosition: Math.min(prev.cursorPosition, value.length),
    }));

    // Trigger auto-completion if engine is available
    if (autocompletionEngine && context && value.length >= 2 && value !== state.lastCompletionInput) {
      debouncedCompletion(value);
    }
  }, [value, autocompletionEngine, context]);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    focus: () => {
      // In Ink, focus is handled automatically
    },
    clear: () => {
      onInputChange('');
      setState(prev => ({
        ...prev,
        cursorPosition: 0,
        showCompletions: false,
        selectedCompletion: 0,
        historyIndex: -1,
        completionCandidates: [],
        completionResult: null,
        showPreview: false,
        previewText: '',
      }));
    },
    setValue: (newValue: string) => {
      onInputChange(newValue);
      setState(prev => ({
        ...prev,
        cursorPosition: newValue.length,
        showCompletions: false,
        selectedCompletion: 0,
      }));
    },
    acceptCompletion: () => {
      if (state.completionCandidates.length > 0 && state.selectedCompletion >= 0) {
        const completion = state.completionCandidates[state.selectedCompletion];
        handleCompletionSelect(completion);
      }
    },
    cycleCompletions: () => {
      if (state.completionCandidates.length > 0) {
        setState(prev => ({
          ...prev,
          selectedCompletion: (prev.selectedCompletion + 1) % prev.completionCandidates.length,
        }));
      }
    },
  }));

  /**
   * Debounced completion request
   */
  const debouncedCompletion = useCallback((input: string) => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(() => {
      requestCompletions(input);
    }, completionDelay);
  }, [completionDelay]);

  /**
   * Request completions from the autocompletion engine
   */
  const requestCompletions = useCallback(async (input: string) => {
    if (!autocompletionEngine || !context || input.length < 2) {
      setState(prev => ({
        ...prev,
        showCompletions: false,
        completionCandidates: [],
        completionResult: null,
        showPreview: false,
      }));
      return;
    }

    setState(prev => ({
      ...prev,
      isLoadingCompletions: true,
      lastCompletionInput: input,
    }));

    try {
      const request: AutocompletionRequest = {
        input,
        cursorPosition: state.cursorPosition,
        context,
        recentSuggestions: suggestions,
        sessionHistory: state.inputHistory,
      };

      const result = await autocompletionEngine.generateCompletions(request);

      setState(prev => ({
        ...prev,
        completionCandidates: result.candidates,
        completionResult: result,
        showCompletions: result.candidates.length > 0,
        selectedCompletion: 0,
        isLoadingCompletions: false,
        showPreview: showCompletionPreview && result.primaryCandidate !== undefined,
        previewText: result.primaryCandidate?.insertText || '',
      }));

    } catch (error) {
      console.error('Failed to get completions:', error);
      setState(prev => ({
        ...prev,
        isLoadingCompletions: false,
        showCompletions: false,
        completionCandidates: [],
        completionResult: null,
        showPreview: false,
      }));
    }
  }, [autocompletionEngine, context, suggestions, state.cursorPosition, state.inputHistory, showCompletionPreview]);

  /**
   * Get completion suggestions based on current input (fallback)
   */
  const getCompletions = useCallback((): Suggestion[] => {
    if (!value.trim() || value.length < 2) return [];

    const input = value.toLowerCase();
    const completionSuggestions = suggestions.filter(suggestion => 
      suggestion.type === 'completion' || 
      suggestion.action.toLowerCase().includes(input) ||
      suggestion.title.toLowerCase().includes(input)
    );

    return completionSuggestions.slice(0, 5);
  }, [value, suggestions]);

  /**
   * Handle input submission
   */
  const handleSubmit = useCallback(() => {
    if (!value.trim() || disabled) return;

    // Add to history
    if (showHistory && value.trim() !== state.inputHistory[0]) {
      setState(prev => ({
        ...prev,
        inputHistory: [value.trim(), ...prev.inputHistory].slice(0, 50),
        historyIndex: -1,
      }));
    }

    onSubmit(value.trim());
  }, [value, disabled, showHistory, state.inputHistory, onSubmit]);

  /**
   * Handle completion selection
   */
  const handleCompletionSelect = useCallback((completion: CompletionCandidate | Suggestion) => {
    let insertText: string;
    
    if ('insertText' in completion) {
      insertText = completion.insertText;
    } else {
      insertText = completion.action;
    }

    onInputChange(insertText);
    setState(prev => ({
      ...prev,
      showCompletions: false,
      selectedCompletion: 0,
      cursorPosition: insertText.length,
      showPreview: false,
      previewText: '',
    }));
  }, [onInputChange]);

  /**
   * Handle history navigation
   */
  const navigateHistory = useCallback((direction: 'up' | 'down') => {
    if (!showHistory || state.inputHistory.length === 0) return;

    setState(prev => {
      let newIndex = prev.historyIndex;
      
      if (direction === 'up') {
        newIndex = Math.min(prev.historyIndex + 1, prev.inputHistory.length - 1);
      } else {
        newIndex = Math.max(prev.historyIndex - 1, -1);
      }

      const newValue = newIndex >= 0 ? prev.inputHistory[newIndex] : '';
      onInputChange(newValue);

      return {
        ...prev,
        historyIndex: newIndex,
        cursorPosition: newValue.length,
        showCompletions: false,
        showPreview: false,
      };
    });
  }, [showHistory, state.inputHistory, onInputChange]);

  /**
   * Handle keyboard input
   */
  useInput((input, key) => {
    if (disabled) return;

    // Handle special keys
    if (key.return) {
      if (state.showCompletions && state.selectedCompletion >= 0) {
        const completions = state.completionCandidates.length > 0 
          ? state.completionCandidates 
          : getCompletions();
        
        if (completions[state.selectedCompletion]) {
          handleCompletionSelect(completions[state.selectedCompletion]);
          return;
        }
      }
      handleSubmit();
      return;
    }

    // Handle escape - close completions
    if (key.escape) {
      setState(prev => ({
        ...prev,
        showCompletions: false,
        selectedCompletion: 0,
        showPreview: false,
        previewText: '',
      }));
      return;
    }

    // Handle tab - show/navigate completions or accept primary completion
    if (key.tab) {
      if (state.showPreview && state.previewText && state.completionResult?.primaryCandidate) {
        // Accept primary completion
        handleCompletionSelect(state.completionResult.primaryCandidate);
        return;
      }

      const completions = state.completionCandidates.length > 0 
        ? state.completionCandidates 
        : getCompletions();
      
      if (completions.length > 0) {
        if (!state.showCompletions) {
          setState(prev => ({
            ...prev,
            showCompletions: true,
            selectedCompletion: 0,
          }));
        } else {
          setState(prev => ({
            ...prev,
            selectedCompletion: (prev.selectedCompletion + 1) % completions.length,
          }));
        }
      }
      return;
    }

    // Handle arrow keys
    if (key.upArrow) {
      if (state.showCompletions) {
        const completions = state.completionCandidates.length > 0 
          ? state.completionCandidates 
          : getCompletions();
        setState(prev => ({
          ...prev,
          selectedCompletion: Math.max(0, prev.selectedCompletion - 1),
        }));
      } else {
        navigateHistory('up');
      }
      return;
    }

    if (key.downArrow) {
      if (state.showCompletions) {
        const completions = state.completionCandidates.length > 0 
          ? state.completionCandidates 
          : getCompletions();
        setState(prev => ({
          ...prev,
          selectedCompletion: Math.min(completions.length - 1, prev.selectedCompletion + 1),
        }));
      } else {
        navigateHistory('down');
      }
      return;
    }

    // Handle backspace
    if (key.backspace) {
      if (value.length > 0) {
        const newValue = value.slice(0, -1);
        onInputChange(newValue);
        setState(prev => ({
          ...prev,
          cursorPosition: Math.max(0, prev.cursorPosition - 1),
          showCompletions: newValue.length >= 2,
          historyIndex: -1,
          showPreview: false,
          previewText: '',
        }));
      }
      return;
    }

    // Handle regular character input
    if (input && !key.ctrl && !key.meta) {
      if (value.length < maxLength) {
        const newValue = value + input;
        onInputChange(newValue);
        setState(prev => ({
          ...prev,
          cursorPosition: prev.cursorPosition + 1,
          showCompletions: newValue.length >= 2,
          historyIndex: -1,
          showPreview: false,
          previewText: '',
        }));
      }
    }
  });

  // Get current completions
  const currentCompletions = state.completionCandidates.length > 0 
    ? state.completionCandidates 
    : getCompletions();
  const showCompletions = state.showCompletions && currentCompletions.length > 0 && !disabled;

  // Get confidence indicator color
  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.8) return 'green';
    if (confidence >= 0.6) return 'yellow';
    if (confidence >= 0.4) return 'cyan';
    return 'gray';
  };

  // Get completion type icon
  const getCompletionIcon = (completion: CompletionCandidate | Suggestion): string => {
    if ('type' in completion) {
      switch (completion.type) {
        case 'command': return '⚡';
        case 'entity': return '🏷️';
        case 'workflow': return '🔄';
        case 'template': return '📝';
        case 'parameter': return '⚙️';
        default: return '💡';
      }
    }
    // Fallback for Suggestion type
    switch (completion.type) {
      case 'command': return '⚡';
      case 'workflow': return '🔄';
      case 'completion': return '💭';
      case 'help': return '❓';
      default: return '💡';
    }
  };

  return (
    <Box flexDirection="column">
      {/* Completion suggestions */}
      {showCompletions && (
        <Box 
          flexDirection="column" 
          borderStyle="round" 
          borderColor="blue"
          marginBottom={1}
          paddingX={1}
        >
          <Box justifyContent="space-between" alignItems="center">
            <Text color="blue" bold>
              💡 Smart Completions
            </Text>
            {state.isLoadingCompletions && (
              <Text color="yellow">🔄 Loading...</Text>
            )}
            {state.completionResult && (
              <Text color="gray">
                {state.completionResult.processingTime}ms
              </Text>
            )}
          </Box>

          {currentCompletions.slice(0, 6).map((completion, index) => {
            const isSelected = index === state.selectedCompletion;
            const confidence = 'confidence' in completion ? completion.confidence : 0.5;
            const description = 'description' in completion ? completion.description : completion.title;
            const category = 'category' in completion ? completion.category : 'general';
            
            return (
              <Box key={`completion-${index}`} marginLeft={1} marginY={0}>
                <Text 
                  color={isSelected ? "cyan" : "white"}
                  backgroundColor={isSelected ? "blue" : undefined}
                  bold={isSelected}
                >
                  {isSelected ? '▶ ' : '  '}
                  {getCompletionIcon(completion)} 
                </Text>
                <Text 
                  color={isSelected ? "cyan" : "white"}
                  backgroundColor={isSelected ? "blue" : undefined}
                  bold={isSelected}
                  marginLeft={1}
                >
                  {'text' in completion ? completion.text : completion.title}
                </Text>
                <Text color={getConfidenceColor(confidence)} marginLeft={1}>
                  ({Math.round(confidence * 100)}%)
                </Text>
                <Text color="gray" marginLeft={1}>
                  [{category}]
                </Text>
              </Box>
            );
          })}

          {state.completionResult && state.completionResult.candidates.length > 6 && (
            <Text color="gray" marginLeft={1}>
              ... and {state.completionResult.candidates.length - 6} more
            </Text>
          )}

          <Box marginTop={1} borderTop borderColor="gray" paddingTop={0}>
            <Text color="gray">
              Tab: accept/cycle • ↑↓: navigate • Enter: select • Esc: close
            </Text>
          </Box>
        </Box>
      )}

      {/* Preview overlay for primary completion */}
      {state.showPreview && state.previewText && !state.showCompletions && (
        <Box marginBottom={1}>
          <Text color="gray" dimColor>
            💡 Press Tab to complete: "{state.previewText}"
          </Text>
        </Box>
      )}

      {/* Input area */}
      <Box 
        borderStyle="round" 
        borderColor={disabled ? "gray" : state.showCompletions ? "blue" : "green"}
        paddingX={1}
      >
        <Text color="green" bold>{'> '}</Text>
        
        {/* Input content with preview */}
        {value ? (
          <Box>
            <Text color={disabled ? "gray" : "white"}>
              {value}
            </Text>
            {state.showPreview && state.previewText && state.previewText.startsWith(value) && (
              <Text color="gray" dimColor>
                {state.previewText.substring(value.length)}
              </Text>
            )}
            {!disabled && <Text backgroundColor="white" color="black"> </Text>}
          </Box>
        ) : (
          <Box>
            <Text color="gray" dimColor>
              {placeholder}
            </Text>
            {!disabled && <Text backgroundColor="gray" color="black"> </Text>}
          </Box>
        )}

        {/* Character count and completion status */}
        {(value.length > maxLength * 0.8 || state.completionResult) && (
          <Box marginLeft={1}>
            {value.length > maxLength * 0.8 && (
              <Text color={value.length >= maxLength ? "red" : "yellow"}>
                [{value.length}/{maxLength}]
              </Text>
            )}
            {state.completionResult && (
              <Text color="blue" marginLeft={1}>
                ✨ {state.completionResult.candidates.length} completions
              </Text>
            )}
          </Box>
        )}
      </Box>

      {/* Help text with completion info */}
      <Box marginTop={1}>
        <Text color="gray" dimColor>
          {disabled ? (
            "Input disabled"
          ) : (
            <>
              Enter: send
              {showHistory && state.inputHistory.length > 0 && " • ↑↓: history"}
              {value.length >= 2 && " • Tab: complete"}
              {autocompletionEngine && " • Smart completions enabled"}
            </>
          )}
        </Text>
      </Box>

      {/* Completion engine statistics (debug mode) */}
      {process.env.NODE_ENV === 'development' && autocompletionEngine && (
        <Box marginTop={1}>
          <Text color="gray" dimColor>
            Debug: {JSON.stringify(autocompletionEngine.getStatistics())}
          </Text>
        </Box>
      )}
    </Box>
  );
});

EnhancedInputBox.displayName = 'EnhancedInputBox';

export default EnhancedInputBox;