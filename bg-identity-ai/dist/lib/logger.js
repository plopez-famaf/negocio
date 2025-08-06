"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.correlationLogger = exports.logger = void 0;
const winston_1 = __importDefault(require("winston"));
const uuid_1 = require("uuid");
exports.logger = winston_1.default.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json(), winston_1.default.format.printf(({ timestamp, level, message, ...meta }) => {
        return JSON.stringify({
            timestamp,
            level,
            message,
            service: 'bg-identity-ai',
            correlationId: meta.correlationId || (0, uuid_1.v4)(),
            ...meta
        });
    })),
    transports: [
        new winston_1.default.transports.Console({
            format: winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.simple())
        })
    ]
});
const correlationLogger = (correlationId) => {
    return exports.logger.child({ correlationId });
};
exports.correlationLogger = correlationLogger;
//# sourceMappingURL=logger.js.map