import React from 'react';
import { render } from 'ink';
import { CommandModule } from 'yargs';
import { ConfigManager, Logger } from '@threatguard/core';
import { ChatInterface } from '../../ui/conversation/ChatInterface.js';
import { ChatManagerFactory } from '../../conversation/integration/ChatManagerFactory.js';
import { APIClient } from '../../services/api.js';
import { WebSocketClient } from '../../services/websocket.js';

export interface ChatOptions {
  userId?: string;
  message?: string;
  debug?: boolean;
}

/**
 * Chat command - Launch interactive conversational CLI interface
 * Provides natural language interaction with ThreatGuard platform
 */
const chatCommand: CommandModule<{}, ChatOptions> = {
  command: 'chat [message]',
  describe: 'Start interactive conversation with ThreatGuard AI',
  
  builder: (yargs) => {
    return yargs
      .positional('message', {
        describe: 'Initial message to send',
        type: 'string',
      })
      .option('user', {
        alias: 'u',
        describe: 'User ID for the session',
        type: 'string',
      })
      .option('debug', {
        alias: 'd',
        describe: 'Enable debug logging',
        type: 'boolean',
        default: false,
      })
      .example('$0 chat', 'Start interactive conversation')
      .example('$0 chat "show threat status"', 'Start with initial message')
      .example('$0 chat -u analyst1', 'Start session for specific user');
  },

  handler: async (args) => {
    const { message, user: userId, debug } = args;

    // Initialize core services
    const configManager = new ConfigManager();
    const logger = new Logger({
      level: debug ? 'debug' : 'info',
      service: 'threatguard-chat',
    });

    logger.info('Starting ThreatGuard Chat Interface', {
      userId,
      hasInitialMessage: !!message,
      debug,
    });

    try {
      // Initialize API and WebSocket clients
      const apiClient = new APIClient({
        configManager,
        logger,
      });

      const wsClient = new WebSocketClient({
        configManager,
        logger,
      });

      // Create ChatManager with all dependencies including autocompletion
      const { chatManager, autocompletionEngine } = await ChatManagerFactory.create({
        configManager,
        logger,
        apiClient,
        wsClient,
        options: {
          autoSuggestionsEnabled: true,
          confirmationTimeout: 30000,
          maxConcurrentSessions: 1,
          enableAutocompletion: true,
          autocompletionMaxCandidates: 8,
        },
      });

      // Create React component with enhanced features
      const ChatApp: React.FC = () => {
        const handleExit = () => {
          logger.info('Chat session ended by user');
          process.exit(0);
        };

        return (
          <ChatInterface
            chatManager={chatManager}
            logger={logger}
            userId={userId}
            initialMessage={message}
            onExit={handleExit}
            autocompletionEngine={autocompletionEngine}
            enableEnhancedInput={true}
          />
        );
      };

      // Render the chat interface
      logger.debug('Rendering chat interface...');
      
      const { waitUntilExit } = render(<ChatApp />);
      
      // Handle graceful shutdown
      process.on('SIGINT', async () => {
        logger.info('Received SIGINT, shutting down...');
        
        // Cleanup services
        try {
          await wsClient.disconnect();
          await apiClient.close();
        } catch (error) {
          logger.error('Error during shutdown', {
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
        
        process.exit(0);
      });

      process.on('SIGTERM', async () => {
        logger.info('Received SIGTERM, shutting down...');
        
        try {
          await wsClient.disconnect();
          await apiClient.close();
        } catch (error) {
          logger.error('Error during shutdown', {
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
        
        process.exit(0);
      });

      // Wait for the app to exit
      await waitUntilExit();
      
      logger.info('Chat interface closed');

    } catch (error) {
      logger.error('Failed to start chat interface', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });

      console.error('❌ Failed to start chat interface:');
      console.error(error instanceof Error ? error.message : 'Unknown error');
      
      if (debug && error instanceof Error && error.stack) {
        console.error('\nStack trace:');
        console.error(error.stack);
      }
      
      process.exit(1);
    }
  },
};

export default chatCommand;