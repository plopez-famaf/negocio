import { CommandModule } from 'yargs';
import { createConfigManager, logger } from '@threatguard/core';
import { GlobalArguments } from '../../cli.js';
import { formatSuccess, formatError } from '../../ui/formatters.js';
import React from 'react';
import { render } from 'ink';
import { InteractiveDashboard } from '@threatguard/ui-components';

interface InteractiveArguments extends GlobalArguments {
  'skip-auth'?: boolean;
  'use-legacy'?: boolean;
  'use-chat'?: boolean;
}

export const interactiveCommand: CommandModule<{}, InteractiveArguments> = {
  command: 'interactive',
  aliases: ['i', 'dashboard'],
  describe: 'Start interactive ThreatGuard dashboard',
  builder: (yargs) => {
    return yargs
      .option('skip-auth', {
        type: 'boolean',
        description: 'Skip authentication check',
        default: false,
      })
      .option('use-legacy', {
        type: 'boolean',
        description: 'Use legacy text-based interface',
        default: false,
      })
      .option('use-chat', {
        type: 'boolean',
        description: 'Use conversational AI chat interface',
        default: false,
      })
      .example([
        ['$0 interactive', 'Start interactive dashboard'],
        ['$0 interactive --use-chat', 'Start with conversational AI interface'],
        ['$0 i', 'Start interactive dashboard (short alias)'],
        ['$0 dashboard', 'Start interactive dashboard (alias)'],
      ])
      .epilogue('TIP: Use "threatguard chat" for dedicated conversational AI mode');
  },
  handler: async (argv) => {
    const configManager = createConfigManager();
    
    try {
      await configManager.load();
      
      // Check authentication unless skipped
      if (!argv['skip-auth'] && !configManager.isAuthenticated()) {
        console.error(formatError('Authentication required. Run: threatguard auth login'));
        process.exit(1);
      }

      logger.info('Starting interactive dashboard', {
        useLegacy: argv['use-legacy'],
        useChat: argv['use-chat'],
      });

      if (argv['use-chat']) {
        // Use conversational AI chat interface
        const { ChatInterface } = await import('../../ui/conversation/ChatInterface.js');
        const { ChatManagerFactory } = await import('../../conversation/integration/ChatManagerFactory.js');
        const { APIClient } = await import('../../services/api.js');
        const { WebSocketClient } = await import('../../services/websocket.js');
        const { Logger } = await import('@threatguard/core');

        console.log(formatSuccess('🤖 Starting ThreatGuard Conversational AI Interface'));
        console.log('Ask me anything about cybersecurity - I understand natural language!\n');

        const chatLogger = new Logger({
          level: argv.verbose ? 'debug' : 'info',
          service: 'threatguard-chat-interactive',
        });

        // Initialize API and WebSocket clients
        const apiClient = new APIClient({
          configManager,
          logger: chatLogger,
        });

        const wsClient = new WebSocketClient({
          configManager,
          logger: chatLogger,
        });

        // Create ChatManager with all dependencies
        const chatManager = await ChatManagerFactory.create({
          configManager,
          logger: chatLogger,
          apiClient,
          wsClient,
          options: {
            autoSuggestionsEnabled: true,
            confirmationTimeout: 30000,
            maxConcurrentSessions: 1,
          },
        });

        const config = configManager.getConfig();
        const userId = config.userId || 'interactive-user';

        const ChatApp = React.createElement(ChatInterface, {
          chatManager,
          logger: chatLogger,
          userId,
          onExit: () => {
            logger.info('Chat interface closed');
            process.exit(0);
          },
        });

        // Render the chat interface
        const { waitUntilExit } = render(ChatApp);
        await waitUntilExit();

      } else if (argv['use-legacy']) {
        // Use legacy text-based interface
        const { InteractiveSession } = await import('../../ui/interactive.js');
        console.log(formatSuccess('🚀 Starting ThreatGuard Interactive Session (Legacy Mode)'));
        console.log('Type "help" for available commands or "exit" to quit\n');

        const session = new InteractiveSession({
          configManager,
          logger: logger.withPrefix('interactive'),
        });

        await session.start();
      } else {
        // Use React/Ink interactive dashboard
        console.log(formatSuccess('🚀 Starting ThreatGuard Interactive Dashboard'));
        console.log('Use arrow keys to navigate, press Q to quit\n');

        const config = configManager.getConfig();
        
        const app = React.createElement(InteractiveDashboard, {
          apiUrl: config.apiUrl,
          token: config.token,
          onExit: () => {
            logger.info('Interactive dashboard closed');
            process.exit(0);
          },
        });

        // Render the React/Ink app
        const { waitUntilExit } = render(app);
        await waitUntilExit();
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Interactive session failed';
      logger.error('Interactive session failed', { error: errorMessage });
      
      console.error(formatError('Interactive session failed'));
      console.error(errorMessage);
      process.exit(1);
    }
  },
};