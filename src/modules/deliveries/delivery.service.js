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
const deliveryImage_util_1 = require("../../utils/deliveryImage.util");

const PROHIBITED_KEYWORDS = [
    'explosive', 'weapon', 'gun', 'contraband', 'flammable',
    'narcotic', 'illegal drug', 'firearm', 'ammunition', 'hazardous chemical'
];

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
        const category = data.category || (data.packageDetails?.type === 'DOCUMENT' ? 'DOCUMENTS' : (data.packageDetails?.type || 'PARCEL'));
        const description = data.description || data.packageDetails?.description || 'Package Delivery';
        const itemName = data.itemName || data.packageDetails?.name || description;
        const handlingInstructions = data.handlingInstructions || data.packageDetails?.handlingInstructions || '';

        // Check prohibited items policy
        const contentToCheck = `${category} ${description} ${itemName} ${handlingInstructions}`.toLowerCase();
        for (const keyword of PROHIBITED_KEYWORDS) {
            if (contentToCheck.includes(keyword)) {
                throw new AppError_1.ValidationError(`The item description or category contains prohibited goods ("${keyword}"). H2H strictly prohibits dangerous, hazardous, or illegal goods.`);
            }
        }

        // Validate mandatory product photograph
        const rawPhoto = data.itemPhoto || data.originalImage || data.packageDetails?.photo;
        if (!rawPhoto || String(rawPhoto).trim() === '') {
            throw new AppError_1.ValidationError('A clear photograph of the product/item is mandatory for booking and pickup verification.');
        }

        let savedPhotoUrl = rawPhoto;
        if (typeof rawPhoto === 'string' && (rawPhoto.startsWith('data:image') || !rawPhoto.startsWith('/api/'))) {
            savedPhotoUrl = (0, deliveryImage_util_1.saveDeliveryImageBase64)(rawPhoto, 'item_orig');
        }

        const txnId = `TXN-H2H-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

        const delivery = await delivery_model_1.DeliveryModel.create({
            customer: customerId,
            ...data,
            category,
            itemName,
            description,
            handlingInstructions,
            itemPhoto: savedPhotoUrl,
            itemVerification: {
                originalImage: savedPhotoUrl,
                originalUploadedAt: new Date(),
                originalUploadedBy: customerId,
                handlingInstructions,
                status: 'PENDING',
                mismatchReason: 'NONE',
                reviewStatus: 'NONE',
            },
            fare: {
                base: fareData.base, perKm: fareData.perKm,
                weightCharge: fareData.weightCharge, discount: 0, total: fareData.total, currency: 'INR',
            },
            distance: fareData.distance,
            duration: fareData.duration,
            pickupOTP,
            deliveryOTP,
            status: 'CREATED',
            statusHistory: [{ status: 'CREATED', timestamp: new Date(), note: 'Delivery requested by customer' }],
            payment: data.payment || {
                method: 'UPI',
                status: 'PAID',
                transactionId: txnId,
                paidAt: new Date(),
            },
        });
        logger_1.logger.info(`Delivery created: ${delivery.trackingId}`);
        return delivery;
    }
    async getCustomerDeliveries(customerId, { page = 1, limit = 20, status = 'ALL', search = '' } = {}) {
        const { skip, page: pg, limit: lm } = (0, pagination_util_1.getPagination)({ page, limit });
        const query = { customer: customerId };
        const statusUpper = String(status || 'ALL').toUpperCase();

        if (statusUpper === 'ACTIVE') {
            query.status = { $in: ['CREATED', 'PARTNER_ASSIGNED', 'ARRIVED_AT_PICKUP', 'ITEM_MISMATCH', 'PICKED_UP', 'IN_TRANSIT'] };
        } else if (statusUpper === 'COMPLETED') {
            query.status = 'DELIVERED';
        } else if (statusUpper === 'CANCELLED') {
            query.status = { $in: ['CANCELLED', 'FAILED'] };
        }

        if (search && String(search).trim()) {
            const s = String(search).trim();
            query.$or = [
                { trackingId: { $regex: s, $options: 'i' } },
                { itemName: { $regex: s, $options: 'i' } },
                { description: { $regex: s, $options: 'i' } },
                { category: { $regex: s, $options: 'i' } },
                { 'pickup.address': { $regex: s, $options: 'i' } },
                { 'drop.address': { $regex: s, $options: 'i' } },
            ];
        }

        const [data, total, activeCount, completedCount, cancelledCount] = await Promise.all([
            delivery_model_1.DeliveryModel.find(query)
                .populate('partner', 'name phone')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(lm)
                .lean(),
            delivery_model_1.DeliveryModel.countDocuments(query),
            delivery_model_1.DeliveryModel.countDocuments({ customer: customerId, status: { $in: ['CREATED', 'PARTNER_ASSIGNED', 'ARRIVED_AT_PICKUP', 'ITEM_MISMATCH', 'PICKED_UP', 'IN_TRANSIT'] } }),
            delivery_model_1.DeliveryModel.countDocuments({ customer: customerId, status: 'DELIVERED' }),
            delivery_model_1.DeliveryModel.countDocuments({ customer: customerId, status: { $in: ['CANCELLED', 'FAILED'] } }),
        ]);

        for (const item of data) {
            if (item.partner && item.partner._id) {
                const partnerProfile = await partnerProfile_model_1.PartnerProfileModel.findOne({ userId: item.partner._id }).select('vehicle rating totalRatings isOnline').lean();
                if (partnerProfile) {
                    item.partner.vehicle = partnerProfile.vehicle;
                    item.partner.rating = partnerProfile.rating;
                    item.partner.totalRatings = partnerProfile.totalRatings;
                    item.partner.isOnline = partnerProfile.isOnline;
                }
            }
        }

        return {
            data,
            pagination: (0, pagination_util_1.buildPaginationMeta)(total, pg, lm),
            summary: {
                activeCount,
                completedCount,
                cancelledCount,
                totalCount: activeCount + completedCount + cancelledCount,
            },
        };
    }
    async getDeliveryById(deliveryId, userId, role) {
        const delivery = await delivery_model_1.DeliveryModel.findById(deliveryId)
            .select('+deliveryOTP')
            .populate('customer', 'name phone email')
            .populate('partner', 'name phone');
        if (!delivery)
            throw new AppError_1.NotFoundError('Delivery');
        // Authorization
        if (role === 'CUSTOMER' && delivery.customer._id.toString() !== userId) {
            throw new AppError_1.AppError('Access denied', 403, 'FORBIDDEN');
        }
        if (role === 'DELIVERY_PARTNER' && delivery.partner?._id.toString() !== userId) {
            throw new AppError_1.AppError('Access denied', 403, 'FORBIDDEN');
        }

        const obj = delivery.toObject();
        if (role === 'CUSTOMER') {
            obj.senderOTP = delivery.deliveryOTP;
            obj.deliveryOTP = delivery.deliveryOTP;
        }
        if (delivery.partner && delivery.partner._id) {
            const partnerProfile = await partnerProfile_model_1.PartnerProfileModel.findOne({ userId: delivery.partner._id }).select('vehicle rating totalRatings isOnline currentLocation').lean();
            if (partnerProfile) {
                obj.partnerDetails = {
                    name: delivery.partner.name,
                    phone: delivery.partner.phone,
                    vehicle: partnerProfile.vehicle,
                    rating: partnerProfile.rating,
                    totalRatings: partnerProfile.totalRatings,
                    isOnline: partnerProfile.isOnline,
                };
            }
        }
        return obj;
    }
    async getDeliveryTracking(deliveryId, userId, role) {
        const delivery = await delivery_model_1.DeliveryModel.findById(deliveryId)
            .select('+deliveryOTP')
            .populate('partner', 'name phone');
        if (!delivery)
            throw new AppError_1.NotFoundError('Delivery');
        if (role === 'CUSTOMER' && delivery.customer.toString() !== userId) {
            throw new AppError_1.AppError('Access denied', 403, 'FORBIDDEN');
        }

        let partnerInfo = null;
        let partnerLocation = null;
        if (delivery.partner) {
            const partnerProfile = await partnerProfile_model_1.PartnerProfileModel.findOne({ userId: delivery.partner._id }).select('vehicle rating totalRatings isOnline currentLocation').lean();
            if (partnerProfile) {
                partnerInfo = {
                    name: delivery.partner.name,
                    phone: delivery.partner.phone,
                    vehicle: partnerProfile.vehicle,
                    rating: partnerProfile.rating,
                    isOnline: partnerProfile.isOnline,
                };
                if (partnerProfile.currentLocation && Array.isArray(partnerProfile.currentLocation.coordinates) && partnerProfile.currentLocation.coordinates.length >= 2) {
                    partnerLocation = {
                        lng: partnerProfile.currentLocation.coordinates[0],
                        lat: partnerProfile.currentLocation.coordinates[1],
                    };
                }
            }
        }

        let stageMessage = 'Delivery request placed. Looking for nearby delivery partner...';
        switch (delivery.status) {
            case 'CREATED':
                stageMessage = 'Delivery requested. Searching for nearby delivery partner...';
                break;
            case 'PARTNER_ASSIGNED':
                stageMessage = 'Delivery hero assigned! Partner is going to the Recipient to collect your product.';
                break;
            case 'ARRIVED_AT_PICKUP':
                stageMessage = 'Partner has arrived at Recipient location to verify and collect your product.';
                break;
            case 'ITEM_MISMATCH':
                stageMessage = `Order on hold: Partner reported an item mismatch (${delivery.itemVerification?.mismatchReason || 'Under review'}). Delivery paused for support investigation.`;
                break;
            case 'PICKED_UP':
                stageMessage = 'Product verified & collected from Recipient! Partner is heading to your delivery address.';
                break;
            case 'IN_TRANSIT':
                stageMessage = 'Partner is in transit to your delivery address with your product.';
                break;
            case 'DELIVERED':
                stageMessage = 'Product successfully delivered to you!';
                break;
            case 'CANCELLED':
                stageMessage = `Order cancelled. Reason: ${delivery.cancellationReason || 'Cancelled'}`;
                break;
        }

        // Live coordinate resolution
        const effectiveLocation = delivery.lastLocation?.lat
            ? {
                lat: delivery.lastLocation.lat,
                lng: delivery.lastLocation.lng,
                heading: delivery.lastLocation.heading,
                speed: delivery.lastLocation.speed,
                accuracy: delivery.lastLocation.accuracy,
                updatedAt: delivery.lastLocation.updatedAt,
            }
            : partnerLocation;

        // Reliable ETA calculation based on real coordinates
        let liveDistanceKm = delivery.distance || 0;
        let liveEstimatedMinutes = Math.max(5, delivery.duration || 15);
        if (effectiveLocation?.lat && effectiveLocation?.lng) {
            const R = 6371;
            const target = (delivery.status === 'IN_TRANSIT' || delivery.status === 'PICKED_UP')
                ? delivery.drop.coordinates
                : delivery.pickup.coordinates;
            if (target?.lat && target?.lng) {
                const dLat = (target.lat - effectiveLocation.lat) * Math.PI / 180;
                const dLon = (target.lng - effectiveLocation.lng) * Math.PI / 180;
                const a = Math.sin(dLat / 2) ** 2 + Math.cos(effectiveLocation.lat * Math.PI / 180) * Math.cos(target.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
                const remaining = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                liveDistanceKm = Math.round(remaining * 10) / 10;
                liveEstimatedMinutes = Math.max(3, Math.round(remaining * 3.5));
            }
        }

        return {
            deliveryId: delivery._id,
            trackingId: delivery.trackingId,
            status: delivery.status,
            stageMessage,
            estimatedMinutes: liveEstimatedMinutes,
            distanceKm: liveDistanceKm,
            pickup: delivery.pickup,
            drop: delivery.drop,
            statusHistory: delivery.statusHistory,
            partner: partnerInfo,
            partnerLocation: effectiveLocation,
            lastLocation: delivery.lastLocation || null,
            senderOTP: role === 'CUSTOMER' ? delivery.deliveryOTP : undefined,
            deliveryOTP: role === 'CUSTOMER' ? delivery.deliveryOTP : undefined,
            itemVerification: delivery.itemVerification || null,
            itemName: delivery.itemName || delivery.description,
            handlingInstructions: delivery.handlingInstructions || delivery.itemVerification?.handlingInstructions || '',
            itemPhoto: delivery.itemPhoto || delivery.itemVerification?.originalImage || '',
            lastUpdated: (delivery.lastLocation?.updatedAt || delivery.updatedAt || new Date()).toISOString(),
        };
    }
    async cancelDelivery(deliveryId, userId, role, reason) {
        const delivery = await delivery_model_1.DeliveryModel.findById(deliveryId);
        if (!delivery)
            throw new AppError_1.NotFoundError('Delivery');
        if (role === 'CUSTOMER' && delivery.customer.toString() !== userId) {
            throw new AppError_1.AppError('Access denied', 403, 'FORBIDDEN');
        }
        const cancellableStatuses = ['CREATED', 'SEARCHING_PARTNER', 'PARTNER_ASSIGNED', 'PARTNER_ARRIVING', 'ARRIVED_AT_PICKUP'];
        if (!cancellableStatuses.includes(delivery.status)) {
            throw new AppError_1.AppError('Delivery cannot be cancelled at this stage', 400, 'CANNOT_CANCEL');
        }
        delivery.cancellationReason = reason || 'Cancelled by customer';
        if (delivery.payment && delivery.payment.status === 'PAID') {
            delivery.payment.status = 'REFUNDED';
        }
        delivery.transitionStatus('CANCELLED', reason);
        await delivery.save();
        return delivery;
    }
    async submitDeliveryRating(deliveryId, userId, rating, feedback) {
        const delivery = await delivery_model_1.DeliveryModel.findById(deliveryId);
        if (!delivery)
            throw new AppError_1.NotFoundError('Delivery');
        if (delivery.customer.toString() !== userId) {
            throw new AppError_1.AppError('Access denied', 403, 'FORBIDDEN');
        }
        if (delivery.status !== 'DELIVERED') {
            throw new AppError_1.AppError('Only completed deliveries can be rated', 400, 'DELIVERY_NOT_COMPLETED');
        }
        if (delivery.rating && delivery.rating.rating) {
            throw new AppError_1.AppError('This delivery has already been rated', 400, 'ALREADY_RATED');
        }
        const ratingNum = Math.min(5, Math.max(1, Math.round(Number(rating))));
        delivery.rating = {
            rating: ratingNum,
            feedback: feedback ? String(feedback).trim() : '',
            createdAt: new Date(),
        };
        await delivery.save();

        if (delivery.partner) {
            const partnerProfile = await partnerProfile_model_1.PartnerProfileModel.findOne({ userId: delivery.partner });
            if (partnerProfile) {
                const count = partnerProfile.totalRatings || 0;
                const prevRating = partnerProfile.rating || 0;
                const newCount = count + 1;
                const newAvg = Math.round(((prevRating * count + ratingNum) / newCount) * 10) / 10;
                partnerProfile.totalRatings = newCount;
                partnerProfile.rating = newAvg;
                await partnerProfile.save();
            }
        }
        return { success: true, message: 'Rating submitted successfully', rating: delivery.rating };
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
