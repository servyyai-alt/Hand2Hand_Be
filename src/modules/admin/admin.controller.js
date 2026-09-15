"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminController = void 0;
const user_model_1 = require("../users/user.model");
const delivery_model_1 = require("../deliveries/delivery.model");
const partnerProfile_model_1 = require("../partners/partnerProfile.model");
const response_1 = require("../../utils/response");
const pagination_util_1 = require("../../utils/pagination.util");
class AdminController {
    async getDashboard(req, res, next) {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const [totalCustomers, totalPartners, activePartners, todayDeliveries, activeDeliveries, completedToday, cancelledToday,] = await Promise.all([
                user_model_1.UserModel.countDocuments({ role: 'CUSTOMER' }),
                user_model_1.UserModel.countDocuments({ role: 'DELIVERY_PARTNER' }),
                partnerProfile_model_1.PartnerProfileModel.countDocuments({ isOnline: true }),
                delivery_model_1.DeliveryModel.countDocuments({ createdAt: { $gte: today } }),
                delivery_model_1.DeliveryModel.countDocuments({ status: { $in: ['SEARCHING_PARTNER', 'PARTNER_ASSIGNED', 'PARTNER_ARRIVING', 'ARRIVED_AT_PICKUP', 'PICKED_UP', 'IN_TRANSIT', 'ARRIVED_AT_DROP'] } }),
                delivery_model_1.DeliveryModel.countDocuments({ status: 'DELIVERED', updatedAt: { $gte: today } }),
                delivery_model_1.DeliveryModel.countDocuments({ status: 'CANCELLED', updatedAt: { $gte: today } }),
            ]);
            const revenueAgg = await delivery_model_1.DeliveryModel.aggregate([
                { $match: { status: 'DELIVERED', updatedAt: { $gte: today } } },
                { $group: { _id: null, total: { $sum: '$fare.total' } } },
            ]);
            (0, response_1.sendSuccess)(res, {
                totalCustomers, totalPartners, activePartners,
                todayDeliveries, activeDeliveries,
                completed: completedToday,
                cancelled: cancelledToday,
                todayRevenue: revenueAgg[0]?.total ?? 0,
                searchingPartner: await delivery_model_1.DeliveryModel.countDocuments({ status: 'SEARCHING_PARTNER' }),
                partnerAssigned: await delivery_model_1.DeliveryModel.countDocuments({ status: 'PARTNER_ASSIGNED' }),
                inTransit: await delivery_model_1.DeliveryModel.countDocuments({ status: 'IN_TRANSIT' }),
                avgDeliveryMinutes: 28,
            }, 'Dashboard loaded');
        }
        catch (err) {
            next(err);
        }
    }
    async getUsers(req, res, next) {
        try {
            const { page, limit, role, search } = req.query;
            const { skip, page: pg, limit: lm } = (0, pagination_util_1.getPagination)({ page: Number(page) || 1, limit: Number(limit) || 20 });
            const filter = {};
            if (role)
                filter.role = role;
            if (search)
                filter.$or = [
                    { name: { $regex: search, $options: 'i' } },
                    { phone: { $regex: search, $options: 'i' } },
                    { email: { $regex: search, $options: 'i' } },
                ];
            const [data, total] = await Promise.all([
                user_model_1.UserModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(lm).lean(),
                user_model_1.UserModel.countDocuments(filter),
            ]);
            (0, response_1.sendSuccess)(res, { data, pagination: (0, pagination_util_1.buildPaginationMeta)(total, pg, lm) }, 'Users loaded');
        }
        catch (err) {
            next(err);
        }
    }
    async getDeliveries(req, res, next) {
        try {
            const { page, limit, status } = req.query;
            const { skip, page: pg, limit: lm } = (0, pagination_util_1.getPagination)({ page: Number(page) || 1, limit: Number(limit) || 20 });
            const filter = {};
            if (status)
                filter.status = status;
            const [data, total] = await Promise.all([
                delivery_model_1.DeliveryModel.find(filter)
                    .sort({ createdAt: -1 }).skip(skip).limit(lm)
                    .populate('customer', 'name phone')
                    .populate('partner', 'name phone')
                    .lean(),
                delivery_model_1.DeliveryModel.countDocuments(filter),
            ]);
            (0, response_1.sendSuccess)(res, { data, pagination: (0, pagination_util_1.buildPaginationMeta)(total, pg, lm) }, 'Deliveries loaded');
        }
        catch (err) {
            next(err);
        }
    }
    async updateUserStatus(req, res, next) {
        try {
            const { status } = req.body;
            const user = await user_model_1.UserModel.findByIdAndUpdate(req.params.id, { status }, { new: true });
            (0, response_1.sendSuccess)(res, user, 'User status updated');
        }
        catch (err) {
            next(err);
        }
    }
}
exports.AdminController = AdminController;
