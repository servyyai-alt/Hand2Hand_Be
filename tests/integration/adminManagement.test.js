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
const jwt_util_1 = require("../../src/utils/jwt.util");

jest.setTimeout(30000);

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

describe('Super Admin Admin Management & Approval Flow', () => {
    let superAdminToken;
    let superAdminUser;
    let regularAdminToken;
    let regularAdminUser;

    beforeEach(async () => {
        // Create Super Admin
        superAdminUser = await user_model_1.UserModel.create({
            name: 'Root Super Admin',
            phone: '9000000000',
            email: 'superadmin@h2h.in',
            passwordHash: 'Super@1234',
            role: 'SUPER_ADMIN',
            status: 'ACTIVE',
            approvalStatus: 'APPROVED',
            isPhoneVerified: true,
            isEmailVerified: true,
        });
        superAdminToken = (0, jwt_util_1.generateAccessToken)({ userId: superAdminUser._id.toString(), role: 'SUPER_ADMIN' });

        // Create an existing active Admin
        regularAdminUser = await user_model_1.UserModel.create({
            name: 'Standard Admin',
            phone: '9000000001',
            email: 'admin@h2h.in',
            passwordHash: 'Admin@1234',
            role: 'ADMIN',
            designation: 'Operations Specialist',
            permissions: ['customers', 'deliveries'],
            status: 'ACTIVE',
            approvalStatus: 'APPROVED',
            isPhoneVerified: true,
            isEmailVerified: true,
        });
        regularAdminToken = (0, jwt_util_1.generateAccessToken)({ userId: regularAdminUser._id.toString(), role: 'ADMIN' });
    });

    it('1. Super Admin can create a new admin who is immediately active and approved', async () => {
        const res = await (0, supertest_1.default)(app_1.default)
            .post('/api/v1/admin/admins')
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({
                name: 'New Officer',
                email: 'officer@h2h.in',
                phone: '9888877777',
                designation: 'Dispatch Lead',
                permissions: ['deliveries', 'partners'],
                authMethod: 'PASSWORD',
                password: 'Officer@1234',
            });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.admin).toBeDefined();
        expect(res.body.data.admin.role).toBe('ADMIN');
        expect(res.body.data.admin.approvalStatus).toBe('APPROVED');
        expect(res.body.data.admin.status).toBe('ACTIVE');
        expect(res.body.data.admin.passwordHash).toBeUndefined(); // Sensitive fields excluded
        expect(res.body.data.emailStatus).toBeDefined();
        expect(typeof res.body.data.emailStatus.sent).toBe('boolean');
        expect(res.body.data.emailStatus.invitationLink).toBeDefined();
    });

    it('2. Rejects duplicate phone or email on admin creation', async () => {
        await (0, supertest_1.default)(app_1.default)
            .post('/api/v1/admin/admins')
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({
                name: 'Officer One',
                email: 'officer1@h2h.in',
                phone: '9888877777',
                designation: 'Dispatch',
                authMethod: 'INVITATION',
            });

        const duplicateRes = await (0, supertest_1.default)(app_1.default)
            .post('/api/v1/admin/admins')
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({
                name: 'Officer Two',
                email: 'officer1@h2h.in',
                phone: '9888877777',
                designation: 'Dispatch',
                authMethod: 'INVITATION',
            });

        expect(duplicateRes.status).toBe(409);
    });

    it('3. Non-Super Admin cannot access admin management or approval APIs', async () => {
        const res = await (0, supertest_1.default)(app_1.default)
            .get('/api/v1/admin/admins')
            .set('Authorization', `Bearer ${regularAdminToken}`);

        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('4. Newly created admin can immediately log in and access protected pages', async () => {
        const createRes = await (0, supertest_1.default)(app_1.default)
            .post('/api/v1/admin/admins')
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({
                name: 'Direct Admin',
                email: 'direct@h2h.in',
                phone: '9111122222',
                designation: 'Support',
                authMethod: 'PASSWORD',
                password: 'Direct@1234',
            });

        expect(createRes.status).toBe(201);
        expect(createRes.body.data.admin.approvalStatus).toBe('APPROVED');
        expect(createRes.body.data.admin.status).toBe('ACTIVE');

        // Attempt login immediately
        const loginRes = await (0, supertest_1.default)(app_1.default)
            .post('/api/v1/auth/login')
            .send({
                phone: '9111122222',
                password: 'Direct@1234',
            });

        expect(loginRes.status).toBe(200);
        expect(loginRes.body.data.accessToken).toBeDefined();

        // Access protected dashboard immediately
        const routeRes = await (0, supertest_1.default)(app_1.default)
            .get('/api/v1/admin/dashboard')
            .set('Authorization', `Bearer ${loginRes.body.data.accessToken}`);

        expect(routeRes.status).toBe(200);
    });

    it('5. Super Admin can approve pending admin, enabling login and access', async () => {
        const createRes = await (0, supertest_1.default)(app_1.default)
            .post('/api/v1/admin/admins')
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({
                name: 'To Approve Admin',
                email: 'toapprove@h2h.in',
                phone: '9333344444',
                designation: 'Customer Care',
                authMethod: 'PASSWORD',
                password: 'Approve@1234',
            });

        const adminId = createRes.body.data.admin._id;

        // Super Admin approves
        const approveRes = await (0, supertest_1.default)(app_1.default)
            .post(`/api/v1/admin/admins/${adminId}/approve`)
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send();

        expect(approveRes.status).toBe(200);
        expect(approveRes.body.data.admin.approvalStatus).toBe('APPROVED');
        expect(approveRes.body.data.admin.status).toBe('ACTIVE');

        // Now admin can log in
        const loginRes = await (0, supertest_1.default)(app_1.default)
            .post('/api/v1/auth/login')
            .send({
                phone: '9333344444',
                password: 'Approve@1234',
            });

        expect(loginRes.status).toBe(200);
        expect(loginRes.body.data.accessToken).toBeDefined();

        // And can access protected dashboard
        const dashRes = await (0, supertest_1.default)(app_1.default)
            .get('/api/v1/admin/dashboard')
            .set('Authorization', `Bearer ${loginRes.body.data.accessToken}`);

        expect(dashRes.status).toBe(200);
    });

    it('6. Deactivated admin cannot log in or access protected pages', async () => {
        const createRes = await (0, supertest_1.default)(app_1.default)
            .post('/api/v1/admin/admins')
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({
                name: 'Deactivated Officer',
                email: 'deactivated@h2h.in',
                phone: '9555566666',
                designation: 'Inventory',
                authMethod: 'PASSWORD',
                password: 'Deactivated@1234',
            });

        const adminId = createRes.body.data.admin._id;

        // Deactivate the admin
        const deactRes = await (0, supertest_1.default)(app_1.default)
            .patch(`/api/v1/admin/admins/${adminId}/status`)
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({ status: 'INACTIVE' });

        expect(deactRes.status).toBe(200);
        expect(deactRes.body.data.status).toBe('INACTIVE');

        // Cannot log in while inactive
        const loginRes = await (0, supertest_1.default)(app_1.default)
            .post('/api/v1/auth/login')
            .send({
                phone: '9555566666',
                password: 'Deactivated@1234',
            });

        expect(loginRes.status).toBe(401);
        expect(loginRes.body.error.message).toMatch(/inactive/i);
    });

    it('7. Super Admin can deactivate and reactivate an approved admin', async () => {
        // Deactivate standard admin
        const deactRes = await (0, supertest_1.default)(app_1.default)
            .patch(`/api/v1/admin/admins/${regularAdminUser._id}/status`)
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({ status: 'INACTIVE' });

        expect(deactRes.status).toBe(200);
        expect(deactRes.body.data.status).toBe('INACTIVE');

        // Deactivated admin cannot access endpoints
        const routeRes = await (0, supertest_1.default)(app_1.default)
            .get('/api/v1/admin/dashboard')
            .set('Authorization', `Bearer ${regularAdminToken}`);

        expect(routeRes.status).toBe(401);
        expect(routeRes.body.error.message).toMatch(/inactive/i);

        // Reactivate
        const reactRes = await (0, supertest_1.default)(app_1.default)
            .patch(`/api/v1/admin/admins/${regularAdminUser._id}/status`)
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({ status: 'ACTIVE' });

        expect(reactRes.status).toBe(200);
        expect(reactRes.body.data.status).toBe('ACTIVE');
    });

    it('8. Super Admin can reject an admin application with a reason', async () => {
        const createRes = await (0, supertest_1.default)(app_1.default)
            .post('/api/v1/admin/admins')
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({
                name: 'To Reject',
                email: 'toreject@h2h.in',
                phone: '9777788888',
                designation: 'Security',
                authMethod: 'PASSWORD',
                password: 'Reject@1234',
            });

        const adminId = createRes.body.data.admin._id;

        const rejectRes = await (0, supertest_1.default)(app_1.default)
            .post(`/api/v1/admin/admins/${adminId}/reject`)
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({ reason: 'Failed background verification check' });

        expect(rejectRes.status).toBe(200);
        expect(rejectRes.body.data.admin.approvalStatus).toBe('REJECTED');
        expect(rejectRes.body.data.admin.rejectionReason).toBe('Failed background verification check');

        // Reject account cannot login
        const loginRes = await (0, supertest_1.default)(app_1.default)
            .post('/api/v1/auth/login')
            .send({ phone: '9777788888', password: 'Reject@1234' });

        expect(loginRes.status).toBe(401);
        expect(loginRes.body.error.message).toMatch(/rejected/i);
    });

    it('9. Invitation acceptance flow allows invited admin to set password securely', async () => {
        const createRes = await (0, supertest_1.default)(app_1.default)
            .post('/api/v1/admin/admins')
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({
                name: 'Invited Admin',
                email: 'invited@h2h.in',
                phone: '9999900000',
                designation: 'Finance Admin',
                authMethod: 'INVITATION',
            });

        expect(createRes.status).toBe(201);
        const invitationLink = createRes.body.data.emailStatus.invitationLink;
        const token = new URL(invitationLink).searchParams.get('token');
        expect(token).toBeDefined();

        // Verify token
        const verifyRes = await (0, supertest_1.default)(app_1.default)
            .get(`/api/v1/auth/verify-invitation?token=${token}`);
        expect(verifyRes.status).toBe(200);
        expect(verifyRes.body.data.valid).toBe(true);

        // Accept invitation & set password
        const acceptRes = await (0, supertest_1.default)(app_1.default)
            .post('/api/v1/auth/accept-invitation')
            .send({
                token,
                password: 'NewSecurePassword@123',
            });
        expect(acceptRes.status).toBe(200);
        expect(acceptRes.body.success).toBe(true);
    });
});
