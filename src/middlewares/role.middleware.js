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
