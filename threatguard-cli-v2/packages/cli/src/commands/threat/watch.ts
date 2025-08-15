import { CommandModule } from 'yargs';
import { createWebSocketClient, createConfigManager, logger } from '@threatguard/core';
import { GlobalArguments } from '../../cli.js';
import { formatSuccess, formatError, formatSeverity, formatRelativeTime, formatThreatType } from '../../ui/formatters.js';
import { Table } from '../../ui/table.js';

interface WatchArguments extends GlobalArguments {
  filter?: string[];
  severity?: string[];
  limit?: number;
  'no-clear'?: boolean;
}

export const watchCommand: CommandModule<{}, WatchArguments> = {
  command: 'watch',
  describe: 'Monitor threats in real-time',
  builder: (yargs) => {
    return yargs
      .option('filter', {
        alias: 'f',
        type: 'array',
        description: 'Filter by threat types',
        choices: ['malware', 'phishing', 'intrusion', 'anomaly', 'vulnerability'],
      })
      .option('severity', {
        alias: 's',
        type: 'array',
        description: 'Filter by severity levels',
        choices: ['low', 'medium', 'high', 'critical'],
      })
      .option('limit', {
        alias: 'l',
        type: 'number',
        description: 'Maximum number of events to display',
        default: 50,
      })
      .option('no-clear', {
        type: 'boolean',
        description: 'Do not clear screen on start',
        default: false,
      })
      .example([
        ['$0 threat watch', 'Monitor all threats'],
        ['$0 threat watch --severity high critical', 'Monitor high/critical threats only'],
        ['$0 threat watch --filter malware intrusion', 'Monitor specific threat types'],
      ]);
  },
  handler: async (argv) => {
    const configManager = createConfigManager();
    
    try {
      await configManager.load();
      
      if (!configManager.isAuthenticated()) {
        console.error(formatError('Authentication required. Run: threatguard auth login'));
        process.exit(1);
      }

      // Clear screen unless disabled
      if (!argv['no-clear']) {
        console.clear();
      }

      console.log(formatSuccess('🔍 ThreatGuard Real-Time Monitoring'));
      console.log('Press Ctrl+C to stop monitoring\n');

      // Set up WebSocket connection
      const wsClient = createWebSocketClient({
        filters: {
          eventTypes: argv.filter || ['threat'],
          severity: argv.severity || ['low', 'medium', 'high', 'critical'],
        },
      });

      const events: any[] = [];
      let isConnected = false;

      // Connection events
      wsClient.on('connected', (info: any) => {
        isConnected = true;
        logger.info('Connected to threat monitoring stream', info);
        updateDisplay();
      });

      wsClient.on('disconnected', (info: any) => {
        isConnected = false;
        console.log(formatError('Disconnected from monitoring stream'));
        logger.warning('Disconnected from threat monitoring stream', info);
      });

      wsClient.on('error', (error: any) => {
        console.error(formatError(`Connection error: ${error.message}`));
        logger.error('WebSocket error', { error: error.message });
      });

      // Threat events
      wsClient.on('threat_event', (event: any) => {
        events.unshift(event);
        
        // Keep only the latest events
        if (events.length > argv.limit!) {
          events.splice(argv.limit!);
        }
        
        updateDisplay();
        logger.debug('Threat event received', { 
          type: event.type,
          severity: event.severity,
          target: event.target 
        });
      });

      // Update display function
      function updateDisplay() {
        if (!argv['no-clear']) {
          console.clear();
        }
        
        console.log(formatSuccess('🔍 ThreatGuard Real-Time Monitoring'));
        console.log(`Status: ${isConnected ? '🟢 Connected' : '🔴 Disconnected'}`);
        console.log(`Events: ${events.length}/${argv.limit} | Filters: ${(argv.filter || ['all']).join(', ')}`);
        console.log('Press Ctrl+C to stop monitoring\n');

        if (events.length === 0) {
          console.log('No threats detected. Monitoring...');
          return;
        }

        // Display recent events in table
        const table = new Table({
          headers: ['Time', 'Type', 'Severity', 'Target', 'Description'],
          rows: events.slice(0, 20).map(event => [
            formatRelativeTime(event.timestamp),
            formatThreatType(event.type),
            formatSeverity(event.severity),
            event.target || 'N/A',
            (event.description || '').substring(0, 40) + '...',
          ]),
          maxWidth: process.stdout.columns - 4,
        });

        console.log(table.render());
        
        if (events.length > 20) {
          console.log(`\n... and ${events.length - 20} more events`);
        }
      }

      // Connect to stream
      const apiUrl = configManager.getApiUrl();
      const wsUrl = apiUrl.replace(/^http/, 'ws') + '/stream';
      const token = configManager.getToken()!;

      await wsClient.connect(wsUrl, token);

      // Handle graceful shutdown
      process.on('SIGINT', () => {
        console.log('\n' + formatSuccess('Stopping monitoring...'));
        wsClient.disconnect();
        process.exit(0);
      });

      // Keep the process running
      setInterval(() => {
        // Heartbeat to keep connection alive
        if (isConnected) {
          wsClient.emit('heartbeat', { timestamp: Date.now() });
        }
      }, 30000);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Monitoring failed';
      logger.error('Threat monitoring failed', { error: errorMessage });
      
      console.error(formatError('Threat monitoring failed'));
      console.error(errorMessage);
      process.exit(1);
    }
  },
};