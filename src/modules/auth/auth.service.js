"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const user_repository_1 = require("../users/user.repository");
const user_model_1 = require("../users/user.model");
const otp_model_1 = require("./otp.model");
const refreshToken_model_1 = require("./refreshToken.model");
const jwt_util_1 = require("../../utils/jwt.util");
const otp_util_1 = require("../../utils/otp.util");
const env_1 = require("../../config/env");
const AppError_1 = require("../../errors/AppError");
const logger_1 = require("../../utils/logger");
const userRepo = new user_repository_1.UserRepository();
class AuthService {
    async register(data) {
        const existing = await userRepo.findByPhone(data.phone);
        if (existing && existing.status !== 'PENDING_VERIFICATION')
            throw new AppError_1.ConflictError('Phone number already registered');
        if (data.email) {
            const existingEmail = await userRepo.findByEmail(data.email);
            if (existingEmail)
                throw new AppError_1.ConflictError('Email already registered');
        }
        let user = existing;
        if (user) {
            user.name = data.name;
            user.email = data.email;
            user.role = data.role;
            user.passwordHash = data.password;
            await user.save();
        }
        else {
            user = await userRepo.create({
                name: data.name,
                phone: data.phone,
                email: data.email,
                passwordHash: data.password,
                role: data.role,
                status: 'PENDING_VERIFICATION',
            });
        }
        // Generate and store OTP
        const otp = await this._createOtp(data.phone, 'PHONE');
        return { message: 'OTP sent to your mobile number', userId: user._id, ...(env_1.env.NODE_ENV === 'development' ? { devOtp: otp } : {}) };
    }
    async resendOtp(phone) {
        const user = await userRepo.findByPhone(phone);
        if (!user)
            throw new AppError_1.NotFoundError('Account');
        if (user.status !== 'PENDING_VERIFICATION')
            throw new AppError_1.ValidationError('This account is already verified. Please log in.');
        const otp = await this._createOtp(phone, 'PHONE');
        return { message: 'A new OTP was sent to your mobile number', ...(env_1.env.NODE_ENV === 'development' ? { devOtp: otp } : {}) };
    }
    async verifyOtp(phone, otp) {
        const otpRecord = await otp_model_1.OTPModel.findOne({
            phone, type: 'PHONE', isUsed: false, expiresAt: { $gt: new Date() }
        });
        if (!otpRecord)
            throw new AppError_1.ValidationError('OTP expired or not found. Request a new one.');
        if (otpRecord.attempts >= Number(env_1.env.OTP_MAX_ATTEMPTS)) {
            await otp_model_1.OTPModel.findByIdAndDelete(otpRecord._id);
            throw new AppError_1.ValidationError('Max OTP attempts exceeded. Request a new OTP.');
        }
        const isValid = await (0, otp_util_1.verifyOTP)(otp, otpRecord.otpHash);
        if (!isValid) {
            await otp_model_1.OTPModel.findByIdAndUpdate(otpRecord._id, { $inc: { attempts: 1 } });
            throw new AppError_1.ValidationError('Invalid OTP');
        }
        await otp_model_1.OTPModel.findByIdAndUpdate(otpRecord._id, { isUsed: true });
        const user = await userRepo.update((await user_model_1.UserModel.findOne({ phone }))._id.toString(), { isPhoneVerified: true, status: 'ACTIVE' });
        if (!user)
            throw new AppError_1.NotFoundError('User');
        const tokens = await this._issueTokens(user._id.toString(), user.role);
        return { ...tokens, user: { id: user._id, name: user.name, role: user.role, phone: user.phone } };
    }
    async forgotPassword(phone) {
        const user = await userRepo.findByPhone(phone);
        let otp;
        if (user && user.status !== 'BLOCKED') {
            otp = await this._createOtp(phone, 'RESET_PASSWORD');
        }
        return { message: 'If the account exists, a password reset OTP has been sent.', ...(env_1.env.NODE_ENV === 'development' && otp ? { devOtp: otp } : {}) };
    }
    async resetPassword(phone, otp, password) {
        const otpRecord = await otp_model_1.OTPModel.findOne({
            phone, type: 'RESET_PASSWORD', isUsed: false, expiresAt: { $gt: new Date() }
        });
        if (!otpRecord)
            throw new AppError_1.ValidationError('Reset OTP expired or not found. Request a new one.');
        if (otpRecord.attempts >= Number(env_1.env.OTP_MAX_ATTEMPTS)) {
            await otp_model_1.OTPModel.findByIdAndDelete(otpRecord._id);
            throw new AppError_1.ValidationError('Max OTP attempts exceeded. Request a new OTP.');
        }
        if (!(await (0, otp_util_1.verifyOTP)(otp, otpRecord.otpHash))) {
            await otp_model_1.OTPModel.findByIdAndUpdate(otpRecord._id, { $inc: { attempts: 1 } });
            throw new AppError_1.ValidationError('Invalid reset OTP');
        }
        const user = await userRepo.findByPhone(phone, true);
        if (!user)
            throw new AppError_1.ValidationError('Reset OTP expired or not found. Request a new one.');
        user.passwordHash = password;
        await user.save();
        await otp_model_1.OTPModel.findByIdAndUpdate(otpRecord._id, { isUsed: true });
        await refreshToken_model_1.RefreshTokenModel.updateMany({ userId: user._id.toString(), isRevoked: false }, { isRevoked: true });
        return { message: 'Password reset successfully' };
    }
    async _createOtp(phone, type) {
        const otp = (0, otp_util_1.generateOTP)(6);
        const otpHash = await (0, otp_util_1.hashOTP)(otp);
        const expiresAt = new Date(Date.now() + Number(env_1.env.OTP_EXPIRES_IN_MINUTES) * 60 * 1000);
        await otp_model_1.OTPModel.findOneAndDelete({ phone, type, isUsed: false });
        await otp_model_1.OTPModel.create({ phone, otpHash, type, expiresAt });
        logger_1.logger.info(`[DEV] ${type} OTP for ${phone}: ${otp}`);
        return otp;
    }
    async login(phone, password) {
        const user = await userRepo.findByPhone(phone, true);
        if (!user)
            throw new AppError_1.AuthError('Invalid phone number or password');
        if (user.status === 'BLOCKED')
            throw new AppError_1.AuthError('Account has been blocked. Contact support.');
        if (user.status === 'PENDING_VERIFICATION')
            throw new AppError_1.AuthError('Please verify your phone number first.');
        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid)
            throw new AppError_1.AuthError('Invalid phone number or password');
        await user_model_1.UserModel.findByIdAndUpdate(user._id, { lastLoginAt: new Date() });
        const tokens = await this._issueTokens(user._id.toString(), user.role);
        return {
            ...tokens,
            user: { id: user._id, name: user.name, role: user.role, phone: user.phone }
        };
    }
    async refreshToken(refreshToken) {
        let payload;
        try {
            payload = (0, jwt_util_1.verifyRefreshToken)(refreshToken);
        }
        catch {
            throw new AppError_1.AuthError('Invalid refresh token');
        }
        const tokenHash = crypto_1.default.createHash('sha256').update(refreshToken).digest('hex');
        const stored = await refreshToken_model_1.RefreshTokenModel.findOne({
            userId: payload.userId, tokenHash, isRevoked: false, expiresAt: { $gt: new Date() }
        });
        if (!stored)
            throw new AppError_1.AuthError('Refresh token revoked or expired');
        const user = await userRepo.findById(payload.userId);
        if (!user || user.status === 'BLOCKED')
            throw new AppError_1.AuthError('User not found or blocked');
        // Rotate: revoke old, issue new
        await refreshToken_model_1.RefreshTokenModel.findByIdAndUpdate(stored._id, { isRevoked: true });
        return this._issueTokens(user._id.toString(), user.role);
    }
    async logout(refreshToken) {
        try {
            const tokenHash = crypto_1.default.createHash('sha256').update(refreshToken).digest('hex');
            await refreshToken_model_1.RefreshTokenModel.findOneAndUpdate({ tokenHash }, { isRevoked: true });
        }
        catch {
            // Silent fail on logout
        }
        return { message: 'Logged out successfully' };
    }
    async getMe(userId) {
        const user = await userRepo.findById(userId);
        if (!user)
            throw new AppError_1.NotFoundError('User');
        return user;
    }
    async _issueTokens(userId, role) {
        const accessToken = (0, jwt_util_1.generateAccessToken)({ userId, role });
        const refreshToken = (0, jwt_util_1.generateRefreshToken)({ userId, tokenVersion: 0 });
        // Hash and store refresh token
        const tokenHash = crypto_1.default.createHash('sha256').update(refreshToken).digest('hex');
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        await refreshToken_model_1.RefreshTokenModel.create({ userId, tokenHash, expiresAt });
        return { accessToken, refreshToken };
    }
}
exports.AuthService = AuthService;
