"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const logger_1 = require("@/lib/logger");
const authMiddleware = (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
        logger_1.logger.warn('Authentication failed: No token provided', {
            ip: req.ip,
            userAgent: req.get('User-Agent')
        });
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }
    try {
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            logger_1.logger.error('JWT_SECRET not configured');
            return res.status(500).json({ error: 'Server configuration error' });
        }
        const decoded = jsonwebtoken_1.default.verify(token, jwtSecret);
        req.user = decoded;
        logger_1.logger.info('User authenticated successfully', {
            userId: decoded.id,
            email: decoded.email
        });
        next();
    }
    catch (error) {
        logger_1.logger.warn('Authentication failed: Invalid token', {
            error: error instanceof Error ? error.message : 'Unknown error',
            ip: req.ip
        });
        return res.status(401).json({ error: 'Invalid token.' });
    }
};
exports.authMiddleware = authMiddleware;
//# sourceMappingURL=auth.js.map