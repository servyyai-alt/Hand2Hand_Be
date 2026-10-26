"use strict";
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../../src/app').default;
const { UserModel } = require('../../src/modules/users/user.model');
const { DeliveryModel } = require('../../src/modules/deliveries/delivery.model');
const { PartnerProfileModel } = require('../../src/modules/partners/partnerProfile.model');
const { PricingModel } = require('../../src/modules/pricing/pricing.model');
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

describe('Product Image Verification & Live Delivery Tracking Tests', () => {
    let customerA, customerAToken;
    let customerB, customerBToken;
    let partnerA, partnerAToken;
    let partnerB, partnerBToken;
    let adminUser, adminToken;

    const dummyBase64Image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    beforeEach(async () => {
        const collections = mongoose.connection.collections;
        for (const key in collections) {
            await collections[key].deleteMany({});
        }

        await PricingModel.create({
            cityId: 'VLR',
            baseFare: 40,
            baseDistanceKm: 2,
            perKmFare: 10,
            minimumFare: 40,
            weightChargePerKg: 5,
            nightSurcharge: 0.2,
            isActive: true,
        });

        customerA = await UserModel.create({
            name: 'Customer Alice',
            phone: '9876543210',
            passwordHash: 'hash',
            role: 'CUSTOMER',
            status: 'ACTIVE',
        });
        customerAToken = generateAccessToken({ userId: customerA._id.toString(), role: 'CUSTOMER' });

        customerB = await UserModel.create({
            name: 'Customer Bob',
            phone: '9876543211',
            passwordHash: 'hash',
            role: 'CUSTOMER',
            status: 'ACTIVE',
        });
        customerBToken = generateAccessToken({ userId: customerB._id.toString(), role: 'CUSTOMER' });

        partnerA = await UserModel.create({
            name: 'Partner Ravi',
            phone: '9876543220',
            passwordHash: 'hash',
            role: 'DELIVERY_PARTNER',
            status: 'ACTIVE',
        });
        partnerAToken = generateAccessToken({ userId: partnerA._id.toString(), role: 'DELIVERY_PARTNER' });

        partnerB = await UserModel.create({
            name: 'Partner Somu',
            phone: '9876543221',
            passwordHash: 'hash',
            role: 'DELIVERY_PARTNER',
            status: 'ACTIVE',
        });
        partnerBToken = generateAccessToken({ userId: partnerB._id.toString(), role: 'DELIVERY_PARTNER' });

        adminUser = await UserModel.create({
            name: 'Admin Officer',
            phone: '9876543299',
            passwordHash: 'hash',
            role: 'ADMIN',
            status: 'ACTIVE',
        });
        adminToken = generateAccessToken({ userId: adminUser._id.toString(), role: 'ADMIN' });

        await PartnerProfileModel.create({
            userId: partnerA._id,
            isOnline: true,
            isAvailable: true,
            kycStatus: 'APPROVED',
            currentLocation: { type: 'Point', coordinates: [79.15, 12.97] },
        });

        await PartnerProfileModel.create({
            userId: partnerB._id,
            isOnline: true,
            isAvailable: true,
            kycStatus: 'APPROVED',
            currentLocation: { type: 'Point', coordinates: [79.16, 12.98] },
        });
    });

    describe('Feature 1: Product Image Verification', () => {
        it('1. Booking fails if product photograph is missing', async () => {
            const res = await request(app)
                .post('/api/v1/deliveries')
                .set('Authorization', `Bearer ${customerAToken}`)
                .send({
                    pickup: { address: 'Origin', coordinates: { lat: 12.97, lng: 79.15 }, contactName: 'Alice', contactPhone: '9876543210' },
                    drop: { address: 'Dest', coordinates: { lat: 12.98, lng: 79.16 }, contactName: 'Bob', contactPhone: '9876543211' },
                    category: 'PARCEL',
                    description: 'Gift box',
                });
            expect(res.status).toBe(400);
            expect(res.body.error.message).toContain('photograph');
        });

        it('2. Booking succeeds with image and stores image reference in order model', async () => {
            const res = await request(app)
                .post('/api/v1/deliveries')
                .set('Authorization', `Bearer ${customerAToken}`)
                .send({
                    pickup: { address: 'Origin', coordinates: { lat: 12.97, lng: 79.15 }, contactName: 'Alice', contactPhone: '9876543210' },
                    drop: { address: 'Dest', coordinates: { lat: 12.98, lng: 79.16 }, contactName: 'Bob', contactPhone: '9876543211' },
                    category: 'PARCEL',
                    itemName: 'Handmade Watch',
                    description: 'Fragile vintage watch',
                    handlingInstructions: 'Handle with extreme care, fragile glass dial',
                    itemPhoto: dummyBase64Image,
                });
            expect(res.status).toBe(201);
            expect(res.body.data.itemPhoto).toMatch(/\/api\/v1\/deliveries\/images\/item_orig_/);
            expect(res.body.data.itemVerification.status).toBe('PENDING');
            expect(res.body.data.handlingInstructions).toBe('Handle with extreme care, fragile glass dial');
        });

        it('3. Partner can review item photo, accept order, and mark arrival', async () => {
            const delivery = await DeliveryModel.create({
                customer: customerA._id,
                pickup: { address: 'Origin', coordinates: { lat: 12.97, lng: 79.15 }, contactName: 'Alice', contactPhone: '9876543210' },
                drop: { address: 'Dest', coordinates: { lat: 12.98, lng: 79.16 }, contactName: 'Bob', contactPhone: '9876543211' },
                category: 'PARCEL',
                itemName: 'Vintage Camera',
                description: 'DSLR Camera',
                itemPhoto: dummyBase64Image,
                itemVerification: {
                    originalImage: dummyBase64Image,
                    status: 'PENDING',
                },
                status: 'CREATED',
                pickupOTP: '4321',
                deliveryOTP: '8765',
            });

            // Review in available deliveries
            const resAvail = await request(app)
                .get('/api/v1/partners/deliveries/available')
                .set('Authorization', `Bearer ${partnerAToken}`);
            expect(resAvail.status).toBe(200);
            expect(resAvail.body.data[0].itemPhoto).toBeDefined();

            // Accept
            const resAccept = await request(app)
                .post(`/api/v1/partners/deliveries/${delivery._id}/accept`)
                .set('Authorization', `Bearer ${partnerAToken}`);
            expect(resAccept.status).toBe(200);

            // Arrive
            const resArrive = await request(app)
                .post(`/api/v1/partners/deliveries/${delivery._id}/arrived-pickup`)
                .set('Authorization', `Bearer ${partnerAToken}`);
            expect(resArrive.status).toBe(200);
            expect(resArrive.body.data.status).toBe('ARRIVED_AT_PICKUP');

            // Pickup OTP verification blocked because item image is not yet verified
            const resBlockedOtp = await request(app)
                .post(`/api/v1/partners/deliveries/${delivery._id}/verify-pickup-otp`)
                .set('Authorization', `Bearer ${partnerAToken}`)
                .send({ otp: '4321' });
            expect(resBlockedOtp.status).toBe(400);
            expect(resBlockedOtp.body.error.code).toBe('ITEM_VERIFICATION_REQUIRED');

            // Partner captures pickup photograph and confirms match
            const resVerify = await request(app)
                .post(`/api/v1/partners/deliveries/${delivery._id}/verify-item`)
                .set('Authorization', `Bearer ${partnerAToken}`)
                .send({
                    pickupImage: dummyBase64Image,
                    notes: 'Physical camera matches original serial number and photo',
                });
            expect(resVerify.status).toBe(200);
            expect(resVerify.body.data.itemVerification.status).toBe('VERIFIED');
            expect(resVerify.body.data.itemVerification.pickupImage).toMatch(/\/api\/v1\/deliveries\/images\/item_pickup_/);

            // Now pickup OTP verification succeeds
            const resSuccessOtp = await request(app)
                .post(`/api/v1/partners/deliveries/${delivery._id}/verify-pickup-otp`)
                .set('Authorization', `Bearer ${partnerAToken}`)
                .send({ otp: '4321' });
            expect(resSuccessOtp.status).toBe(200);
            expect(resSuccessOtp.body.data.status).toBe('PICKED_UP');
        });

        it('4. Reporting item mismatch halts pickup, transitions to ITEM_MISMATCH, and blocks pickup OTP', async () => {
            const delivery = await DeliveryModel.create({
                customer: customerA._id,
                partner: partnerA._id,
                pickup: { address: 'Origin', coordinates: { lat: 12.97, lng: 79.15 }, contactName: 'Alice', contactPhone: '9876543210' },
                drop: { address: 'Dest', coordinates: { lat: 12.98, lng: 79.16 }, contactName: 'Bob', contactPhone: '9876543211' },
                category: 'PARCEL',
                itemName: 'Laptop',
                description: 'MacBook Pro',
                itemPhoto: dummyBase64Image,
                itemVerification: {
                    originalImage: dummyBase64Image,
                    status: 'PENDING',
                },
                status: 'ARRIVED_AT_PICKUP',
                pickupOTP: '9988',
                deliveryOTP: '1122',
            });

            // Partner reports mismatch
            const resMismatch = await request(app)
                .post(`/api/v1/partners/deliveries/${delivery._id}/report-mismatch`)
                .set('Authorization', `Bearer ${partnerAToken}`)
                .send({
                    reason: 'WRONG_ITEM',
                    notes: 'Sender is handing over a microwave instead of a laptop',
                    evidenceImage: dummyBase64Image,
                });
            expect(resMismatch.status).toBe(200);
            expect(resMismatch.body.data.status).toBe('ITEM_MISMATCH');
            expect(resMismatch.body.data.itemVerification.status).toBe('MISMATCH');
            expect(resMismatch.body.data.itemVerification.mismatchReason).toBe('WRONG_ITEM');

            // Pickup OTP MUST be blocked
            const resBlockedOtp = await request(app)
                .post(`/api/v1/partners/deliveries/${delivery._id}/verify-pickup-otp`)
                .set('Authorization', `Bearer ${partnerAToken}`)
                .send({ otp: '9988' });
            expect(resBlockedOtp.status).toBe(400);

            // Unassigned partner cannot alter verification
            const resOtherPartner = await request(app)
                .post(`/api/v1/partners/deliveries/${delivery._id}/verify-item`)
                .set('Authorization', `Bearer ${partnerBToken}`)
                .send({ pickupImage: dummyBase64Image });
            expect(resOtherPartner.status).toBe(404);

            // Admin resolves mismatch by proceeding
            const resAdminProceed = await request(app)
                .post(`/api/v1/admin/deliveries/${delivery._id}/resolve-mismatch`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ decision: 'PROCEED', notes: 'Sender clarified package model, authorized' });
            expect(resAdminProceed.status).toBe(200);
            expect(resAdminProceed.body.data.status).toBe('ARRIVED_AT_PICKUP');
            expect(resAdminProceed.body.data.itemVerification.status).toBe('OVERRIDDEN');

            // Pickup OTP can now proceed
            const resOtpAllowed = await request(app)
                .post(`/api/v1/partners/deliveries/${delivery._id}/verify-pickup-otp`)
                .set('Authorization', `Bearer ${partnerAToken}`)
                .send({ otp: '9988' });
            expect(resOtpAllowed.status).toBe(200);
            expect(resOtpAllowed.body.data.status).toBe('PICKED_UP');
        });
    });

    describe('Feature 2: Real-Time Delivery Partner Location Tracking', () => {
        it('1. Rejects location updates from unassigned partners or invalid coordinates', async () => {
            const delivery = await DeliveryModel.create({
                customer: customerA._id,
                partner: partnerA._id,
                pickup: { address: 'Origin', coordinates: { lat: 12.97, lng: 79.15 }, contactName: 'Alice', contactPhone: '9876543210' },
                drop: { address: 'Dest', coordinates: { lat: 12.98, lng: 79.16 }, contactName: 'Bob', contactPhone: '9876543211' },
                category: 'PARCEL',
                status: 'IN_TRANSIT',
            });

            // Unassigned partner
            const resUnassigned = await request(app)
                .post(`/api/v1/partners/deliveries/${delivery._id}/location`)
                .set('Authorization', `Bearer ${partnerBToken}`)
                .send({ lat: 12.975, lng: 79.155 });
            expect(resUnassigned.status).toBe(404);

            // Invalid coordinates
            const resInvalid = await request(app)
                .post(`/api/v1/partners/deliveries/${delivery._id}/location`)
                .set('Authorization', `Bearer ${partnerAToken}`)
                .send({ lat: 999, lng: 79.155 });
            expect(resInvalid.status).toBe(400);
        });

        it('2. Ingests valid location updates and exposes them on GET /tracking with accurate ETA', async () => {
            const delivery = await DeliveryModel.create({
                customer: customerA._id,
                partner: partnerA._id,
                pickup: { address: 'Origin', coordinates: { lat: 12.97, lng: 79.15 }, contactName: 'Alice', contactPhone: '9876543210' },
                drop: { address: 'Dest', coordinates: { lat: 12.98, lng: 79.16 }, contactName: 'Bob', contactPhone: '9876543211' },
                category: 'PARCEL',
                status: 'IN_TRANSIT',
                deliveryOTP: '5566',
            });

            const resLoc = await request(app)
                .post(`/api/v1/partners/deliveries/${delivery._id}/location`)
                .set('Authorization', `Bearer ${partnerAToken}`)
                .send({ lat: 12.975, lng: 79.155, heading: 45, speed: 28, accuracy: 5 });
            expect(resLoc.status).toBe(200);

            // Customer retrieves live tracking
            const resTrack = await request(app)
                .get(`/api/v1/deliveries/${delivery._id}/tracking`)
                .set('Authorization', `Bearer ${customerAToken}`);
            expect(resTrack.status).toBe(200);
            expect(resTrack.body.data.partnerLocation.lat).toBe(12.975);
            expect(resTrack.body.data.partnerLocation.lng).toBe(79.155);
            expect(resTrack.body.data.distanceKm).toBeGreaterThan(0);
            expect(resTrack.body.data.estimatedMinutes).toBeGreaterThan(0);
            expect(resTrack.body.data.stageMessage).toContain('transit');

            // Unrelated customer cannot view tracking
            const resBlocked = await request(app)
                .get(`/api/v1/deliveries/${delivery._id}/tracking`)
                .set('Authorization', `Bearer ${customerBToken}`);
            expect(resBlocked.status).toBe(403);
        });

        it('3. Tracking stops when order is delivered or cancelled', async () => {
            const delivery = await DeliveryModel.create({
                customer: customerA._id,
                partner: partnerA._id,
                pickup: { address: 'Origin', coordinates: { lat: 12.97, lng: 79.15 }, contactName: 'Alice', contactPhone: '9876543210' },
                drop: { address: 'Dest', coordinates: { lat: 12.98, lng: 79.16 }, contactName: 'Bob', contactPhone: '9876543211' },
                category: 'PARCEL',
                status: 'DELIVERED',
            });

            // Updating location for delivered order is rejected
            const resDelivered = await request(app)
                .post(`/api/v1/partners/deliveries/${delivery._id}/location`)
                .set('Authorization', `Bearer ${partnerAToken}`)
                .send({ lat: 12.975, lng: 79.155 });
            expect(resDelivered.status).toBe(400);
            expect(resDelivered.body.error.code).toBe('TRACKING_NOT_ACTIVE');
        });
    });
});
