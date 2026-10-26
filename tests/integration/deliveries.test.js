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
const delivery_model_1 = require("../../src/modules/deliveries/delivery.model");
const pricing_model_1 = require("../../src/modules/pricing/pricing.model");
const ticket_model_1 = require("../../src/modules/tickets/ticket.model");
const partnerProfile_model_1 = require("../../src/modules/partners/partnerProfile.model");
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

describe('Customer Deliveries & Orders Integration Tests', () => {
    let customerA;
    let customerAToken;
    let customerB;
    let customerBToken;
    let partnerUser;
    let partnerToken;

    beforeEach(async () => {
        const collections = mongoose_1.default.connection.collections;
        for (const key in collections) {
            await collections[key].deleteMany({});
        }

        // Setup pricing for fare calculation
        await pricing_model_1.PricingModel.create({
            cityId: 'VLR',
            baseFare: 40,
            baseDistanceKm: 2,
            perKmFare: 10,
            minimumFare: 40,
            weightChargePerKg: 5,
            nightSurcharge: 0.2,
            isActive: true,
        });

        customerA = await user_model_1.UserModel.create({
            name: 'Priya Sharma',
            phone: '9876543210',
            email: 'priya@example.com',
            passwordHash: 'Password@123',
            role: 'CUSTOMER',
            status: 'ACTIVE',
        });
        customerAToken = generateAccessToken({ userId: customerA._id.toString(), role: 'CUSTOMER' });

        customerB = await user_model_1.UserModel.create({
            name: 'Rahul Verma',
            phone: '9876543211',
            email: 'rahul@example.com',
            passwordHash: 'Password@123',
            role: 'CUSTOMER',
            status: 'ACTIVE',
        });
        customerBToken = generateAccessToken({ userId: customerB._id.toString(), role: 'CUSTOMER' });

        partnerUser = await user_model_1.UserModel.create({
            name: 'Suresh Kumar',
            phone: '9876543212',
            passwordHash: 'Password@123',
            role: 'DELIVERY_PARTNER',
            status: 'ACTIVE',
        });
        partnerToken = generateAccessToken({ userId: partnerUser._id.toString(), role: 'DELIVERY_PARTNER' });

        await partnerProfile_model_1.PartnerProfileModel.create({
            userId: partnerUser._id,
            vehicle: { make: 'Honda', model: 'Activa', registrationNumber: 'TN 23 AB 1234' },
            rating: 4.8,
            totalRatings: 10,
            isOnline: true,
            isAvailable: true,
            currentLocation: { type: 'Point', coordinates: [79.1590, 12.9720] },
        });
    });

    it('POST /api/v1/deliveries — creates a delivery booking for customer', async () => {
        const payload = {
            pickup: {
                address: 'VIT Main Gate, Vellore',
                coordinates: { lat: 12.9716, lng: 79.1585 },
                contactName: 'Priya',
                contactPhone: '9876543210',
            },
            drop: {
                address: 'Katpadi Railway Station, Vellore',
                coordinates: { lat: 12.9785, lng: 79.1620 },
                contactName: 'Sneha',
                contactPhone: '9876543299',
            },
            category: 'DOCUMENTS',
            description: 'Important College Certificates',
            itemPhoto: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            weight: 1,
        };

        const res = await (0, supertest_1.default)(app_1.default)
            .post('/api/v1/deliveries')
            .set('Authorization', `Bearer ${customerAToken}`)
            .send(payload);

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.trackingId).toMatch(/^HD-VLR-/);
        expect(res.body.data.status).toBe('CREATED');
        expect(res.body.data.itemPhoto).toBeDefined();
        expect(res.body.data.itemVerification?.status).toBe('PENDING');
        expect(res.body.data.payment.status).toBe('PAID');
        expect(res.body.data.fare.total).toBeGreaterThan(0);
    });

    it('POST /api/v1/deliveries — rejects booking if item photograph is missing', async () => {
        const payload = {
            pickup: { address: 'A', coordinates: { lat: 12.97, lng: 79.15 }, contactName: 'Priya', contactPhone: '9876543210' },
            drop: { address: 'B', coordinates: { lat: 12.98, lng: 79.16 }, contactName: 'Sneha', contactPhone: '9876543299' },
            category: 'DOCUMENTS',
            description: 'Certificates without photo',
            weight: 1,
        };

        const res = await (0, supertest_1.default)(app_1.default)
            .post('/api/v1/deliveries')
            .set('Authorization', `Bearer ${customerAToken}`)
            .send(payload);

        expect(res.status).toBe(400);
        expect(res.body.error.message).toContain('photograph');
    });

    it('POST /api/v1/deliveries — rejects booking if item contains prohibited keywords', async () => {
        const payload = {
            pickup: { address: 'A', coordinates: { lat: 12.97, lng: 79.15 }, contactName: 'Priya', contactPhone: '9876543210' },
            drop: { address: 'B', coordinates: { lat: 12.98, lng: 79.16 }, contactName: 'Sneha', contactPhone: '9876543299' },
            category: 'PARCEL',
            description: 'Contains dangerous explosive material',
            itemPhoto: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            weight: 1,
        };

        const res = await (0, supertest_1.default)(app_1.default)
            .post('/api/v1/deliveries')
            .set('Authorization', `Bearer ${customerAToken}`)
            .send(payload);

        expect(res.status).toBe(400);
        expect(res.body.error.message).toContain('prohibited');
    });

    it('GET /api/v1/deliveries/my — returns customer deliveries with summary counts', async () => {
        // Create 2 deliveries for customer A
        const d1 = await delivery_model_1.DeliveryModel.create({
            customer: customerA._id,
            pickup: { address: 'A', coordinates: { lat: 12.97, lng: 79.15 }, contactName: 'Priya', contactPhone: '9876543210' },
            drop: { address: 'B', coordinates: { lat: 12.98, lng: 79.16 }, contactName: 'Sneha', contactPhone: '9876543299' },
            category: 'DOCUMENTS',
            status: 'CREATED',
            fare: { total: 49 },
        });

        const d2 = await delivery_model_1.DeliveryModel.create({
            customer: customerA._id,
            pickup: { address: 'C', coordinates: { lat: 12.97, lng: 79.15 }, contactName: 'Priya', contactPhone: '9876543210' },
            drop: { address: 'D', coordinates: { lat: 12.98, lng: 79.16 }, contactName: 'Sneha', contactPhone: '9876543299' },
            category: 'FOOD',
            status: 'DELIVERED',
            fare: { total: 60 },
        });

        // 1 delivery for customer B
        await delivery_model_1.DeliveryModel.create({
            customer: customerB._id,
            pickup: { address: 'X', coordinates: { lat: 12.97, lng: 79.15 }, contactName: 'Rahul', contactPhone: '9876543211' },
            drop: { address: 'Y', coordinates: { lat: 12.98, lng: 79.16 }, contactName: 'Amit', contactPhone: '9876543288' },
            category: 'BOOKS',
            status: 'CREATED',
            fare: { total: 40 },
        });

        const res = await (0, supertest_1.default)(app_1.default)
            .get('/api/v1/deliveries/my')
            .set('Authorization', `Bearer ${customerAToken}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.data.length).toBe(2);
        expect(res.body.data.summary.activeCount).toBe(1);
        expect(res.body.data.summary.completedCount).toBe(1);
        expect(res.body.data.summary.totalCount).toBe(2);
    });

    it('GET /api/v1/deliveries/:id — secures access so customer cannot view another user\'s delivery', async () => {
        const dA = await delivery_model_1.DeliveryModel.create({
            customer: customerA._id,
            pickup: { address: 'A', coordinates: { lat: 12.97, lng: 79.15 }, contactName: 'Priya', contactPhone: '9876543210' },
            drop: { address: 'B', coordinates: { lat: 12.98, lng: 79.16 }, contactName: 'Sneha', contactPhone: '9876543299' },
            category: 'DOCUMENTS',
            status: 'CREATED',
        });

        // Customer A can view
        const resA = await (0, supertest_1.default)(app_1.default)
            .get(`/api/v1/deliveries/${dA._id}`)
            .set('Authorization', `Bearer ${customerAToken}`);
        expect(resA.status).toBe(200);

        // Customer B is rejected with 403 FORBIDDEN
        const resB = await (0, supertest_1.default)(app_1.default)
            .get(`/api/v1/deliveries/${dA._id}`)
            .set('Authorization', `Bearer ${customerBToken}`);
        expect(resB.status).toBe(403);
    });

    it('GET /api/v1/deliveries/:id/tracking — returns live tracking data and partner coordinates', async () => {
        const d = await delivery_model_1.DeliveryModel.create({
            customer: customerA._id,
            partner: partnerUser._id,
            pickup: { address: 'VIT', coordinates: { lat: 12.97, lng: 79.15 }, contactName: 'Priya', contactPhone: '9876543210' },
            drop: { address: 'Station', coordinates: { lat: 12.98, lng: 79.16 }, contactName: 'Sneha', contactPhone: '9876543299' },
            category: 'PARCEL',
            status: 'IN_TRANSIT',
            distance: 4.2,
            duration: 14,
        });

        const res = await (0, supertest_1.default)(app_1.default)
            .get(`/api/v1/deliveries/${d._id}/tracking`)
            .set('Authorization', `Bearer ${customerAToken}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.status).toBe('IN_TRANSIT');
        expect(res.body.data.partner.name).toBe('Suresh Kumar');
        expect(res.body.data.partnerLocation).toEqual({ lng: 79.1590, lat: 12.9720 });
        expect(res.body.data.stageMessage).toContain('transit');
    });

    it('POST /api/v1/deliveries/:id/cancel — cancels order and records reason', async () => {
        const d = await delivery_model_1.DeliveryModel.create({
            customer: customerA._id,
            pickup: { address: 'VIT', coordinates: { lat: 12.97, lng: 79.15 }, contactName: 'Priya', contactPhone: '9876543210' },
            drop: { address: 'Station', coordinates: { lat: 12.98, lng: 79.16 }, contactName: 'Sneha', contactPhone: '9876543299' },
            category: 'PARCEL',
            status: 'CREATED',
            payment: { method: 'UPI', status: 'PAID' },
        });

        const res = await (0, supertest_1.default)(app_1.default)
            .post(`/api/v1/deliveries/${d._id}/cancel`)
            .set('Authorization', `Bearer ${customerAToken}`)
            .send({ reason: 'Found alternate transport' });

        expect(res.status).toBe(200);
        expect(res.body.data.status).toBe('CANCELLED');
        expect(res.body.data.cancellationReason).toBe('Found alternate transport');
        expect(res.body.data.payment.status).toBe('REFUNDED');
    });

    it('POST /api/v1/deliveries/:id/rating — rates partner on completed delivery and updates average rating', async () => {
        const d = await delivery_model_1.DeliveryModel.create({
            customer: customerA._id,
            partner: partnerUser._id,
            pickup: { address: 'VIT', coordinates: { lat: 12.97, lng: 79.15 }, contactName: 'Priya', contactPhone: '9876543210' },
            drop: { address: 'Station', coordinates: { lat: 12.98, lng: 79.16 }, contactName: 'Sneha', contactPhone: '9876543299' },
            category: 'PARCEL',
            status: 'DELIVERED',
        });

        const res = await (0, supertest_1.default)(app_1.default)
            .post(`/api/v1/deliveries/${d._id}/rating`)
            .set('Authorization', `Bearer ${customerAToken}`)
            .send({ rating: 5, feedback: 'Super fast delivery and polite partner!' });

        expect(res.status).toBe(200);
        expect(res.body.data.rating.rating).toBe(5);
        expect(res.body.data.rating.feedback).toBe('Super fast delivery and polite partner!');

        // Reject duplicate rating
        const dupRes = await (0, supertest_1.default)(app_1.default)
            .post(`/api/v1/deliveries/${d._id}/rating`)
            .set('Authorization', `Bearer ${customerAToken}`)
            .send({ rating: 4 });
        expect(dupRes.status).toBe(400);

        // Verify partner profile rating updated
        const partnerProfile = await partnerProfile_model_1.PartnerProfileModel.findOne({ userId: partnerUser._id });
        expect(partnerProfile.totalRatings).toBe(11);
    });

    it('POST /api/v1/tickets — creates support ticket associated with deliveryId', async () => {
        const d = await delivery_model_1.DeliveryModel.create({
            customer: customerA._id,
            pickup: { address: 'VIT', coordinates: { lat: 12.97, lng: 79.15 }, contactName: 'Priya', contactPhone: '9876543210' },
            drop: { address: 'Station', coordinates: { lat: 12.98, lng: 79.16 }, contactName: 'Sneha', contactPhone: '9876543299' },
            category: 'PARCEL',
            status: 'DELIVERED',
        });

        const res = await (0, supertest_1.default)(app_1.default)
            .post('/api/v1/tickets')
            .set('Authorization', `Bearer ${customerAToken}`)
            .send({
                category: 'DELIVERY_DELAY',
                subject: 'Delivery arrived 20 minutes late',
                description: 'The delivery partner got delayed in traffic.',
                relatedDeliveryId: d._id.toString(),
            });

        expect(res.status).toBe(201);
        expect(res.body.data.relatedDeliveryId.toString()).toBe(d._id.toString());
        expect(res.body.data.category).toBe('DELIVERY_DELAY');
    });
});
