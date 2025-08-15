import React, { useState, useCallback, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Box, Text, useInput } from 'ink';
import { Suggestion } from '../../conversation/interface/ChatManager.js';

export interface InputBoxProps {
  value: string;
  onSubmit: (input: string) => void;
  onInputChange: (input: string) => void;
  disabled?: boolean;
  placeholder?: string;
  suggestions?: Suggestion[];
  maxLength?: number;
  showHistory?: boolean;
}

export interface InputBoxRef {
  focus: () => void;
  clear: () => void;
  setValue: (value: string) => void;
}

interface InputState {
  cursorPosition: number;
  showCompletions: boolean;
  selectedCompletion: number;
  inputHistory: string[];
  historyIndex: number;
  isComposing: boolean;
}

/**
 * Enhanced input box with auto-completion, history, and validation
 */
export const InputBox = forwardRef<InputBoxRef, InputBoxProps>(({
  value,
  onSubmit,
  onInputChange,
  disabled = false,
  placeholder = "Type your message...",
  suggestions = [],
  maxLength = 500,
  showHistory = true,
}, ref) => {
  const [state, setState] = useState<InputState>({
    cursorPosition: value.length,
    showCompletions: false,
    selectedCompletion: 0,
    inputHistory: [],
    historyIndex: -1,
    isComposing: false,
  });

  const inputRef = useRef<string>(value);

  // Update input ref when value changes
  useEffect(() => {
    inputRef.current = value;
    setState(prev => ({
      ...prev,
      cursorPosition: Math.min(prev.cursorPosition, value.length),
    }));
  }, [value]);

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
  }));

  /**
   * Get completion suggestions based on current input
   */
  const getCompletions = useCallback((): Suggestion[] => {
    if (!value.trim() || value.length < 2) return [];

    const input = value.toLowerCase();
    const completionSuggestions = suggestions.filter(suggestion => 
      suggestion.type === 'completion' || 
      suggestion.action.toLowerCase().includes(input) ||
      suggestion.title.toLowerCase().includes(input)
    );

    return completionSuggestions.slice(0, 5); // Limit to 5 completions
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
        inputHistory: [value.trim(), ...prev.inputHistory].slice(0, 50), // Keep last 50
        historyIndex: -1,
      }));
    }

    onSubmit(value.trim());
  }, [value, disabled, showHistory, state.inputHistory, onSubmit]);

  /**
   * Handle completion selection
   */
  const handleCompletionSelect = useCallback((completion: Suggestion) => {
    onInputChange(completion.action);
    setState(prev => ({
      ...prev,
      showCompletions: false,
      selectedCompletion: 0,
      cursorPosition: completion.action.length,
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
        const completions = getCompletions();
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
      }));
      return;
    }

    // Handle tab - show/navigate completions
    if (key.tab) {
      const completions = getCompletions();
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
        const completions = getCompletions();
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
        const completions = getCompletions();
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
        }));
      }
    }
  });

  // Get current completions
  const completions = getCompletions();
  const showCompletions = state.showCompletions && completions.length > 0 && !disabled;

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
          <Text color="blue" bold>💡 Suggestions:</Text>
          {completions.map((completion, index) => (
            <Box key={completion.id} marginLeft={1}>
              <Text 
                color={index === state.selectedCompletion ? "cyan" : "white"}
                backgroundColor={index === state.selectedCompletion ? "blue" : undefined}
                bold={index === state.selectedCompletion}
              >
                {index === state.selectedCompletion ? '▶ ' : '  '}
                {completion.title}
              </Text>
              <Text color="gray" marginLeft={1}>
                - {completion.description}
              </Text>
            </Box>
          ))}
          <Text color="gray" marginTop={1}>
            Press Tab to cycle, Enter to select, Esc to close
          </Text>
        </Box>
      )}

      {/* Input area */}
      <Box 
        borderStyle="round" 
        borderColor={disabled ? "gray" : "green"}
        paddingX={1}
      >
        <Text color="green" bold>{'> '}</Text>
        
        {/* Input content */}
        {value ? (
          <Text color={disabled ? "gray" : "white"}>
            {value}
            {!disabled && <Text backgroundColor="white" color="black"> </Text>}
          </Text>
        ) : (
          <Text color="gray" dimColor>
            {placeholder}
            {!disabled && <Text backgroundColor="gray" color="black"> </Text>}
          </Text>
        )}

        {/* Character count indicator */}
        {value.length > maxLength * 0.8 && (
          <Text color={value.length >= maxLength ? "red" : "yellow"} marginLeft={1}>
            [{value.length}/{maxLength}]
          </Text>
        )}
      </Box>

      {/* Help text */}
      <Box marginTop={1}>
        <Text color="gray" dimColor>
          {disabled ? (
            "Input disabled"
          ) : (
            <>
              Press Enter to send
              {showHistory && state.inputHistory.length > 0 && " • ↑↓ for history"}
              {value.length >= 2 && " • Tab for completions"}
            </>
          )}
        </Text>
      </Box>
    </Box>
  );
});

InputBox.displayName = 'InputBox';

export default InputBox;