"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectFileType = exports.validateAndSaveKycDocument = exports.getKycFilePath = exports.saveKycBase64 = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const AppError_1 = require("../errors/AppError");

const SECURE_KYC_DIR = path_1.default.join(__dirname, '../../uploads/secure-kyc');
if (!fs_1.default.existsSync(SECURE_KYC_DIR)) {
    fs_1.default.mkdirSync(SECURE_KYC_DIR, { recursive: true });
}

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB

function detectFileType(buffer, mimeHint = '') {
    if (!buffer || buffer.length < 4) return null;

    // PDF magic bytes: %PDF (0x25 0x50 0x44 0x46)
    if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
        return { ext: 'pdf', mime: 'application/pdf' };
    }

    // JPEG magic bytes: 0xFF 0xD8 0xFF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
        return { ext: 'jpg', mime: 'image/jpeg' };
    }

    // PNG magic bytes: 0x89 0x50 0x4E 0x47
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
        return { ext: 'png', mime: 'image/png' };
    }

    // WEBP magic bytes: RIFF....WEBP
    if (
        buffer.length >= 12 &&
        buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
        buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
    ) {
        return { ext: 'webp', mime: 'image/webp' };
    }

    // Fallback to mimeHint if valid
    const cleanHint = (mimeHint || '').toLowerCase();
    if (cleanHint.includes('pdf')) return { ext: 'pdf', mime: 'application/pdf' };
    if (cleanHint.includes('png')) return { ext: 'png', mime: 'image/png' };
    if (cleanHint.includes('jpeg') || cleanHint.includes('jpg')) return { ext: 'jpg', mime: 'image/jpeg' };
    if (cleanHint.includes('webp')) return { ext: 'webp', mime: 'image/webp' };

    return null;
}
exports.detectFileType = detectFileType;

function saveKycBase64(base64Data, prefix = 'doc') {
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
        throw new AppError_1.ValidationError('Uploaded file is empty.');
    }

    if (buffer.length > MAX_FILE_SIZE_BYTES) {
        throw new AppError_1.ValidationError(`File size (${Math.round(buffer.length / 1024 / 1024)}MB) exceeds maximum limit of 15MB.`);
    }

    const fileType = detectFileType(buffer, mimeHint);
    if (!fileType) {
        throw new AppError_1.ValidationError('Please upload a valid JPG, PNG, or PDF file.');
    }

    // Profile photo cannot be PDF
    if (prefix === 'profile' && fileType.ext === 'pdf') {
        throw new AppError_1.ValidationError('Profile photo must be an image (JPG, PNG, or WEBP). PDF is not accepted for profile photos.');
    }

    const filename = `${prefix}_${Date.now()}_${crypto_1.default.randomBytes(6).toString('hex')}.${fileType.ext}`;
    const filePath = path_1.default.join(SECURE_KYC_DIR, filename);
    fs_1.default.writeFileSync(filePath, buffer);

    return `/api/v1/admin/documents/${filename}`;
}
exports.saveKycBase64 = saveKycBase64;
exports.validateAndSaveKycDocument = saveKycBase64;

function getKycFilePath(filename) {
    const safeName = path_1.default.basename(filename);
    const fullPath = path_1.default.join(SECURE_KYC_DIR, safeName);
    if (fs_1.default.existsSync(fullPath)) {
        return fullPath;
    }
    return null;
}
exports.getKycFilePath = getKycFilePath;
