"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const notification_controller_1 = require("./notification.controller");
const auth_middleware_1 = require("../../middlewares/auth.middleware");

const router = (0, express_1.Router)();
const controller = new notification_controller_1.NotificationController();

router.use(auth_middleware_1.authenticate);

router.get('/', controller.getNotifications);
router.patch('/:id/read', controller.markAsRead);
router.post('/mark-all-read', controller.markAllAsRead);

exports.default = router;
