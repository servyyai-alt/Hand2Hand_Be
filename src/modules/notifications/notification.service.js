"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationService = void 0;
const notification_model_1 = require("./notification.model");
const delivery_model_1 = require("../deliveries/delivery.model");
const AppError_1 = require("../../errors/AppError");

class NotificationService {
    async getNotifications(userId, { filter, page = 1, limit = 20 } = {}) {
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
        const skip = (pageNum - 1) * limitNum;

        // Auto-seed real notification records from actual deliveries if user has none
        const totalExisting = await notification_model_1.NotificationModel.countDocuments({ userId });
        if (totalExisting === 0) {
            await this._seedDeliveriesNotifications(userId);
        }

        const query = { userId };
        if (filter === 'unread') {
            query.isRead = false;
        }

        const [notifications, total, unreadCount] = await Promise.all([
            notification_model_1.NotificationModel.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum)
                .lean(),
            notification_model_1.NotificationModel.countDocuments(query),
            notification_model_1.NotificationModel.countDocuments({ userId, isRead: false }),
        ]);

        return {
            notifications,
            unreadCount,
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                totalPages: Math.ceil(total / limitNum) || 1,
            },
        };
    }

    async markAsRead(userId, notificationId) {
        const notification = await notification_model_1.NotificationModel.findOneAndUpdate(
            { _id: notificationId, userId },
            { isRead: true },
            { new: true }
        );
        if (!notification) {
            throw new AppError_1.NotFoundError('Notification');
        }
        return notification;
    }

    async markAllAsRead(userId) {
        const res = await notification_model_1.NotificationModel.updateMany(
            { userId, isRead: false },
            { isRead: true }
        );
        return { message: 'All notifications marked as read', updatedCount: res.modifiedCount };
    }

    async createNotification(data) {
        return notification_model_1.NotificationModel.create(data);
    }

    async _seedDeliveriesNotifications(userId) {
        try {
            const deliveries = await delivery_model_1.DeliveryModel.find({ customer: userId })
                .sort({ createdAt: -1 })
                .limit(10)
                .lean();

            const docs = [];
            for (const d of deliveries) {
                const orderRef = d.trackingCode || `#DEL-${d._id.toString().slice(-6).toUpperCase()}`;
                const dropLoc = d.drop?.address ? d.drop.address.split(',')[0] : 'destination';

                if (d.status === 'DELIVERED') {
                    docs.push({
                        userId,
                        type: 'DELIVERED',
                        title: 'Package Delivered Successfully',
                        description: `Your package (${d.item?.name || 'Package'}) was safely delivered to ${dropLoc}.`,
                        deliveryId: d._id,
                        orderRef,
                        isRead: true,
                        createdAt: d.updatedAt || d.createdAt,
                    });
                } else if (d.status === 'CANCELLED') {
                    docs.push({
                        userId,
                        type: 'CANCELLED',
                        title: 'Delivery Request Cancelled',
                        description: `Booking ${orderRef} was cancelled.`,
                        deliveryId: d._id,
                        orderRef,
                        isRead: true,
                        createdAt: d.updatedAt || d.createdAt,
                    });
                } else if (['IN_TRANSIT', 'PICKED_UP'].includes(d.status)) {
                    docs.push({
                        userId,
                        type: 'IN_PROGRESS',
                        title: 'Delivery in Progress',
                        description: `Your package is picked up and en route to ${dropLoc}.`,
                        deliveryId: d._id,
                        orderRef,
                        isRead: false,
                        createdAt: d.updatedAt || d.createdAt,
                    });
                } else if (d.status === 'ASSIGNED') {
                    docs.push({
                        userId,
                        type: 'DELIVERY_ASSIGNED',
                        title: 'Delivery Partner Assigned',
                        description: `A verified partner has been assigned to collect your delivery ${orderRef}.`,
                        deliveryId: d._id,
                        orderRef,
                        isRead: false,
                        createdAt: d.updatedAt || d.createdAt,
                    });
                } else {
                    docs.push({
                        userId,
                        type: 'SYSTEM',
                        title: 'Delivery Request Created',
                        description: `Your delivery request ${orderRef} has been recorded.`,
                        deliveryId: d._id,
                        orderRef,
                        isRead: false,
                        createdAt: d.createdAt,
                    });
                }
            }

            if (docs.length > 0) {
                await notification_model_1.NotificationModel.insertMany(docs);
            }
        } catch {
            // Ignore seeding errors silently
        }
    }
}

exports.NotificationService = NotificationService;
