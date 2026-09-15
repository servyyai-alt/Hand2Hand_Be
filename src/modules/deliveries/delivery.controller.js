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
            const { page, limit } = req.query;
            const result = await svc.getCustomerDeliveries(req.user.userId, Number(page) || 1, Number(limit) || 20);
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
}
exports.DeliveryController = DeliveryController;
