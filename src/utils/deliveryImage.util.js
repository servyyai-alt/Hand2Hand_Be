"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDeliveryImageFilePath = exports.saveDeliveryImageBase64 = exports.detectImageType = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const AppError_1 = require("../errors/AppError");

const DELIVERY_ITEMS_DIR = path_1.default.join(__dirname, '../../uploads/delivery-items');
if (!fs_1.default.existsSync(DELIVERY_ITEMS_DIR)) {
    fs_1.default.mkdirSync(DELIVERY_ITEMS_DIR, { recursive: true });
}

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

function detectImageType(buffer, mimeHint = '') {
    if (!buffer || buffer.length < 4) return null;

    // JPEG: 0xFF 0xD8 0xFF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
        return { ext: 'jpg', mime: 'image/jpeg' };
    }

    // PNG: 0x89 0x50 0x4E 0x47
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
        return { ext: 'png', mime: 'image/png' };
    }

    // WEBP: RIFF....WEBP
    if (
        buffer.length >= 12 &&
        buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
        buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
    ) {
        return { ext: 'webp', mime: 'image/webp' };
    }

    const cleanHint = (mimeHint || '').toLowerCase();
    if (cleanHint.includes('png')) return { ext: 'png', mime: 'image/png' };
    if (cleanHint.includes('jpeg') || cleanHint.includes('jpg')) return { ext: 'jpg', mime: 'image/jpeg' };
    if (cleanHint.includes('webp')) return { ext: 'webp', mime: 'image/webp' };

    return null;
}
exports.detectImageType = detectImageType;

function saveDeliveryImageBase64(base64Data, prefix = 'item_photo') {
    if (!base64Data || typeof base64Data !== 'string') return '';
    if (base64Data.startsWith('/api/') || base64Data.startsWith('http://') || base64Data.startsWith('https://')) {
        return base64Data;
    }

    let mimeHint = '';
    let rawBase64 = base64Data;

    const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (matches && matches.length === 3) {
        mimeHint = matches[1];
        rawBase64 = matches[2];
    }

    const buffer = Buffer.from(rawBase64, 'base64');
    if (buffer.length === 0) {
        throw new AppError_1.ValidationError('Uploaded image file is empty.');
    }

    if (buffer.length > MAX_IMAGE_SIZE_BYTES) {
        throw new AppError_1.ValidationError(`Image file size (${Math.round(buffer.length / 1024 / 1024)}MB) exceeds maximum limit of 10MB.`);
    }

    const imageType = detectImageType(buffer, mimeHint);
    if (!imageType) {
        throw new AppError_1.ValidationError('Please upload a valid image file (JPG, PNG, or WEBP). Documents or other file formats are not permitted.');
    }

    const filename = `${prefix}_${Date.now()}_${crypto_1.default.randomBytes(6).toString('hex')}.${imageType.ext}`;
    const filePath = path_1.default.join(DELIVERY_ITEMS_DIR, filename);
    fs_1.default.writeFileSync(filePath, buffer);

    return `/api/v1/deliveries/images/${filename}`;
}
exports.saveDeliveryImageBase64 = saveDeliveryImageBase64;

function getDeliveryImageFilePath(filename) {
    const safeName = path_1.default.basename(filename);
    const fullPath = path_1.default.join(DELIVERY_ITEMS_DIR, safeName);
    if (fs_1.default.existsSync(fullPath)) {
        return fullPath;
    }
    return null;
}
exports.getDeliveryImageFilePath = getDeliveryImageFilePath;
