import { CommandModule } from 'yargs';
import { scanCommand } from './scan.js';
import { listCommand } from './list.js';
import { watchCommand } from './watch.js';
import { detailsCommand } from './details.js';

export const threatCommands: CommandModule<{}, any>[] = [
  {
    command: 'threat <subcommand>',
    describe: 'Threat detection and analysis',
    builder: (yargs) => {
      return yargs
        .command(scanCommand)
        .command(listCommand)
        .command(watchCommand)
        .command(detailsCommand)
        .demandCommand(1, 'You must specify a threat subcommand')
        .help()
        .example([
          ['$0 threat scan --targets 192.168.1.0/24', 'Scan network range for threats'],
          ['$0 threat list --severity high', 'List high-severity threats'],
          ['$0 threat watch', 'Monitor threats in real-time'],
        ]);
    },
    handler: () => {
      // This will never be called due to demandCommand(1)
    },
  },
];