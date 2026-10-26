"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.changePasswordSchema = exports.resetPasswordSchema = exports.forgotPasswordSchema = exports.loginSchema = exports.resendOtpSchema = exports.verifyOtpSchema = exports.registerSchema = void 0;
const zod_1 = require("zod");
const registerSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(2, 'Full name must be at least 2 characters').max(50, 'Full name cannot exceed 50 characters'),
    phone: zod_1.z.string().trim().regex(/^(\+91)?[6-9]\d{9}$/, 'Please enter a valid 10-digit mobile number'),
    email: zod_1.z.string().trim().email('Invalid email address').optional().or(zod_1.z.literal('')),
    password: zod_1.z.string().min(6, 'Password must be at least 6 characters'),
    role: zod_1.z.enum(['CUSTOMER', 'DELIVERY_PARTNER', 'PARTNER']).default('CUSTOMER'),
    vehicleType: zod_1.z.string().optional(),
    vehicleNumber: zod_1.z.string().optional(),
    registrationNumber: zod_1.z.string().optional(),
    drivingLicenceNumber: zod_1.z.string().optional(),
    drivingLicencePhoto: zod_1.z.string().optional(),
    panNumber: zod_1.z.string().optional(),
    panPhoto: zod_1.z.string().optional(),
    aadhaarNumber: zod_1.z.string().optional(),
    aadhaarPhoto: zod_1.z.string().optional(),
    profilePhoto: zod_1.z.string().optional(),
    avatar: zod_1.z.string().optional(),
    termsAccepted: zod_1.z.boolean().optional(),
    detailsConfirmed: zod_1.z.boolean().optional(),
}).passthrough();
exports.registerSchema = registerSchema;
const verifyOtpSchema = zod_1.z.object({
    phone: zod_1.z.string().trim().regex(/^(\+91)?[6-9]\d{9}$/, 'Please enter a valid 10-digit mobile number'),
    otp: zod_1.z.string().length(6, 'OTP must be 6 digits'),
});
exports.verifyOtpSchema = verifyOtpSchema;
const resendOtpSchema = zod_1.z.object({
    phone: zod_1.z.string().trim().regex(/^(\+91)?[6-9]\d{9}$/, 'Please enter a valid 10-digit mobile number'),
});
exports.resendOtpSchema = resendOtpSchema;
const loginSchema = zod_1.z.object({
    phone: zod_1.z.string().min(3).optional(),
    email: zod_1.z.string().email().optional(),
    password: zod_1.z.string().min(1),
}).refine((data) => data.phone || data.email, {
    message: 'Phone number or email address is required',
});
exports.loginSchema = loginSchema;
const changePasswordSchema = zod_1.z.object({
    currentPassword: zod_1.z.string().min(1, 'Current password is required'),
    newPassword: zod_1.z.string().min(6, 'New password must be at least 6 characters'),
    confirmPassword: zod_1.z.string().optional(),
});
exports.changePasswordSchema = changePasswordSchema;
const forgotPasswordSchema = zod_1.z.object({
    phone: zod_1.z.string().min(10),
});
exports.forgotPasswordSchema = forgotPasswordSchema;
const resetPasswordSchema = zod_1.z.object({
    phone: zod_1.z.string().min(10),
    otp: zod_1.z.string().length(6),
    password: zod_1.z.string().min(6, 'Password must be at least 6 characters'),
});
exports.resetPasswordSchema = resetPasswordSchema;
