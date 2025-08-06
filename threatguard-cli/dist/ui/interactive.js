"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startInteractiveMode = startInteractiveMode;
const blessed_1 = __importDefault(require("blessed"));
const config_1 = require("@/utils/config");
const logger_1 = require("@/utils/logger");
const dashboard_1 = require("./dashboard");
const command_interface_1 = require("./command-interface");
const realtime_stream_1 = require("./realtime-stream");
async function startInteractiveMode() {
    logger_1.logger.info('Starting interactive mode...');
    const app = new InteractiveApp();
    await app.initialize();
    app.run();
}
class InteractiveApp {
    constructor() {
        this.currentMode = 'dashboard';
        // Create main screen
        this.screen = blessed_1.default.screen({
            smartCSR: true,
            title: 'ThreatGuard CLI - Interactive Mode',
            dockBorders: false,
            fullUnicode: true,
            cursor: {
                artificial: true,
                shape: 'line',
                blink: true,
                color: null
            }
        });
        // Initialize components
        this.dashboard = new dashboard_1.ThreatDashboard(this.screen);
        this.commandInterface = new command_interface_1.CommandInterface(this.screen);
        this.realTimeStream = new realtime_stream_1.RealTimeStream(this.screen);
        this.setupKeyBindings();
        this.setupStatusBar();
    }
    async initialize() {
        try {
            // Validate authentication
            if (!config_1.configManager.isAuthenticated()) {
                throw new Error('Not authenticated');
            }
            // Initialize components
            await this.dashboard.initialize();
            await this.commandInterface.initialize();
            await this.realTimeStream.initialize();
            // Set initial mode
            this.switchMode('dashboard');
        }
        catch (error) {
            logger_1.logger.error(`Failed to initialize interactive mode: ${error instanceof Error ? error.message : 'Unknown error'}`);
            process.exit(1);
        }
    }
    setupKeyBindings() {
        // Global key bindings
        this.screen.key(['q', 'C-c'], () => {
            this.cleanup();
            process.exit(0);
        });
        // Mode switching
        this.screen.key('1', () => this.switchMode('dashboard'));
        this.screen.key('2', () => this.switchMode('command'));
        this.screen.key('3', () => this.switchMode('stream'));
        // Help
        this.screen.key(['?', 'h'], () => this.showHelp());
        // Refresh
        this.screen.key('r', () => this.refresh());
    }
    setupStatusBar() {
        const statusBar = blessed_1.default.box({
            parent: this.screen,
            bottom: 0,
            left: 0,
            right: 0,
            height: 1,
            content: this.getStatusBarContent(),
            style: {
                bg: 'blue',
                fg: 'white'
            },
            tags: true
        });
        // Update status bar every second
        setInterval(() => {
            statusBar.setContent(this.getStatusBarContent());
            this.screen.render();
        }, 1000);
    }
    getStatusBarContent() {
        const time = new Date().toLocaleTimeString();
        const user = config_1.configManager.getUserId() || 'unknown';
        const mode = this.currentMode.toUpperCase();
        return ` ThreatGuard CLI | User: ${user} | Mode: ${mode} | Time: ${time} | [1]Dashboard [2]Command [3]Stream [?]Help [Q]uit`;
    }
    switchMode(mode) {
        // Hide all components
        this.dashboard.hide();
        this.commandInterface.hide();
        this.realTimeStream.hide();
        // Show selected component
        switch (mode) {
            case 'dashboard':
                this.dashboard.show();
                this.dashboard.focus();
                break;
            case 'command':
                this.commandInterface.show();
                this.commandInterface.focus();
                break;
            case 'stream':
                this.realTimeStream.show();
                this.realTimeStream.focus();
                break;
        }
        this.currentMode = mode;
        this.screen.render();
    }
    showHelp() {
        const helpText = `
ThreatGuard CLI - Interactive Mode Help

GLOBAL SHORTCUTS:
  1            - Switch to Dashboard view
  2            - Switch to Command interface
  3            - Switch to Real-time stream
  r            - Refresh current view
  ?/h          - Show this help
  q/Ctrl+C     - Quit application

DASHBOARD VIEW:
  ↑/↓          - Navigate between widgets
  Enter        - Expand selected widget
  Tab          - Cycle through widgets
  Esc          - Return to overview

COMMAND INTERFACE:
  Type commands directly (e.g., 'threat scan 192.168.1.0/24')
  ↑/↓          - Command history
  Tab          - Auto-complete
  Ctrl+L       - Clear screen

STREAM VIEW:
  Space        - Pause/Resume stream
  c            - Clear stream
  f            - Apply filters
  s            - Save current stream

TIPS:
  • Use Tab for auto-completion
  • Commands work the same as CLI mode
  • Real-time data updates automatically
  • Dashboard widgets are interactive
    `;
        const helpBox = blessed_1.default.box({
            parent: this.screen,
            top: 'center',
            left: 'center',
            width: '80%',
            height: '80%',
            content: helpText,
            border: {
                type: 'line'
            },
            style: {
                border: {
                    fg: 'cyan'
                }
            },
            scrollable: true,
            alwaysScroll: true,
            keys: true,
            vi: true
        });
        helpBox.key(['escape', 'q'], () => {
            helpBox.destroy();
            this.screen.render();
        });
        helpBox.focus();
        this.screen.render();
    }
    async refresh() {
        try {
            switch (this.currentMode) {
                case 'dashboard':
                    await this.dashboard.refresh();
                    break;
                case 'command':
                    await this.commandInterface.refresh();
                    break;
                case 'stream':
                    await this.realTimeStream.refresh();
                    break;
            }
            this.screen.render();
        }
        catch (error) {
            logger_1.logger.error(`Refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    cleanup() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        this.dashboard.cleanup();
        this.commandInterface.cleanup();
        this.realTimeStream.cleanup();
    }
    run() {
        // Start auto-update interval
        this.updateInterval = setInterval(async () => {
            if (this.currentMode === 'dashboard') {
                await this.dashboard.updateMetrics();
            }
            else if (this.currentMode === 'stream') {
                await this.realTimeStream.updateStream();
            }
        }, 5000); // Update every 5 seconds
        this.screen.render();
        // Show welcome message
        setTimeout(() => {
            this.showWelcomeMessage();
        }, 100);
    }
    showWelcomeMessage() {
        const welcomeBox = blessed_1.default.box({
            parent: this.screen,
            top: 'center',
            left: 'center',
            width: 60,
            height: 8,
            content: `
{center}Welcome to ThreatGuard CLI Interactive Mode{/center}

Press 1 for Dashboard, 2 for Commands, 3 for Live Stream
Press ? for help, Q to quit

{center}Starting in Dashboard mode...{/center}
      `,
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
        // Auto-dismiss after 3 seconds
        setTimeout(() => {
            welcomeBox.destroy();
            this.screen.render();
        }, 3000);
        this.screen.render();
    }
}
//# sourceMappingURL=interactive.js.map