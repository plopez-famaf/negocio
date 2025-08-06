import { Command } from 'commander';
import inquirer from 'inquirer';
import { apiClient } from '@/services/api';
import { configManager } from '@/utils/config';
import { logger } from '@/utils/logger';

export function setupAuthCommands(program: Command): void {
  const authCommand = program
    .command('auth')
    .description('Authentication commands');

  // Login command
  authCommand
    .command('login')
    .description('Login to ThreatGuard platform')
    .option('-e, --email <email>', 'Email address')
    .option('-p, --password <password>', 'Password')
    .action(async (options) => {
      try {
        let { email, password } = options;

        // If credentials not provided via options, prompt for them
        if (!email || !password) {
          const answers = await inquirer.prompt([
            {
              type: 'input',
              name: 'email',
              message: 'Email:',
              when: () => !email,
              validate: (input: string) => {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                return emailRegex.test(input) || 'Please enter a valid email address';
              }
            },
            {
              type: 'password',
              name: 'password',
              message: 'Password:',
              when: () => !password,
              mask: '*'
            }
          ]);

          email = email || answers.email;
          password = password || answers.password;
        }

        logger.info('Authenticating...');
        
        const tokenData = await apiClient.login({ email, password });
        
        logger.success(`Logged in successfully as ${email}`);
        logger.info(`Token expires: ${new Date(tokenData.expiresAt).toLocaleString()}`);
        
        // Display permissions if available
        if (tokenData.permissions.length > 0) {
          logger.info(`Permissions: ${tokenData.permissions.join(', ')}`);
        }

      } catch (error) {
        logger.error(`Login failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        process.exit(1);
      }
    });

  // Logout command
  authCommand
    .command('logout')
    .description('Logout from ThreatGuard platform')
    .action(async () => {
      try {
        if (!configManager.isAuthenticated()) {
          logger.warning('You are not currently logged in');
          return;
        }

        await apiClient.logout();
        logger.success('Logged out successfully');
      } catch (error) {
        logger.error(`Logout failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

  // Status command
  authCommand
    .command('status')
    .description('Show authentication status')
    .action(async () => {
      if (!configManager.isAuthenticated()) {
        logger.warning('Not authenticated');
        logger.info('Run: threatguard auth login');
        return;
      }

      const userId = configManager.getUserId();
      const apiUrl = configManager.getApiUrl();

      logger.info(`Authenticated as: ${userId}`);
      logger.info(`API URL: ${apiUrl}`);

      // Validate token
      try {
        const isValid = await apiClient.validateToken();
        if (isValid) {
          logger.success('Token is valid');
        } else {
          logger.warning('Token is invalid or expired. Please login again.');
        }
      } catch (error) {
        logger.error('Failed to validate token');
      }
    });

  // Whoami command
  authCommand
    .command('whoami')
    .description('Display current user information')
    .action(async () => {
      if (!configManager.isAuthenticated()) {
        logger.warning('Not authenticated');
        return;
      }

      try {
        const health = await apiClient.getSystemHealth();
        logger.info(`User ID: ${configManager.getUserId()}`);
        logger.info(`API URL: ${configManager.getApiUrl()}`);
        
        if (health.user) {
          logger.info(`Role: ${health.user.role || 'user'}`);
          logger.info(`Plan: ${health.user.plan || 'free'}`);
        }
      } catch (error) {
        logger.error('Failed to get user information');
      }
    });
}