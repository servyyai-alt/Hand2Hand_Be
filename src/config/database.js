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
async function connectDatabase(retries = 3, delayMs = 2000) {
    mongoose_1.default.set('strictQuery', true);
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            await mongoose_1.default.connect(MONGODB_URI, {
                maxPoolSize: 10,
                serverSelectionTimeoutMS: 5000,
                socketTimeoutMS: 45000,
            });
            logger_1.logger.info('✅ MongoDB connected: ' + mongoose_1.default.connection.host);
            return;
        }
        catch (error) {
            logger_1.logger.error(`❌ MongoDB connection attempt ${attempt}/${retries} failed:`, error.message || error);
            if (attempt === retries) {
                logger_1.logger.error('❌ Could not connect to MongoDB after multiple attempts. Server will keep running to serve requests.');
                return;
            }
            await new Promise(r => setTimeout(r, delayMs));
        }
    }
}
mongoose_1.default.connection.on('disconnected', () => {
    logger_1.logger.warn('MongoDB disconnected. Attempting reconnect...');
});
