"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentController = void 0;
const payment_service_1 = require("./payment.service");
const response_1 = require("../../utils/response");

const paymentService = new payment_service_1.PaymentService();

class PaymentController {
    async getSummary(req, res, next) {
        try {
            const summary = await paymentService.getPaymentSummary(req.user.userId);
            (0, response_1.sendSuccess)(res, summary, 'Payment summary retrieved successfully');
        } catch (err) {
            next(err);
        }
    }

    async getHistory(req, res, next) {
        try {
            const result = await paymentService.getPaymentHistory(req.user.userId, req.query);
            (0, response_1.sendSuccess)(res, result, 'Payment history retrieved successfully');
        } catch (err) {
            next(err);
        }
    }

    async getById(req, res, next) {
        try {
            const payment = await paymentService.getPaymentById(req.user.userId, req.params.id);
            (0, response_1.sendSuccess)(res, payment, 'Payment details retrieved successfully');
        } catch (err) {
            next(err);
        }
    }

    async getInvoice(req, res, next) {
        try {
            const invoice = await paymentService.getPaymentInvoice(req.user.userId, req.params.id);
            (0, response_1.sendSuccess)(res, invoice, 'Invoice data generated successfully');
        } catch (err) {
            next(err);
        }
    }
}

exports.PaymentController = PaymentController;
