"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireApprovedPartner = void 0;
const AppError_1 = require("../errors/AppError");
const user_model_1 = require("../modules/users/user.model");

const requireApprovedPartner = async (req, _res, next) => {
    try {
        if (!req.user || req.user.role !== 'DELIVERY_PARTNER') {
            throw new AppError_1.ForbiddenError('Delivery Partner access only');
        }

        const user = await user_model_1.UserModel.findById(req.user.userId)
            .select('status role approvalStatus adminApprovalStatus superAdminApprovalStatus accountStatus isActive canWork canAcceptDeliveries rejectionReason')
            .lean();

        if (!user) {
            throw new AppError_1.AuthError('User not found');
        }

        if (user.status === 'BLOCKED' || user.accountStatus === 'SUSPENDED') {
            throw new AppError_1.ForbiddenError('Your delivery partner account has been suspended. Please contact support.');
        }

        if (user.approvalStatus === 'REJECTED' || user.accountStatus === 'REJECTED') {
            throw new AppError_1.ForbiddenError(`Your delivery partner application was rejected: ${user.rejectionReason || 'Documents unclear'}`);
        }

        const isFullyApproved =
            (user.approvalStatus === 'APPROVED' ||
             user.status === 'ACTIVE' ||
             user.accountStatus === 'ACTIVE' ||
             user.canWork === true ||
             user.superAdminApprovalStatus === 'APPROVED' ||
             user.adminApprovalStatus === 'APPROVED') &&
            user.status !== 'BLOCKED' &&
            user.accountStatus !== 'SUSPENDED' &&
            user.accountStatus !== 'REJECTED';

        if (!isFullyApproved) {
            throw new AppError_1.ForbiddenError('Your Delivery Partner application is still under verification.');
        }

        next();
    } catch (err) {
        next(err);
    }
};
exports.requireApprovedPartner = requireApprovedPartner;
