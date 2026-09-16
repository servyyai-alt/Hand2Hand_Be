"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const morgan_1 = __importDefault(require("morgan"));
const env_1 = require("./config/env");
const rateLimit_middleware_1 = require("./middlewares/rateLimit.middleware");
const error_middleware_1 = require("./middlewares/error.middleware");
const logger_1 = require("./utils/logger");
const auth_routes_1 = __importDefault(require("./modules/auth/auth.routes"));
const delivery_routes_1 = __importDefault(require("./modules/deliveries/delivery.routes"));
const partner_routes_1 = __importDefault(require("./modules/partners/partner.routes"));
const admin_routes_1 = __importDefault(require("./modules/admin/admin.routes"));
const homeCard_routes_1 = require("./modules/content/homeCard.routes");
const homeBanner_routes_1 = require("./modules/content/homeBanner.routes");
const path_1 = __importDefault(require("path"));
const app = (0, express_1.default)();
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: env_1.env.NODE_ENV === 'production'
        ? [env_1.env.ADMIN_WEB_URL]
        : true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
}));
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express_1.default.static(path_1.default.join(__dirname, '../uploads')));
app.use((0, morgan_1.default)(env_1.env.NODE_ENV === 'production' ? 'combined' : 'dev', {
    stream: { write: (msg) => logger_1.logger.info(msg.trim()) },
}));
app.use(`/api/${env_1.env.API_VERSION}`, rateLimit_middleware_1.apiRateLimit);
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), version: env_1.env.API_VERSION, env: env_1.env.NODE_ENV });
});
const base = `/api/${env_1.env.API_VERSION}`;
app.use(`${base}/auth`, auth_routes_1.default);
app.use(`${base}/deliveries`, delivery_routes_1.default);
app.use(`${base}/partners`, partner_routes_1.default);
app.use(`${base}/admin`, admin_routes_1.default);
app.use(`${base}/home-cards`, homeCard_routes_1.default);
app.use(`${base}/home-banners`, homeBanner_routes_1.default);
app.use((_req, res) => {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } });
});
app.use(error_middleware_1.errorMiddleware);
exports.default = app;
