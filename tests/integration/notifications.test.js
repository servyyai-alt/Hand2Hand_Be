"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const mongoose_1 = __importDefault(require("mongoose"));
const mongodb_memory_server_1 = require("mongodb-memory-server");
const app_1 = __importDefault(require("../../src/app"));
const user_model_1 = require("../../src/modules/users/user.model");
const notification_model_1 = require("../../src/modules/notifications/notification.model");
const jwt_util_1 = require("../../src/utils/jwt.util");

let mongoServer;
let customerToken;
let customerUserId;

beforeAll(async () => {
    mongoServer = await mongodb_memory_server_1.MongoMemoryServer.create();
    await mongoose_1.default.connect(mongoServer.getUri());
}, 30000);

afterAll(async () => {
    await mongoose_1.default.disconnect();
    await mongoServer.stop();
});

beforeEach(async () => {
    const collections = mongoose_1.default.connection.collections;
    for (const key in collections) {
        await collections[key].deleteMany({});
    }

    const user = await user_model_1.UserModel.create({
        name: 'Notification Test User',
        phone: '9876543299',
        passwordHash: 'hash123',
        role: 'CUSTOMER',
        status: 'ACTIVE',
        isPhoneVerified: true,
    });
    customerUserId = user._id;
    customerToken = (0, jwt_util_1.generateAccessToken)({ userId: user._id.toString(), role: 'CUSTOMER' });
});

describe('Notifications API', () => {
    it('GET /api/v1/notifications — requires authentication', async () => {
        const res = await (0, supertest_1.default)(app_1.default).get('/api/v1/notifications');
        expect(res.status).toBe(401);
    });

    it('GET /api/v1/notifications — returns notifications and unread count', async () => {
        await notification_model_1.NotificationModel.create({
            userId: customerUserId,
            type: 'DELIVERED',
            title: 'Package Delivered',
            description: 'Your delivery was successful',
            isRead: false,
        });

        const res = await (0, supertest_1.default)(app_1.default)
            .get('/api/v1/notifications')
            .set('Authorization', `Bearer ${customerToken}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.notifications.length).toBe(1);
        expect(res.body.data.unreadCount).toBe(1);
    });

    it('PATCH /api/v1/notifications/:id/read — marks notification as read', async () => {
        const notif = await notification_model_1.NotificationModel.create({
            userId: customerUserId,
            type: 'DELIVERY_ASSIGNED',
            title: 'Partner Assigned',
            description: 'A rider is on the way',
            isRead: false,
        });

        const res = await (0, supertest_1.default)(app_1.default)
            .patch(`/api/v1/notifications/${notif._id}/read`)
            .set('Authorization', `Bearer ${customerToken}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.isRead).toBe(true);
    });

    it('POST /api/v1/notifications/mark-all-read — marks all unread as read', async () => {
        await notification_model_1.NotificationModel.create([
            { userId: customerUserId, type: 'PAYMENT', title: 'Payment Confirmed', description: 'Paid 85 INR', isRead: false },
            { userId: customerUserId, type: 'SECURITY', title: 'Security Alert', description: 'Login from new device', isRead: false },
        ]);

        const res = await (0, supertest_1.default)(app_1.default)
            .post('/api/v1/notifications/mark-all-read')
            .set('Authorization', `Bearer ${customerToken}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        const checkRes = await (0, supertest_1.default)(app_1.default)
            .get('/api/v1/notifications')
            .set('Authorization', `Bearer ${customerToken}`);

        expect(checkRes.body.data.unreadCount).toBe(0);
    });
});
