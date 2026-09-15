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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PartnerProfileModel = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const partnerProfileSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    vehicle: {
        type: { type: String, enum: ['BICYCLE', 'MOTORCYCLE', 'SCOOTER', 'CAR', 'VAN'], default: 'MOTORCYCLE' },
        make: { type: String, default: '' },
        model: { type: String, default: '' },
        registrationNumber: { type: String, default: '' },
        rcPhoto: { type: String },
        insurancePhoto: { type: String },
    },
    isOnline: { type: Boolean, default: false, index: true },
    isAvailable: { type: Boolean, default: false, index: true },
    currentLocation: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], default: [80.0, 12.9] }, // lng, lat
    },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    totalRatings: { type: Number, default: 0 },
    totalDeliveries: { type: Number, default: 0 },
    completionRate: { type: Number, default: 0 },
    totalEarnings: { type: Number, default: 0 },
    walletBalance: { type: Number, default: 0 },
    kycStatus: { type: String, enum: ['NOT_SUBMITTED', 'PENDING', 'APPROVED', 'REJECTED'], default: 'NOT_SUBMITTED' },
    documents: [{ type: { type: String }, url: String, status: { type: String, default: 'PENDING' } }],
}, { timestamps: true });
// Geospatial index for partner search
partnerProfileSchema.index({ currentLocation: '2dsphere' });
partnerProfileSchema.index({ isOnline: 1, isAvailable: 1 });
exports.PartnerProfileModel = mongoose_1.default.model('PartnerProfile', partnerProfileSchema);
