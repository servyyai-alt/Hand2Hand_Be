"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetPasswordSchema = exports.forgotPasswordSchema = exports.loginSchema = exports.resendOtpSchema = exports.verifyOtpSchema = exports.registerSchema = void 0;
const zod_1 = require("zod");
const registerSchema = zod_1.z.object({
    name: zod_1.z.string().min(2, 'Name must be at least 2 characters'),
    phone: zod_1.z.string().min(10, 'Phone must be at least 10 digits').max(15),
    email: zod_1.z.string().email('Invalid email').optional(),
    password: zod_1.z.string().min(6, 'Password must be at least 6 characters'),
    role: zod_1.z.enum(['CUSTOMER', 'PARTNER']).default('CUSTOMER'),
});
exports.registerSchema = registerSchema;
const verifyOtpSchema = zod_1.z.object({
    phone: zod_1.z.string().min(10),
    otp: zod_1.z.string().length(6, 'OTP must be 6 digits'),
});
exports.verifyOtpSchema = verifyOtpSchema;
const resendOtpSchema = zod_1.z.object({
    phone: zod_1.z.string().min(10),
});
exports.resendOtpSchema = resendOtpSchema;
const loginSchema = zod_1.z.object({
    phone: zod_1.z.string().min(10),
    password: zod_1.z.string().min(1),
});
exports.loginSchema = loginSchema;
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
