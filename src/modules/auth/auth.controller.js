"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const auth_service_1 = require("./auth.service");
const response_1 = require("../../utils/response");
const authService = new auth_service_1.AuthService();
class AuthController {
    async register(req, res, next) {
        try {
            const result = await authService.register(req.body);
            (0, response_1.sendSuccess)(res, result, 'Registration successful. OTP sent to mobile.', 201);
        }
        catch (err) {
            next(err);
        }
    }
    async verifyOtp(req, res, next) {
        try {
            const { phone, otp } = req.body;
            const result = await authService.verifyOtp(phone, otp);
            (0, response_1.sendSuccess)(res, result, 'Phone verified successfully');
        }
        catch (err) {
            next(err);
        }
    }
    async resendOtp(req, res, next) {
        try {
            const result = await authService.resendOtp(req.body.phone);
            (0, response_1.sendSuccess)(res, result, 'OTP resent');
        }
        catch (err) {
            next(err);
        }
    }
    async forgotPassword(req, res, next) {
        try {
            const result = await authService.forgotPassword(req.body.phone);
            (0, response_1.sendSuccess)(res, result, 'Password reset OTP requested');
        }
        catch (err) {
            next(err);
        }
    }
    async resetPassword(req, res, next) {
        try {
            const { phone, otp, password } = req.body;
            const result = await authService.resetPassword(phone, otp, password);
            (0, response_1.sendSuccess)(res, result, 'Password reset successful');
        }
        catch (err) {
            next(err);
        }
    }
    async login(req, res, next) {
        try {
            const { phone, email, password } = req.body;
            const identifier = email || phone;
            const result = await authService.login(identifier, password);
            (0, response_1.sendSuccess)(res, result, 'Login successful');
        }
        catch (err) {
            next(err);
        }
    }
    async changePassword(req, res, next) {
        try {
            const { currentPassword, newPassword } = req.body;
            const result = await authService.changePassword(req.user.userId, currentPassword, newPassword);
            (0, response_1.sendSuccess)(res, result, 'Password changed successfully');
        }
        catch (err) {
            next(err);
        }
    }
    async refreshToken(req, res, next) {
        try {
            const { refreshToken } = req.body;
            const result = await authService.refreshToken(refreshToken);
            (0, response_1.sendSuccess)(res, result, 'Token refreshed');
        }
        catch (err) {
            next(err);
        }
    }
    async logout(req, res, next) {
        try {
            const { refreshToken } = req.body;
            const result = await authService.logout(refreshToken);
            (0, response_1.sendSuccess)(res, result, 'Logged out');
        }
        catch (err) {
            next(err);
        }
    }
    async getMe(req, res, next) {
        try {
            const user = await authService.getMe(req.user.userId);
            (0, response_1.sendSuccess)(res, user, 'User retrieved');
        }
        catch (err) {
            next(err);
        }
    }
    async verifyInvitation(req, res, next) {
        try {
            const { token } = req.query;
            const result = await authService.verifyInvitationToken(String(token || ''));
            (0, response_1.sendSuccess)(res, result, 'Invitation token valid');
        }
        catch (err) {
            next(err);
        }
    }
    async acceptInvitation(req, res, next) {
        try {
            const { token, password } = req.body;
            const result = await authService.acceptInvitation(token, password);
            (0, response_1.sendSuccess)(res, result, result.message);
        }
        catch (err) {
            next(err);
        }
    }
}
exports.AuthController = AuthController;
