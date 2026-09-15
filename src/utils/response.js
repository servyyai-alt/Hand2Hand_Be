"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendError = exports.sendSuccess = void 0;
const sendSuccess = (res, data, message = 'Success', statusCode = 200) => {
    return res.status(statusCode).json({ success: true, data, message });
};
exports.sendSuccess = sendSuccess;
const sendError = (res, code, message, statusCode = 400, details) => {
    return res.status(statusCode).json({
        success: false,
        error: { code, message, ...(details ? { details } : {}) },
    });
};
exports.sendError = sendError;
