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
const customerProfile_model_1 = require("../../src/modules/customers/customerProfile.model");
const { generateAccessToken } = require('../../src/utils/jwt.util');

let mongoServer;

beforeAll(async () => {
    mongoServer = await mongodb_memory_server_1.MongoMemoryServer.create();
    await mongoose_1.default.connect(mongoServer.getUri());
}, 30000);

afterAll(async () => {
    await mongoose_1.default.disconnect();
    await mongoServer.stop();
});

describe('Customer Profile & Tickets Integration Tests', () => {
    let customerUser;
    let customerToken;

    beforeEach(async () => {
        const collections = mongoose_1.default.connection.collections;
        for (const key in collections) {
            await collections[key].deleteMany({});
        }

        customerUser = await user_model_1.UserModel.create({
            name: 'Ananya Sharma',
            phone: '9876543210',
            email: 'ananya@example.com',
            passwordHash: 'Password@123',
            role: 'CUSTOMER',
            status: 'ACTIVE',
        });

        await customerProfile_model_1.CustomerProfileModel.create({
            userId: customerUser._id,
            savedAddresses: [],
        });

        customerToken = generateAccessToken({
            userId: customerUser._id.toString(),
            role: 'CUSTOMER',
        });
    });

    it('GET /api/v1/users/me — returns full profile with addresses and preferences', async () => {
        const res = await (0, supertest_1.default)(app_1.default)
            .get('/api/v1/users/me')
            .set('Authorization', `Bearer ${customerToken}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.name).toBe('Ananya Sharma');
        expect(res.body.data.email).toBe('ananya@example.com');
        expect(res.body.data.savedAddresses).toBeDefined();
        expect(res.body.data.notificationPreferences).toBeDefined();
    });

    it('PATCH /api/v1/users/me — updates profile details', async () => {
        const res = await (0, supertest_1.default)(app_1.default)
            .patch('/api/v1/users/me')
            .set('Authorization', `Bearer ${customerToken}`)
            .send({ name: 'Ananya S. Iyer', avatar: 'https://avatar.url/new.png' });

        expect(res.status).toBe(200);
        expect(res.body.data.name).toBe('Ananya S. Iyer');
        expect(res.body.data.avatar).toBe('https://avatar.url/new.png');
    });

    it('PATCH /api/v1/users/me/preferences — updates preferences', async () => {
        const res = await (0, supertest_1.default)(app_1.default)
            .patch('/api/v1/users/me/preferences')
            .set('Authorization', `Bearer ${customerToken}`)
            .send({ promotions: true, deliveryAccepted: false });

        expect(res.status).toBe(200);
        expect(res.body.data.promotions).toBe(true);
        expect(res.body.data.deliveryAccepted).toBe(false);
        expect(res.body.data.deliveryCompleted).toBe(true);
    });

    it('POST /api/v1/users/me/addresses — adds address and sets default', async () => {
        const addressData = {
            label: 'Home Sweet Home',
            type: 'Home',
            addressLine: 'Flat 402, Green Glen Heights, Bellandur',
            city: 'Bengaluru',
            pincode: '560103',
            landmark: 'Opposite Central Mall',
            isDefault: true,
            coordinates: { latitude: 12.9279, longitude: 77.6749 },
        };

        const res = await (0, supertest_1.default)(app_1.default)
            .post('/api/v1/users/me/addresses')
            .set('Authorization', `Bearer ${customerToken}`)
            .send(addressData);

        expect(res.status).toBe(201);
        expect(res.body.data.label).toBe('Home Sweet Home');
        expect(res.body.data.isDefault).toBe(true);
    });

    it('POST /api/v1/tickets — raises a ticket and retrieves tickets', async () => {
        const ticketData = {
            category: 'DELIVERY_DELAY',
            subject: 'Delivery delayed by over 45 minutes',
            description: 'My delivery was scheduled for 2 PM but hasn’t arrived yet.',
            priority: 'HIGH',
            contactPreference: 'IN_APP',
        };

        const createRes = await (0, supertest_1.default)(app_1.default)
            .post('/api/v1/tickets')
            .set('Authorization', `Bearer ${customerToken}`)
            .send(ticketData);

        expect(createRes.status).toBe(201);
        expect(createRes.body.data.subject).toBe(ticketData.subject);
        expect(createRes.body.data.status).toBe('OPEN');

        const listRes = await (0, supertest_1.default)(app_1.default)
            .get('/api/v1/tickets')
            .set('Authorization', `Bearer ${customerToken}`);

        expect(listRes.status).toBe(200);
        expect(listRes.body.data.data.length).toBe(1);
        expect(listRes.body.data.data[0].subject).toBe(ticketData.subject);
    });
});
