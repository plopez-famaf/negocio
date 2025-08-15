import { CommandModule } from 'yargs';
import { createAPIClient, createConfigManager, logger } from '@threatguard/core';
import { GlobalArguments } from '../../cli.js';
import { formatSuccess, formatError, formatProgress, formatDuration } from '../../ui/formatters.js';
import { Table } from '../../ui/table.js';
import ora from 'ora';

interface ScanArguments extends GlobalArguments {
  targets: string[];
  timeout?: number;
  'scan-type'?: 'quick' | 'deep' | 'full';
  save?: boolean;
  follow?: boolean;
}

export const scanCommand: CommandModule<{}, ScanArguments> = {
  command: 'scan',
  describe: 'Scan targets for threats and vulnerabilities',
  builder: (yargs) => {
    return yargs
      .option('targets', {
        alias: 't',
        type: 'array',
        description: 'Target IP addresses, networks, or domains to scan',
        required: true,
      })
      .option('timeout', {
        type: 'number',
        description: 'Scan timeout in seconds',
        default: 300,
      })
      .option('scan-type', {
        choices: ['quick', 'deep', 'full'] as const,
        description: 'Type of scan to perform',
        default: 'quick' as const,
      })
      .option('save', {
        type: 'boolean',
        description: 'Save scan results to history',
        default: true,
      })
      .option('follow', {
        alias: 'f',
        type: 'boolean',
        description: 'Follow scan progress in real-time',
        default: false,
      })
      .example([
        ['$0 threat scan -t 192.168.1.1', 'Scan single host'],
        ['$0 threat scan -t 192.168.1.0/24 --scan-type deep', 'Deep scan of network'],
        ['$0 threat scan -t example.com --follow', 'Scan domain with progress'],
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

      const apiClient = createAPIClient({
        baseUrl: configManager.getApiUrl(),
        token: configManager.getToken(),
      });

      const targets = argv.targets.map(String);
      const scanOptions = {
        scanType: argv['scan-type'],
        timeout: argv.timeout! * 1000, // Convert to milliseconds
        aggressive: argv['scan-type'] === 'full',
        saveResults: argv.save,
      };

      logger.info('Starting threat scan', { targets, scanOptions });

      // Start scan
      const spinner = ora('Initializing threat scan...').start();
      
      try {
        const scanResult = await apiClient.startThreatScan(targets, scanOptions);
        
        spinner.text = `Scan started (ID: ${scanResult.scanId})`;
        
        if (!argv.follow) {
          spinner.succeed(formatSuccess(`Threat scan initiated successfully`));
          console.log(`Scan ID: ${scanResult.scanId}`);
          console.log(`Status: ${scanResult.status}`);
          console.log(`Use 'threatguard threat details ${scanResult.scanId}' to check progress`);
          return;
        }

        // Follow scan progress
        spinner.text = 'Monitoring scan progress...';
        
        let completed = false;
        const startTime = Date.now();
        
        while (!completed) {
          try {
            const status = await apiClient.getThreatScanStatus(scanResult.scanId);
            
            switch (status.status) {
              case 'completed':
                completed = true;
                const duration = Date.now() - startTime;
                spinner.succeed(formatSuccess(`Scan completed in ${formatDuration(duration)}`));
                
                // Display results
                await displayScanResults(status);
                break;
                
              case 'failed':
                completed = true;
                spinner.fail(formatError('Scan failed'));
                console.error(`Error: ${status.error || 'Unknown error'}`);
                process.exit(1);
                break;
                
              case 'running':
                const progress = status.progress || 0;
                spinner.text = `Scanning... ${Math.round(progress)}% complete`;
                break;
                
              default:
                spinner.text = `Status: ${status.status}`;
            }
            
            if (!completed) {
              await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
            }
            
          } catch (error) {
            spinner.fail('Failed to get scan status');
            throw error;
          }
        }

      } catch (error) {
        spinner.fail('Scan failed');
        throw error;
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Scan failed';
      logger.error('Threat scan failed', { error: errorMessage });
      
      console.error(formatError('Threat scan failed'));
      console.error(errorMessage);
      process.exit(1);
    }
  },
};

async function displayScanResults(scanResult: any): Promise<void> {
  console.log('\n' + formatSuccess('Scan Results:'));
  
  // Summary table
  const summaryTable = new Table({
    headers: ['Metric', 'Value'],
    rows: [
      ['Targets Scanned', scanResult.summary?.targetsScanned || 0],
      ['Threats Found', scanResult.summary?.threatsFound || 0],
      ['Vulnerabilities', scanResult.summary?.vulnerabilities || 0],
      ['Risk Level', scanResult.summary?.riskLevel || 'Unknown'],
      ['Scan Duration', formatDuration(scanResult.duration || 0)],
    ],
  });
  
  console.log(summaryTable.render());
  
  // Threats found
  if (scanResult.threats && scanResult.threats.length > 0) {
    console.log('\n' + formatError('Threats Detected:'));
    
    const threatTable = new Table({
      headers: ['Target', 'Threat Type', 'Severity', 'Description'],
      rows: scanResult.threats.map((threat: any) => [
        threat.target,
        threat.type,
        threat.severity,
        threat.description || 'No description',
      ]),
    });
    
    console.log(threatTable.render());
  }
  
  // Recommendations
  if (scanResult.recommendations && scanResult.recommendations.length > 0) {
    console.log('\n' + formatProgress('Recommendations:'));
    scanResult.recommendations.forEach((rec: string, index: number) => {
      console.log(`  ${index + 1}. ${rec}`);
    });
  }
}