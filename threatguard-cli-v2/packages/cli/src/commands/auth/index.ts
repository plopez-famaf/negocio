import { CommandModule } from 'yargs';
import { loginCommand } from './login.js';
import { logoutCommand } from './logout.js';
import { statusCommand } from './status.js';

export const authCommands: CommandModule<{}, any>[] = [
  {
    command: 'auth <subcommand>',
    describe: 'Authentication management',
    builder: (yargs) => {
      return yargs
        .command(loginCommand)
        .command(logoutCommand)
        .command(statusCommand)
        .demandCommand(1, 'You must specify an auth subcommand')
        .help();
    },
    handler: () => {
      // This will never be called due to demandCommand(1)
    },
  },
];