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

describe('Customer Payments & Invoices Integration Tests', () => {
    let customerA;
    let customerAToken;
    let customerB;
    let customerBToken;
    let deliveryA1;
    let deliveryA2;

    beforeEach(async () => {
        const collections = mongoose_1.default.connection.collections;
        for (const key in collections) {
            await collections[key].deleteMany({});
        }

        customerA = await user_model_1.UserModel.create({
            name: 'Priya Sharma',
            phone: '9876543210',
            email: 'priya@example.com',
            passwordHash: 'Password@123',
            role: 'CUSTOMER',
        });
        customerAToken = generateAccessToken({ userId: customerA._id, role: customerA.role });

        customerB = await user_model_1.UserModel.create({
            name: 'Vikram Singh',
            phone: '9876543211',
            email: 'vikram@example.com',
            passwordHash: 'Password@123',
            role: 'CUSTOMER',
        });
        customerBToken = generateAccessToken({ userId: customerB._id, role: customerB.role });

        // Seed paid delivery for Customer A
        deliveryA1 = await delivery_model_1.DeliveryModel.create({
            customer: customerA._id,
            pickup: {
                address: 'Katpadi Station, Vellore',
                coordinates: { lat: 12.9698, lng: 79.1384 },
                contactName: 'Priya Sharma',
                contactPhone: '9876543210',
            },
            drop: {
                address: 'VIT Main Gate, Vellore',
                coordinates: { lat: 12.9692, lng: 79.1559 },
                contactName: 'Rohan Verma',
                contactPhone: '9876543222',
            },
            category: 'DOCUMENTS',
            description: 'Important Exam Application Forms',
            weight: 0.5,
            fare: {
                base: 40,
                perKm: 20,
                weightCharge: 0,
                discount: 0,
                total: 60,
                currency: 'INR',
            },
            distance: 2.5,
            status: 'DELIVERED',
            pickupOTP: '1111',
            deliveryOTP: '2222',
            payment: {
                method: 'UPI',
                status: 'PAID',
                transactionId: 'TXN-H2H-1001-A',
                paidAt: new Date(),
            },
        });

        // Seed pending cash delivery for Customer A
        deliveryA2 = await delivery_model_1.DeliveryModel.create({
            customer: customerA._id,
            pickup: {
                address: 'Bagayam, Vellore',
                coordinates: { lat: 12.8900, lng: 79.1300 },
                contactName: 'Priya Sharma',
                contactPhone: '9876543210',
            },
            drop: {
                address: 'CMC Hospital, Vellore',
                coordinates: { lat: 12.9246, lng: 79.1348 },
                contactName: 'Nurse Station',
                contactPhone: '9876543233',
            },
            category: 'PARCEL',
            description: 'Medical reports parcel',
            weight: 1.0,
            fare: {
                base: 40,
                perKm: 40,
                weightCharge: 5,
                discount: 0,
                total: 85,
                currency: 'INR',
            },
            distance: 4.0,
            status: 'CREATED',
            pickupOTP: '3333',
            deliveryOTP: '4444',
            payment: {
                method: 'CASH',
                status: 'PENDING',
                transactionId: 'TXN-H2H-1002-CASH',
                paidAt: new Date(),
            },
        });
    });

    test('GET /api/v1/payments/summary - returns accurate payment totals and counts', async () => {
        const res = await (0, supertest_1.default)(app_1.default)
            .get('/api/v1/payments/summary')
            .set('Authorization', `Bearer ${customerAToken}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.totalPaid).toBe(60);
        expect(res.body.data.pendingAmount).toBe(85);
        expect(res.body.data.paidCount).toBe(1);
        expect(res.body.data.pendingCount).toBe(1);
        expect(res.body.data.totalCount).toBe(2);
        expect(res.body.data.currency).toBe('INR');
    });

    test('GET /api/v1/payments/summary - returns zero values for customer without payments', async () => {
        const res = await (0, supertest_1.default)(app_1.default)
            .get('/api/v1/payments/summary')
            .set('Authorization', `Bearer ${customerBToken}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.totalPaid).toBe(0);
        expect(res.body.data.pendingAmount).toBe(0);
        expect(res.body.data.paidCount).toBe(0);
        expect(res.body.data.totalCount).toBe(0);
    });

    test('GET /api/v1/payments/my - returns customer payment history', async () => {
        const res = await (0, supertest_1.default)(app_1.default)
            .get('/api/v1/payments/my')
            .set('Authorization', `Bearer ${customerAToken}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.data).toHaveLength(2);
        expect(res.body.data.pagination.total).toBe(2);
        expect(res.body.data.summary.totalPaid).toBe(60);
    });

    test('GET /api/v1/payments/my?status=PAID - filters by payment status', async () => {
        const res = await (0, supertest_1.default)(app_1.default)
            .get('/api/v1/payments/my?status=PAID')
            .set('Authorization', `Bearer ${customerAToken}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.data).toHaveLength(1);
        expect(res.body.data.data[0].status).toBe('PAID');
        expect(res.body.data.data[0].amount).toBe(60);
    });

    test('GET /api/v1/payments/:id - returns payment details for customer owner', async () => {
        const res = await (0, supertest_1.default)(app_1.default)
            .get(`/api/v1/payments/${deliveryA1._id}`)
            .set('Authorization', `Bearer ${customerAToken}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.amount).toBe(60);
        expect(res.body.data.method).toBe('UPI');
        expect(res.body.data.transactionId).toBe('TXN-H2H-1001-A');
        expect(res.body.data.fareBreakdown.base).toBe(40);
        expect(res.body.data.fareBreakdown.perKm).toBe(20);
    });

    test('GET /api/v1/payments/:id - prohibits Customer B from accessing Customer A payment', async () => {
        const res = await (0, supertest_1.default)(app_1.default)
            .get(`/api/v1/payments/${deliveryA1._id}`)
            .set('Authorization', `Bearer ${customerBToken}`);

        expect(res.status).toBe(403);
        expect(res.body.success).toBe(false);
    });

    test('GET /api/v1/payments/:id/invoice - generates formal invoice with breakdown and company info', async () => {
        const res = await (0, supertest_1.default)(app_1.default)
            .get(`/api/v1/payments/${deliveryA1._id}/invoice`)
            .set('Authorization', `Bearer ${customerAToken}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.invoiceNumber).toBe(`INV-${deliveryA1.trackingId}`);
        expect(res.body.data.company.name).toContain('H2H');
        expect(res.body.data.fareBreakdown.total).toBe(60);
        expect(res.body.data.payment.method).toBe('UPI');
        expect(res.body.data.payment.status).toBe('PAID');
    });

    test('GET /api/v1/payments/:id/invoice - prohibits Customer B from accessing Customer A invoice', async () => {
        const res = await (0, supertest_1.default)(app_1.default)
            .get(`/api/v1/payments/${deliveryA1._id}/invoice`)
            .set('Authorization', `Bearer ${customerBToken}`);

        expect(res.status).toBe(403);
        expect(res.body.success).toBe(false);
    });
});
