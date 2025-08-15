"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("module-alias/register");
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const dotenv_1 = __importDefault(require("dotenv"));
const logger_1 = require("@/lib/logger");
const error_handler_1 = require("@/middleware/error-handler");
const auth_1 = require("@/middleware/auth");
const threat_1 = require("@/routes/threat");
const health_1 = require("@/routes/health");
const websocket_stream_service_1 = require("@/services/websocket-stream-service");
dotenv_1.default.config();
const app = (0, express_1.default)();
const server = (0, http_1.createServer)(app);
const PORT = process.env.PORT || 3001;
// Security and performance middleware
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true
}));
app.use((0, compression_1.default)());
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// Logging middleware
app.use((req, _res, next) => {
    logger_1.logger.info('Request received', {
        method: req.method,
        url: req.url,
        userAgent: req.get('User-Agent'),
        ip: req.ip
    });
    next();
});
// Routes
app.use('/health', health_1.healthRoutes);
app.use('/api/threat', auth_1.authMiddleware, threat_1.threatRoutes);
// Error handling
app.use(error_handler_1.errorHandler);
// 404 handler
app.use('*', (_req, res) => {
    res.status(404).json({ error: 'Route not found' });
});
// Initialize WebSocket streaming service
const streamService = new websocket_stream_service_1.WebSocketStreamService(server);
// Start server
server.listen(PORT, () => {
    logger_1.logger.info(`BG Threat AI Service listening on port ${PORT}`, {
        service: 'bg-threat-ai',
        version: '2.0.0',
        features: [
            'real-time-detection',
            'behavioral-analysis',
            'network-monitoring',
            'threat-intelligence',
            'websocket-streaming'
        ],
        websocket: {
            enabled: true,
            transports: ['websocket', 'polling']
        }
    });
});
// Graceful shutdown
process.on('SIGTERM', () => {
    logger_1.logger.info('SIGTERM received, shutting down gracefully');
    streamService.cleanup();
    server.close(() => {
        logger_1.logger.info('Process terminated');
        process.exit(0);
    });
});
process.on('SIGINT', () => {
    logger_1.logger.info('SIGINT received, shutting down gracefully');
    streamService.cleanup();
    server.close(() => {
        logger_1.logger.info('Process terminated');
        process.exit(0);
    });
});
exports.default = app;
//# sourceMappingURL=index.js.map