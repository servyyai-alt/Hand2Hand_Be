"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserController = void 0;
const user_service_1 = require("./user.service");
const response_1 = require("../../utils/response");

const userService = new user_service_1.UserService();

class UserController {
    async getMe(req, res, next) {
        try {
            const profile = await userService.getProfile(req.user.userId);
            (0, response_1.sendSuccess)(res, profile, 'Profile retrieved successfully');
        } catch (err) {
            next(err);
        }
    }

    async updateMe(req, res, next) {
        try {
            const updated = await userService.updateProfile(req.user.userId, req.body);
            (0, response_1.sendSuccess)(res, updated, 'Profile updated successfully');
        } catch (err) {
            next(err);
        }
    }

    async getPreferences(req, res, next) {
        try {
            const prefs = await userService.getPreferences(req.user.userId);
            (0, response_1.sendSuccess)(res, prefs, 'Preferences retrieved successfully');
        } catch (err) {
            next(err);
        }
    }

    async updatePreferences(req, res, next) {
        try {
            const prefs = await userService.updatePreferences(req.user.userId, req.body);
            (0, response_1.sendSuccess)(res, prefs, 'Preferences updated successfully');
        } catch (err) {
            next(err);
        }
    }

    async getAddresses(req, res, next) {
        try {
            const addresses = await userService.getAddresses(req.user.userId);
            (0, response_1.sendSuccess)(res, addresses, 'Addresses retrieved successfully');
        } catch (err) {
            next(err);
        }
    }

    async addAddress(req, res, next) {
        try {
            const address = await userService.addAddress(req.user.userId, req.body);
            (0, response_1.sendSuccess)(res, address, 'Address added successfully', 201);
        } catch (err) {
            next(err);
        }
    }

    async updateAddress(req, res, next) {
        try {
            const address = await userService.updateAddress(req.user.userId, req.params.addressId, req.body);
            (0, response_1.sendSuccess)(res, address, 'Address updated successfully');
        } catch (err) {
            next(err);
        }
    }

    async deleteAddress(req, res, next) {
        try {
            const result = await userService.deleteAddress(req.user.userId, req.params.addressId);
            (0, response_1.sendSuccess)(res, result, 'Address deleted successfully');
        } catch (err) {
            next(err);
        }
    }

    async deleteAccount(req, res, next) {
        try {
            const result = await userService.deleteAccount(req.user.userId);
            (0, response_1.sendSuccess)(res, result, 'Account deleted successfully');
        } catch (err) {
            next(err);
        }
    }
}
exports.UserController = UserController;
