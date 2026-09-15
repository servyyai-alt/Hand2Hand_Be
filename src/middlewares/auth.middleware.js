"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = void 0;
const jwt_util_1 = require("../utils/jwt.util");
const AppError_1 = require("../errors/AppError");
const user_model_1 = require("../modules/users/user.model");
const authenticate = async (req, _res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            throw new AppError_1.AuthError('No token provided');
        }
        const token = authHeader.split(' ')[1];
        const payload = (0, jwt_util_1.verifyAccessToken)(token);
        // Verify user still exists and is active
        const user = await user_model_1.UserModel.findById(payload.userId).select('status role').lean();
        if (!user)
            throw new AppError_1.AuthError('User not found');
        if (user.status === 'BLOCKED')
            throw new AppError_1.AuthError('Account is blocked');
        if (user.status === 'INACTIVE')
            throw new AppError_1.AuthError('Account is inactive');
        req.user = { userId: payload.userId, role: payload.role };
        next();
    }
    catch (err) {
        if (err.name === 'JsonWebTokenError') {
            next(new AppError_1.AuthError('Invalid token'));
        }
        else if (err.name === 'TokenExpiredError') {
            next(new AppError_1.AuthError('Token expired'));
        }
        else {
            next(err);
        }
    }
};
exports.authenticate = authenticate;
