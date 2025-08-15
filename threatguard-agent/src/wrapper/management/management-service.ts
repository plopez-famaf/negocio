/**
 * ThreatGuard Agent - Management Service
 * HTTP API for agent control, monitoring, and remote management
 */

import { EventEmitter } from 'events';
import express from 'express';
import { createServer, Server } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { Logger } from '../../common/logger';
import { 
    AgentConfig,
    AgentOptions,
    ManagementConfig,
    AgentStatus,
    AgentMetrics,
    RemoteCommand,
    ConfigUpdateRequest
} from '../../common/types';
import { ThreatGuardAgent } from '../agent';
import { promisify } from 'util';
import { randomBytes } from 'crypto';

export class ManagementService extends EventEmitter {
    private logger: Logger;
    private options: AgentOptions;
    private config: ManagementConfig;
    private app: express.Application;
    private server: Server | null = null;
    private wsServer: WebSocketServer | null = null;
    private isRunning: boolean = false;
    private activeConnections: Set<WebSocket> = new Set();
    private agent: ThreatGuardAgent | null = null;

    constructor(options: AgentOptions) {
        super();
        this.options = options;
        this.logger = new Logger('ManagementService');
        this.app = express();
        this.setupMiddleware();
        this.setupRoutes();
    }

    /**
     * Start the management service
     */
    public async start(config: AgentConfig, agent: ThreatGuardAgent): Promise<void> {
        try {
            if (this.isRunning) {
                this.logger.warn('⚠️ Management service is already running');
                return;
            }

            this.config = config.management;
            this.agent = agent;

            this.logger.info(`🌐 Starting management service on ${this.config.interface}:${this.config.port}...`);

            // Create HTTP server
            this.server = createServer(this.app);

            // Setup WebSocket server for real-time communication
            this.wsServer = new WebSocketServer({ 
                server: this.server,
                path: '/ws'
            });

            this.setupWebSocketHandlers();

            // Start listening
            await new Promise<void>((resolve, reject) => {
                this.server!.listen(this.config.port, this.config.interface, (error?: Error) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve();
                    }
                });
            });

            this.isRunning = true;
            this.emit('service-started');

            this.logger.info(`✅ Management service started successfully`);
            this.logger.info(`📊 API available at: http://${this.config.interface}:${this.config.port}`);
            this.logger.info(`🔌 WebSocket available at: ws://${this.config.interface}:${this.config.port}/ws`);

            // Start remote management if enabled
            if (this.config.remoteManagement.enabled) {
                await this.startRemoteManagement();
            }

        } catch (error) {
            this.logger.error('❌ Failed to start management service:', error);
            this.emit('service-error', error);
            throw error;
        }
    }

    /**
     * Stop the management service
     */
    public async stop(): Promise<void> {
        try {
            if (!this.isRunning) {
                this.logger.warn('⚠️ Management service is not running');
                return;
            }

            this.logger.info('🛑 Stopping management service...');

            // Close WebSocket connections
            this.activeConnections.forEach(ws => {
                ws.close(1001, 'Server shutting down');
            });
            this.activeConnections.clear();

            // Close WebSocket server
            if (this.wsServer) {
                this.wsServer.close();
                this.wsServer = null;
            }

            // Close HTTP server
            if (this.server) {
                await promisify(this.server.close.bind(this.server))();
                this.server = null;
            }

            this.isRunning = false;
            this.emit('service-stopped');

            this.logger.info('✅ Management service stopped successfully');

        } catch (error) {
            this.logger.error('❌ Failed to stop management service:', error);
            throw error;
        }
    }

    /**
     * Get current agent status
     */
    public async getStatus(): Promise<AgentStatus> {
        if (!this.agent) {
            throw new Error('Agent reference not available');
        }

        return await this.agent.getStatus();
    }

    /**
     * Get agent metrics
     */
    public async getMetrics(): Promise<AgentMetrics> {
        if (!this.agent) {
            throw new Error('Agent reference not available');
        }

        return await this.agent.getMetrics();
    }

    /**
     * Setup Express middleware
     */
    private setupMiddleware(): void {
        // Security headers
        this.app.use((req, res, next) => {
            res.setHeader('X-Content-Type-Options', 'nosniff');
            res.setHeader('X-Frame-Options', 'DENY');
            res.setHeader('X-XSS-Protection', '1; mode=block');
            next();
        });

        // JSON parsing
        this.app.use(express.json({ limit: '1mb' }));

        // Request logging
        this.app.use((req, res, next) => {
            this.logger.debug(`📥 ${req.method} ${req.path}`, {
                ip: req.ip,
                userAgent: req.get('User-Agent')
            });
            next();
        });

        // Authentication middleware
        this.app.use((req, res, next) => {
            // Skip auth for health check
            if (req.path === '/health') {
                return next();
            }

            const apiKey = req.headers['x-api-key'] || req.query.api_key;
            if (!apiKey || apiKey !== this.config?.apiKey) {
                return res.status(401).json({
                    success: false,
                    error: 'Invalid or missing API key'
                });
            }

            next();
        });
    }

    /**
     * Setup Express routes
     */
    private setupRoutes(): void {
        // Health check (no auth required)
        this.app.get('/health', (req, res) => {
            res.json({
                success: true,
                status: 'healthy',
                timestamp: new Date().toISOString(),
                version: '2.0.1'
            });
        });

        // Agent status
        this.app.get('/status', async (req, res) => {
            try {
                const status = await this.getStatus();
                res.json({
                    success: true,
                    data: status
                });
            } catch (error) {
                this.logger.error('Failed to get status:', error);
                res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        });

        // Agent metrics
        this.app.get('/metrics', async (req, res) => {
            try {
                const metrics = await this.getMetrics();
                res.json({
                    success: true,
                    data: metrics
                });
            } catch (error) {
                this.logger.error('Failed to get metrics:', error);
                res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        });

        // Configuration reload
        this.app.post('/config/reload', async (req, res) => {
            try {
                if (!this.agent) {
                    throw new Error('Agent reference not available');
                }

                await this.agent.reloadConfiguration();
                res.json({
                    success: true,
                    message: 'Configuration reloaded successfully'
                });
            } catch (error) {
                this.logger.error('Failed to reload configuration:', error);
                res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        });

        // Configuration update
        this.app.put('/config', async (req, res) => {
            try {
                const updateRequest: ConfigUpdateRequest = req.body;
                
                if (!this.agent) {
                    throw new Error('Agent reference not available');
                }

                await this.agent.updateConfiguration(updateRequest);
                res.json({
                    success: true,
                    message: 'Configuration updated successfully'
                });
            } catch (error) {
                this.logger.error('Failed to update configuration:', error);
                res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        });

        // Log tail endpoint
        this.app.get('/logs/tail', (req, res) => {
            const lines = parseInt(req.query.lines as string) || 100;
            
            // This would implement log tailing functionality
            // For now, return a placeholder
            res.json({
                success: true,
                data: {
                    lines: [],
                    message: 'Log tailing not yet implemented'
                }
            });
        });

        // Agent control endpoints
        this.app.post('/control/start', async (req, res) => {
            try {
                if (!this.agent) {
                    throw new Error('Agent reference not available');
                }

                await this.agent.start();
                res.json({
                    success: true,
                    message: 'Agent started successfully'
                });
            } catch (error) {
                this.logger.error('Failed to start agent:', error);
                res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        });

        this.app.post('/control/stop', async (req, res) => {
            try {
                if (!this.agent) {
                    throw new Error('Agent reference not available');
                }

                await this.agent.stop();
                res.json({
                    success: true,
                    message: 'Agent stopped successfully'
                });
            } catch (error) {
                this.logger.error('Failed to stop agent:', error);
                res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        });

        // 404 handler
        this.app.use((req, res) => {
            res.status(404).json({
                success: false,
                error: 'Endpoint not found'
            });
        });

        // Error handler
        this.app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
            this.logger.error('API error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        });
    }

    /**
     * Setup WebSocket handlers
     */
    private setupWebSocketHandlers(): void {
        if (!this.wsServer) return;

        this.wsServer.on('connection', (ws: WebSocket, req) => {
            const clientId = randomBytes(8).toString('hex');
            this.logger.info(`🔌 WebSocket client connected: ${clientId}`);
            
            this.activeConnections.add(ws);

            // Send welcome message
            ws.send(JSON.stringify({
                type: 'welcome',
                clientId,
                timestamp: new Date().toISOString()
            }));

            // Handle messages
            ws.on('message', async (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    await this.handleWebSocketMessage(ws, message);
                } catch (error) {
                    this.logger.error('WebSocket message error:', error);
                    ws.send(JSON.stringify({
                        type: 'error',
                        error: 'Invalid message format'
                    }));
                }
            });

            // Handle close
            ws.on('close', () => {
                this.logger.info(`🔌 WebSocket client disconnected: ${clientId}`);
                this.activeConnections.delete(ws);
            });

            // Handle errors
            ws.on('error', (error) => {
                this.logger.error(`WebSocket error for client ${clientId}:`, error);
                this.activeConnections.delete(ws);
            });
        });

        // Periodic status broadcasts
        setInterval(() => {
            this.broadcastStatus();
        }, 30000); // Every 30 seconds
    }

    /**
     * Handle WebSocket messages
     */
    private async handleWebSocketMessage(ws: WebSocket, message: any): Promise<void> {
        const { type, data } = message;

        switch (type) {
            case 'ping':
                ws.send(JSON.stringify({
                    type: 'pong',
                    timestamp: new Date().toISOString()
                }));
                break;

            case 'subscribe':
                // Handle subscription to specific events
                ws.send(JSON.stringify({
                    type: 'subscribed',
                    events: data.events || ['status', 'metrics']
                }));
                break;

            case 'command':
                // Handle remote commands
                try {
                    const result = await this.executeRemoteCommand(data);
                    ws.send(JSON.stringify({
                        type: 'command_result',
                        success: true,
                        data: result
                    }));
                } catch (error) {
                    ws.send(JSON.stringify({
                        type: 'command_result',
                        success: false,
                        error: error instanceof Error ? error.message : 'Unknown error'
                    }));
                }
                break;

            default:
                ws.send(JSON.stringify({
                    type: 'error',
                    error: `Unknown message type: ${type}`
                }));
        }
    }

    /**
     * Execute remote command
     */
    private async executeRemoteCommand(command: RemoteCommand): Promise<any> {
        if (!this.agent) {
            throw new Error('Agent reference not available');
        }

        switch (command.action) {
            case 'get_status':
                return await this.agent.getStatus();

            case 'get_metrics':
                return await this.agent.getMetrics();

            case 'reload_config':
                await this.agent.reloadConfiguration();
                return { message: 'Configuration reloaded' };

            case 'update_config':
                await this.agent.updateConfiguration(command.payload);
                return { message: 'Configuration updated' };

            default:
                throw new Error(`Unknown command: ${command.action}`);
        }
    }

    /**
     * Broadcast status to all connected WebSocket clients
     */
    private async broadcastStatus(): Promise<void> {
        if (this.activeConnections.size === 0 || !this.agent) {
            return;
        }

        try {
            const status = await this.agent.getStatus();
            const message = JSON.stringify({
                type: 'status_update',
                data: status,
                timestamp: new Date().toISOString()
            });

            this.activeConnections.forEach(ws => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(message);
                }
            });
        } catch (error) {
            this.logger.error('Failed to broadcast status:', error);
        }
    }

    /**
     * Start remote management connection
     */
    private async startRemoteManagement(): Promise<void> {
        try {
            this.logger.info('🌐 Starting remote management connection...');
            
            // This would implement connection to remote management server
            // For now, just log that it's configured
            this.logger.info(`📡 Remote management configured: ${this.config.remoteManagement.serverUrl}`);
            
        } catch (error) {
            this.logger.error('❌ Failed to start remote management:', error);
        }
    }
}