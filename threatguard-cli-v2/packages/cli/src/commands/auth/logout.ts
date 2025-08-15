import { CommandModule } from 'yargs';
import { createAPIClient, createConfigManager, logger } from '@threatguard/core';
import { GlobalArguments } from '../../cli.js';
import { formatSuccess, formatWarning } from '../../ui/formatters.js';

interface LogoutArguments extends GlobalArguments {
  force?: boolean;
}

export const logoutCommand: CommandModule<{}, LogoutArguments> = {
  command: 'logout',
  describe: 'Log out from the ThreatGuard platform',
  builder: (yargs) => {
    return yargs
      .option('force', {
        alias: 'f',
        type: 'boolean',
        description: 'Force logout without server confirmation',
        default: false,
      })
      .example([
        ['$0 auth logout', 'Standard logout'],
        ['$0 auth logout --force', 'Force logout (offline)'],
      ]);
  },
  handler: async (argv) => {
    const configManager = createConfigManager();
    
    try {
      // Load existing configuration
      await configManager.load();

      // Check if user is authenticated
      if (!configManager.isAuthenticated()) {
        console.log(formatWarning('You are not currently logged in'));
        return;
      }

      // If not forcing, try to logout from server
      if (!argv.force) {
        try {
          const apiClient = createAPIClient({ 
            baseUrl: configManager.getApiUrl(),
            token: configManager.getToken(),
          });

          await apiClient.logout();
          logger.info('Server logout successful');
        } catch (error) {
          logger.warning('Server logout failed, proceeding with local logout', {
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          console.log(formatWarning('Could not contact server, logging out locally'));
        }
      }

      // Clear local authentication
      configManager.logout();
      await configManager.save();

      logger.success('Logout completed');
      console.log(formatSuccess('Successfully logged out from ThreatGuard platform'));

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Logout failed';
      logger.error('Logout failed', { error: errorMessage });
      
      console.error(`Logout failed: ${errorMessage}`);
      process.exit(1);
    }
  },
};