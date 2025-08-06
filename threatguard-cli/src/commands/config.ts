import { Command } from 'commander';
import inquirer from 'inquirer';
import { configManager } from '@/utils/config';
import { logger } from '@/utils/logger';

export function setupConfigCommands(program: Command): void {
  const configCommand = program
    .command('config')
    .description('Configuration management commands');

  // Set configuration value
  configCommand
    .command('set <key> <value>')
    .description('Set a configuration value')
    .action((key, value) => {
      try {
        // Parse value based on key type
        let parsedValue: any = value;
        
        if (key.includes('.')) {
          // Handle nested configuration keys
          const [section, subKey] = key.split('.');
          const currentSection = configManager.get(section as any) || {};
          
          // Parse boolean values
          if (value === 'true') parsedValue = true;
          else if (value === 'false') parsedValue = false;
          // Parse numbers
          else if (!isNaN(Number(value))) parsedValue = Number(value);
          
          currentSection[subKey] = parsedValue;
          configManager.set(section as any, currentSection);
        } else {
          // Parse boolean values
          if (value === 'true') parsedValue = true;
          else if (value === 'false') parsedValue = false;
          // Parse numbers
          else if (!isNaN(Number(value))) parsedValue = Number(value);
          
          configManager.set(key as any, parsedValue);
        }

        logger.success(`Configuration updated: ${key} = ${parsedValue}`);
      } catch (error) {
        logger.error(`Failed to set configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

  // Get configuration value
  configCommand
    .command('get [key]')
    .description('Get configuration value(s)')
    .option('--format <format>', 'Output format (json, table)', 'table')
    .action((key, options) => {
      try {
        if (key) {
          const value = key.includes('.') ? 
            getNestedConfig(key) : 
            configManager.get(key as any);
          
          if (value === undefined) {
            logger.warning(`Configuration key '${key}' not found`);
          } else {
            if (options.format === 'json') {
              console.log(JSON.stringify({ [key]: value }, null, 2));
            } else {
              logger.info(`${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`);
            }
          }
        } else {
          // Show all configuration
          const allConfig = configManager.get();
          
          if (options.format === 'json') {
            console.log(JSON.stringify(allConfig, null, 2));
          } else {
            logger.title('Current Configuration:');
            displayConfigRecursive(allConfig);
          }
        }
      } catch (error) {
        logger.error(`Failed to get configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

  // Delete configuration value
  configCommand
    .command('delete <key>')
    .alias('del')
    .description('Delete a configuration value')
    .option('-f, --force', 'Force deletion without confirmation')
    .action(async (key, options) => {
      try {
        const currentValue = key.includes('.') ? 
          getNestedConfig(key) : 
          configManager.get(key as any);
        
        if (currentValue === undefined) {
          logger.warning(`Configuration key '${key}' not found`);
          return;
        }

        // Confirmation unless forced
        if (!options.force) {
          const answer = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'confirm',
              message: `Delete configuration '${key}'?`,
              default: false
            }
          ]);

          if (!answer.confirm) {
            logger.info('Deletion cancelled');
            return;
          }
        }

        if (key.includes('.')) {
          // Handle nested configuration keys
          const [section, subKey] = key.split('.');
          const currentSection = configManager.get(section as any) || {};
          delete currentSection[subKey];
          configManager.set(section as any, currentSection);
        } else {
          configManager.delete(key as any);
        }

        logger.success(`Configuration deleted: ${key}`);
      } catch (error) {
        logger.error(`Failed to delete configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

  // Reset configuration
  configCommand
    .command('reset')
    .description('Reset configuration to defaults')
    .option('-f, --force', 'Force reset without confirmation')
    .action(async (options) => {
      try {
        if (!options.force) {
          const answer = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'confirm',
              message: 'Reset all configuration to defaults? This will remove your API token.',
              default: false
            }
          ]);

          if (!answer.confirm) {
            logger.info('Reset cancelled');
            return;
          }
        }

        configManager.clear();
        logger.success('Configuration reset to defaults');
        logger.warning('You will need to login again: threatguard auth login');
      } catch (error) {
        logger.error(`Failed to reset configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

  // Interactive configuration setup
  configCommand
    .command('setup')
    .description('Interactive configuration setup')
    .action(async () => {
      logger.title('ThreatGuard CLI Configuration Setup');
      
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'apiUrl',
          message: 'API URL:',
          default: configManager.getApiUrl(),
          validate: (input: string) => {
            const urlRegex = /^https?:\/\/.+/;
            return urlRegex.test(input) || 'Please enter a valid URL';
          }
        },
        {
          type: 'list',
          name: 'theme',
          message: 'Terminal theme:',
          choices: [
            { name: 'Dark theme (recommended)', value: 'dark' },
            { name: 'Light theme', value: 'light' }
          ],
          default: configManager.getPreferences().theme
        },
        {
          type: 'list',
          name: 'outputFormat',
          message: 'Default output format:',
          choices: [
            { name: 'Table format (recommended)', value: 'table' },
            { name: 'JSON format', value: 'json' },
            { name: 'Plain text', value: 'text' }
          ],
          default: configManager.getPreferences().outputFormat
        },
        {
          type: 'confirm',
          name: 'realTimeUpdates',
          message: 'Enable real-time updates?',
          default: configManager.getPreferences().realTimeUpdates
        },
        {
          type: 'confirm',
          name: 'notifications',
          message: 'Enable notifications?',
          default: configManager.getPreferences().notifications
        },
        {
          type: 'number',
          name: 'defaultLimit',
          message: 'Default result limit:',
          default: 20,
          validate: (input: number) => input > 0 || 'Please enter a positive number'
        }
      ]);

      // Apply configuration
      configManager.set('apiUrl', answers.apiUrl);
      configManager.setPreference('theme', answers.theme);
      configManager.setPreference('outputFormat', answers.outputFormat);
      configManager.setPreference('realTimeUpdates', answers.realTimeUpdates);
      configManager.setPreference('notifications', answers.notifications);
      
      // Set default limit in preferences (custom setting)
      const preferences = configManager.getPreferences();
      preferences.defaultLimit = answers.defaultLimit;
      configManager.set('preferences', preferences);

      logger.success('Configuration updated successfully!');
      
      // Check if user is authenticated
      if (!configManager.isAuthenticated()) {
        logger.info('To get started, please login: threatguard auth login');
      }
    });

  // Show configuration file path
  configCommand
    .command('path')
    .description('Show configuration file path')
    .action(() => {
      // This would show the actual config file path
      const configPath = process.env.HOME + '/.config/threatguard-cli/config.json';
      logger.info(`Configuration file: ${configPath}`);
      
      // Check if file exists
      const fs = require('fs');
      if (fs.existsSync(configPath)) {
        const stats = fs.statSync(configPath);
        logger.info(`Last modified: ${stats.mtime.toLocaleString()}`);
        logger.info(`File size: ${stats.size} bytes`);
      } else {
        logger.warning('Configuration file does not exist yet');
      }
    });

  // Validate configuration
  configCommand
    .command('validate')
    .description('Validate current configuration')
    .action(async () => {
      logger.title('Configuration Validation');
      
      const config = configManager.get();
      const issues: string[] = [];
      const warnings: string[] = [];

      // Check API URL
      if (!config.apiUrl) {
        issues.push('API URL is not configured');
      } else {
        try {
          new URL(config.apiUrl);
          logger.success('✓ API URL format is valid');
        } catch {
          issues.push('API URL format is invalid');
        }
      }

      // Check authentication
      if (!configManager.isAuthenticated()) {
        warnings.push('Not authenticated - run: threatguard auth login');
      } else {
        logger.success('✓ Authentication token is present');
      }

      // Check preferences
      const prefs = config.preferences || {};
      
      if (!['dark', 'light'].includes(prefs.theme)) {
        warnings.push('Invalid theme preference');
      } else {
        logger.success('✓ Theme preference is valid');
      }

      if (!['table', 'json', 'text'].includes(prefs.outputFormat)) {
        warnings.push('Invalid output format preference');
      } else {
        logger.success('✓ Output format preference is valid');
      }

      // Report results
      if (issues.length === 0 && warnings.length === 0) {
        logger.success('Configuration is valid!');
      } else {
        if (issues.length > 0) {
          logger.newLine();
          logger.error('Issues found:');
          issues.forEach(issue => logger.error(`  • ${issue}`));
        }

        if (warnings.length > 0) {
          logger.newLine();
          logger.warning('Warnings:');
          warnings.forEach(warning => logger.warning(`  • ${warning}`));
        }

        logger.newLine();
        logger.info('Run: threatguard config setup - to fix configuration issues');
      }
    });
}

// Helper functions
function getNestedConfig(key: string): any {
  const [section, subKey] = key.split('.');
  const sectionData = configManager.get(section as any);
  return sectionData ? sectionData[subKey] : undefined;
}

function displayConfigRecursive(obj: any, prefix: string = ''): void {
  Object.entries(obj).forEach(([key, value]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      logger.subtitle(`${fullKey}:`);
      displayConfigRecursive(value, fullKey);
    } else {
      const displayValue = typeof value === 'string' && key.toLowerCase().includes('token') 
        ? '***hidden***' 
        : JSON.stringify(value);
      logger.info(`  ${fullKey}: ${displayValue}`);
    }
  });
}