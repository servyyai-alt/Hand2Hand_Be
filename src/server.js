"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const app_1 = __importDefault(require("./app"));
const database_1 = require("./config/database");
const socket_server_1 = require("./sockets/socket.server");
const env_1 = require("./config/env");
const logger_1 = require("./utils/logger");
const PORT = Number(env_1.env.PORT) || 5000;
const start = async () => {
    await (0, database_1.connectDatabase)();
    const httpServer = http_1.default.createServer(app_1.default);
    (0, socket_server_1.initializeSocket)(httpServer);
    httpServer.listen(PORT, () => {
        logger_1.logger.info(`🚀 Server running on port ${PORT}`);
        logger_1.logger.info(`📡 API: http://localhost:${PORT}/api/${env_1.env.API_VERSION}`);
        logger_1.logger.info(`🌍 Environment: ${env_1.env.NODE_ENV}`);
    });
    // Graceful shutdown
    const shutdown = async (signal) => {
        logger_1.logger.info(`Received ${signal}. Shutting down gracefully...`);
        httpServer.close(() => {
            logger_1.logger.info('HTTP server closed');
            process.exit(0);
        });
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
};
start().catch((err) => {
    console.error('Fatal startup error:', err);
    process.exit(1);
});
