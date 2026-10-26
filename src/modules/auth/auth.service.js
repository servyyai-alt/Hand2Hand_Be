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
const partnerProfile_model_1 = require("../partners/partnerProfile.model");
const customerProfile_model_1 = require("../customers/customerProfile.model");
const kycStorage_util_1 = require("../../utils/kycStorage.util");
const partnerNotification_util_1 = require("../../utils/partnerNotification.util");
const auditLog_model_1 = require("../admin/auditLog.model");
const userRepo = new user_repository_1.UserRepository();
class AuthService {
    async register(data) {
        const cleanPhone = data.phone.replace(/[\s\-\(\)]/g, '').replace(/^\+91/, '');
        const role = (data.role === 'PARTNER' || data.role === 'DELIVERY_PARTNER') ? 'DELIVERY_PARTNER' : 'CUSTOMER';
        const existing = await userRepo.findByPhone(cleanPhone);
        if (existing)
            throw new AppError_1.ConflictError('Phone number already registered');
        if (data.email) {
            const existingEmail = await userRepo.findByEmail(data.email.trim().toLowerCase());
            if (existingEmail)
                throw new AppError_1.ConflictError('Email already registered');
        }

        let savedProfilePhoto = '';
        let savedDlPhoto = '';
        let savedPanPhoto = '';
        let savedAadhaarPhoto = '';

        if (role === 'DELIVERY_PARTNER') {
            savedProfilePhoto = (0, kycStorage_util_1.saveKycBase64)(data.profilePhoto || data.avatar, 'profile');
            savedDlPhoto = (0, kycStorage_util_1.saveKycBase64)(data.drivingLicencePhoto, 'dl');
            savedPanPhoto = (0, kycStorage_util_1.saveKycBase64)(data.panPhoto, 'pan');
            savedAadhaarPhoto = (0, kycStorage_util_1.saveKycBase64)(data.aadhaarPhoto, 'aadhaar');
        }

        let partnerId = undefined;
        let applicationRef = undefined;
        if (role === 'DELIVERY_PARTNER') {
            const partnerCount = await user_model_1.UserModel.countDocuments({ role: 'DELIVERY_PARTNER' });
            partnerId = `H2H-DP-${String(partnerCount + 101).padStart(6, '0')}`;
            applicationRef = partnerId;
        }

        let user = await userRepo.create({
            name: data.name.trim(),
            phone: cleanPhone,
            email: data.email ? data.email.trim().toLowerCase() : undefined,
            passwordHash: data.password,
            role: role,
            status: 'PENDING_VERIFICATION',
            accountStatus: 'PENDING_VERIFICATION',
            approvalStatus: 'PENDING',
            adminApprovalStatus: 'PENDING',
            superAdminApprovalStatus: 'PENDING',
            isActive: false,
            canWork: false,
            canAcceptDeliveries: false,
            isPhoneVerified: role === 'DELIVERY_PARTNER' ? true : false,
            partnerId: partnerId,
            applicationRef: applicationRef,
            avatar: savedProfilePhoto || '',
            applicationSubmittedAt: new Date(),
        });

        if (role === 'DELIVERY_PARTNER') {
            const documents = [];
            if (savedDlPhoto) documents.push({ type: 'DRIVING_LICENCE', url: savedDlPhoto, number: data.drivingLicenceNumber || '', status: 'PENDING' });
            if (savedPanPhoto) documents.push({ type: 'PAN_CARD', url: savedPanPhoto, number: data.panNumber || '', status: 'PENDING' });
            if (savedAadhaarPhoto) documents.push({ type: 'AADHAAR_CARD', url: savedAadhaarPhoto, number: data.aadhaarNumber || '', status: 'PENDING' });

            await partnerProfile_model_1.PartnerProfileModel.findOneAndUpdate(
                { userId: user._id },
                {
                    userId: user._id,
                    vehicle: {
                        type: data.vehicleType || 'MOTORCYCLE',
                        registrationNumber: data.vehicleNumber || data.registrationNumber || '',
                    },
                    kyc: {
                        drivingLicenceNumber: data.drivingLicenceNumber || '',
                        drivingLicencePhoto: savedDlPhoto,
                        panNumber: data.panNumber || '',
                        panPhoto: savedPanPhoto,
                        aadhaarNumber: data.aadhaarNumber || '',
                        aadhaarPhoto: savedAadhaarPhoto,
                        profilePhoto: savedProfilePhoto,
                    },
                    kycStatus: 'PENDING',
                    isOnline: false,
                    isAvailable: false,
                    documents,
                },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );
        } else if (role === 'CUSTOMER') {
            await customerProfile_model_1.CustomerProfileModel.findOneAndUpdate(
                { userId: user._id },
                { userId: user._id, addresses: [] },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );
        }
        // Generate and store OTP
        const otp = await this._createOtp(cleanPhone, 'PHONE');
        return {
            message: 'OTP sent to your mobile number',
            userId: user._id,
            partnerId: user.partnerId || `H2H-DP-${user._id.toString().slice(-6).toUpperCase()}`,
            applicationRef: user.applicationRef || user.partnerId || `H2H-DP-${user._id.toString().slice(-6).toUpperCase()}`,
            ...(env_1.env.NODE_ENV === 'development' ? { devOtp: otp } : {})
        };
    }
    async resendOtp(phone) {
        const cleanPhone = phone.replace(/[\s\-\(\)]/g, '').replace(/^\+91/, '');
        const user = await userRepo.findByPhone(cleanPhone);
        if (!user)
            throw new AppError_1.NotFoundError('Account');
        if (user.status !== 'PENDING_VERIFICATION')
            throw new AppError_1.ValidationError('This account is already verified. Please log in.');
        const otp = await this._createOtp(cleanPhone, 'PHONE');
        return { message: 'A new OTP was sent to your mobile number', ...(env_1.env.NODE_ENV === 'development' ? { devOtp: otp } : {}) };
    }
    async verifyOtp(phone, otp) {
        const cleanPhone = phone.replace(/[\s\-\(\)]/g, '').replace(/^\+91/, '');
        const otpRecord = await otp_model_1.OTPModel.findOne({
            phone: cleanPhone, type: 'PHONE', isUsed: false, expiresAt: { $gt: new Date() }
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
        const existingUser = await user_model_1.UserModel.findOne({ phone: cleanPhone });
        if (!existingUser)
            throw new AppError_1.NotFoundError('User');

        let updateData = { isPhoneVerified: true };
        if (existingUser.role === 'DELIVERY_PARTNER') {
            updateData.status = 'PENDING_VERIFICATION';
            updateData.accountStatus = 'PENDING_VERIFICATION';
            updateData.approvalStatus = 'PENDING';
            updateData.adminApprovalStatus = 'PENDING';
            updateData.superAdminApprovalStatus = 'PENDING';
            updateData.isActive = false;
            updateData.canWork = false;
            updateData.canAcceptDeliveries = false;
        } else {
            updateData.status = 'ACTIVE';
            updateData.accountStatus = 'ACTIVE';
            updateData.isActive = true;
        }

        const user = await userRepo.update(existingUser._id.toString(), updateData);
        if (!user)
            throw new AppError_1.NotFoundError('User');
        if (user.role === 'DELIVERY_PARTNER') {
            await partnerProfile_model_1.PartnerProfileModel.findOneAndUpdate(
                { userId: user._id },
                { userId: user._id },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );
            (0, partnerNotification_util_1.notifyPartnerApplicationSubmitted)(user.name, user._id).catch(() => {});
            try {
                await auditLog_model_1.AdminAuditLogModel.create({
                    action: 'PARTNER_APPLICATION_SUBMITTED',
                    performedBy: user._id,
                    targetUser: user._id,
                    details: { name: user.name, phone: user.phone },
                });
            } catch (e) {}
        } else if (user.role === 'CUSTOMER') {
            await customerProfile_model_1.CustomerProfileModel.findOneAndUpdate(
                { userId: user._id },
                { userId: user._id, addresses: [] },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );
        }
        const tokens = await this._issueTokens(user._id.toString(), user.role);
        return {
            ...tokens,
            user: {
                id: user._id,
                name: user.name,
                role: user.role,
                phone: user.phone,
                email: user.email,
                avatar: user.avatar,
                status: user.status,
                approvalStatus: user.approvalStatus,
                adminApprovalStatus: user.adminApprovalStatus || 'PENDING',
                superAdminApprovalStatus: user.superAdminApprovalStatus || 'PENDING',
                accountStatus: user.accountStatus || 'PENDING_VERIFICATION',
                isActive: Boolean(user.isActive),
                canWork: Boolean(user.canWork),
                canAcceptDeliveries: Boolean(user.canAcceptDeliveries),
            }
        };
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
    async login(phoneOrEmail, password) {
        let user;
        const identifier = typeof phoneOrEmail === 'string' ? phoneOrEmail.trim() : '';
        if (identifier.includes('@')) {
            user = await userRepo.findByEmail(identifier.toLowerCase(), true);
        } else {
            user = await userRepo.findByPhone(identifier, true);
        }
        if (!user)
            throw new AppError_1.AuthError('Invalid phone number/email or password');
        if (user.status === 'BLOCKED' || user.accountStatus === 'SUSPENDED')
            throw new AppError_1.AuthError('Account has been suspended. Contact support.');
        if (user.role === 'ADMIN') {
            if (user.approvalStatus === 'REJECTED') {
                throw new AppError_1.AuthError('Your admin account request was rejected' + (user.rejectionReason ? `: ${user.rejectionReason}` : '.'));
            }
            // Admin approval is not required once created - auto-approve any pending accounts
            if (user.approvalStatus === 'PENDING') {
                user.approvalStatus = 'APPROVED';
                user.status = 'ACTIVE';
                await user_model_1.UserModel.findByIdAndUpdate(user._id, { approvalStatus: 'APPROVED', status: 'ACTIVE' });
            }
        }
        if (user.role !== 'DELIVERY_PARTNER' && user.status === 'INACTIVE')
            throw new AppError_1.AuthError('Account is inactive. Please contact Super Admin.');
        if (user.role !== 'DELIVERY_PARTNER' && user.status === 'PENDING_VERIFICATION' && !user.isPhoneVerified)
            throw new AppError_1.AuthError('Please verify your phone number first.');

        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid)
            throw new AppError_1.AuthError('Invalid phone number/email or password');
        await user_model_1.UserModel.findByIdAndUpdate(user._id, { lastLoginAt: new Date() });
        const tokens = await this._issueTokens(user._id.toString(), user.role);
        const resolvedPartnerId = user.partnerId || (user.role === 'DELIVERY_PARTNER' ? `H2H-DP-${user._id.toString().slice(-6).toUpperCase()}` : undefined);
        return {
            ...tokens,
            user: {
                id: user._id,
                name: user.name,
                role: user.role,
                phone: user.phone,
                email: user.email,
                avatar: user.avatar,
                partnerId: resolvedPartnerId,
                applicationRef: user.applicationRef || resolvedPartnerId,
                approvalStatus: user.approvalStatus || 'PENDING',
                adminApprovalStatus: user.adminApprovalStatus || 'PENDING',
                superAdminApprovalStatus: user.superAdminApprovalStatus || 'PENDING',
                accountStatus: user.accountStatus || user.status || 'PENDING_VERIFICATION',
                isActive: Boolean(user.isActive),
                canWork: Boolean(user.canWork),
                canAcceptDeliveries: Boolean(user.canAcceptDeliveries),
                rejectionReason: user.rejectionReason || '',
                designation: user.designation,
                permissions: (user.role === 'ADMIN' && (!user.permissions || user.permissions.length === 0))
                    ? ['customers', 'partners', 'deliveries', 'support']
                    : (user.permissions || []),
            }
        };
    }
    async verifyInvitationToken(token) {
        if (!token)
            throw new AppError_1.ValidationError('Invitation token is required');
        const user = await user_model_1.UserModel.findOne({
            invitationToken: token,
            invitationExpiresAt: { $gt: new Date() },
        }).select('name email role designation');
        if (!user)
            throw new AppError_1.ValidationError('Invalid or expired invitation token');
        return { valid: true, user: { name: user.name, email: user.email, designation: user.designation } };
    }
    async acceptInvitation(token, newPassword) {
        if (!token)
            throw new AppError_1.ValidationError('Invitation token is required');
        if (!newPassword || newPassword.length < 8)
            throw new AppError_1.ValidationError('Password must be at least 8 characters long');
        const user = await user_model_1.UserModel.findOne({
            invitationToken: token,
            invitationExpiresAt: { $gt: new Date() },
        }).select('+passwordHash +invitationToken');
        if (!user)
            throw new AppError_1.ValidationError('Invalid or expired invitation link. Please ask your Super Admin to resend an invitation.');
        user.passwordHash = newPassword;
        user.invitationToken = undefined;
        user.invitationExpiresAt = undefined;
        user.isInvitationAccepted = true;
        user.isEmailVerified = true;
        await user.save();
        return {
            message: 'Password set successfully! ' + (user.approvalStatus === 'APPROVED' && user.status === 'ACTIVE'
                ? 'You can now log in.'
                : 'Your account is pending approval by the Super Admin.'),
            approvalStatus: user.approvalStatus,
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
    async changePassword(userId, currentPassword, newPassword) {
        const user = await user_model_1.UserModel.findById(userId).select('+passwordHash');
        if (!user)
            throw new AppError_1.NotFoundError('User');
        const isPasswordValid = await user.comparePassword(currentPassword);
        if (!isPasswordValid)
            throw new AppError_1.ValidationError('Current password is incorrect');
        if (!newPassword || newPassword.length < 6)
            throw new AppError_1.ValidationError('New password must be at least 6 characters');
        user.passwordHash = newPassword;
        user.tokenVersion = (user.tokenVersion || 0) + 1;
        await user.save();
        await refreshToken_model_1.RefreshTokenModel.updateMany({ userId: user._id.toString(), isRevoked: false }, { isRevoked: true });
        return { message: 'Password changed successfully' };
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
