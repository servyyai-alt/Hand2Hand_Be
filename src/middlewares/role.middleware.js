"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authorize = void 0;
const AppError_1 = require("../errors/AppError");
const authorize = (...roles) => {
    return (req, _res, next) => {
        if (!req.user) {
            next(new AppError_1.ForbiddenError('Not authenticated'));
            return;
        }
        if (!roles.includes(req.user.role)) {
            next(new AppError_1.ForbiddenError(`Access denied. Required role: ${roles.join(' or ')}`));
            return;
        }
        next();
    };
};
exports.authorize = authorize;

const MANDATORY_OPERATIONAL = ['customers', 'partners', 'deliveries', 'support'];

const authorizePermission = (permission) => {
    return (req, _res, next) => {
        if (!req.user) {
            next(new AppError_1.ForbiddenError('Not authenticated'));
            return;
        }
        if (req.user.role === 'SUPER_ADMIN') {
            next();
            return;
        }
        if (req.user.role === 'ADMIN') {
            // Mandatory operational permissions are granted by role
            if (MANDATORY_OPERATIONAL.includes(permission)) {
                next();
                return;
            }
            if (Array.isArray(req.user.permissions) && req.user.permissions.includes(permission)) {
                next();
                return;
            }
        }
        next(new AppError_1.ForbiddenError(`Access denied. Missing permission: ${permission}`));
    };
};
exports.authorizePermission = authorizePermission;
