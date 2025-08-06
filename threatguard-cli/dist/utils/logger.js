"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const chalk_1 = __importDefault(require("chalk"));
const moment_1 = __importDefault(require("moment"));
class Logger {
    constructor() {
        this.debugMode = process.env.DEBUG === 'true';
    }
    formatMessage(level, message) {
        const timestamp = chalk_1.default.gray((0, moment_1.default)().format('HH:mm:ss'));
        const levelColor = this.getLevelColor(level);
        const levelText = levelColor(`[${level.toUpperCase()}]`);
        return `${timestamp} ${levelText} ${message}`;
    }
    getLevelColor(level) {
        switch (level) {
            case 'info':
                return chalk_1.default.blue;
            case 'success':
                return chalk_1.default.green;
            case 'warning':
                return chalk_1.default.yellow;
            case 'error':
                return chalk_1.default.red;
            case 'debug':
                return chalk_1.default.magenta;
            default:
                return chalk_1.default.white;
        }
    }
    info(message) {
        console.log(this.formatMessage('info', message));
    }
    success(message) {
        console.log(this.formatMessage('success', message));
    }
    warning(message) {
        console.log(this.formatMessage('warning', message));
    }
    error(message) {
        console.error(this.formatMessage('error', message));
    }
    debug(message) {
        if (this.debugMode) {
            console.log(this.formatMessage('debug', message));
        }
    }
    // Special formatting methods
    title(message) {
        console.log(chalk_1.default.bold.cyan(`\n${message}\n`));
    }
    subtitle(message) {
        console.log(chalk_1.default.bold(`${message}`));
    }
    dim(message) {
        console.log(chalk_1.default.dim(message));
    }
    highlight(message) {
        console.log(chalk_1.default.bgBlue.white(` ${message} `));
    }
    // Threat-specific logging methods
    threat(severity, message) {
        const icons = {
            low: '🔵',
            medium: '🟡',
            high: '🟠',
            critical: '🔴'
        };
        const colors = {
            low: chalk_1.default.blue,
            medium: chalk_1.default.yellow,
            high: chalk_1.default.orange,
            critical: chalk_1.default.red
        };
        const formatted = `${icons[severity]} ${colors[severity](message)}`;
        console.log(this.formatMessage('info', formatted));
    }
    security(message) {
        console.log(chalk_1.default.bgRed.white(`🛡️  SECURITY: ${message}`));
    }
    network(message) {
        console.log(chalk_1.default.cyan(`🌐 ${message}`));
    }
    behavior(message) {
        console.log(chalk_1.default.magenta(`🧠 ${message}`));
    }
    intelligence(message) {
        console.log(chalk_1.default.blue(`🔍 ${message}`));
    }
    // Progress and status methods
    progress(current, total, message) {
        const percentage = Math.round((current / total) * 100);
        const progressBar = this.createProgressBar(percentage);
        const status = message ? ` ${message}` : '';
        process.stdout.write(`\r${progressBar} ${percentage}%${status}`);
        if (current === total) {
            console.log(); // New line when complete
        }
    }
    createProgressBar(percentage, length = 20) {
        const filled = Math.round((percentage / 100) * length);
        const empty = length - filled;
        return chalk_1.default.green('█'.repeat(filled)) + chalk_1.default.gray('░'.repeat(empty));
    }
    clearLine() {
        process.stdout.write('\r\x1b[K');
    }
    newLine() {
        console.log();
    }
    hr(char = '─', length = 50) {
        console.log(chalk_1.default.gray(char.repeat(length)));
    }
}
exports.logger = new Logger();
//# sourceMappingURL=logger.js.map