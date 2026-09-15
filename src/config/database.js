"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectDatabase = connectDatabase;
const mongoose_1 = __importDefault(require("mongoose"));
const env_1 = require("./env");
const logger_1 = require("../utils/logger");
const MONGODB_URI = env_1.env.NODE_ENV === 'test'
    ? (env_1.env.MONGODB_URI_TEST || env_1.env.MONGODB_URI)
    : env_1.env.MONGODB_URI;
async function connectDatabase() {
    try {
        mongoose_1.default.set('strictQuery', true);
        await mongoose_1.default.connect(MONGODB_URI, {
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });
        logger_1.logger.info('✅ MongoDB connected: ' + mongoose_1.default.connection.host);
    }
    catch (error) {
        logger_1.logger.error('❌ MongoDB connection failed:', error);
        process.exit(1);
    }
}
mongoose_1.default.connection.on('disconnected', () => {
    logger_1.logger.warn('MongoDB disconnected. Attempting reconnect...');
});
