"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hyperlocal_delivery';
async function seed() {
    await mongoose_1.default.connect(MONGODB_URI);
    console.log('Connected to MongoDB');
    const { UserModel } = await Promise.resolve().then(() => __importStar(require('../../modules/users/user.model')));
    const { PartnerProfileModel } = await Promise.resolve().then(() => __importStar(require('../../modules/partners/partnerProfile.model')));
    const { CustomerProfileModel } = await Promise.resolve().then(() => __importStar(require('../../modules/customers/customerProfile.model')));
    const { PricingModel } = await Promise.resolve().then(() => __importStar(require('../../modules/pricing/pricing.model')));
    // Clear
    await Promise.all([
        UserModel.deleteMany({}),
        PartnerProfileModel.deleteMany({}),
        CustomerProfileModel.deleteMany({}),
        PricingModel.deleteMany({}),
    ]);
    const hash = 'Test@1234';
    // Admin
    const admin = await UserModel.create({
        name: 'Super Admin', phone: '9000000000', email: 'admin@hyperlocal.in',
        passwordHash: hash, role: 'SUPER_ADMIN', status: 'ACTIVE',
        isPhoneVerified: true, isEmailVerified: true,
    });
    console.log('Admin created:', admin.phone);
    // Sample customer
    const customer = await UserModel.create({
        name: 'Ravi Kumar', phone: '9876543210',
        passwordHash: hash, role: 'CUSTOMER', status: 'ACTIVE', isPhoneVerified: true,
    });
    await CustomerProfileModel.create({ userId: customer._id });
    console.log('Customer created:', customer.phone);
    // Sample partner
    const partner = await UserModel.create({
        name: 'Murugan S', phone: '9876543211',
        passwordHash: hash, role: 'DELIVERY_PARTNER', status: 'ACTIVE', isPhoneVerified: true,
    });
    await PartnerProfileModel.create({
        userId: partner._id,
        vehicle: { type: 'MOTORCYCLE', make: 'Honda', model: 'Activa', registrationNumber: 'TN23AB1234' },
        kycStatus: 'APPROVED',
        currentLocation: { type: 'Point', coordinates: [79.1324, 12.9165] }, // Vellore
    });
    console.log('Partner created:', partner.phone);
    // Pricing rule for Vellore
    await PricingModel.create({
        cityId: 'VLR', baseFare: 30, baseDistanceKm: 2,
        perKmFare: 8, weightChargePerKg: 5, nightSurcharge: 0.2, minimumFare: 30,
    });
    console.log('Pricing rule created for VLR');
    console.log('\n✅ Seed complete!');
    console.log('Admin login:    9000000000 / Test@1234');
    console.log('Customer login: 9876543210 / Test@1234');
    console.log('Partner login:  9876543211 / Test@1234');
    await mongoose_1.default.disconnect();
}
seed().catch(console.error);
