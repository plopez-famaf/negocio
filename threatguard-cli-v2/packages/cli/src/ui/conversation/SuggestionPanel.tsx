import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { Suggestion } from '../../conversation/interface/ChatManager.js';

export interface SuggestionPanelProps {
  suggestions: Suggestion[];
  onSelect: (suggestion: Suggestion) => void;
  isProcessing?: boolean;
  showConfirmation?: boolean;
  width?: number;
  maxSuggestions?: number;
}

interface SuggestionPanelState {
  selectedIndex: number;
  expandedSuggestion: string | null;
  filteredSuggestions: Suggestion[];
  categoryFilter: string | null;
}

/**
 * Interactive suggestion panel with keyboard navigation and categorization
 */
export const SuggestionPanel: React.FC<SuggestionPanelProps> = ({
  suggestions,
  onSelect,
  isProcessing = false,
  showConfirmation = false,
  width = 35,
  maxSuggestions = 8,
}) => {
  const [state, setState] = useState<SuggestionPanelState>({
    selectedIndex: 0,
    expandedSuggestion: null,
    filteredSuggestions: suggestions,
    categoryFilter: null,
  });

  // Update filtered suggestions when suggestions change
  useEffect(() => {
    const filtered = state.categoryFilter 
      ? suggestions.filter(s => s.metadata?.category === state.categoryFilter)
      : suggestions;

    setState(prev => ({
      ...prev,
      filteredSuggestions: filtered.slice(0, maxSuggestions),
      selectedIndex: Math.min(prev.selectedIndex, Math.max(0, filtered.length - 1)),
    }));
  }, [suggestions, state.categoryFilter, maxSuggestions]);

  /**
   * Get suggestion icon based on type and metadata
   */
  const getSuggestionIcon = (suggestion: Suggestion): string => {
    if (suggestion.metadata?.risk === 'critical' || suggestion.metadata?.risk === 'high') {
      return '⚠️';
    }
    
    switch (suggestion.type) {
      case 'command': return '⚡';
      case 'workflow': return '🔄';
      case 'completion': return '💭';
      case 'help': return '❓';
      default: return '💡';
    }
  };

  /**
   * Get suggestion color based on type and risk
   */
  const getSuggestionColor = (suggestion: Suggestion, isSelected: boolean): string => {
    if (isSelected) return 'cyan';
    
    if (suggestion.metadata?.risk === 'critical') return 'red';
    if (suggestion.metadata?.risk === 'high') return 'yellow';
    if (suggestion.metadata?.risk === 'medium') return 'yellow';
    
    switch (suggestion.type) {
      case 'command': return 'green';
      case 'workflow': return 'blue';
      case 'completion': return 'magenta';
      case 'help': return 'cyan';
      default: return 'white';
    }
  };

  /**
   * Get unique categories from suggestions
   */
  const getCategories = useCallback((): string[] => {
    const categories = new Set<string>();
    suggestions.forEach(s => {
      if (s.metadata?.category) {
        categories.add(s.metadata.category);
      }
    });
    return Array.from(categories).sort();
  }, [suggestions]);

  /**
   * Format confidence level
   */
  const formatConfidence = (confidence: number): string => {
    if (confidence >= 0.9) return 'very high';
    if (confidence >= 0.8) return 'high';
    if (confidence >= 0.6) return 'medium';
    if (confidence >= 0.4) return 'low';
    return 'very low';
  };

  /**
   * Format estimated time
   */
  const formatEstimatedTime = (milliseconds?: number): string => {
    if (!milliseconds || milliseconds <= 0) return 'instant';
    if (milliseconds === -1) return 'continuous';
    
    if (milliseconds < 60000) return `${Math.ceil(milliseconds / 1000)}s`;
    if (milliseconds < 3600000) return `${Math.ceil(milliseconds / 60000)}m`;
    return `${Math.ceil(milliseconds / 3600000)}h`;
  };

  /**
   * Handle keyboard navigation
   */
  useInput((input, key) => {
    if (isProcessing || showConfirmation || state.filteredSuggestions.length === 0) {
      return;
    }

    // Navigation
    if (key.upArrow || input === 'k') {
      setState(prev => ({
        ...prev,
        selectedIndex: Math.max(0, prev.selectedIndex - 1),
      }));
      return;
    }

    if (key.downArrow || input === 'j') {
      setState(prev => ({
        ...prev,
        selectedIndex: Math.min(prev.filteredSuggestions.length - 1, prev.selectedIndex + 1),
      }));
      return;
    }

    // Selection
    if (key.return || input === ' ') {
      const selected = state.filteredSuggestions[state.selectedIndex];
      if (selected) {
        onSelect(selected);
      }
      return;
    }

    // Expand/collapse details
    if (input === 'e' || key.tab) {
      const selected = state.filteredSuggestions[state.selectedIndex];
      if (selected) {
        setState(prev => ({
          ...prev,
          expandedSuggestion: prev.expandedSuggestion === selected.id ? null : selected.id,
        }));
      }
      return;
    }

    // Number key selection (1-9)
    const numKey = parseInt(input);
    if (!isNaN(numKey) && numKey >= 1 && numKey <= state.filteredSuggestions.length) {
      const selected = state.filteredSuggestions[numKey - 1];
      if (selected) {
        onSelect(selected);
      }
      return;
    }

    // Category filtering
    if (input === 'c') {
      const categories = getCategories();
      if (categories.length > 0) {
        // Cycle through categories
        const currentIndex = state.categoryFilter ? categories.indexOf(state.categoryFilter) : -1;
        const nextIndex = (currentIndex + 1) % (categories.length + 1);
        const nextCategory = nextIndex === categories.length ? null : categories[nextIndex];
        
        setState(prev => ({
          ...prev,
          categoryFilter: nextCategory,
          selectedIndex: 0,
        }));
      }
      return;
    }

    // Clear filter
    if (input === 'r') {
      setState(prev => ({
        ...prev,
        categoryFilter: null,
        selectedIndex: 0,
      }));
      return;
    }
  });

  // Empty state
  if (suggestions.length === 0) {
    return (
      <Box 
        width={width} 
        borderStyle="round" 
        borderColor="gray" 
        paddingX={1} 
        paddingY={1}
      >
        <Box flexDirection="column" alignItems="center">
          <Text color="gray" bold>💡 Suggestions</Text>
          <Text color="gray" marginTop={1}>
            No suggestions available
          </Text>
          <Text color="gray" dimColor marginTop={1}>
            Type something to get started
          </Text>
        </Box>
      </Box>
    );
  }

  // Processing state
  if (isProcessing) {
    return (
      <Box 
        width={width} 
        borderStyle="round" 
        borderColor="blue" 
        paddingX={1} 
        paddingY={1}
      >
        <Box flexDirection="column" alignItems="center">
          <Text color="blue" bold>💡 Suggestions</Text>
          <Text color="blue" marginTop={1}>
            🔄 Generating suggestions...
          </Text>
        </Box>
      </Box>
    );
  }

  // Confirmation mode
  if (showConfirmation) {
    return (
      <Box 
        width={width} 
        borderStyle="round" 
        borderColor="yellow" 
        paddingX={1} 
        paddingY={1}
      >
        <Box flexDirection="column">
          <Text color="yellow" bold>⚠️ Confirmation</Text>
          <Text color="yellow" marginTop={1}>
            Waiting for your response...
          </Text>
          <Box marginTop={2}>
            <Text color="green">• yes - Proceed</Text>
            <Text color="red">• no - Cancel</Text>
          </Box>
        </Box>
      </Box>
    );
  }

  const categories = getCategories();

  return (
    <Box 
      width={width} 
      borderStyle="round" 
      borderColor="green" 
      paddingX={1} 
      paddingY={1}
    >
      <Box flexDirection="column">
        {/* Header */}
        <Box justifyContent="space-between">
          <Text color="green" bold>💡 Suggestions</Text>
          <Text color="gray" dimColor>
            ({state.filteredSuggestions.length}/{suggestions.length})
          </Text>
        </Box>

        {/* Category filter indicator */}
        {state.categoryFilter && (
          <Box marginTop={1} marginBottom={1}>
            <Text color="cyan" backgroundColor="blue">
              {' '}{state.categoryFilter}{' '}
            </Text>
            <Text color="gray" marginLeft={1}>
              filter active
            </Text>
          </Box>
        )}

        {/* Suggestions list */}
        <Box flexDirection="column" marginTop={1}>
          {state.filteredSuggestions.map((suggestion, index) => {
            const isSelected = index === state.selectedIndex;
            const isExpanded = state.expandedSuggestion === suggestion.id;
            const color = getSuggestionColor(suggestion, isSelected);
            const icon = getSuggestionIcon(suggestion);

            return (
              <Box key={suggestion.id} flexDirection="column" marginBottom={1}>
                {/* Main suggestion line */}
                <Box>
                  <Text color={color} bold={isSelected}>
                    {isSelected ? '▶ ' : '  '}
                    {index + 1}. {icon} {suggestion.title}
                  </Text>
                </Box>

                {/* Confidence and risk indicators */}
                <Box marginLeft={4}>
                  <Text color="gray" dimColor>
                    {formatConfidence(suggestion.confidence)}
                    {suggestion.metadata?.risk && (
                      <> • <Text color={
                        suggestion.metadata.risk === 'critical' ? 'red' :
                        suggestion.metadata.risk === 'high' ? 'yellow' :
                        suggestion.metadata.risk === 'medium' ? 'yellow' : 'green'
                      }>
                        {suggestion.metadata.risk} risk
                      </Text></>
                    )}
                    {suggestion.metadata?.estimatedTime && (
                      <> • {formatEstimatedTime(suggestion.metadata.estimatedTime)}</>
                    )}
                  </Text>
                </Box>

                {/* Expanded details */}
                {isExpanded && (
                  <Box flexDirection="column" marginLeft={4} marginTop={1} borderLeft borderColor="gray">
                    <Box paddingLeft={1}>
                      <Text color="white">
                        {suggestion.description}
                      </Text>
                      <Text color="gray" marginTop={1}>
                        Action: {suggestion.action}
                      </Text>
                      {suggestion.metadata?.category && (
                        <Text color="cyan">
                          Category: {suggestion.metadata.category}
                        </Text>
                      )}
                      {suggestion.metadata?.tags && (
                        <Text color="magenta">
                          Tags: {suggestion.metadata.tags.join(', ')}
                        </Text>
                      )}
                    </Box>
                  </Box>
                )}
              </Box>
            );
          })}
        </Box>

        {/* Truncation indicator */}
        {suggestions.length > maxSuggestions && (
          <Box marginTop={1} justifyContent="center">
            <Text color="gray" dimColor>
              ... {suggestions.length - maxSuggestions} more suggestions
            </Text>
          </Box>
        )}

        {/* Controls */}
        <Box marginTop={2} borderTop borderColor="gray" paddingTop={1}>
          <Box flexDirection="column">
            <Text color="gray" dimColor>
              ↑↓ navigate • Enter/Space select • 1-9 quick select
            </Text>
            <Text color="gray" dimColor>
              E expand details
              {categories.length > 0 && " • C filter category • R reset"}
            </Text>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default SuggestionPanel;