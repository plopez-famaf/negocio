"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const logger_1 = require("@/lib/logger");
const errorHandler = (error, req, res, next) => {
    logger_1.logger.error('Unhandled error', {
        error: error.message,
        stack: error.stack,
        url: req.url,
        method: req.method,
        ip: req.ip
    });
    // Don't leak error details in production
    const isDevelopment = process.env.NODE_ENV === 'development';
    res.status(500).json({
        error: 'Internal server error',
        ...(isDevelopment && { details: error.message, stack: error.stack })
    });
};
exports.errorHandler = errorHandler;
//# sourceMappingURL=error-handler.js.map