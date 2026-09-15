"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyOTP = exports.hashOTP = exports.generateOTP = void 0;
const crypto_1 = __importDefault(require("crypto"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const generateOTP = (length = 6) => {
    const digits = '0123456789';
    let otp = '';
    const bytes = crypto_1.default.randomBytes(length);
    for (let i = 0; i < length; i++) {
        otp += digits[bytes[i] % 10];
    }
    return otp;
};
exports.generateOTP = generateOTP;
const hashOTP = async (otp) => {
    return bcryptjs_1.default.hash(otp, 10);
};
exports.hashOTP = hashOTP;
const verifyOTP = async (otp, hash) => {
    return bcryptjs_1.default.compare(otp, hash);
};
exports.verifyOTP = verifyOTP;
