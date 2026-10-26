"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlatformSettingsModel = void 0;
const mongoose_1 = __importDefault(require("mongoose"));

const platformSettingsSchema = new mongoose_1.default.Schema({
    platformName: { type: String, default: 'Hyperlocal Delivery (H2H)' },
    defaultCity: { type: String, default: 'Vellore' },
    state: { type: String, default: 'Tamil Nadu' },
    currency: { type: String, default: 'INR' },
    partnerSearchRadiusKm: { type: Number, default: 5 },
    platformCommissionPercent: { type: Number, default: 20 },
    autoDispatchEnabled: { type: Boolean, default: true },
    maintenanceMode: { type: Boolean, default: false },
    supportEmail: { type: String, default: 'support@h2h.in' },
    supportPhone: { type: String, default: '+91 98765 43210' },
    // Base fare configurations
    baseFare: { type: Number, default: 30 },
    baseDistanceKm: { type: Number, default: 2 },
    perKmFare: { type: Number, default: 8 },
    weightChargePerKg: { type: Number, default: 5 },
    nightSurgeMultiplier: { type: Number, default: 1.2 },
    minimumFare: { type: Number, default: 30 },
}, { timestamps: true });

exports.PlatformSettingsModel = mongoose_1.default.model('PlatformSettings', platformSettingsSchema);
