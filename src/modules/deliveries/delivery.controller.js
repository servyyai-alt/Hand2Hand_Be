"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeliveryController = void 0;
const delivery_service_1 = require("./delivery.service");
const response_1 = require("../../utils/response");
const svc = new delivery_service_1.DeliveryService();
class DeliveryController {
    async create(req, res, next) {
        try {
            const result = await svc.createDelivery(req.user.userId, req.body);
            (0, response_1.sendSuccess)(res, result, 'Delivery created', 201);
        }
        catch (err) {
            next(err);
        }
    }
    async getFare(req, res, next) {
        try {
            const { pickup, drop, weight } = req.body;
            const result = await svc.calculateFare(pickup, drop, weight);
            (0, response_1.sendSuccess)(res, result, 'Fare calculated');
        }
        catch (err) {
            next(err);
        }
    }
    async getMyDeliveries(req, res, next) {
        try {
            const { page, limit, status, search } = req.query;
            const result = await svc.getCustomerDeliveries(req.user.userId, {
                page: Number(page) || 1,
                limit: Number(limit) || 20,
                status: status ? String(status) : 'ALL',
                search: search ? String(search) : '',
            });
            (0, response_1.sendSuccess)(res, result, 'Deliveries retrieved');
        }
        catch (err) {
            next(err);
        }
    }
    async getById(req, res, next) {
        try {
            const delivery = await svc.getDeliveryById(req.params.id, req.user.userId, req.user.role);
            (0, response_1.sendSuccess)(res, delivery, 'Delivery retrieved');
        }
        catch (err) {
            next(err);
        }
    }
    async getTracking(req, res, next) {
        try {
            const tracking = await svc.getDeliveryTracking(req.params.id, req.user.userId, req.user.role);
            (0, response_1.sendSuccess)(res, tracking, 'Tracking retrieved');
        }
        catch (err) {
            next(err);
        }
    }
    async cancel(req, res, next) {
        try {
            const { reason } = req.body;
            const result = await svc.cancelDelivery(req.params.id, req.user.userId, req.user.role, reason);
            (0, response_1.sendSuccess)(res, result, 'Delivery cancelled');
        }
        catch (err) {
            next(err);
        }
    }
    async submitRating(req, res, next) {
        try {
            const { rating, feedback } = req.body;
            const result = await svc.submitDeliveryRating(req.params.id, req.user.userId, rating, feedback);
            (0, response_1.sendSuccess)(res, result, 'Rating submitted');
        }
        catch (err) {
            next(err);
        }
    }
    async uploadImage(req, res, next) {
        try {
            const { image, prefix } = req.body;
            if (!image) {
                return res.status(400).json({ success: false, error: { message: 'Image data is required.' } });
            }
            const { saveDeliveryImageBase64 } = require('../../utils/deliveryImage.util');
            const imageUrl = saveDeliveryImageBase64(image, prefix || 'item_photo');
            (0, response_1.sendSuccess)(res, { imageUrl }, 'Image uploaded successfully', 201);
        }
        catch (err) {
            next(err);
        }
    }
    async serveDeliveryImage(req, res, next) {
        try {
            const { filename } = req.params;
            const { getDeliveryImageFilePath } = require('../../utils/deliveryImage.util');
            const filePath = getDeliveryImageFilePath(filename);
            if (!filePath) {
                return res.status(404).json({ success: false, error: { message: 'Image not found' } });
            }

            // Check authorization: Admin, or Customer/Partner associated with the delivery
            const role = req.user?.role;
            const userId = req.user?.userId;
            if (!['ADMIN', 'SUPER_ADMIN'].includes(role)) {
                const { DeliveryModel } = require('./delivery.model');
                const delivery = await DeliveryModel.findOne({
                    $or: [
                        { 'itemVerification.originalImage': { $regex: filename } },
                        { 'itemVerification.pickupImage': { $regex: filename } },
                        { 'itemVerification.mismatchEvidenceImage': { $regex: filename } },
                        { itemPhoto: { $regex: filename } },
                    ]
                }).select('customer partner');

                if (delivery) {
                    const isCustomer = delivery.customer?.toString() === userId;
                    const isPartner = delivery.partner?.toString() === userId;
                    if (!isCustomer && !isPartner) {
                        return res.status(403).json({ success: false, error: { message: 'Unauthorized to view this item photograph.' } });
                    }
                }
            }

            res.sendFile(filePath);
        }
        catch (err) {
            next(err);
        }
    }
}
exports.DeliveryController = DeliveryController;
