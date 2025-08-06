import chalk from 'chalk';
import moment from 'moment';

export type LogLevel = 'info' | 'success' | 'warning' | 'error' | 'debug';

class Logger {
  private debugMode: boolean = process.env.DEBUG === 'true';

  private formatMessage(level: LogLevel, message: string): string {
    const timestamp = chalk.gray(moment().format('HH:mm:ss'));
    const levelColor = this.getLevelColor(level);
    const levelText = levelColor(`[${level.toUpperCase()}]`);
    
    return `${timestamp} ${levelText} ${message}`;
  }

  private getLevelColor(level: LogLevel): chalk.Chalk {
    switch (level) {
      case 'info':
        return chalk.blue;
      case 'success':
        return chalk.green;
      case 'warning':
        return chalk.yellow;
      case 'error':
        return chalk.red;
      case 'debug':
        return chalk.magenta;
      default:
        return chalk.white;
    }
  }

  info(message: string): void {
    console.log(this.formatMessage('info', message));
  }

  success(message: string): void {
    console.log(this.formatMessage('success', message));
  }

  warning(message: string): void {
    console.log(this.formatMessage('warning', message));
  }

  error(message: string): void {
    console.error(this.formatMessage('error', message));
  }

  debug(message: string): void {
    if (this.debugMode) {
      console.log(this.formatMessage('debug', message));
    }
  }

  // Special formatting methods
  title(message: string): void {
    console.log(chalk.bold.cyan(`\n${message}\n`));
  }

  subtitle(message: string): void {
    console.log(chalk.bold(`${message}`));
  }

  dim(message: string): void {
    console.log(chalk.dim(message));
  }

  highlight(message: string): void {
    console.log(chalk.bgBlue.white(` ${message} `));
  }

  // Threat-specific logging methods
  threat(severity: 'low' | 'medium' | 'high' | 'critical', message: string): void {
    const icons = {
      low: '🔵',
      medium: '🟡',
      high: '🟠',
      critical: '🔴'
    };
    
    const colors = {
      low: chalk.blue,
      medium: chalk.yellow,
      high: chalk.orange,
      critical: chalk.red
    };

    const formatted = `${icons[severity]} ${colors[severity](message)}`;
    console.log(this.formatMessage('info', formatted));
  }

  security(message: string): void {
    console.log(chalk.bgRed.white(`🛡️  SECURITY: ${message}`));
  }

  network(message: string): void {
    console.log(chalk.cyan(`🌐 ${message}`));
  }

  behavior(message: string): void {
    console.log(chalk.magenta(`🧠 ${message}`));
  }

  intelligence(message: string): void {
    console.log(chalk.blue(`🔍 ${message}`));
  }

  // Progress and status methods
  progress(current: number, total: number, message?: string): void {
    const percentage = Math.round((current / total) * 100);
    const progressBar = this.createProgressBar(percentage);
    const status = message ? ` ${message}` : '';
    
    process.stdout.write(`\r${progressBar} ${percentage}%${status}`);
    
    if (current === total) {
      console.log(); // New line when complete
    }
  }

  private createProgressBar(percentage: number, length: number = 20): string {
    const filled = Math.round((percentage / 100) * length);
    const empty = length - filled;
    
    return chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
  }

  clearLine(): void {
    process.stdout.write('\r\x1b[K');
  }

  newLine(): void {
    console.log();
  }

  hr(char: string = '─', length: number = 50): void {
    console.log(chalk.gray(char.repeat(length)));
  }
}

export const logger = new Logger();