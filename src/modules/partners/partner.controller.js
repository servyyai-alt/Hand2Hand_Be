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
const delivery_model_1 = require("../deliveries/delivery.model");
const response_1 = require("../../utils/response");
const AppError_1 = require("../../errors/AppError");
const pagination_util_1 = require("../../utils/pagination.util");

class PartnerController {
    async getProfile(req, res, next) {
        try {
            let profile = await partnerProfile_model_1.PartnerProfileModel.findOne({ userId: req.user.userId }).populate('userId', 'name phone email avatar role status approvalStatus adminApprovalStatus superAdminApprovalStatus accountStatus isActive canWork canAcceptDeliveries rejectionReason');
            if (!profile) {
                profile = await partnerProfile_model_1.PartnerProfileModel.create({
                    userId: req.user.userId,
                    isOnline: false,
                    isAvailable: false,
                    kycStatus: 'PENDING',
                    vehicle: {
                        type: 'MOTORCYCLE',
                        make: '',
                        model: '',
                        registrationNumber: '',
                    },
                });
                profile = await partnerProfile_model_1.PartnerProfileModel.findById(profile._id).populate('userId', 'name phone email avatar role status approvalStatus adminApprovalStatus superAdminApprovalStatus accountStatus isActive canWork canAcceptDeliveries rejectionReason');
            }
            (0, response_1.sendSuccess)(res, profile, 'Profile loaded');
        }
        catch (err) {
            next(err);
        }
    }

    async setAvailability(req, res, next) {
        try {
            const { isOnline } = req.body;
            let profile = await partnerProfile_model_1.PartnerProfileModel.findOne({ userId: req.user.userId });
            if (!profile) {
                profile = await partnerProfile_model_1.PartnerProfileModel.create({
                    userId: req.user.userId,
                    isOnline: false,
                    isAvailable: false,
                    kycStatus: 'PENDING',
                });
            } else {
                if (profile.kycStatus === 'REJECTED') {
                    throw new AppError_1.AppError('Account verification failed. Please contact partner support.', 403, 'KYC_REJECTED');
                }
                profile.isOnline = Boolean(isOnline);
                profile.isAvailable = Boolean(isOnline);
                await profile.save();
            }
            (0, response_1.sendSuccess)(res, profile, `Status: ${isOnline ? 'online' : 'offline'}`);
        }
        catch (err) {
            next(err);
        }
    }

    async getEarnings(req, res, next) {
        try {
            let profile = await partnerProfile_model_1.PartnerProfileModel.findOne({ userId: req.user.userId });
            if (!profile) {
                profile = await partnerProfile_model_1.PartnerProfileModel.create({
                    userId: req.user.userId,
                    isOnline: false,
                    isAvailable: false,
                    kycStatus: 'PENDING',
                });
            }

            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);

            const weekStart = new Date();
            weekStart.setDate(weekStart.getDate() - 7);
            weekStart.setHours(0, 0, 0, 0);

            const [todayDeliveries, weekDeliveries] = await Promise.all([
                delivery_model_1.DeliveryModel.find({
                    partner: req.user.userId,
                    status: 'DELIVERED',
                    updatedAt: { $gte: todayStart }
                }).select('fare distance').lean(),
                delivery_model_1.DeliveryModel.find({
                    partner: req.user.userId,
                    status: 'DELIVERED',
                    updatedAt: { $gte: weekStart }
                }).select('fare distance').lean(),
            ]);

            const todayEarnings = todayDeliveries.reduce((sum, d) => sum + (d.fare?.total || 0), 0);
            const weekEarnings = weekDeliveries.reduce((sum, d) => sum + (d.fare?.total || 0), 0);
            const totalEarnings = profile.totalEarnings || weekEarnings || 0;
            const walletBalance = profile.walletBalance || totalEarnings || 0;
            const totalDeliveries = profile.totalDeliveries || todayDeliveries.length || 0;

            (0, response_1.sendSuccess)(res, {
                totalEarnings,
                walletBalance,
                rating: profile.rating || 4.9,
                completionRate: profile.completionRate || 98,
                totalDeliveries,
                todayEarnings,
                todayDeliveries: todayDeliveries.length,
                weekEarnings,
                avgEarningsPerDelivery: totalDeliveries > 0 ? Math.round(totalEarnings / totalDeliveries) : 0,
                totalDistance: todayDeliveries.reduce((sum, d) => sum + (d.distance || 0), 0),
            }, 'Earnings loaded');
        }
        catch (err) {
            next(err);
        }
    }

    async getDeliveries(req, res, next) {
        try {
            const { page, limit, status } = req.query;
            const { skip, page: pg, limit: lm } = (0, pagination_util_1.getPagination)({ page, limit });

            let query = { partner: req.user.userId };
            if (status === 'ACTIVE') {
                query.status = { $in: ['PARTNER_ASSIGNED', 'ARRIVED_AT_PICKUP', 'PICKED_UP', 'IN_TRANSIT'] };
            } else if (status === 'COMPLETED') {
                query.status = 'DELIVERED';
            } else if (status === 'CANCELLED') {
                query.status = 'CANCELLED';
            } else if (status && status !== 'ALL') {
                query.status = status;
            }

            const [data, total] = await Promise.all([
                delivery_model_1.DeliveryModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(lm).lean(),
                delivery_model_1.DeliveryModel.countDocuments(query),
            ]);

            (0, response_1.sendSuccess)(res, { data, pagination: (0, pagination_util_1.buildPaginationMeta)(total, pg, lm) }, 'Deliveries loaded');
        }
        catch (err) {
            next(err);
        }
    }

    async getAvailableRequests(req, res, next) {
        try {
            const deliveries = await delivery_model_1.DeliveryModel.find({
                status: 'CREATED',
                partner: { $exists: false }
            })
            .sort({ createdAt: -1 })
            .limit(10)
            .lean();

            const requests = deliveries.map(d => ({
                deliveryId: d._id,
                trackingId: d.trackingId,
                pickup: d.pickup,
                drop: d.drop,
                distance: d.distance || 3.5,
                duration: d.duration || 15,
                category: d.category,
                itemName: d.itemName || d.description,
                description: d.description || 'Package parcel',
                handlingInstructions: d.handlingInstructions || d.itemVerification?.handlingInstructions || '',
                itemPhoto: d.itemPhoto || d.itemVerification?.originalImage || '',
                fare: d.fare || { total: 65 },
                pickupDistanceKm: 1.2,
                createdAt: d.createdAt,
            }));

            (0, response_1.sendSuccess)(res, requests, 'Available requests loaded');
        }
        catch (err) {
            next(err);
        }
    }

    async getActiveDelivery(req, res, next) {
        try {
            const isDev = process.env.NODE_ENV !== 'production';
            let query = delivery_model_1.DeliveryModel.findOne({
                partner: req.user.userId,
                status: { $in: ['PARTNER_ASSIGNED', 'ARRIVED_AT_PICKUP', 'ITEM_MISMATCH', 'PICKED_UP', 'IN_TRANSIT'] }
            })
            .populate('customer', 'name phone');

            if (isDev) {
                query = query.select('+pickupOTP');
            }

            const delivery = await query.lean();
            if (delivery && isDev && delivery.pickupOTP) {
                delivery.devRecipientOtp = delivery.pickupOTP;
            }

            (0, response_1.sendSuccess)(res, delivery || null, delivery ? 'Active delivery loaded' : 'No active delivery');
        }
        catch (err) {
            next(err);
        }
    }

    async getDeliveryById(req, res, next) {
        try {
            const isDev = process.env.NODE_ENV !== 'production';
            let query = delivery_model_1.DeliveryModel.findOne({
                _id: req.params.id,
                partner: req.user.userId
            })
            .populate('customer', 'name phone');

            if (isDev) {
                query = query.select('+pickupOTP');
            }

            const delivery = await query.lean();

            if (!delivery) {
                throw new AppError_1.NotFoundError('Delivery not found or not assigned to you');
            }

            if (isDev && delivery.pickupOTP) {
                delivery.devRecipientOtp = delivery.pickupOTP;
            }

            (0, response_1.sendSuccess)(res, delivery, 'Delivery retrieved');
        }
        catch (err) {
            next(err);
        }
    }

    async acceptDelivery(req, res, next) {
        try {
            const activeExisting = await delivery_model_1.DeliveryModel.findOne({
                partner: req.user.userId,
                status: { $in: ['PARTNER_ASSIGNED', 'ARRIVED_AT_PICKUP', 'PICKED_UP', 'IN_TRANSIT'] }
            });

            if (activeExisting) {
                throw new AppError_1.AppError('You already have an active delivery in progress. Complete it first.', 400, 'ACTIVE_DELIVERY_EXISTS');
            }

            const delivery = await delivery_model_1.DeliveryModel.findOne({
                _id: req.params.id,
                status: 'CREATED'
            });

            if (!delivery) {
                throw new AppError_1.AppError('This delivery request is no longer available.', 400, 'REQUEST_UNAVAILABLE');
            }

            delivery.partner = req.user.userId;
            delivery.transitionStatus('PARTNER_ASSIGNED', 'Partner accepted delivery request — traveling to Recipient');
            await delivery.save();

            await partnerProfile_model_1.PartnerProfileModel.findOneAndUpdate(
                { userId: req.user.userId },
                { isAvailable: false }
            );

            (0, response_1.sendSuccess)(res, delivery, 'Delivery accepted');
        }
        catch (err) {
            next(err);
        }
    }

    async arriveAtPickup(req, res, next) {
        try {
            const delivery = await delivery_model_1.DeliveryModel.findOne({
                _id: req.params.id,
                partner: req.user.userId
            }).select('+pickupOTP');

            if (!delivery) {
                throw new AppError_1.NotFoundError('Delivery');
            }

            if (delivery.status !== 'PARTNER_ASSIGNED') {
                throw new AppError_1.AppError(`Cannot mark arrived from status ${delivery.status}`, 400, 'INVALID_TRANSITION');
            }

            delivery.transitionStatus('ARRIVED_AT_PICKUP', 'Partner arrived at Recipient collection location');
            await delivery.save();

            const isDev = process.env.NODE_ENV !== 'production';
            const responseData = delivery.toObject();
            if (isDev) {
                responseData.devRecipientOtp = delivery.pickupOTP;
            }

            (0, response_1.sendSuccess)(res, responseData, 'Marked arrived at Recipient location');
        }
        catch (err) {
            next(err);
        }
    }

    async requestRecipientOTP(req, res, next) {
        try {
            const delivery = await delivery_model_1.DeliveryModel.findOne({
                _id: req.params.id,
                partner: req.user.userId
            }).select('+pickupOTP');

            if (!delivery) {
                throw new AppError_1.NotFoundError('Delivery');
            }

            // In production, an SMS would be dispatched to delivery.pickup.contactPhone
            const isDev = process.env.NODE_ENV !== 'production';
            (0, response_1.sendSuccess)(res, {
                recipientPhone: delivery.pickup.contactPhone,
                devOtp: isDev ? delivery.pickupOTP : undefined,
            }, `Collection OTP dispatched to Recipient at ${delivery.pickup.contactPhone}`);
        }
        catch (err) {
            next(err);
        }
    }

    async verifyPickupOTP(req, res, next) {
        try {
            const { otp } = req.body;
            if (!otp || String(otp).trim().length !== 4) {
                throw new AppError_1.ValidationError('Please enter a valid 4-digit Recipient OTP.');
            }

            const delivery = await delivery_model_1.DeliveryModel.findOne({
                _id: req.params.id,
                partner: req.user.userId
            }).select('+pickupOTP');

            if (!delivery) {
                throw new AppError_1.NotFoundError('Delivery');
            }

            if (!['PARTNER_ASSIGNED', 'ARRIVED_AT_PICKUP'].includes(delivery.status)) {
                throw new AppError_1.AppError(`Cannot verify pickup OTP in status ${delivery.status}`, 400, 'INVALID_STATUS');
            }

            // Strict enforcement of Item Photo Verification before pickup OTP
            if (delivery.status === 'ITEM_MISMATCH') {
                throw new AppError_1.AppError('Cannot verify pickup OTP while delivery has an active item mismatch exception. Awaiting admin/customer review.', 400, 'ITEM_MISMATCH_BLOCK');
            }

            if (delivery.itemVerification?.originalImage) {
                if (delivery.itemVerification.status !== 'VERIFIED' && delivery.itemVerification.status !== 'OVERRIDDEN') {
                    throw new AppError_1.AppError('Mandatory product photograph verification must be completed and confirmed before pickup OTP verification.', 400, 'ITEM_VERIFICATION_REQUIRED');
                }
            }

            if (String(delivery.pickupOTP).trim() !== String(otp).trim()) {
                throw new AppError_1.ValidationError('Invalid Recipient OTP. Please ask the recipient (who has the product) for the 4-digit collection code.');
            }

            delivery.transitionStatus('PICKED_UP', 'Product collected from Recipient and verified with OTP');
            await delivery.save();

            // Notify customer and emit to socket
            try {
                const { emitToDelivery } = require('../../sockets/socket.server');
                emitToDelivery(delivery._id.toString(), 'delivery:pickedUp', {
                    deliveryId: delivery._id,
                    status: 'PICKED_UP',
                });
                const { NotificationModel } = require('../notifications/notification.model');
                await NotificationModel.create({
                    userId: delivery.customer,
                    type: 'ITEM_PICKED_UP',
                    title: 'Item Collected',
                    description: 'Delivery partner has collected the package from recipient and verified the OTP. Heading to delivery destination.',
                    deliveryId: delivery._id,
                    orderRef: delivery.trackingId,
                });
            } catch {}

            (0, response_1.sendSuccess)(res, delivery, 'Product collected successfully. Proceed to Sender location.');
        }
        catch (err) {
            next(err);
        }
    }

    async verifyItem(req, res, next) {
        try {
            const { pickupImage, notes } = req.body;
            if (!pickupImage) {
                throw new AppError_1.ValidationError('Please capture and upload a photograph of the actual item at pickup.');
            }

            const delivery = await delivery_model_1.DeliveryModel.findOne({
                _id: req.params.id,
                partner: req.user.userId
            });

            if (!delivery) {
                throw new AppError_1.NotFoundError('Delivery not found or not assigned to you');
            }

            if (!['PARTNER_ASSIGNED', 'ARRIVED_AT_PICKUP'].includes(delivery.status)) {
                throw new AppError_1.AppError(`Cannot verify item at stage ${delivery.status}`, 400, 'INVALID_STATUS');
            }

            const { saveDeliveryImageBase64 } = require('../../utils/deliveryImage.util');
            const savedPickupUrl = (typeof pickupImage === 'string' && (pickupImage.startsWith('data:image') || !pickupImage.startsWith('/api/')))
                ? saveDeliveryImageBase64(pickupImage, 'item_pickup')
                : pickupImage;

            if (!delivery.itemVerification) {
                delivery.itemVerification = {
                    originalImage: delivery.itemPhoto || '',
                    originalUploadedAt: delivery.createdAt,
                    originalUploadedBy: delivery.customer,
                    status: 'PENDING',
                };
            }

            delivery.itemVerification.pickupImage = savedPickupUrl;
            delivery.itemVerification.pickupUploadedAt = new Date();
            delivery.itemVerification.pickupUploadedBy = req.user.userId;
            delivery.itemVerification.status = 'VERIFIED';
            delivery.itemVerification.verifiedAt = new Date();
            delivery.itemVerification.verifiedBy = req.user.userId;
            delivery.itemVerification.notes = notes || 'Physical item confirmed matching booking reference photo';

            delivery.statusHistory.push({
                status: delivery.status,
                timestamp: new Date(),
                note: 'Physical item photograph verified and confirmed matching by partner',
            });

            await delivery.save();

            // Real-time socket event & notification
            try {
                const { emitToDelivery } = require('../../sockets/socket.server');
                emitToDelivery(delivery._id.toString(), 'delivery:itemVerified', {
                    deliveryId: delivery._id,
                    verification: delivery.itemVerification,
                });
                const { NotificationModel } = require('../notifications/notification.model');
                await NotificationModel.create({
                    userId: delivery.customer,
                    type: 'ITEM_VERIFIED',
                    title: 'Item Photo Verified',
                    description: 'Delivery partner has verified your item against the reference photo at the pickup location.',
                    deliveryId: delivery._id,
                    orderRef: delivery.trackingId,
                });
            } catch {}

            (0, response_1.sendSuccess)(res, delivery, 'Product item verified successfully. You may now enter the collection OTP.');
        }
        catch (err) {
            next(err);
        }
    }

    async reportMismatch(req, res, next) {
        try {
            const { reason, notes, evidenceImage } = req.body;
            const validReasons = ['WRONG_ITEM', 'DAMAGED_ITEM', 'DIFFERENT_SIZE_WEIGHT', 'SUSPICIOUS_PACKAGE', 'OTHER'];
            if (!reason || !validReasons.includes(reason)) {
                throw new AppError_1.ValidationError(`Please select a valid mismatch reason (${validReasons.join(', ')}).`);
            }

            const delivery = await delivery_model_1.DeliveryModel.findOne({
                _id: req.params.id,
                partner: req.user.userId
            });

            if (!delivery) {
                throw new AppError_1.NotFoundError('Delivery not found or not assigned to you');
            }

            if (!['PARTNER_ASSIGNED', 'ARRIVED_AT_PICKUP'].includes(delivery.status)) {
                throw new AppError_1.AppError(`Cannot report mismatch at stage ${delivery.status}`, 400, 'INVALID_STATUS');
            }

            let savedEvidenceUrl = '';
            if (evidenceImage && typeof evidenceImage === 'string') {
                const { saveDeliveryImageBase64 } = require('../../utils/deliveryImage.util');
                savedEvidenceUrl = (evidenceImage.startsWith('data:image') || !evidenceImage.startsWith('/api/'))
                    ? saveDeliveryImageBase64(evidenceImage, 'mismatch_evidence')
                    : evidenceImage;
            }

            if (!delivery.itemVerification) {
                delivery.itemVerification = {
                    originalImage: delivery.itemPhoto || '',
                    originalUploadedAt: delivery.createdAt,
                    originalUploadedBy: delivery.customer,
                };
            }

            delivery.itemVerification.status = 'MISMATCH';
            delivery.itemVerification.mismatchReason = reason;
            delivery.itemVerification.mismatchNotes = notes || '';
            delivery.itemVerification.mismatchEvidenceImage = savedEvidenceUrl;
            delivery.itemVerification.mismatchReportedAt = new Date();
            delivery.itemVerification.mismatchReportedBy = req.user.userId;
            delivery.itemVerification.reviewStatus = 'PENDING_REVIEW';

            delivery.transitionStatus('ITEM_MISMATCH', `Item mismatch reported: ${reason}. ${notes ? `Notes: ${notes}` : ''}`);
            await delivery.save();

            // Real-time socket event & notification
            try {
                const { emitToDelivery } = require('../../sockets/socket.server');
                emitToDelivery(delivery._id.toString(), 'delivery:itemMismatch', {
                    deliveryId: delivery._id,
                    reason,
                    notes,
                    evidenceImage: savedEvidenceUrl,
                    status: 'ITEM_MISMATCH',
                });
                const { NotificationModel } = require('../notifications/notification.model');
                await NotificationModel.create({
                    userId: delivery.customer,
                    type: 'ITEM_MISMATCH',
                    title: 'Item Mismatch Reported',
                    description: `Delivery partner reported an item issue: ${reason.replace(/_/g, ' ')}. Delivery is paused pending review.`,
                    deliveryId: delivery._id,
                    orderRef: delivery.trackingId,
                });
            } catch {}

            (0, response_1.sendSuccess)(res, delivery, 'Item mismatch reported. Order is now on hold for administrative review.');
        }
        catch (err) {
            next(err);
        }
    }

    async updateDeliveryLocation(req, res, next) {
        try {
            const { lat, lng, heading, speed, accuracy } = req.body;
            if (typeof lat !== 'number' || typeof lng !== 'number' || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
                throw new AppError_1.ValidationError('Invalid GPS coordinates (lat must be -90..90, lng must be -180..180).');
            }

            const delivery = await delivery_model_1.DeliveryModel.findOne({
                _id: req.params.id,
                partner: req.user.userId,
            });

            if (!delivery) {
                throw new AppError_1.NotFoundError('Delivery not found or not assigned to you');
            }

            const activeStatuses = ['PARTNER_ASSIGNED', 'ARRIVED_AT_PICKUP', 'PICKED_UP', 'IN_TRANSIT'];
            if (!activeStatuses.includes(delivery.status)) {
                throw new AppError_1.AppError(`Location updates not permitted in status ${delivery.status}`, 400, 'TRACKING_NOT_ACTIVE');
            }

            const locData = {
                lat,
                lng,
                heading: typeof heading === 'number' ? heading : undefined,
                speed: typeof speed === 'number' ? speed : undefined,
                accuracy: typeof accuracy === 'number' ? accuracy : undefined,
                updatedAt: new Date(),
            };

            delivery.lastLocation = locData;
            if (!delivery.locationHistory) delivery.locationHistory = [];
            delivery.locationHistory.push({ lat, lng, timestamp: new Date() });
            if (delivery.locationHistory.length > 50) {
                delivery.locationHistory = delivery.locationHistory.slice(-50);
            }
            await delivery.save();

            await partnerProfile_model_1.PartnerProfileModel.findOneAndUpdate(
                { userId: req.user.userId },
                { 'currentLocation.coordinates': [lng, lat] }
            );

            try {
                const { emitToDelivery } = require('../../sockets/socket.server');
                emitToDelivery(delivery._id.toString(), 'partner:locationUpdated', {
                    deliveryId: delivery._id,
                    coords: locData,
                    timestamp: new Date().toISOString(),
                    status: delivery.status,
                });
            } catch {}

            (0, response_1.sendSuccess)(res, locData, 'Location updated');
        }
        catch (err) {
            next(err);
        }
    }

    async startTransit(req, res, next) {
        try {
            const delivery = await delivery_model_1.DeliveryModel.findOne({
                _id: req.params.id,
                partner: req.user.userId
            });

            if (!delivery) {
                throw new AppError_1.NotFoundError('Delivery');
            }

            if (delivery.status !== 'PICKED_UP') {
                throw new AppError_1.AppError(`Cannot start transit from status ${delivery.status}`, 400, 'INVALID_STATUS');
            }

            delivery.transitionStatus('IN_TRANSIT', 'Partner is in transit to Sender delivery address');
            await delivery.save();

            (0, response_1.sendSuccess)(res, delivery, 'Status updated to In Transit towards Sender');
        }
        catch (err) {
            next(err);
        }
    }

    async verifyDeliveryOTP(req, res, next) {
        try {
            const { otp } = req.body;
            if (!otp || String(otp).trim().length !== 4) {
                throw new AppError_1.ValidationError('Please enter a valid 4-digit Sender Delivery OTP.');
            }

            const delivery = await delivery_model_1.DeliveryModel.findOne({
                _id: req.params.id,
                partner: req.user.userId
            }).select('+deliveryOTP');

            if (!delivery) {
                throw new AppError_1.NotFoundError('Delivery');
            }

            if (!['PICKED_UP', 'IN_TRANSIT'].includes(delivery.status)) {
                throw new AppError_1.AppError(`Cannot verify delivery OTP in status ${delivery.status}`, 400, 'INVALID_STATUS');
            }

            if (String(delivery.deliveryOTP).trim() !== String(otp).trim()) {
                throw new AppError_1.ValidationError('Invalid Sender OTP. Please ask the sender (who created the order) for the 4-digit delivery code shown in their app.');
            }

            delivery.transitionStatus('DELIVERED', 'Product delivered to Sender and verified with OTP');
            await delivery.save();

            const earning = delivery.fare?.total || 50;
            await partnerProfile_model_1.PartnerProfileModel.findOneAndUpdate(
                { userId: req.user.userId },
                {
                    $inc: { totalEarnings: earning, walletBalance: earning, totalDeliveries: 1 },
                    $set: { isAvailable: true }
                }
            );

            // Emit completion and termination of live tracking
            try {
                const { emitToDelivery } = require('../../sockets/socket.server');
                emitToDelivery(delivery._id.toString(), 'delivery:trackingEnded', {
                    deliveryId: delivery._id,
                    status: 'DELIVERED',
                });
                const { NotificationModel } = require('../notifications/notification.model');
                await NotificationModel.create({
                    userId: delivery.customer,
                    type: 'DELIVERED',
                    title: 'Delivery Complete',
                    description: 'Your package has been safely delivered to you and verified.',
                    deliveryId: delivery._id,
                    orderRef: delivery.trackingId,
                });
            } catch {}

            (0, response_1.sendSuccess)(res, delivery, 'Delivery verified and marked completed!');
        }
        catch (err) {
            next(err);
        }
    }
}

exports.PartnerController = PartnerController;
