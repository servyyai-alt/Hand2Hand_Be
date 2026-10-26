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
exports.DeliveryModel = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const src_1 = require("../../constants");
const AppError_1 = require("../../errors/AppError");
const locationSchema = new mongoose_1.Schema({
    address: { type: String, required: true },
    coordinates: { lat: { type: Number, required: true }, lng: { type: Number, required: true } },
    contactName: { type: String, required: true },
    contactPhone: { type: String, required: true },
    landmark: { type: String },
}, { _id: false });
const fareSchema = new mongoose_1.Schema({
    base: { type: Number, default: 0 },
    perKm: { type: Number, default: 0 },
    weightCharge: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    currency: { type: String, default: 'INR' },
}, { _id: false });
const statusHistorySchema = new mongoose_1.Schema({
    status: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    note: { type: String },
}, { _id: false });
const ratingSchema = new mongoose_1.Schema({
    rating: { type: Number, required: true, min: 1, max: 5 },
    feedback: { type: String, maxlength: 500 },
    createdAt: { type: Date, default: Date.now },
}, { _id: false });
const paymentSchema = new mongoose_1.Schema({
    method: { type: String, enum: ['CASH', 'UPI', 'CARD', 'WALLET'], default: 'UPI' },
    status: { type: String, enum: ['PENDING', 'PAID', 'REFUNDED', 'FAILED'], default: 'PAID' },
    transactionId: { type: String },
    paidAt: { type: Date, default: Date.now },
}, { _id: false });

const itemVerificationSchema = new mongoose_1.Schema({
    originalImage: { type: String, default: '' },
    originalUploadedAt: { type: Date, default: Date.now },
    originalUploadedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' },
    handlingInstructions: { type: String, maxlength: 500, default: '' },
    pickupImage: { type: String, default: '' },
    pickupUploadedAt: { type: Date },
    pickupUploadedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' },
    status: {
        type: String,
        enum: ['PENDING', 'VERIFIED', 'MISMATCH', 'OVERRIDDEN'],
        default: 'PENDING',
    },
    verifiedAt: { type: Date },
    verifiedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' },
    notes: { type: String },
    mismatchReason: {
        type: String,
        enum: ['WRONG_ITEM', 'DAMAGED_ITEM', 'DIFFERENT_SIZE_WEIGHT', 'SUSPICIOUS_PACKAGE', 'OTHER', 'NONE'],
        default: 'NONE',
    },
    mismatchNotes: { type: String },
    mismatchEvidenceImage: { type: String },
    mismatchReportedAt: { type: Date },
    mismatchReportedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' },
    reviewStatus: {
        type: String,
        enum: ['NONE', 'PENDING_REVIEW', 'INVESTIGATING', 'RESOLVED_PROCEED', 'RESOLVED_CANCELLED'],
        default: 'NONE',
    },
    adminDecision: { type: String },
    adminDecisionAt: { type: Date },
    adminDecisionBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' },
}, { _id: false });

const lastLocationSchema = new mongoose_1.Schema({
    lat: { type: Number },
    lng: { type: Number },
    accuracy: { type: Number },
    heading: { type: Number },
    speed: { type: Number },
    updatedAt: { type: Date, default: Date.now },
}, { _id: false });

const locationHistoryItemSchema = new mongoose_1.Schema({
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    timestamp: { type: Date, default: Date.now },
}, { _id: false });

const deliverySchema = new mongoose_1.Schema({
    trackingId: { type: String, unique: true, index: true },
    customer: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    partner: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', index: true, sparse: true },
    pickup: { type: locationSchema, required: true },
    drop: { type: locationSchema, required: true },
    status: { type: String, enum: Object.keys(src_1.DELIVERY_STATUS_TRANSITIONS), default: 'CREATED', index: true },
    statusHistory: [statusHistorySchema],
    category: { type: String, enum: ['DOCUMENTS', 'FOOD', 'CLOTHES', 'GIFTS', 'PARCEL', 'BOOKS', 'PERSONAL_ITEMS', 'OTHER'], required: true },
    itemName: { type: String, trim: true },
    description: { type: String, maxlength: 200 },
    handlingInstructions: { type: String, maxlength: 500 },
    weight: { type: Number, min: 0, max: 50 },
    itemPhoto: { type: String },
    itemVerification: { type: itemVerificationSchema },
    lastLocation: { type: lastLocationSchema },
    locationHistory: [locationHistoryItemSchema],
    fare: { type: fareSchema, default: {} },
    distance: { type: Number, default: 0 },
    duration: { type: Number, default: 0 },
    pickupOTP: { type: String, select: false },
    deliveryOTP: { type: String, select: false },
    partnerSearchAttempts: { type: Number, default: 0 },
    cityId: { type: String, default: 'VLR' },
    rating: { type: ratingSchema },
    payment: { type: paymentSchema, default: () => ({ method: 'UPI', status: 'PAID', paidAt: new Date() }) },
    cancellationReason: { type: String },
    recipientNotes: { type: String },
}, {
    timestamps: true,
    toJSON: {
        transform: (_doc, ret) => {
            const sanitized = { ...ret };
            delete sanitized.__v;
            return sanitized;
        },
    }
});
deliverySchema.index({ status: 1, createdAt: -1 });
deliverySchema.index({ customer: 1, createdAt: -1 });
deliverySchema.index({ partner: 1, status: 1 });
// Enforce status machine
deliverySchema.methods.transitionStatus = function (newStatus, note) {
    const allowed = src_1.DELIVERY_STATUS_TRANSITIONS[this.status] || [];
    if (!allowed.includes(newStatus)) {
        throw new AppError_1.AppError(`Invalid status transition: ${this.status} → ${newStatus}`, 400, 'INVALID_STATUS_TRANSITION');
    }
    this.statusHistory.push({ status: newStatus, timestamp: new Date(), note });
    this.status = newStatus;
};
// Auto-generate trackingId
deliverySchema.pre('save', function (next) {
    if (!this.trackingId) {
        const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
        this.trackingId = `HD-VLR-${date}-${rand}`;
    }
    next();
});
exports.DeliveryModel = mongoose_1.default.model('Delivery', deliverySchema);
