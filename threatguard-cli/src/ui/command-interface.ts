import blessed from 'blessed';
import { spawn } from 'child_process';
import { logger } from '@/utils/logger';

export class CommandInterface {
  private screen: blessed.Widgets.Screen;
  private container: blessed.Widgets.BoxElement;
  private outputBox: blessed.Widgets.BoxElement;
  private inputBox: blessed.Widgets.TextareaElement;
  private commandHistory: string[] = [];
  private historyIndex: number = -1;
  private currentDirectory: string = process.cwd();

  constructor(screen: blessed.Widgets.Screen) {
    this.screen = screen;
    this.createContainer();
    this.createInterface();
  }

  private createContainer(): void {
    this.container = blessed.box({
      parent: this.screen,
      top: 0,
      left: 0,
      right: 0,
      bottom: 1, // Leave space for status bar
      style: {
        bg: 'default'
      },
      hidden: true
    });
  }

  private createInterface(): void {
    // Header
    const header = blessed.box({
      parent: this.container,
      top: 0,
      left: 0,
      right: 0,
      height: 3,
      content: '{center}{bold}ThreatGuard Command Interface{/bold}{/center}\n{center}Type commands directly or "help" for available commands{/center}',
      border: {
        type: 'line'
      },
      style: {
        border: {
          fg: 'green'
        }
      },
      tags: true
    });

    // Output area
    this.outputBox = blessed.box({
      parent: this.container,
      top: 3,
      left: 0,
      right: 0,
      bottom: 4,
      content: this.getWelcomeMessage(),
      border: {
        type: 'line',
        left: true,
        right: true
      },
      style: {
        border: {
          fg: 'white'
        }
      },
      scrollable: true,
      alwaysScroll: true,
      tags: true,
      keys: true,
      vi: true,
      mouse: true
    });

    // Input area
    const inputContainer = blessed.box({
      parent: this.container,
      bottom: 0,
      left: 0,
      right: 0,
      height: 4,
      border: {
        type: 'line'
      },
      style: {
        border: {
          fg: 'cyan'
        }
      }
    });

    // Prompt label
    blessed.box({
      parent: inputContainer,
      top: 1,
      left: 1,
      width: 12,
      height: 1,
      content: 'threatguard>',
      style: {
        fg: 'green',
        bold: true
      }
    });

    // Command input
    this.inputBox = blessed.textarea({
      parent: inputContainer,
      top: 1,
      left: 13,
      right: 1,
      height: 1,
      style: {
        bg: 'default',
        fg: 'white'
      },
      keys: true,
      mouse: true
    });

    this.setupInputHandlers();
  }

  private getWelcomeMessage(): string {
    return `{bold}Welcome to ThreatGuard Command Interface{/bold}

Available commands:
  {cyan-fg}threat scan <target>{/cyan-fg}          - Scan for threats
  {cyan-fg}threat list{/cyan-fg}                   - List recent threats
  {cyan-fg}behavior analyze <target>{/cyan-fg}    - Analyze behavior patterns
  {cyan-fg}network scan <target>{/cyan-fg}        - Network security scan
  {cyan-fg}intel query <indicator>{/intel-fg}     - Query threat intelligence
  {cyan-fg}config setup{/cyan-fg}                 - Configure settings
  {cyan-fg}help{/cyan-fg}                         - Show detailed help
  {cyan-fg}clear{/cyan-fg}                        - Clear output

Type any command and press Enter to execute.
Use ↑/↓ arrows for command history.

`;
  }

  private setupInputHandlers(): void {
    // Handle Enter key
    this.inputBox.key('enter', () => {
      const command = this.inputBox.getValue().trim();
      if (command) {
        this.executeCommand(command);
        this.addToHistory(command);
        this.inputBox.clearValue();
      }
    });

    // Handle Up/Down arrows for command history
    this.inputBox.key('up', () => {
      if (this.commandHistory.length > 0) {
        this.historyIndex = Math.min(this.historyIndex + 1, this.commandHistory.length - 1);
        const command = this.commandHistory[this.commandHistory.length - 1 - this.historyIndex];
        this.inputBox.setValue(command);
        this.screen.render();
      }
    });

    this.inputBox.key('down', () => {
      if (this.historyIndex > 0) {
        this.historyIndex--;
        const command = this.commandHistory[this.commandHistory.length - 1 - this.historyIndex];
        this.inputBox.setValue(command);
        this.screen.render();
      } else if (this.historyIndex === 0) {
        this.historyIndex = -1;
        this.inputBox.clearValue();
        this.screen.render();
      }
    });

    // Handle Tab for auto-completion
    this.inputBox.key('tab', () => {
      const currentInput = this.inputBox.getValue();
      const suggestions = this.getAutocompleteSuggestions(currentInput);
      
      if (suggestions.length === 1) {
        // Complete with the single suggestion
        this.inputBox.setValue(suggestions[0]);
      } else if (suggestions.length > 1) {
        // Show suggestions
        this.appendToOutput(`\n{yellow-fg}Suggestions:{/yellow-fg} ${suggestions.join(', ')}\n`);
      }
      this.screen.render();
    });

    // Handle Ctrl+L to clear
    this.inputBox.key('C-l', () => {
      this.clearOutput();
    });
  }

  private getAutocompleteSuggestions(input: string): string[] {
    const commands = [
      'threat scan',
      'threat list',
      'threat watch',
      'threat status',
      'behavior analyze',
      'behavior patterns',
      'behavior anomalies',
      'network scan',
      'network monitor',
      'network events',
      'network topology',
      'intel query',
      'intel search',
      'intel feeds',
      'config set',
      'config get',
      'config setup',
      'auth login',
      'auth logout',
      'auth status',
      'help',
      'clear'
    ];

    return commands.filter(cmd => cmd.startsWith(input.toLowerCase()));
  }

  private addToHistory(command: string): void {
    this.commandHistory.push(command);
    
    // Keep only last 100 commands
    if (this.commandHistory.length > 100) {
      this.commandHistory.shift();
    }
    
    this.historyIndex = -1;
  }

  private async executeCommand(command: string): Promise<void> {
    // Add command to output
    this.appendToOutput(`\n{green-fg}threatguard>{/green-fg} ${command}\n`);

    // Handle built-in commands
    if (command === 'clear') {
      this.clearOutput();
      return;
    }

    if (command === 'help') {
      this.showHelp();
      return;
    }

    if (command === 'history') {
      this.showHistory();
      return;
    }

    // Execute ThreatGuard CLI command
    try {
      await this.executeThreatGuardCommand(command);
    } catch (error) {
      this.appendToOutput(`{red-fg}Error: ${error instanceof Error ? error.message : 'Command failed'}{/red-fg}\n`);
    }

    this.screen.render();
  }

  private async executeThreatGuardCommand(command: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Parse command
      const args = command.split(' ');
      
      // Execute using node process (simulating CLI execution)
      const child = spawn('node', ['-e', `
        // Simulate CLI command execution
        const command = '${command}';
        console.log('Executing: ' + command);
        
        // Mock responses for demo
        if (command.includes('threat scan')) {
          setTimeout(() => {
            console.log('Starting threat scan...');
            console.log('Scanning completed: 0 threats found');
            console.log('System is secure.');
          }, 1000);
        } else if (command.includes('threat list')) {
          console.log('Recent Threats:');
          console.log('No active threats detected');
        } else if (command.includes('behavior analyze')) {
          console.log('Analyzing behavioral patterns...');
          console.log('Analysis complete: Normal behavior detected');
        } else if (command.includes('network scan')) {
          console.log('Network scan initiated...');
          console.log('Scan complete: Network appears secure');
        } else if (command.includes('intel query')) {
          console.log('Querying threat intelligence...');
          console.log('Intelligence result: No threats found');
        } else {
          console.log('Command executed successfully');
        }
      `], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let output = '';
      let errorOutput = '';

      child.stdout.on('data', (data) => {
        output += data.toString();
      });

      child.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          if (output) {
            this.appendToOutput(output + '\n');
          }
          resolve();
        } else {
          if (errorOutput) {
            this.appendToOutput(`{red-fg}${errorOutput}{/red-fg}\n`);
          }
          reject(new Error(`Command failed with code ${code}`));
        }
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        child.kill();
        reject(new Error('Command timeout'));
      }, 30000);
    });
  }

  private appendToOutput(text: string): void {
    const currentContent = this.outputBox.getContent();
    const newContent = currentContent + text;
    
    // Keep only last 1000 lines
    const lines = newContent.split('\n');
    if (lines.length > 1000) {
      lines.splice(0, lines.length - 1000);
    }
    
    this.outputBox.setContent(lines.join('\n'));
    this.outputBox.setScrollPerc(100); // Auto-scroll to bottom
  }

  private clearOutput(): void {
    this.outputBox.setContent(this.getWelcomeMessage());
    this.screen.render();
  }

  private showHelp(): void {
    const helpText = `
{bold}ThreatGuard CLI Commands{/bold}

{cyan-fg}THREAT DETECTION:{/cyan-fg}
  threat scan <target>              - Scan IP, network, or domain for threats
  threat list [options]             - List recent threats
  threat watch                      - Monitor threats in real-time
  threat status                     - Show system status

{cyan-fg}BEHAVIORAL ANALYSIS:{/cyan-fg}
  behavior analyze <target>         - Analyze behavioral patterns
  behavior patterns <target>        - List behavioral patterns
  behavior anomalies                - Detect anomalies

{cyan-fg}NETWORK MONITORING:{/cyan-fg}
  network scan <target>             - Network security scan
  network monitor                   - Monitor network events
  network events [options]          - List network events
  network topology                  - Discover network topology

{cyan-fg}THREAT INTELLIGENCE:{/cyan-fg}
  intel query <indicator>           - Query threat intelligence
  intel search <term>               - Search intelligence databases
  intel feeds                       - List intelligence feeds

{cyan-fg}CONFIGURATION:{/cyan-fg}
  config setup                      - Interactive configuration
  config set <key> <value>          - Set configuration value
  config get [key]                  - Get configuration value

{cyan-fg}AUTHENTICATION:{/cyan-fg}
  auth login                        - Login to platform
  auth logout                       - Logout
  auth status                       - Show auth status

{cyan-fg}INTERFACE COMMANDS:{/cyan-fg}
  help                              - Show this help
  clear                             - Clear output
  history                           - Show command history

Use Tab for auto-completion and ↑/↓ for command history.
`;

    this.appendToOutput(helpText);
  }

  private showHistory(): void {
    if (this.commandHistory.length === 0) {
      this.appendToOutput('\n{yellow-fg}No commands in history{/yellow-fg}\n');
      return;
    }

    let historyText = '\n{bold}Command History:{/bold}\n';
    this.commandHistory.slice(-20).forEach((cmd, index) => {
      const num = this.commandHistory.length - 20 + index + 1;
      historyText += `{gray-fg}${num.toString().padStart(3)}{/gray-fg} ${cmd}\n`;
    });

    this.appendToOutput(historyText);
  }

  async initialize(): Promise<void> {
    // Focus on input by default
    this.inputBox.focus();
  }

  show(): void {
    this.container.show();
  }

  hide(): void {
    this.container.hide();
  }

  focus(): void {
    this.inputBox.focus();
  }

  async refresh(): Promise<void> {
    // Refresh command interface if needed
  }

  cleanup(): void {
    // Cleanup any resources
  }
}