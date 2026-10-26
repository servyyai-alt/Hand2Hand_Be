"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const zod_1 = require("zod");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const envSchema = zod_1.z.object({
    NODE_ENV: zod_1.z.enum(['development', 'staging', 'production', 'test']).default('development'),
    PORT: zod_1.z.string().default('5000'),
    API_VERSION: zod_1.z.string().default('v1'),
    MONGODB_URI: zod_1.z.string().min(1),
    MONGODB_URI_TEST: zod_1.z.string().optional(),
    JWT_ACCESS_SECRET: zod_1.z.string().min(32),
    JWT_REFRESH_SECRET: zod_1.z.string().min(32),
    JWT_ACCESS_EXPIRES_IN: zod_1.z.string().default('7d'),
    JWT_REFRESH_EXPIRES_IN: zod_1.z.string().default('30d'),
    OTP_EXPIRES_IN_MINUTES: zod_1.z.string().default('10'),
    OTP_MAX_ATTEMPTS: zod_1.z.string().default('3'),
    CLOUDINARY_CLOUD_NAME: zod_1.z.string().optional(),
    CLOUDINARY_API_KEY: zod_1.z.string().optional(),
    CLOUDINARY_API_SECRET: zod_1.z.string().optional(),
    ADMIN_WEB_URL: zod_1.z.string().default('http://localhost:3000'),
    PARTNER_SEARCH_RADIUS_KM: zod_1.z.string().default('5'),
    DELIVERY_REQUEST_TIMEOUT_SECONDS: zod_1.z.string().default('45'),
    MAX_PARTNER_SEARCH_ATTEMPTS: zod_1.z.string().default('5'),
    GOOGLE_MAPS_API_KEY: zod_1.z.string().optional(),
    REDIS_URL: zod_1.z.string().optional(),
});
const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
    console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
    process.exit(1);
}
exports.env = parsed.data;
