"use strict";
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../../src/app').default;
const { UserModel } = require('../../src/modules/users/user.model');
const { DeliveryModel } = require('../../src/modules/deliveries/delivery.model');
const { PartnerProfileModel } = require('../../src/modules/partners/partnerProfile.model');
const { generateAccessToken } = require('../../src/utils/jwt.util');

let mongoServer;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
}, 30000);

afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

describe('Delivery Partner Flow Integration Tests', () => {
    let customerUser, customerToken;
    let partnerUser, partnerToken;
    let otherPartnerUser, otherPartnerToken;

    beforeEach(async () => {
        const collections = mongoose.connection.collections;
        for (const key in collections) {
            await collections[key].deleteMany({});
        }

        customerUser = await UserModel.create({
            name: 'Customer One',
            phone: '9876543210',
            passwordHash: 'hash',
            role: 'CUSTOMER',
            status: 'ACTIVE',
            isPhoneVerified: true,
        });
        customerToken = generateAccessToken({ userId: customerUser._id, role: 'CUSTOMER' });

        partnerUser = await UserModel.create({
            name: 'Rider Ramesh',
            phone: '9876543211',
            passwordHash: 'hash',
            role: 'DELIVERY_PARTNER',
            status: 'ACTIVE',
            isPhoneVerified: true,
        });
        partnerToken = generateAccessToken({ userId: partnerUser._id, role: 'DELIVERY_PARTNER' });

        otherPartnerUser = await UserModel.create({
            name: 'Rider Suresh',
            phone: '9876543212',
            passwordHash: 'hash',
            role: 'DELIVERY_PARTNER',
            status: 'ACTIVE',
            isPhoneVerified: true,
        });
        otherPartnerToken = generateAccessToken({ userId: otherPartnerUser._id, role: 'DELIVERY_PARTNER' });

        await PartnerProfileModel.create({
            userId: partnerUser._id,
            isOnline: true,
            isAvailable: true,
            kycStatus: 'APPROVED',
            totalEarnings: 0,
            walletBalance: 0,
            vehicle: { type: 'SCOOTER', make: 'Honda', model: 'Activa', registrationNumber: 'TN-01-AB-1234' }
        });
    });

    it('1. Rejects non-partner access to partner routes', async () => {
        const res = await request(app)
            .get('/api/v1/partners/profile')
            .set('Authorization', `Bearer ${customerToken}`);
        expect(res.status).toBe(403);
    });

    it('2. Partner can view profile and toggle availability', async () => {
        const resProfile = await request(app)
            .get('/api/v1/partners/profile')
            .set('Authorization', `Bearer ${partnerToken}`);
        expect(resProfile.status).toBe(200);
        expect(resProfile.body.data.vehicle.model).toBe('Activa');

        const resOffline = await request(app)
            .post('/api/v1/partners/availability')
            .set('Authorization', `Bearer ${partnerToken}`)
            .send({ isOnline: false });
        expect(resOffline.status).toBe(200);
        expect(resOffline.body.data.isOnline).toBe(false);
    });

    it('3. Complete Delivery Partner lifecycle: available -> accept -> pickup OTP -> transit -> delivery OTP -> earnings', async () => {
        const delivery = await DeliveryModel.create({
            customer: customerUser._id,
            pickup: { address: 'Katpadi Station, Vellore', coordinates: { lat: 12.97, lng: 79.13 }, contactName: 'Sender', contactPhone: '9876543210' },
            drop: { address: 'VIT University, Vellore', coordinates: { lat: 12.96, lng: 79.15 }, contactName: 'Recipient', contactPhone: '9876543299' },
            status: 'CREATED',
            category: 'DOCUMENTS',
            description: 'Exam papers',
            itemPhoto: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            itemVerification: {
                originalImage: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
                status: 'PENDING',
            },
            fare: { total: 80 },
            distance: 4.5,
            duration: 15,
            pickupOTP: '1234',
            deliveryOTP: '5678',
        });

        // 3a. Partner views available requests
        const resAvail = await request(app)
            .get('/api/v1/partners/deliveries/available')
            .set('Authorization', `Bearer ${partnerToken}`);
        expect(resAvail.status).toBe(200);
        expect(resAvail.body.data.length).toBe(1);
        expect(resAvail.body.data[0].deliveryId.toString()).toBe(delivery._id.toString());
        expect(resAvail.body.data[0].itemPhoto).toBeDefined();

        // 3b. Partner accepts delivery
        const resAccept = await request(app)
            .post(`/api/v1/partners/deliveries/${delivery._id}/accept`)
            .set('Authorization', `Bearer ${partnerToken}`);
        expect(resAccept.status).toBe(200);
        expect(resAccept.body.data.status).toBe('PARTNER_ASSIGNED');

        // 3c. Another partner cannot accept the same delivery
        const resAcceptOther = await request(app)
            .post(`/api/v1/partners/deliveries/${delivery._id}/accept`)
            .set('Authorization', `Bearer ${otherPartnerToken}`);
        expect(resAcceptOther.status).toBe(400);

        // 3d. Partner active delivery endpoint returns current order
        const resActive = await request(app)
            .get('/api/v1/partners/deliveries/active')
            .set('Authorization', `Bearer ${partnerToken}`);
        expect(resActive.status).toBe(200);
        expect(resActive.body.data._id.toString()).toBe(delivery._id.toString());

        // 3e. Partner marks arrival at pickup
        const resArrived = await request(app)
            .post(`/api/v1/partners/deliveries/${delivery._id}/arrived-pickup`)
            .set('Authorization', `Bearer ${partnerToken}`);
        expect(resArrived.status).toBe(200);
        expect(resArrived.body.data.status).toBe('ARRIVED_AT_PICKUP');

        // 3f. Attempting pickup OTP verification before item verification is rejected
        const resOtpBeforeVerify = await request(app)
            .post(`/api/v1/partners/deliveries/${delivery._id}/verify-pickup-otp`)
            .set('Authorization', `Bearer ${partnerToken}`)
            .send({ otp: '1234' });
        expect(resOtpBeforeVerify.status).toBe(400);
        expect(resOtpBeforeVerify.body.error.code).toBe('ITEM_VERIFICATION_REQUIRED');

        // 3g. Partner captures pickup photo and verifies item match
        const resVerifyItem = await request(app)
            .post(`/api/v1/partners/deliveries/${delivery._id}/verify-item`)
            .set('Authorization', `Bearer ${partnerToken}`)
            .send({
                pickupImage: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
                notes: 'Exam papers verified and intact',
            });
        expect(resVerifyItem.status).toBe(200);
        expect(resVerifyItem.body.data.itemVerification.status).toBe('VERIFIED');

        // 3h. Wrong pickup OTP rejected
        const resWrongPickupOtp = await request(app)
            .post(`/api/v1/partners/deliveries/${delivery._id}/verify-pickup-otp`)
            .set('Authorization', `Bearer ${partnerToken}`)
            .send({ otp: '9999' });
        expect(resWrongPickupOtp.status).toBe(400);

        // 3i. Correct pickup OTP transitions to PICKED_UP
        const resCorrectPickupOtp = await request(app)
            .post(`/api/v1/partners/deliveries/${delivery._id}/verify-pickup-otp`)
            .set('Authorization', `Bearer ${partnerToken}`)
            .send({ otp: '1234' });
        expect(resCorrectPickupOtp.status).toBe(200);
        expect(resCorrectPickupOtp.body.data.status).toBe('PICKED_UP');

        // 3j. Partner starts transit
        const resTransit = await request(app)
            .post(`/api/v1/partners/deliveries/${delivery._id}/in-transit`)
            .set('Authorization', `Bearer ${partnerToken}`);
        expect(resTransit.status).toBe(200);
        expect(resTransit.body.data.status).toBe('IN_TRANSIT');

        // 3i. Wrong delivery OTP rejected
        const resWrongDeliveryOtp = await request(app)
            .post(`/api/v1/partners/deliveries/${delivery._id}/verify-delivery-otp`)
            .set('Authorization', `Bearer ${partnerToken}`)
            .send({ otp: '0000' });
        expect(resWrongDeliveryOtp.status).toBe(400);

        // 3j. Correct delivery OTP transitions to DELIVERED and credits earnings
        const resCorrectDeliveryOtp = await request(app)
            .post(`/api/v1/partners/deliveries/${delivery._id}/verify-delivery-otp`)
            .set('Authorization', `Bearer ${partnerToken}`)
            .send({ otp: '5678' });
        expect(resCorrectDeliveryOtp.status).toBe(200);
        expect(resCorrectDeliveryOtp.body.data.status).toBe('DELIVERED');

        // 3k. Check partner earnings updated
        const resEarnings = await request(app)
            .get('/api/v1/partners/earnings')
            .set('Authorization', `Bearer ${partnerToken}`);
        expect(resEarnings.status).toBe(200);
        expect(resEarnings.body.data.totalEarnings).toBe(80);
        expect(resEarnings.body.data.walletBalance).toBe(80);
        expect(resEarnings.body.data.todayEarnings).toBe(80);
        expect(resEarnings.body.data.todayDeliveries).toBe(1);

        // 3l. Check delivery appears in partner deliveries history
        const resHistory = await request(app)
            .get('/api/v1/partners/deliveries?status=COMPLETED')
            .set('Authorization', `Bearer ${partnerToken}`);
        expect(resHistory.status).toBe(200);
        expect(resHistory.body.data.data.length).toBe(1);
        expect(resHistory.body.data.data[0].status).toBe('DELIVERED');

        // 3m. Other partner sees NO earnings and NO history
        const resOtherEarnings = await request(app)
            .get('/api/v1/partners/earnings')
            .set('Authorization', `Bearer ${otherPartnerToken}`);
        expect(resOtherEarnings.body.data.totalEarnings).toBe(0);

        const resOtherHistory = await request(app)
            .get('/api/v1/partners/deliveries')
            .set('Authorization', `Bearer ${otherPartnerToken}`);
        expect(resOtherHistory.body.data.data.length).toBe(0);
    });
});
