"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RealTimeStream = void 0;
const blessed_1 = __importDefault(require("blessed"));
const api_1 = require("@/services/api");
const logger_1 = require("@/utils/logger");
class RealTimeStream {
    constructor(screen) {
        this.isStreaming = true;
        this.streamBuffer = [];
        this.filters = {
            eventTypes: ['threat', 'behavior', 'network'],
            severity: ['low', 'medium', 'high', 'critical'],
            sources: []
        };
        this.screen = screen;
        this.createContainer();
        this.createInterface();
    }
    createContainer() {
        this.container = blessed_1.default.box({
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
    createInterface() {
        // Header
        const header = blessed_1.default.box({
            parent: this.container,
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            content: '{center}{bold}Real-time Security Event Stream{/bold}{/center}\n{center}Live monitoring of threats, behaviors, and network events{/center}',
            border: {
                type: 'line'
            },
            style: {
                border: {
                    fg: 'magenta'
                }
            },
            tags: true
        });
        // Controls panel
        this.controlsBox = blessed_1.default.box({
            parent: this.container,
            top: 3,
            left: 0,
            right: 0,
            height: 3,
            content: this.getControlsContent(),
            border: {
                type: 'line',
                bottom: true
            },
            style: {
                border: {
                    fg: 'white'
                }
            },
            tags: true
        });
        // Main stream area
        this.streamBox = blessed_1.default.box({
            parent: this.container,
            top: 6,
            left: 0,
            right: '25%',
            bottom: 0,
            content: this.getInitialStreamContent(),
            border: {
                type: 'line',
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
        // Filters panel
        this.filtersBox = blessed_1.default.box({
            parent: this.container,
            top: 6,
            left: '75%',
            right: 0,
            bottom: 0,
            content: this.getFiltersContent(),
            border: {
                type: 'line'
            },
            style: {
                border: {
                    fg: 'cyan'
                }
            },
            tags: true,
            keys: true,
            scrollable: true
        });
        this.setupKeyBindings();
    }
    getControlsContent() {
        const status = this.isStreaming ? '{green-fg}●{/green-fg} STREAMING' : '{red-fg}●{/red-fg} PAUSED';
        const eventCount = this.streamBuffer.length;
        return ` ${status} | Events: ${eventCount} | [Space] Pause/Resume | [C] Clear | [F] Filters | [S] Save`;
    }
    getInitialStreamContent() {
        return `{bold}Security Event Stream{/bold}

{dim}Waiting for events...{/dim}

Events will appear here in real-time as they occur.

{gray-fg}Event format:{/gray-fg}
{gray-fg}[HH:MM:SS] [TYPE] [SEVERITY] Message{/gray-fg}
{gray-fg}             Source: source information{/gray-fg}

`;
    }
    getFiltersContent() {
        return `{bold}Stream Filters{/bold}

{cyan-fg}Event Types:{/cyan-fg}
${this.filters.eventTypes.map(type => `  ☑ ${type.charAt(0).toUpperCase() + type.slice(1)}`).join('\n')}

{cyan-fg}Severity Levels:{/cyan-fg}
${this.filters.severity.map(sev => `  ☑ ${sev.charAt(0).toUpperCase() + sev.slice(1)}`).join('\n')}

{cyan-fg}Sources:{/cyan-fg}
${this.filters.sources.length > 0 ?
            this.filters.sources.map(src => `  ☑ ${src}`).join('\n') :
            '  {dim}All sources{/dim}'}

{dim}Press F to modify filters{/dim}
`;
    }
    setupKeyBindings() {
        // Space to pause/resume
        this.container.key('space', () => {
            this.toggleStream();
        });
        // C to clear stream
        this.container.key('c', () => {
            this.clearStream();
        });
        // F to configure filters
        this.container.key('f', () => {
            this.showFilterDialog();
        });
        // S to save stream
        this.container.key('s', () => {
            this.saveStream();
        });
    }
    toggleStream() {
        this.isStreaming = !this.isStreaming;
        this.updateControls();
        if (this.isStreaming) {
            this.addStreamEvent('system', 'info', 'Stream resumed', 'User action');
        }
        else {
            this.addStreamEvent('system', 'info', 'Stream paused', 'User action');
        }
    }
    clearStream() {
        this.streamBuffer = [];
        this.streamBox.setContent(this.getInitialStreamContent());
        this.updateControls();
        this.screen.render();
    }
    showFilterDialog() {
        const filterDialog = blessed_1.default.box({
            parent: this.screen,
            top: 'center',
            left: 'center',
            width: '60%',
            height: '70%',
            content: this.getFilterDialogContent(),
            border: {
                type: 'line'
            },
            style: {
                border: {
                    fg: 'yellow'
                }
            },
            tags: true,
            keys: true,
            scrollable: true
        });
        filterDialog.key(['escape', 'q'], () => {
            filterDialog.destroy();
            this.screen.render();
        });
        filterDialog.focus();
        this.screen.render();
    }
    getFilterDialogContent() {
        return `{center}{bold}Configure Stream Filters{/bold}{/center}

{yellow-fg}Event Types:{/yellow-fg}
  [ ] Threats        - Threat detection events
  [ ] Behavior       - Behavioral analysis events  
  [ ] Network        - Network monitoring events
  [ ] Intelligence   - Threat intelligence updates
  [ ] System         - System status events

{yellow-fg}Severity Levels:{/yellow-fg}
  [ ] Critical       - Critical severity events only
  [ ] High           - High severity and above
  [ ] Medium         - Medium severity and above
  [ ] Low            - All severity levels

{yellow-fg}Advanced Filters:{/yellow-fg}
  Source Filter: _______________
  Keyword Filter: ______________
  Time Window: [Last 1 hour   ▼]

{center}[Enter] Apply Filters  [Esc] Cancel{/center}

{dim}Note: This is a simplified filter interface.{/dim}
{dim}In production, this would have interactive checkboxes.{/dim}
`;
    }
    saveStream() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `threatguard-stream-${timestamp}.log`;
        // In a real implementation, this would save to file
        this.addStreamEvent('system', 'info', `Stream saved to ${filename}`, 'File system');
        // Mock file save
        const content = this.streamBuffer.join('\n');
        logger_1.logger.info(`Would save ${content.length} characters to ${filename}`);
    }
    updateControls() {
        this.controlsBox.setContent(this.getControlsContent());
        this.screen.render();
    }
    async initialize() {
        // Start simulated stream
        this.startMockStream();
    }
    startMockStream() {
        // Simulate real-time events
        const eventInterval = setInterval(() => {
            if (!this.isStreaming)
                return;
            const eventTypes = ['threat', 'behavior', 'network', 'intelligence'];
            const severities = ['low', 'medium', 'high', 'critical'];
            const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
            const severity = severities[Math.floor(Math.random() * severities.length)];
            let message = '';
            let source = '';
            switch (eventType) {
                case 'threat':
                    message = 'Suspicious activity detected on endpoint';
                    source = `192.168.1.${Math.floor(Math.random() * 255)}`;
                    break;
                case 'behavior':
                    message = 'Anomalous user behavior pattern identified';
                    source = `user-${Math.floor(Math.random() * 1000)}`;
                    break;
                case 'network':
                    message = 'Unusual network traffic pattern observed';
                    source = 'Network Monitor';
                    break;
                case 'intelligence':
                    message = 'New IOC added to threat intelligence feed';
                    source = 'Intel Feed';
                    break;
            }
            // Only add events that match current filters
            if (this.filters.eventTypes.includes(eventType) &&
                this.filters.severity.includes(severity)) {
                this.addStreamEvent(eventType, severity, message, source);
            }
        }, Math.random() * 5000 + 2000); // Random interval between 2-7 seconds
        // Store interval for cleanup
        this.eventInterval = eventInterval;
    }
    addStreamEvent(type, severity, message, source) {
        const timestamp = new Date().toLocaleTimeString();
        const severityColor = severity === 'critical' ? 'red' :
            severity === 'high' ? 'orange' :
                severity === 'medium' ? 'yellow' : 'white';
        const typeIcon = type === 'threat' ? '🚨' :
            type === 'behavior' ? '🧠' :
                type === 'network' ? '🌐' :
                    type === 'intelligence' ? '🔍' : '⚙️';
        const eventLine = `{gray-fg}[${timestamp}]{/gray-fg} ${typeIcon} {${severityColor}-fg}[${severity.toUpperCase()}]{/${severityColor}-fg} ${message}\n{dim}             Source: ${source}{/dim}\n`;
        // Add to buffer
        this.streamBuffer.push(eventLine);
        // Keep only last 500 events
        if (this.streamBuffer.length > 500) {
            this.streamBuffer.shift();
        }
        // Update display
        const content = this.streamBuffer.slice(-50).join('\n'); // Show last 50 events
        this.streamBox.setContent(`{bold}Security Event Stream{/bold}\n\n` + content);
        this.streamBox.setScrollPerc(100); // Auto-scroll to bottom
        this.updateControls();
        this.screen.render();
    }
    async updateStream() {
        // This would be called to refresh the stream with real data
        try {
            // In production, this would fetch latest events from API
            const latestEvents = await api_1.apiClient.getThreats({ limit: 5, since: '1m' }).catch(() => []);
            latestEvents.forEach((event) => {
                if (Math.random() > 0.7) { // Only show some events to avoid spam
                    this.addStreamEvent(event.type || 'threat', event.severity || 'medium', event.description || 'Threat detected', event.source || 'Unknown');
                }
            });
        }
        catch (error) {
            // Silently handle errors in background updates
        }
    }
    show() {
        this.container.show();
    }
    hide() {
        this.container.hide();
    }
    focus() {
        this.streamBox.focus();
    }
    async refresh() {
        await this.updateStream();
    }
    cleanup() {
        if (this.eventInterval) {
            clearInterval(this.eventInterval);
        }
    }
}
exports.RealTimeStream = RealTimeStream;
//# sourceMappingURL=realtime-stream.js.map