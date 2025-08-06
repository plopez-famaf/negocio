"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthRoutes = void 0;
const express_1 = require("express");
const logger_1 = require("@/lib/logger");
const router = (0, express_1.Router)();
exports.healthRoutes = router;
router.get('/', (req, res) => {
    const healthCheck = {
        service: 'bg-identity-ai',
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.env.npm_package_version || '1.0.0'
    };
    logger_1.logger.info('Health check requested', healthCheck);
    res.status(200).json(healthCheck);
});
router.get('/ready', (req, res) => {
    // Add readiness checks here (database, external services, etc.)
    res.status(200).json({
        service: 'bg-identity-ai',
        ready: true,
        timestamp: new Date().toISOString()
    });
});
//# sourceMappingURL=health.js.map