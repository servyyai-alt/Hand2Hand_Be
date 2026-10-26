"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const mongoose_1 = __importDefault(require("mongoose"));
const mongodb_memory_server_1 = require("mongodb-memory-server");
const app_1 = __importDefault(require("../../src/app"));
let mongoServer;
beforeAll(async () => {
    mongoServer = await mongodb_memory_server_1.MongoMemoryServer.create();
    await mongoose_1.default.connect(mongoServer.getUri());
}, 30000);
afterAll(async () => {
    await mongoose_1.default.disconnect();
    await mongoServer.stop();
});
afterEach(async () => {
    const collections = mongoose_1.default.connection.collections;
    for (const key in collections) {
        await collections[key].deleteMany({});
    }
});
describe('Auth API', () => {
    const testUser = {
        name: 'Test Customer',
        phone: '9876543210',
        password: 'Test@1234',
        role: 'CUSTOMER',
    };
    it('POST /auth/register — registers a new customer', async () => {
        const res = await (0, supertest_1.default)(app_1.default)
            .post('/api/v1/auth/register')
            .send(testUser);
        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.userId).toBeDefined();
    });
    it('POST /auth/register — rejects duplicate phone', async () => {
        await (0, supertest_1.default)(app_1.default).post('/api/v1/auth/register').send(testUser);
        const res = await (0, supertest_1.default)(app_1.default).post('/api/v1/auth/register').send(testUser);
        expect(res.status).toBe(409);
    });
    it('POST /auth/login — rejects unverified account', async () => {
        await (0, supertest_1.default)(app_1.default).post('/api/v1/auth/register').send(testUser);
        const res = await (0, supertest_1.default)(app_1.default).post('/api/v1/auth/login').send({
            phone: testUser.phone, password: testUser.password
        });
        expect(res.status).toBe(401);
    });
    it('POST /auth/register — registers a new DELIVERY_PARTNER', async () => {
        const res = await (0, supertest_1.default)(app_1.default)
            .post('/api/v1/auth/register')
            .send({
                name: 'Partner Rider',
                phone: '9876543211',
                password: 'Partner@1234',
                role: 'DELIVERY_PARTNER',
            });
        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.userId).toBeDefined();
    });
    it('POST /auth/register — rejects invalid 9-digit mobile number', async () => {
        const res = await (0, supertest_1.default)(app_1.default)
            .post('/api/v1/auth/register')
            .send({
                name: 'Partner',
                phone: '638348565',
                password: 'Password@123',
                role: 'DELIVERY_PARTNER',
            });
        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
    it('GET /auth/me — requires authentication', async () => {
        const res = await (0, supertest_1.default)(app_1.default).get('/api/v1/auth/me');
        expect(res.status).toBe(401);
    });
});
