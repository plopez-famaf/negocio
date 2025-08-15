import { CommandModule } from 'yargs';

export const detailsCommand: CommandModule = {
  command: 'details <id>',
  describe: 'Show detailed threat information',
  handler: async () => {
    console.log('🔍 Threat details - Coming soon in Phase 3');
  },
};