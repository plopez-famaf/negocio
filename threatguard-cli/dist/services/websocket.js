"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.wsClient = exports.WebSocketClient = void 0;
const socket_io_client_1 = require("socket.io-client");
const config_1 = require("@/utils/config");
const logger_1 = require("@/utils/logger");
class WebSocketClient {
    constructor(options = {}) {
        this.socket = null;
        this.connected = false;
        this.eventHandlers = new Map();
        this.reconnectAttempts = 0;
        this.options = {
            autoReconnect: true,
            reconnectAttempts: 5,
            reconnectInterval: 5000,
            filters: {
                eventTypes: ['threat', 'behavior', 'network'],
                severity: ['medium', 'high', 'critical'],
                sources: []
            },
            ...options
        };
    }
    async connect() {
        try {
            const token = config_1.configManager.getToken();
            if (!token) {
                throw new Error('Authentication token required for WebSocket connection');
            }
            const apiUrl = config_1.configManager.getApiUrl();
            const wsUrl = apiUrl.replace(/^http/, 'ws').replace('/api', '');
            logger_1.logger.info('Connecting to WebSocket server...', { url: wsUrl });
            this.socket = (0, socket_io_client_1.io)(wsUrl, {
                auth: {
                    token
                },
                transports: ['websocket', 'polling'],
                timeout: 10000,
                forceNew: true
            });
            this.setupEventHandlers();
            return new Promise((resolve, reject) => {
                if (!this.socket)
                    return reject(new Error('Socket not initialized'));
                const connectionTimeout = setTimeout(() => {
                    reject(new Error('WebSocket connection timeout'));
                }, 10000);
                this.socket.on('connect', () => {
                    clearTimeout(connectionTimeout);
                    this.connected = true;
                    this.reconnectAttempts = 0;
                    logger_1.logger.success('Connected to WebSocket server', {
                        socketId: this.socket?.id,
                        transport: this.socket?.io.engine.transport.name
                    });
                    // Apply initial filters
                    this.updateFilters(this.options.filters || {});
                    resolve();
                });
                this.socket.on('connect_error', (error) => {
                    clearTimeout(connectionTimeout);
                    this.connected = false;
                    logger_1.logger.error('WebSocket connection failed', {
                        error: error.message,
                        attempts: this.reconnectAttempts
                    });
                    if (this.options.autoReconnect && this.reconnectAttempts < (this.options.reconnectAttempts || 5)) {
                        this.scheduleReconnect();
                    }
                    reject(new Error(`WebSocket connection failed: ${error.message}`));
                });
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to initiate WebSocket connection', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    setupEventHandlers() {
        if (!this.socket)
            return;
        // Connection events
        this.socket.on('disconnect', (reason) => {
            this.connected = false;
            logger_1.logger.warning('WebSocket disconnected', { reason });
            if (this.options.autoReconnect && reason !== 'client namespace disconnect') {
                this.scheduleReconnect();
            }
            this.emit('disconnect', { reason });
        });
        // Stream events
        this.socket.on('stream_event', (event) => {
            logger_1.logger.debug('Stream event received', {
                type: event.type,
                source: event.metadata.source,
                correlationId: event.metadata.correlationId
            });
            this.emit('stream_event', event);
            this.emit(`${event.type}_event`, event);
        });
        // Specific event types
        this.socket.on('threat_event', (data) => {
            this.emit('threat', data);
        });
        this.socket.on('behavior_event', (data) => {
            this.emit('behavior', data);
        });
        this.socket.on('network_event', (data) => {
            this.emit('network', data);
        });
        this.socket.on('intelligence_event', (data) => {
            this.emit('intelligence', data);
        });
        this.socket.on('system_event', (data) => {
            this.emit('system', data);
        });
        // Response events
        this.socket.on('threat_scan_result', (result) => {
            this.emit('threat_scan_result', result);
        });
        this.socket.on('threat_scan_error', (error) => {
            this.emit('threat_scan_error', error);
        });
        this.socket.on('behavior_analysis_result', (result) => {
            this.emit('behavior_analysis_result', result);
        });
        this.socket.on('behavior_analysis_error', (error) => {
            this.emit('behavior_analysis_error', error);
        });
        this.socket.on('network_monitoring_result', (result) => {
            this.emit('network_monitoring_result', result);
        });
        this.socket.on('network_monitoring_error', (error) => {
            this.emit('network_monitoring_error', error);
        });
        // Filter update confirmation
        this.socket.on('filters_updated', (filters) => {
            logger_1.logger.info('Stream filters updated', { filters });
            this.emit('filters_updated', filters);
        });
        // Heartbeat
        this.socket.on('heartbeat_response', (response) => {
            this.emit('heartbeat', response);
        });
    }
    scheduleReconnect() {
        if (this.reconnectAttempts >= (this.options.reconnectAttempts || 5)) {
            logger_1.logger.error('Max reconnection attempts reached');
            return;
        }
        this.reconnectAttempts++;
        const delay = this.options.reconnectInterval || 5000;
        logger_1.logger.info(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})...`);
        setTimeout(() => {
            this.connect().catch((error) => {
                logger_1.logger.error('Reconnection failed', { error: error.message });
            });
        }, delay);
    }
    updateFilters(filters) {
        if (!this.socket || !this.connected) {
            logger_1.logger.warning('Cannot update filters: not connected');
            return;
        }
        this.socket.emit('update_filters', filters);
        logger_1.logger.debug('Filter update requested', { filters });
    }
    // Request-response methods
    requestThreatScan(targets, options) {
        if (!this.socket || !this.connected) {
            throw new Error('Not connected to WebSocket server');
        }
        this.socket.emit('request_threat_scan', { targets, options });
        logger_1.logger.debug('Threat scan requested', { targets, options });
    }
    requestBehaviorAnalysis(target, timeRange, analysisType) {
        if (!this.socket || !this.connected) {
            throw new Error('Not connected to WebSocket server');
        }
        this.socket.emit('request_behavior_analysis', { target, timeRange, analysisType });
        logger_1.logger.debug('Behavior analysis requested', { target, timeRange, analysisType });
    }
    requestNetworkMonitoring(targets, options) {
        if (!this.socket || !this.connected) {
            throw new Error('Not connected to WebSocket server');
        }
        this.socket.emit('request_network_monitoring', { targets, options });
        logger_1.logger.debug('Network monitoring requested', { targets, options });
    }
    sendHeartbeat() {
        if (!this.socket || !this.connected)
            return;
        this.socket.emit('heartbeat');
    }
    // Event subscription methods
    on(event, callback) {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, []);
        }
        this.eventHandlers.get(event).push(callback);
    }
    off(event, callback) {
        if (!this.eventHandlers.has(event))
            return;
        if (callback) {
            const handlers = this.eventHandlers.get(event);
            const index = handlers.indexOf(callback);
            if (index !== -1) {
                handlers.splice(index, 1);
            }
        }
        else {
            this.eventHandlers.delete(event);
        }
    }
    emit(event, data) {
        const handlers = this.eventHandlers.get(event);
        if (handlers) {
            handlers.forEach(handler => {
                try {
                    handler(data);
                }
                catch (error) {
                    logger_1.logger.error('Event handler error', {
                        event,
                        error: error instanceof Error ? error.message : 'Unknown error'
                    });
                }
            });
        }
    }
    // Connection status
    isConnected() {
        return this.connected && this.socket?.connected === true;
    }
    getConnectionInfo() {
        if (!this.socket) {
            return { connected: false, error: 'Socket not initialized' };
        }
        return {
            connected: this.connected,
            socketId: this.socket.id,
            transport: this.socket.io.engine?.transport?.name,
            reconnectAttempts: this.reconnectAttempts,
            filters: this.options.filters
        };
    }
    // Cleanup
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
        this.connected = false;
        this.eventHandlers.clear();
        logger_1.logger.info('WebSocket client disconnected');
    }
    cleanup() {
        this.disconnect();
    }
}
exports.WebSocketClient = WebSocketClient;
// Singleton instance for CLI usage
exports.wsClient = new WebSocketClient();
//# sourceMappingURL=websocket.js.map