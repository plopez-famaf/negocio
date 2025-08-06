import { Command } from 'commander';
import inquirer from 'inquirer';
import ora from 'ora';
import { apiClient } from '@/services/api';
import { configManager } from '@/utils/config';
import { logger } from '@/utils/logger';
import { formatter } from '@/utils/formatter';
import { BehaviorAnalysisRequest } from '@/types';

export function setupBehaviorCommands(program: Command): void {
  const behaviorCommand = program
    .command('behavior')
    .alias('behav')
    .description('Behavioral analysis commands');

  // Analyze command
  behaviorCommand
    .command('analyze <target>')
    .description('Analyze behavioral patterns for a target')
    .option('-t, --type <type>', 'Analysis type (user, network, system, application)', 'user')
    .option('--since <time>', 'Analyze patterns since (e.g., 1h, 24h, 7d)', '24h')
    .option('--until <time>', 'Analyze patterns until (e.g., now, 1h)', 'now')
    .option('-m, --metrics <metrics...>', 'Specific metrics to analyze')
    .option('--baseline <period>', 'Baseline period for comparison (e.g., 7d)', '7d')
    .option('--format <format>', 'Output format (table, json)', 'table')
    .action(async (target, options) => {
      if (!configManager.isAuthenticated()) {
        logger.error('Please login first: threatguard auth login');
        process.exit(1);
      }

      try {
        // Parse time ranges
        const endTime = parseTimeReference(options.until);
        const startTime = parseTimeReference(options.since, endTime);

        const request: BehaviorAnalysisRequest = {
          target,
          timeRange: {
            start: startTime.toISOString(),
            end: endTime.toISOString()
          },
          analysisType: options.type,
          metrics: options.metrics || []
        };

        logger.info(`Analyzing behavioral patterns for: ${target}`);
        logger.info(`Time range: ${startTime.toLocaleString()} - ${endTime.toLocaleString()}`);
        
        const spinner = ora('Running behavioral analysis...').start();

        const result = await apiClient.analyzeBehavior(request);

        spinner.stop();

        logger.success(`Analysis completed for ${target}`);
        logger.info(`Overall Risk Score: ${formatter.formatRiskScore(result.overallRiskScore)}`);
        logger.info(`Patterns Found: ${result.patterns.length}`);
        logger.info(`Anomalies Detected: ${result.anomalies}`);

        if (result.patterns.length > 0) {
          logger.newLine();
          logger.title('Behavioral Patterns:');
          
          if (options.format === 'json') {
            console.log(formatter.formatJSON(result.patterns));
          } else {
            result.patterns.forEach(pattern => {
              console.log(formatter.formatBehaviorPattern(pattern));
              logger.newLine();
            });
          }
        }

        // Display recommendations
        if (result.recommendations.length > 0) {
          logger.title('Recommendations:');
          result.recommendations.forEach((rec, index) => {
            logger.info(`${index + 1}. ${rec}`);
          });
        }

      } catch (error) {
        logger.error(`Behavioral analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        process.exit(1);
      }
    });

  // Patterns command
  behaviorCommand
    .command('patterns <target>')
    .description('List behavioral patterns for a target')
    .option('--since <time>', 'Show patterns since (e.g., 1h, 24h)', '24h')
    .option('-l, --limit <number>', 'Number of patterns to show', '20')
    .option('--min-confidence <value>', 'Minimum confidence threshold (0-1)', '0.7')
    .option('--format <format>', 'Output format (table, json)', 'table')
    .action(async (target, options) => {
      if (!configManager.isAuthenticated()) {
        logger.error('Please login first: threatguard auth login');
        process.exit(1);
      }

      try {
        const timeRange = {
          since: options.since,
          limit: parseInt(options.limit),
          minConfidence: parseFloat(options.minConfidence)
        };

        const patterns = await apiClient.getBehaviorPatterns(target, timeRange);

        if (patterns.length === 0) {
          logger.info(`No behavioral patterns found for ${target}`);
          return;
        }

        logger.success(`Found ${patterns.length} behavioral patterns for ${target}`);

        if (options.format === 'json') {
          console.log(formatter.formatJSON(patterns));
        } else {
          patterns.forEach(pattern => {
            console.log(formatter.formatBehaviorPattern(pattern));
            logger.newLine();
          });
        }

      } catch (error) {
        logger.error(`Failed to get behavioral patterns: ${error instanceof Error ? error.message : 'Unknown error'}`);
        process.exit(1);
      }
    });

  // Anomaly detection command
  behaviorCommand
    .command('anomalies')
    .description('Detect behavioral anomalies in real-time')
    .option('-t, --targets <targets...>', 'Specific targets to monitor')
    .option('--threshold <value>', 'Anomaly threshold (0-1)', '0.8')
    .option('--min-severity <level>', 'Minimum severity (low, medium, high, critical)', 'medium')
    .option('--live', 'Enable live monitoring mode')
    .action(async (options) => {
      if (!configManager.isAuthenticated()) {
        logger.error('Please login first: threatguard auth login');
        process.exit(1);
      }

      logger.info('Starting behavioral anomaly detection...');
      
      if (options.targets) {
        logger.info(`Monitoring targets: ${options.targets.join(', ')}`);
      } else {
        logger.info('Monitoring all targets');
      }
      
      logger.info(`Anomaly threshold: ${options.threshold}`);
      logger.hr();

      if (options.live) {
        logger.info('Live monitoring mode - Press Ctrl+C to stop');
        
        const monitorInterval = setInterval(async () => {
          try {
            // This would be replaced with WebSocket streaming
            const filters = {
              targets: options.targets,
              threshold: parseFloat(options.threshold),
              minSeverity: options.minSeverity,
              since: '1m'
            };

            const patterns = await apiClient.getBehaviorPatterns('*', filters);
            
            patterns
              .filter(pattern => pattern.anomalyScore >= parseFloat(options.threshold))
              .forEach(pattern => {
                logger.behavior(formatter.formatBehaviorPattern(pattern));
              });

          } catch (error) {
            logger.error(`Anomaly detection error: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }, 10000); // Check every 10 seconds

        // Handle Ctrl+C
        process.on('SIGINT', () => {
          clearInterval(monitorInterval);
          logger.info('\nStopping anomaly detection...');
          process.exit(0);
        });

      } else {
        // One-time anomaly detection
        try {
          const spinner = ora('Detecting anomalies...').start();
          
          const filters = {
            targets: options.targets,
            threshold: parseFloat(options.threshold),
            since: '1h'
          };

          const patterns = await apiClient.getBehaviorPatterns('*', filters);
          const anomalies = patterns.filter(pattern => pattern.anomalyScore >= parseFloat(options.threshold));

          spinner.stop();

          if (anomalies.length === 0) {
            logger.success('No significant anomalies detected');
          } else {
            logger.warning(`Found ${anomalies.length} behavioral anomalies`);
            logger.newLine();
            
            anomalies.forEach(anomaly => {
              logger.behavior(formatter.formatBehaviorPattern(anomaly));
              logger.newLine();
            });
          }

        } catch (error) {
          logger.error(`Anomaly detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
          process.exit(1);
        }
      }
    });

  // Interactive behavioral analysis
  behaviorCommand
    .command('interactive')
    .alias('int')
    .description('Interactive behavioral analysis session')
    .action(async () => {
      if (!configManager.isAuthenticated()) {
        logger.error('Please login first: threatguard auth login');
        process.exit(1);
      }

      logger.title('Interactive Behavioral Analysis');

      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'target',
          message: 'Enter target to analyze (IP, username, domain):',
          validate: (input: string) => input.length > 0 || 'Please enter a target'
        },
        {
          type: 'list',
          name: 'analysisType',
          message: 'Select analysis type:',
          choices: [
            { name: 'User behavior analysis', value: 'user' },
            { name: 'Network traffic patterns', value: 'network' },
            { name: 'System behavior analysis', value: 'system' },
            { name: 'Application usage patterns', value: 'application' }
          ]
        },
        {
          type: 'list',
          name: 'timeRange',
          message: 'Select time range:',
          choices: [
            { name: 'Last hour', value: '1h' },
            { name: 'Last 24 hours', value: '24h' },
            { name: 'Last 7 days', value: '7d' },
            { name: 'Last 30 days', value: '30d' }
          ]
        },
        {
          type: 'checkbox',
          name: 'metrics',
          message: 'Select metrics to analyze:',
          choices: [
            'login_patterns',
            'network_usage',
            'data_access',
            'system_calls',
            'application_usage',
            'file_access',
            'privilege_escalation'
          ]
        },
        {
          type: 'confirm',
          name: 'detailed',
          message: 'Include detailed analysis?',
          default: true
        }
      ]);

      try {
        const endTime = new Date();
        const startTime = parseTimeReference(answers.timeRange, endTime);

        const request: BehaviorAnalysisRequest = {
          target: answers.target,
          timeRange: {
            start: startTime.toISOString(),
            end: endTime.toISOString()
          },
          analysisType: answers.analysisType,
          metrics: answers.metrics
        };

        const spinner = ora('Analyzing behavioral patterns...').start();
        const result = await apiClient.analyzeBehavior(request);
        spinner.stop();

        logger.success(`Analysis completed for ${answers.target}`);
        logger.info(`Risk Score: ${formatter.formatRiskScore(result.overallRiskScore)}`);

        if (result.patterns.length > 0) {
          logger.newLine();
          logger.title('Key Findings:');
          
          result.patterns.slice(0, 5).forEach(pattern => {
            console.log(formatter.formatBehaviorPattern(pattern));
            logger.newLine();
          });
        }

        if (result.recommendations.length > 0) {
          logger.title('Recommendations:');
          result.recommendations.forEach((rec, index) => {
            logger.info(`${index + 1}. ${rec}`);
          });
        }

      } catch (error) {
        logger.error(`Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });
}

// Helper function to parse time references
function parseTimeReference(timeRef: string, relativeTo: Date = new Date()): Date {
  const now = relativeTo.getTime();
  
  if (timeRef === 'now') {
    return new Date(now);
  }

  const match = timeRef.match(/^(\d+)([hmwd])$/);
  if (!match) {
    throw new Error(`Invalid time reference: ${timeRef}`);
  }

  const [, value, unit] = match;
  const amount = parseInt(value);
  
  let milliseconds = 0;
  switch (unit) {
    case 'h':
      milliseconds = amount * 60 * 60 * 1000;
      break;
    case 'd':
      milliseconds = amount * 24 * 60 * 60 * 1000;
      break;
    case 'w':
      milliseconds = amount * 7 * 24 * 60 * 60 * 1000;
      break;
    case 'm':
      milliseconds = amount * 60 * 1000;
      break;
  }

  return new Date(now - milliseconds);
}