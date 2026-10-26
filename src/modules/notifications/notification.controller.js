"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationController = void 0;
const notification_service_1 = require("./notification.service");
const response_1 = require("../../utils/response");

const notificationService = new notification_service_1.NotificationService();

class NotificationController {
    async getNotifications(req, res, next) {
        try {
            const data = await notificationService.getNotifications(req.user.userId, req.query);
            (0, response_1.sendSuccess)(res, data, 'Notifications fetched successfully');
        } catch (err) {
            next(err);
        }
    }

    async markAsRead(req, res, next) {
        try {
            const notification = await notificationService.markAsRead(req.user.userId, req.params.id);
            (0, response_1.sendSuccess)(res, notification, 'Notification marked as read');
        } catch (err) {
            next(err);
        }
    }

    async markAllAsRead(req, res, next) {
        try {
            const result = await notificationService.markAllAsRead(req.user.userId);
            (0, response_1.sendSuccess)(res, result, 'All notifications marked as read');
        } catch (err) {
            next(err);
        }
    }
}

exports.NotificationController = NotificationController;
