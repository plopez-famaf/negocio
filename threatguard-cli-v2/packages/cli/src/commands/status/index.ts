import { CommandModule } from 'yargs';
import { createAPIClient, createConfigManager, logger } from '@threatguard/core';
import { GlobalArguments } from '../../cli.js';
import { formatSuccess, formatError, formatWarning, formatStatus, formatTimestamp } from '../../ui/formatters.js';
import { Table } from '../../ui/table.js';

interface StatusArguments extends GlobalArguments {
  detailed?: boolean;
  'health-check'?: boolean;
}

export const statusCommand: CommandModule<{}, StatusArguments> = {
  command: 'status',
  describe: 'Show system status and health information',
  builder: (yargs) => {
    return yargs
      .option('detailed', {
        alias: 'd',
        type: 'boolean',
        description: 'Show detailed status information',
        default: false,
      })
      .option('health-check', {
        alias: 'h',
        type: 'boolean',
        description: 'Perform health check against API',
        default: false,
      })
      .example([
        ['$0 status', 'Show basic status'],
        ['$0 status --detailed', 'Show detailed status'],
        ['$0 status --health-check', 'Include API health check'],
      ]);
  },
  handler: async (argv) => {
    const configManager = createConfigManager();
    
    try {
      await configManager.load();
      
      console.log(formatSuccess('📊 ThreatGuard CLI Status'));
      console.log('═'.repeat(50) + '\n');

      // Basic configuration status
      const config = configManager.getConfig();
      const isAuthenticated = configManager.isAuthenticated();

      const basicTable = new Table({
        headers: ['Component', 'Status', 'Details'],
        rows: [
          ['Authentication', isAuthenticated ? '✅ Active' : '❌ Not authenticated', config.userId || 'No user'],
          ['API Endpoint', '📡 Configured', config.apiUrl],
          ['Profile', '👤 Active', config.currentProfile || 'default'],
          ['CLI Version', '🔢 2.0.0', 'Latest'],
        ],
      });

      console.log(basicTable.render());

      // API Health Check
      if (argv['health-check'] && isAuthenticated) {
        console.log('\n' + formatSuccess('🏥 API Health Check'));
        console.log('─'.repeat(30));

        try {
          const apiClient = createAPIClient({
            baseUrl: config.apiUrl,
            token: config.token,
          });

          const startTime = Date.now();
          const healthData = await apiClient.getSystemHealth();
          const responseTime = Date.now() - startTime;

          const healthTable = new Table({
            headers: ['Service', 'Status', 'Response Time'],
            rows: [
              ['API Server', formatStatus('online'), `${responseTime}ms`],
              ['Database', healthData.database?.status ? formatStatus('online') : formatStatus('error'), 'N/A'],
              ['WebSocket', healthData.websocket?.status ? formatStatus('online') : formatStatus('offline'), 'N/A'],
              ['Redis Cache', healthData.redis?.status ? formatStatus('online') : formatStatus('offline'), 'N/A'],
            ],
          });

          console.log(healthTable.render());

          if (healthData.version) {
            console.log(`\nAPI Version: ${healthData.version}`);
          }

        } catch (error) {
          console.log(formatError('API health check failed'));
          console.log(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Detailed information
      if (argv.detailed) {
        console.log('\n' + formatSuccess('🔧 Detailed Information'));
        console.log('─'.repeat(40));

        const preferences = config.preferences;
        if (preferences) {
          const detailTable = new Table({
            headers: ['Setting', 'Value', 'Description'],
            rows: [
              ['Theme', preferences.theme, 'UI color scheme'],
              ['Output Format', preferences.outputFormat, 'Default output format'],
              ['Verbose Logging', preferences.verbose ? 'enabled' : 'disabled', 'Debug output level'],
              ['Auto Reconnect', preferences.autoReconnect ? 'enabled' : 'disabled', 'WebSocket reconnection'],
              ['Request Timeout', `${preferences.timeout}ms`, 'API request timeout'],
              ['Page Size', String(preferences.pageSize), 'Default pagination size'],
              ['Date Format', preferences.dateFormat, 'Timestamp format'],
              ['Color Output', preferences.colorOutput ? 'enabled' : 'disabled', 'Terminal colors'],
            ],
          });

          console.log(detailTable.render());
        }

        // Recent commands
        const recentCommands = configManager.getRecentCommands(5);
        if (recentCommands.length > 0) {
          console.log('\n' + formatSuccess('📝 Recent Commands'));
          console.log('─'.repeat(25));
          
          recentCommands.forEach((cmd, index) => {
            console.log(`  ${index + 1}. ${cmd}`);
          });
        }

        // Configuration file info
        console.log('\n' + formatSuccess('📂 Configuration'));
        console.log('─'.repeat(25));
        
        const configPath = configManager.getConfigPath();
        const configSize = await configManager.getConfigSize();
        
        console.log(`Config Path: ${configPath}`);
        console.log(`Config Size: ${configSize} bytes`);
        console.log(`Last Modified: ${formatTimestamp(new Date())}`);
      }

      // Warnings and recommendations
      const warnings: string[] = [];
      
      if (!isAuthenticated) {
        warnings.push('Not authenticated - run "threatguard auth login"');
      }
      
      if (!argv['health-check']) {
        warnings.push('Add --health-check for complete status');
      }

      if (warnings.length > 0) {
        console.log('\n' + formatWarning('⚠️  Recommendations'));
        console.log('─'.repeat(25));
        warnings.forEach((warning, index) => {
          console.log(`  ${index + 1}. ${warning}`);
        });
      }

      logger.info('Status check completed', { 
        authenticated: isAuthenticated,
        healthCheck: argv['health-check'],
        detailed: argv.detailed 
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Status check failed';
      logger.error('Status check failed', { error: errorMessage });
      
      console.error(formatError('Status check failed'));
      console.error(errorMessage);
      process.exit(1);
    }
  },
};