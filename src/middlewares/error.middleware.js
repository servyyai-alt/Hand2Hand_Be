"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorMiddleware = void 0;
const zod_1 = require("zod");
const AppError_1 = require("../errors/AppError");
const logger_1 = require("../utils/logger");
const env_1 = require("../config/env");
const errorMiddleware = (err, req, res, _next) => {
    logger_1.logger.error(`${req.method} ${req.path} — ${err.message}`, {
        stack: env_1.env.NODE_ENV !== 'production' ? err.stack : undefined,
    });
    if (err instanceof AppError_1.AppError) {
        res.status(err.statusCode).json({
            success: false,
            error: {
                code: err.code,
                message: err.message,
                ...(err.details ? { details: err.details } : {}),
            },
        });
        return;
    }
    if (err instanceof zod_1.ZodError) {
        res.status(400).json({
            success: false,
            error: {
                code: 'VALIDATION_ERROR',
                message: 'Invalid input',
                details: err.errors,
            },
        });
        return;
    }
    // Unknown error — don't leak details in production
    res.status(500).json({
        success: false,
        error: {
            code: 'INTERNAL_ERROR',
            message: env_1.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
        },
    });
};
exports.errorMiddleware = errorMiddleware;
