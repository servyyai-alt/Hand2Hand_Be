"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.PartnerController = void 0;
const partnerProfile_model_1 = require("./partnerProfile.model");
const response_1 = require("../../utils/response");
const AppError_1 = require("../../errors/AppError");
class PartnerController {
    async getProfile(req, res, next) {
        try {
            const profile = await partnerProfile_model_1.PartnerProfileModel.findOne({ userId: req.user.userId }).populate('userId', 'name phone email');
            if (!profile)
                throw new AppError_1.NotFoundError('Partner profile');
            (0, response_1.sendSuccess)(res, profile, 'Profile loaded');
        }
        catch (err) {
            next(err);
        }
    }
    async setAvailability(req, res, next) {
        try {
            const { isOnline } = req.body;
            const profile = await partnerProfile_model_1.PartnerProfileModel.findOneAndUpdate({ userId: req.user.userId }, { isOnline, isAvailable: isOnline }, { new: true });
            (0, response_1.sendSuccess)(res, profile, `Status: ${isOnline ? 'online' : 'offline'}`);
        }
        catch (err) {
            next(err);
        }
    }
    async getEarnings(req, res, next) {
        try {
            const profile = await partnerProfile_model_1.PartnerProfileModel.findOne({ userId: req.user.userId });
            (0, response_1.sendSuccess)(res, {
                totalEarnings: profile?.totalEarnings ?? 0,
                walletBalance: profile?.walletBalance ?? 0,
                rating: profile?.rating ?? 0,
                completionRate: profile?.completionRate ?? 0,
                totalDeliveries: profile?.totalDeliveries ?? 0,
                todayEarnings: 0,
                todayDeliveries: 0,
                avgEarningsPerDelivery: 0,
                totalDistance: 0,
            }, 'Earnings loaded');
        }
        catch (err) {
            next(err);
        }
    }
    async getDeliveries(req, res, next) {
        try {
            const { DeliveryService } = await Promise.resolve().then(() => __importStar(require('../deliveries/delivery.service')));
            const svc = new DeliveryService();
            const { page, limit } = req.query;
            const result = await svc.getPartnerDeliveries(req.user.userId, Number(page) || 1, Number(limit) || 20);
            (0, response_1.sendSuccess)(res, result, 'Deliveries loaded');
        }
        catch (err) {
            next(err);
        }
    }
}
exports.PartnerController = PartnerController;
