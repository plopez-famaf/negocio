import { CommandModule } from 'yargs';
import { createAPIClient, createConfigManager, logger } from '@threatguard/core';
import { GlobalArguments } from '../../cli.js';
import { InputPrompt } from '../../ui/prompts.js';
import { formatError, formatSuccess } from '../../ui/formatters.js';

interface LoginArguments extends GlobalArguments {
  username?: string;
  password?: string;
  'api-url'?: string;
  save?: boolean;
}

export const loginCommand: CommandModule<{}, LoginArguments> = {
  command: 'login',
  describe: 'Authenticate with the ThreatGuard platform',
  builder: (yargs) => {
    return yargs
      .option('username', {
        alias: 'u',
        type: 'string',
        description: 'Username for authentication',
      })
      .option('password', {
        alias: 'p',
        type: 'string',
        description: 'Password for authentication (not recommended)',
      })
      .option('api-url', {
        type: 'string',
        description: 'API base URL',
      })
      .option('save', {
        type: 'boolean',
        description: 'Save credentials for future use',
        default: true,
      })
      .example([
        ['$0 auth login', 'Interactive login'],
        ['$0 auth login -u admin@company.com', 'Login with username'],
        ['$0 auth login --api-url https://api.threatguard.io', 'Login with custom API URL'],
      ]);
  },
  handler: async (argv) => {
    const configManager = createConfigManager();
    
    try {
      // Load existing configuration
      await configManager.load();

      // Determine API URL
      const apiUrl = argv['api-url'] || configManager.getApiUrl();
      if (argv['api-url']) {
        configManager.setApiUrl(argv['api-url']);
      }

      logger.info('Authenticating with ThreatGuard platform...', { apiUrl });

      // Create API client
      const apiClient = createAPIClient({ baseUrl: apiUrl });

      // Get credentials interactively if not provided
      let username = argv.username;
      let password = argv.password;

      if (!username) {
        const prompt = new InputPrompt();
        username = await prompt.text({
          message: 'Username or email:',
          required: true,
        });
      }

      if (!password) {
        const prompt = new InputPrompt();
        password = await prompt.password({
          message: 'Password:',
          required: true,
        });
      }

      // Authenticate
      const authResult = await apiClient.login({
        username: username!,
        password: password!,
      });

      // Save authentication if requested
      if (argv.save) {
        configManager.setToken(authResult.token);
        configManager.setUserId(authResult.userId);
        await configManager.save();
      }

      logger.success('Authentication successful!', {
        userId: authResult.userId,
        expiresAt: authResult.expiresAt,
      });

      console.log(formatSuccess('Successfully authenticated with ThreatGuard platform'));
      console.log(`Welcome, ${authResult.user?.name || username}!`);

      if (authResult.expiresAt) {
        const expiryDate = new Date(authResult.expiresAt);
        console.log(`Token expires: ${expiryDate.toLocaleString()}`);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
      logger.error('Authentication failed', { error: errorMessage });
      
      console.error(formatError('Authentication failed'));
      console.error(errorMessage);
      
      process.exit(1);
    }
  },
};