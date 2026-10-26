"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = void 0;
const jwt_util_1 = require("../utils/jwt.util");
const AppError_1 = require("../errors/AppError");
const user_model_1 = require("../modules/users/user.model");
const authenticate = async (req, _res, next) => {
    try {
        let token = null;
        const authHeader = req.headers.authorization;
        if (authHeader?.startsWith('Bearer ')) {
            token = authHeader.split(' ')[1];
        } else if (req.query?.token) {
            token = String(req.query.token);
        }
        if (!token) {
            throw new AppError_1.AuthError('No token provided');
        }
        const payload = (0, jwt_util_1.verifyAccessToken)(token);
        // Verify user still exists and is active
        const user = await user_model_1.UserModel.findById(payload.userId)
            .select('status role approvalStatus designation permissions')
            .lean();
        if (!user)
            throw new AppError_1.AuthError('User not found');
        if (user.status === 'BLOCKED')
            throw new AppError_1.AuthError('Account is blocked');
        if (user.role === 'ADMIN') {
            if (user.approvalStatus === 'REJECTED')
                throw new AppError_1.AuthError('Admin account has been rejected');
        }
        if (user.status === 'INACTIVE')
            throw new AppError_1.AuthError('Account is inactive');
        const mandatoryOps = ['customers', 'partners', 'deliveries', 'support'];
        const userPerms = (user.role === 'ADMIN' && (!user.permissions || user.permissions.length === 0))
            ? mandatoryOps
            : (user.permissions || []);
        req.user = {
            userId: payload.userId,
            role: payload.role,
            approvalStatus: user.approvalStatus,
            designation: user.designation,
            permissions: userPerms,
        };
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
