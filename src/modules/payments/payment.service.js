"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentService = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const delivery_model_1 = require("../deliveries/delivery.model");
const user_model_1 = require("../users/user.model");
const AppError_1 = require("../../errors/AppError");
const pagination_util_1 = require("../../utils/pagination.util");
const logger_1 = require("../../utils/logger");

class PaymentService {
    /**
     * Get aggregated payment summary for the authenticated customer.
     * Calculates total paid, pending amounts, and order counts.
     */
    async getPaymentSummary(customerId) {
        const customerObjId = mongoose_1.default.Types.ObjectId.isValid(customerId)
            ? new mongoose_1.default.Types.ObjectId(customerId)
            : customerId;

        const agg = await delivery_model_1.DeliveryModel.aggregate([
            { $match: { customer: customerObjId } },
            {
                $group: {
                    _id: null,
                    totalPaid: {
                        $sum: {
                            $cond: [{ $eq: ['$payment.status', 'PAID'] }, '$fare.total', 0]
                        }
                    },
                    pendingAmount: {
                        $sum: {
                            $cond: [{ $eq: ['$payment.status', 'PENDING'] }, '$fare.total', 0]
                        }
                    },
                    paidCount: {
                        $sum: {
                            $cond: [{ $eq: ['$payment.status', 'PAID'] }, 1, 0]
                        }
                    },
                    pendingCount: {
                        $sum: {
                            $cond: [{ $eq: ['$payment.status', 'PENDING'] }, 1, 0]
                        }
                    },
                    totalCount: { $sum: 1 },
                }
            }
        ]);

        const result = agg[0] || {
            totalPaid: 0,
            pendingAmount: 0,
            paidCount: 0,
            pendingCount: 0,
            totalCount: 0,
        };

        return {
            totalPaid: result.totalPaid || 0,
            pendingAmount: result.pendingAmount || 0,
            paidCount: result.paidCount || 0,
            pendingCount: result.pendingCount || 0,
            totalCount: result.totalCount || 0,
            currency: 'INR',
        };
    }

    /**
     * Get paginated payment history for the customer.
     */
    async getPaymentHistory(customerId, query = {}) {
        const { skip, page, limit } = (0, pagination_util_1.getPagination)({
            page: Number(query.page) || 1,
            limit: Number(query.limit) || 20,
        });

        const filter = { customer: customerId };

        if (query.status && query.status !== 'ALL') {
            filter['payment.status'] = query.status.toUpperCase();
        }

        if (query.method && query.method !== 'ALL') {
            filter['payment.method'] = query.method.toUpperCase();
        }

        if (query.search && query.search.trim()) {
            const term = query.search.trim();
            filter.$or = [
                { trackingId: { $regex: term, $options: 'i' } },
                { 'payment.transactionId': { $regex: term, $options: 'i' } },
                { 'drop.address': { $regex: term, $options: 'i' } },
                { 'pickup.address': { $regex: term, $options: 'i' } },
                { description: { $regex: term, $options: 'i' } },
            ];
        }

        const [deliveries, total] = await Promise.all([
            delivery_model_1.DeliveryModel.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            delivery_model_1.DeliveryModel.countDocuments(filter),
        ]);

        const summary = await this.getPaymentSummary(customerId);

        const items = deliveries.map((d) => ({
            id: d._id,
            deliveryId: d._id,
            trackingId: d.trackingId,
            amount: d.fare?.total || 0,
            currency: d.fare?.currency || 'INR',
            fareBreakdown: {
                base: d.fare?.base || 0,
                perKm: d.fare?.perKm || 0,
                weightCharge: d.fare?.weightCharge || 0,
                discount: d.fare?.discount || 0,
                total: d.fare?.total || 0,
                currency: d.fare?.currency || 'INR',
            },
            method: d.payment?.method || 'UPI',
            status: d.payment?.status || (d.status === 'CANCELLED' ? 'REFUNDED' : 'PAID'),
            transactionId: d.payment?.transactionId || `TXN-${d.trackingId}`,
            paidAt: d.payment?.paidAt || d.createdAt,
            createdAt: d.createdAt,
            pickupAddress: d.pickup?.address || 'Pickup Point',
            dropAddress: d.drop?.address || 'Delivery Destination',
            deliveryStatus: d.status,
            category: d.category,
            hasInvoice: Boolean(d.payment?.status === 'PAID' || d.status === 'DELIVERED'),
        }));

        return {
            data: items,
            pagination: (0, pagination_util_1.buildPaginationMeta)(total, page, limit),
            summary,
        };
    }

    /**
     * Get payment details by payment/delivery ID.
     */
    async getPaymentById(customerId, paymentOrDeliveryId) {
        let delivery;
        if (mongoose_1.default.Types.ObjectId.isValid(paymentOrDeliveryId)) {
            delivery = await delivery_model_1.DeliveryModel.findById(paymentOrDeliveryId)
                .populate('customer', 'name phone email')
                .populate('partner', 'name phone')
                .lean();
        }

        if (!delivery) {
            delivery = await delivery_model_1.DeliveryModel.findOne({ trackingId: paymentOrDeliveryId })
                .populate('customer', 'name phone email')
                .populate('partner', 'name phone')
                .lean();
        }

        if (!delivery) {
            throw new AppError_1.NotFoundError('Payment or Delivery record');
        }

        // Customer security check
        const deliveryCustId = delivery.customer?._id
            ? delivery.customer._id.toString()
            : delivery.customer.toString();

        if (deliveryCustId !== customerId.toString()) {
            throw new AppError_1.AppError('Unauthorized access to payment information', 403, 'FORBIDDEN');
        }

        return {
            id: delivery._id,
            deliveryId: delivery._id,
            trackingId: delivery.trackingId,
            amount: delivery.fare?.total || 0,
            currency: delivery.fare?.currency || 'INR',
            fareBreakdown: {
                base: delivery.fare?.base || 0,
                perKm: delivery.fare?.perKm || 0,
                weightCharge: delivery.fare?.weightCharge || 0,
                discount: delivery.fare?.discount || 0,
                total: delivery.fare?.total || 0,
                currency: delivery.fare?.currency || 'INR',
            },
            method: delivery.payment?.method || 'UPI',
            status: delivery.payment?.status || (delivery.status === 'CANCELLED' ? 'REFUNDED' : 'PAID'),
            transactionId: delivery.payment?.transactionId || `TXN-${delivery.trackingId}`,
            paidAt: delivery.payment?.paidAt || delivery.createdAt,
            createdAt: delivery.createdAt,
            pickup: {
                address: delivery.pickup?.address,
                contactName: delivery.pickup?.contactName,
                contactPhone: delivery.pickup?.contactPhone,
                landmark: delivery.pickup?.landmark,
            },
            drop: {
                address: delivery.drop?.address,
                contactName: delivery.drop?.contactName,
                contactPhone: delivery.drop?.contactPhone,
                landmark: delivery.drop?.landmark,
            },
            deliveryStatus: delivery.status,
            category: delivery.category,
            distance: delivery.distance,
            weight: delivery.weight,
            hasInvoice: Boolean(delivery.payment?.status === 'PAID' || delivery.status === 'DELIVERED'),
        };
    }

    /**
     * Get or generate formal invoice data for the delivery payment.
     */
    async getPaymentInvoice(customerId, paymentOrDeliveryId) {
        let delivery;
        if (mongoose_1.default.Types.ObjectId.isValid(paymentOrDeliveryId)) {
            delivery = await delivery_model_1.DeliveryModel.findById(paymentOrDeliveryId)
                .populate('customer', 'name phone email')
                .lean();
        }

        if (!delivery) {
            delivery = await delivery_model_1.DeliveryModel.findOne({ trackingId: paymentOrDeliveryId })
                .populate('customer', 'name phone email')
                .lean();
        }

        if (!delivery) {
            throw new AppError_1.NotFoundError('Delivery / Invoice record');
        }

        const deliveryCustId = delivery.customer?._id
            ? delivery.customer._id.toString()
            : delivery.customer.toString();

        if (deliveryCustId !== customerId.toString()) {
            throw new AppError_1.AppError('Unauthorized access to invoice', 403, 'FORBIDDEN');
        }

        const base = delivery.fare?.base || 0;
        const perKm = delivery.fare?.perKm || 0;
        const weightCharge = delivery.fare?.weightCharge || 0;
        const discount = delivery.fare?.discount || 0;
        const subtotal = Math.max(0, base + perKm + weightCharge - discount);
        const total = delivery.fare?.total || subtotal;

        return {
            invoiceNumber: `INV-${delivery.trackingId}`,
            invoiceDate: delivery.payment?.paidAt || delivery.createdAt,
            company: {
                name: 'H2H Hand-to-Hand Hyperlocal Delivery',
                tagline: 'Hyperlocal Person-to-Person Delivery Network',
                address: 'Katpadi Main Road, Vellore, Tamil Nadu 632014',
                email: 'support@hand2hand.in',
                phone: '+91 98765 43210',
                gstin: '33AAACH2026K1Z9',
            },
            customer: {
                name: delivery.customer?.name || delivery.pickup?.contactName || 'Valued Customer',
                phone: delivery.customer?.phone || delivery.pickup?.contactPhone,
                email: delivery.customer?.email,
            },
            delivery: {
                trackingId: delivery.trackingId,
                category: delivery.category,
                description: delivery.description,
                distanceKm: delivery.distance,
                weightKg: delivery.weight,
                pickupAddress: delivery.pickup?.address,
                dropAddress: delivery.drop?.address,
                pickupContact: `${delivery.pickup?.contactName} (${delivery.pickup?.contactPhone})`,
                dropContact: `${delivery.drop?.contactName} (${delivery.drop?.contactPhone})`,
                bookedAt: delivery.createdAt,
                status: delivery.status,
            },
            fareBreakdown: {
                base,
                perKm,
                weightCharge,
                discount,
                subtotal,
                taxes: 0,
                total,
                currency: delivery.fare?.currency || 'INR',
            },
            payment: {
                method: delivery.payment?.method || 'UPI',
                status: delivery.payment?.status || (delivery.status === 'CANCELLED' ? 'REFUNDED' : 'PAID'),
                transactionId: delivery.payment?.transactionId || `TXN-${delivery.trackingId}`,
                paidAt: delivery.payment?.paidAt || delivery.createdAt,
            },
        };
    }
}

exports.PaymentService = PaymentService;
