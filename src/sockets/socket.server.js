"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emitToUser = exports.emitToDelivery = exports.initializeSocket = exports.io = void 0;
const socket_io_1 = require("socket.io");
const jwt_util_1 = require("../utils/jwt.util");
const src_1 = require("../constants");
const partnerProfile_model_1 = require("../modules/partners/partnerProfile.model");
const logger_1 = require("../utils/logger");
const initializeSocket = (httpServer) => {
    exports.io = new socket_io_1.Server(httpServer, {
        cors: { origin: '*', methods: ['GET', 'POST'] },
        pingTimeout: 60000,
        pingInterval: 25000,
    });
    // Socket authentication middleware
    exports.io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token;
            if (!token)
                return next(new Error('No token provided'));
            const payload = (0, jwt_util_1.verifyAccessToken)(token);
            socket.userId = payload.userId;
            socket.role = payload.role;
            next();
        }
        catch {
            next(new Error('Invalid token'));
        }
    });
    exports.io.on('connection', (socket) => {
        const userId = socket.userId;
        const role = socket.role;
        logger_1.logger.info(`Socket connected: ${userId} (${role})`);
        // Join personal room
        socket.join(`user:${userId}`);
        // Partner events
        if (role === 'DELIVERY_PARTNER') {
            socket.on(src_1.SOCKET_EVENTS.PARTNER_GO_ONLINE, async () => {
                await partnerProfile_model_1.PartnerProfileModel.findOneAndUpdate({ userId }, { isOnline: true, isAvailable: true });
                logger_1.logger.info(`Partner online: ${userId}`);
            });
            socket.on(src_1.SOCKET_EVENTS.PARTNER_GO_OFFLINE, async () => {
                await partnerProfile_model_1.PartnerProfileModel.findOneAndUpdate({ userId }, { isOnline: false, isAvailable: false });
            });
            socket.on(src_1.SOCKET_EVENTS.PARTNER_LOCATION_UPDATE, async (data) => {
                try {
                    if (!data || !data.coords) return;
                    const { lat, lng } = data.coords;
                    if (typeof lat !== 'number' || typeof lng !== 'number' || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
                        return;
                    }

                    // Update partner profile location in database
                    await partnerProfile_model_1.PartnerProfileModel.findOneAndUpdate(
                        { userId },
                        { 'currentLocation.coordinates': [lng, lat] }
                    );

                    const deliveryId = data.deliveryId;
                    if (!deliveryId) return;

                    const { DeliveryModel } = require('../modules/deliveries/delivery.model');
                    const delivery = await DeliveryModel.findOne({
                        _id: deliveryId,
                        partner: userId,
                    });

                    if (!delivery) return;

                    // Verify tracking eligibility for current status
                    const activeStatuses = ['PARTNER_ASSIGNED', 'ARRIVED_AT_PICKUP', 'PICKED_UP', 'IN_TRANSIT'];
                    if (!activeStatuses.includes(delivery.status)) {
                        return;
                    }

                    const locUpdate = {
                        lat,
                        lng,
                        heading: typeof data.coords.heading === 'number' ? data.coords.heading : undefined,
                        speed: typeof data.coords.speed === 'number' ? data.coords.speed : undefined,
                        accuracy: typeof data.coords.accuracy === 'number' ? data.coords.accuracy : undefined,
                        updatedAt: new Date(),
                    };

                    delivery.lastLocation = locUpdate;
                    if (!delivery.locationHistory) delivery.locationHistory = [];
                    delivery.locationHistory.push({ lat, lng, timestamp: new Date() });
                    if (delivery.locationHistory.length > 50) {
                        delivery.locationHistory = delivery.locationHistory.slice(-50);
                    }
                    await delivery.save();

                    // Secure broadcast ONLY to the authorized order tracking room
                    exports.io.to(`delivery:${deliveryId}`).emit(src_1.SOCKET_EVENTS.PARTNER_LOCATION_UPDATED, {
                        deliveryId,
                        coords: locUpdate,
                        timestamp: new Date().toISOString(),
                        status: delivery.status,
                    });
                } catch (err) {
                    logger_1.logger.error(`Error processing location update: ${err.message}`);
                }
            });
        }
        // Join delivery room with strict authorization
        socket.on(src_1.SOCKET_EVENTS.JOIN_DELIVERY_ROOM, async (payload) => {
            try {
                const deliveryId = typeof payload === 'object' && payload?.deliveryId ? payload.deliveryId : payload;
                if (!deliveryId) return;
                const { DeliveryModel } = require('../modules/deliveries/delivery.model');
                const delivery = await DeliveryModel.findById(deliveryId).select('customer partner status');
                if (!delivery) {
                    socket.emit('delivery:error', { message: 'Delivery not found' });
                    return;
                }

                const isCustomer = delivery.customer?.toString() === userId;
                const isPartner = delivery.partner?.toString() === userId;
                const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(role);

                if (!isCustomer && !isPartner && !isAdmin) {
                    socket.emit('delivery:error', { message: 'Unauthorized to access this delivery tracking channel' });
                    logger_1.logger.warn(`Unauthorized join attempt by ${userId} for delivery:${deliveryId}`);
                    return;
                }

                socket.join(`delivery:${deliveryId}`);
                logger_1.logger.info(`Authorized: ${userId} (${role}) joined delivery room: ${deliveryId}`);
                socket.emit('delivery:roomJoined', { deliveryId, status: delivery.status });
            } catch (err) {
                logger_1.logger.error(`Error joining delivery room: ${err.message}`);
            }
        });
        socket.on(src_1.SOCKET_EVENTS.LEAVE_DELIVERY_ROOM, (payload) => {
            const deliveryId = typeof payload === 'object' && payload?.deliveryId ? payload.deliveryId : payload;
            if (deliveryId) {
                socket.leave(`delivery:${deliveryId}`);
                logger_1.logger.info(`${userId} left delivery room: ${deliveryId}`);
            }
        });
        socket.on('disconnect', async () => {
            if (role === 'DELIVERY_PARTNER') {
                await partnerProfile_model_1.PartnerProfileModel.findOneAndUpdate({ userId }, { isOnline: false, isAvailable: false });
            }
            logger_1.logger.info(`Socket disconnected: ${userId}`);
        });
    });
    return exports.io;
};
exports.initializeSocket = initializeSocket;
// Utility: emit to a delivery room
const emitToDelivery = (deliveryId, event, data) => {
    exports.io?.to(`delivery:${deliveryId}`).emit(event, data);
};
exports.emitToDelivery = emitToDelivery;
// Utility: emit to a user
const emitToUser = (userId, event, data) => {
    exports.io?.to(`user:${userId}`).emit(event, data);
};
exports.emitToUser = emitToUser;
