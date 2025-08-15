import { CommandModule } from 'yargs';

export const listCommand: CommandModule = {
  command: 'list',
  describe: 'List detected threats',
  handler: async () => {
    console.log('📋 Threat listing - Coming soon in Phase 3');
  },
};