import { CommandModule } from 'yargs';
import { createAPIClient, createConfigManager, logger } from '@threatguard/core';
import { GlobalArguments } from '../../cli.js';
import { formatSuccess, formatError, formatInfo } from '../../ui/formatters.js';
import { Table } from '../../ui/table.js';

interface StatusArguments extends GlobalArguments {
  validate?: boolean;
}

export const statusCommand: CommandModule<{}, StatusArguments> = {
  command: 'status',
  describe: 'Show authentication status and configuration',
  builder: (yargs) => {
    return yargs
      .option('validate', {
        alias: 'v',
        type: 'boolean',
        description: 'Validate token with server',
        default: false,
      })
      .example([
        ['$0 auth status', 'Show current auth status'],
        ['$0 auth status --validate', 'Validate token with server'],
      ]);
  },
  handler: async (argv) => {
    const configManager = createConfigManager();
    
    try {
      // Load existing configuration
      await configManager.load();

      // Check basic authentication status
      const isAuthenticated = configManager.isAuthenticated();
      const config = configManager.getConfig();

      if (!isAuthenticated) {
        console.log(formatError('Not authenticated'));
        console.log('Run `threatguard auth login` to authenticate');
        return;
      }

      // Display basic status
      console.log(formatSuccess('Authenticated'));
      
      const table = new Table({
        headers: ['Property', 'Value'],
        rows: [
          ['API URL', config.apiUrl],
          ['User ID', config.userId || 'N/A'],
          ['Profile', config.currentProfile || 'default'],
          ['Token Present', config.token ? '✓' : '✗'],
        ],
      });

      console.log(table.render());

      // Validate with server if requested
      if (argv.validate) {
        console.log(formatInfo('Validating token with server...'));
        
        try {
          const apiClient = createAPIClient({ 
            baseUrl: config.apiUrl,
            token: config.token,
          });

          const isValid = await apiClient.validateToken();
          
          if (isValid) {
            console.log(formatSuccess('Token is valid'));
          } else {
            console.log(formatError('Token is invalid or expired'));
            console.log('Run `threatguard auth login` to re-authenticate');
          }
        } catch (error) {
          logger.warning('Token validation failed', {
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          console.log(formatError('Could not validate token with server'));
          console.log('Server may be unreachable or token may be invalid');
        }
      }

      // Show configuration summary
      const preferences = config.preferences;
      if (preferences) {
        console.log('\n' + formatInfo('Configuration:'));
        
        const configTable = new Table({
          headers: ['Setting', 'Value'],
          rows: [
            ['Theme', preferences.theme],
            ['Output Format', preferences.outputFormat],
            ['Verbose Mode', preferences.verbose ? 'enabled' : 'disabled'],
            ['Auto Reconnect', preferences.autoReconnect ? 'enabled' : 'disabled'],
            ['Timeout', `${preferences.timeout}ms`],
            ['Page Size', String(preferences.pageSize)],
          ],
        });

        console.log(configTable.render());
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Status check failed';
      logger.error('Status check failed', { error: errorMessage });
      
      console.error(formatError('Status check failed'));
      console.error(errorMessage);
      process.exit(1);
    }
  },
};