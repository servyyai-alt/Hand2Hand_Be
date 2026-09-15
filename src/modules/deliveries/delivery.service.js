"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeliveryService = void 0;
const delivery_model_1 = require("./delivery.model");
const pricing_model_1 = require("../pricing/pricing.model");
const partnerProfile_model_1 = require("../partners/partnerProfile.model");
const AppError_1 = require("../../errors/AppError");
const pagination_util_1 = require("../../utils/pagination.util");
const otp_util_1 = require("../../utils/otp.util");
const env_1 = require("../../config/env");
const logger_1 = require("../../utils/logger");
class DeliveryService {
    async calculateFare(pickup, drop, weight = 0, cityId = 'VLR') {
        const pricing = await pricing_model_1.PricingModel.findOne({ cityId, isActive: true });
        if (!pricing)
            throw new AppError_1.AppError('Pricing not configured for this area', 400, 'NO_PRICING');
        // Haversine distance
        const R = 6371;
        const dLat = (drop.lat - pickup.lat) * Math.PI / 180;
        const dLon = (drop.lng - pickup.lng) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(pickup.lat * Math.PI / 180) * Math.cos(drop.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
        const distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const isNight = new Date().getHours() >= 22 || new Date().getHours() < 6;
        const extraKm = Math.max(0, distance - pricing.baseDistanceKm);
        const base = pricing.baseFare + (extraKm * pricing.perKmFare);
        const weightCharge = weight > 5 ? (weight - 5) * pricing.weightChargePerKg : 0;
        const nightAdd = isNight ? (base * pricing.nightSurcharge) : 0;
        const subtotal = base + weightCharge + nightAdd;
        const total = Math.max(pricing.minimumFare, Math.round(subtotal));
        return {
            base: Math.round(base),
            perKm: Math.round(extraKm * pricing.perKmFare),
            weightCharge: Math.round(weightCharge),
            discount: 0,
            total,
            currency: 'INR',
            distance: Math.round(distance * 100) / 100,
            duration: Math.round(distance * 3),
        };
    }
    async createDelivery(customerId, data) {
        const fareData = await this.calculateFare(data.pickup.coordinates, data.drop.coordinates, data.weight);
        const pickupOTP = (0, otp_util_1.generateOTP)(4);
        const deliveryOTP = (0, otp_util_1.generateOTP)(4);
        const delivery = await delivery_model_1.DeliveryModel.create({
            customer: customerId,
            ...data,
            fare: {
                base: fareData.base, perKm: fareData.perKm,
                weightCharge: fareData.weightCharge, discount: 0, total: fareData.total, currency: 'INR',
            },
            distance: fareData.distance,
            duration: fareData.duration,
            pickupOTP,
            deliveryOTP,
            status: 'CREATED',
            statusHistory: [{ status: 'CREATED', timestamp: new Date() }],
        });
        // TODO: Emit socket event to trigger partner search
        logger_1.logger.info(`Delivery created: ${delivery.trackingId}`);
        return delivery;
    }
    async getCustomerDeliveries(customerId, page = 1, limit = 20) {
        const { skip, page: pg, limit: lm } = (0, pagination_util_1.getPagination)({ page, limit });
        const [data, total] = await Promise.all([
            delivery_model_1.DeliveryModel.find({ customer: customerId }).sort({ createdAt: -1 }).skip(skip).limit(lm).lean(),
            delivery_model_1.DeliveryModel.countDocuments({ customer: customerId }),
        ]);
        return { data, pagination: (0, pagination_util_1.buildPaginationMeta)(total, pg, lm) };
    }
    async getDeliveryById(deliveryId, userId, role) {
        const delivery = await delivery_model_1.DeliveryModel.findById(deliveryId)
            .populate('customer', 'name phone')
            .populate('partner', 'name phone');
        if (!delivery)
            throw new AppError_1.NotFoundError('Delivery');
        // Authorization: customer can only see own deliveries; partner can only see assigned
        if (role === 'CUSTOMER' && delivery.customer._id.toString() !== userId) {
            throw new AppError_1.AppError('Access denied', 403, 'FORBIDDEN');
        }
        if (role === 'DELIVERY_PARTNER' && delivery.partner?._id.toString() !== userId) {
            throw new AppError_1.AppError('Access denied', 403, 'FORBIDDEN');
        }
        return delivery;
    }
    async cancelDelivery(deliveryId, userId, role, reason) {
        const delivery = await delivery_model_1.DeliveryModel.findById(deliveryId);
        if (!delivery)
            throw new AppError_1.NotFoundError('Delivery');
        if (role === 'CUSTOMER' && delivery.customer.toString() !== userId) {
            throw new AppError_1.AppError('Access denied', 403, 'FORBIDDEN');
        }
        const cancellableStatuses = ['CREATED', 'SEARCHING_PARTNER', 'PARTNER_ASSIGNED', 'PARTNER_ARRIVING'];
        if (!cancellableStatuses.includes(delivery.status)) {
            throw new AppError_1.AppError('Delivery cannot be cancelled at this stage', 400, 'CANNOT_CANCEL');
        }
        delivery.transitionStatus('CANCELLED', reason);
        await delivery.save();
        return delivery;
    }
    async getPartnerDeliveries(partnerId, page = 1, limit = 20) {
        const { skip, page: pg, limit: lm } = (0, pagination_util_1.getPagination)({ page, limit });
        const [data, total] = await Promise.all([
            delivery_model_1.DeliveryModel.find({ partner: partnerId, status: { $in: ['DELIVERED', 'CANCELLED'] } })
                .sort({ createdAt: -1 }).skip(skip).limit(lm).lean(),
            delivery_model_1.DeliveryModel.countDocuments({ partner: partnerId }),
        ]);
        return { data, pagination: (0, pagination_util_1.buildPaginationMeta)(total, pg, lm) };
    }
    async findAvailablePartners(pickup) {
        const radiusKm = Number(env_1.env.PARTNER_SEARCH_RADIUS_KM);
        return partnerProfile_model_1.PartnerProfileModel.find({
            isOnline: true,
            isAvailable: true,
            kycStatus: 'APPROVED',
            currentLocation: {
                $near: {
                    $geometry: { type: 'Point', coordinates: [pickup.lng, pickup.lat] },
                    $maxDistance: radiusKm * 1000,
                },
            },
        }).limit(10).populate('userId', 'name phone').lean();
    }
}
exports.DeliveryService = DeliveryService;
