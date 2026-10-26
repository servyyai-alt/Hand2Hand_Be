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
exports.UserModel = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const userSchema = new mongoose_1.Schema({
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 50 },
    phone: { type: String, required: true, unique: true, index: true },
    email: { type: String, sparse: true, unique: true, lowercase: true, index: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['CUSTOMER', 'DELIVERY_PARTNER', 'ADMIN', 'SUPER_ADMIN'], required: true, index: true },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE', 'BLOCKED', 'PENDING_VERIFICATION'], default: 'PENDING_VERIFICATION', index: true },
    isPhoneVerified: { type: Boolean, default: false },
    isEmailVerified: { type: Boolean, default: false },
    fcmToken: { type: String },
    avatar: { type: String, default: '' },
    notificationPreferences: {
        deliveryAccepted: { type: Boolean, default: true },
        partnerArriving: { type: Boolean, default: true },
        itemPickedUp: { type: Boolean, default: true },
        deliveryInProgress: { type: Boolean, default: true },
        deliveryCompleted: { type: Boolean, default: true },
        paymentUpdates: { type: Boolean, default: true },
        promotions: { type: Boolean, default: false },
    },
    tokenVersion: { type: Number, default: 0 },
    lastLoginAt: { type: Date },
    approvalStatus: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'APPROVED', index: true },
    adminApprovalStatus: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING', index: true },
    superAdminApprovalStatus: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING', index: true },
    accountStatus: { type: String, enum: ['PENDING_VERIFICATION', 'ACTIVE', 'INACTIVE', 'BLOCKED', 'REJECTED', 'SUSPENDED'], default: 'PENDING_VERIFICATION', index: true },
    isActive: { type: Boolean, default: false, index: true },
    canWork: { type: Boolean, default: false, index: true },
    canAcceptDeliveries: { type: Boolean, default: false, index: true },
    designation: { type: String, trim: true, default: '' },
    permissions: { type: [String], default: ['customers', 'partners', 'deliveries', 'support'] },
    approvedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    approvedByAdmin: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' },
    adminApprovedAt: { type: Date },
    approvedBySuperAdmin: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' },
    superAdminApprovedAt: { type: Date },
    rejectedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' },
    rejectedAt: { type: Date },
    rejectionReason: { type: String, default: '' },
    partnerId: { type: String, sparse: true, index: true },
    applicationRef: { type: String, sparse: true, index: true },
    applicationSubmittedAt: { type: Date },
    invitationToken: { type: String, select: false },
    invitationExpiresAt: { type: Date },
    isInvitationAccepted: { type: Boolean, default: false },
}, {
    timestamps: true,
    toJSON: {
        transform: (_doc, ret) => {
            const sanitized = { ...ret };
            delete sanitized.passwordHash;
            delete sanitized.invitationToken;
            delete sanitized.tokenVersion;
            delete sanitized.__v;
            return sanitized;
        },
    },
});
userSchema.methods.comparePassword = async function (password) {
    return bcryptjs_1.default.compare(password, this.passwordHash);
};
userSchema.pre('save', async function (next) {
    if (!this.isModified('passwordHash'))
        return next();
    this.passwordHash = await bcryptjs_1.default.hash(this.passwordHash, 12);
    next();
});
exports.UserModel = mongoose_1.default.model('User', userSchema);
