import chalk from 'chalk';
import figures from 'figures';

// Color and symbol formatting utilities

export function formatSuccess(message: string): string {
  return chalk.green(`${figures.tick} ${message}`);
}

export function formatError(message: string): string {
  return chalk.red(`${figures.cross} ${message}`);
}

export function formatWarning(message: string): string {
  return chalk.yellow(`${figures.warning} ${message}`);
}

export function formatInfo(message: string): string {
  return chalk.blue(`${figures.info} ${message}`);
}

export function formatProgress(message: string): string {
  return chalk.cyan(`${figures.arrowRight} ${message}`);
}

export function formatVerbose(message: string): string {
  return chalk.gray(`${figures.bullet} ${message}`);
}

// Status indicators
export function formatStatus(status: 'online' | 'offline' | 'unknown' | 'error'): string {
  switch (status) {
    case 'online':
      return chalk.green(figures.radioOn);
    case 'offline':
      return chalk.red(figures.radioOff);
    case 'error':
      return chalk.red(figures.cross);
    case 'unknown':
    default:
      return chalk.yellow(figures.radioOff);
  }
}

// Severity levels
export function formatSeverity(severity: 'low' | 'medium' | 'high' | 'critical'): string {
  switch (severity) {
    case 'low':
      return chalk.green(severity.toUpperCase());
    case 'medium':
      return chalk.yellow(severity.toUpperCase());
    case 'high':
      return chalk.orange(severity.toUpperCase());
    case 'critical':
      return chalk.red(severity.toUpperCase());
    default:
      return chalk.gray('UNKNOWN');
  }
}

// Threat types
export function formatThreatType(type: string): string {
  const colors = {
    malware: chalk.red,
    phishing: chalk.magenta,
    intrusion: chalk.yellow,
    anomaly: chalk.cyan,
    vulnerability: chalk.orange,
  };

  const color = colors[type as keyof typeof colors] || chalk.white;
  return color(type.toUpperCase());
}

// Time formatting
export function formatRelativeTime(timestamp: string | Date): string {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) {
    return chalk.gray(`${diffSeconds}s ago`);
  } else if (diffMinutes < 60) {
    return chalk.gray(`${diffMinutes}m ago`);
  } else if (diffHours < 24) {
    return chalk.gray(`${diffHours}h ago`);
  } else {
    return chalk.gray(`${diffDays}d ago`);
  }
}

export function formatTimestamp(timestamp: string | Date): string {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  return chalk.gray(date.toLocaleString());
}

// Data size formatting
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// Duration formatting
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  } else if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  } else if (ms < 3600000) {
    return `${(ms / 60000).toFixed(1)}m`;
  } else {
    return `${(ms / 3600000).toFixed(1)}h`;
  }
}

// IP address formatting
export function formatIPAddress(ip: string): string {
  // Simple validation and formatting
  if (ip.includes(':')) {
    // IPv6
    return chalk.cyan(ip);
  } else {
    // IPv4
    return chalk.blue(ip);
  }
}

// URL formatting
export function formatURL(url: string): string {
  return chalk.underline.blue(url);
}

// Hash formatting (truncated)
export function formatHash(hash: string, length: number = 8): string {
  if (hash.length <= length) {
    return chalk.gray(hash);
  }
  return chalk.gray(`${hash.substring(0, length)}...`);
}

// Highlight important text
export function highlight(text: string): string {
  return chalk.bold.white(text);
}

// Dimmed text for less important information
export function dimmed(text: string): string {
  return chalk.gray(text);
}

// Badge-style formatting
export function badge(text: string, color: 'green' | 'red' | 'yellow' | 'blue' | 'gray' = 'blue'): string {
  const colors = {
    green: chalk.bgGreen.black,
    red: chalk.bgRed.white,
    yellow: chalk.bgYellow.black,
    blue: chalk.bgBlue.white,
    gray: chalk.bgGray.white,
  };

  return colors[color](` ${text} `);
}

// Progress bar
export function progressBar(percentage: number, width: number = 20): string {
  const filled = Math.floor((percentage / 100) * width);
  const empty = width - filled;
  
  const bar = chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
  return `${bar} ${percentage.toFixed(1)}%`;
}

// Spinner characters
export const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

// Code formatting
export function formatCode(code: string): string {
  return chalk.bgBlack.white(` ${code} `);
}

// JSON formatting
export function formatJSON(obj: any, indent: number = 2): string {
  return chalk.gray(JSON.stringify(obj, null, indent));
}