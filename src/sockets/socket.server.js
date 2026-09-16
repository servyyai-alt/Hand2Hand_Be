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
                await partnerProfile_model_1.PartnerProfileModel.findOneAndUpdate({ userId }, { 'currentLocation.coordinates': [data.coords.lng, data.coords.lat] });
                // Broadcast to any active delivery room this partner is in
                socket.rooms.forEach(room => {
                    if (room.startsWith('delivery:')) {
                        exports.io.to(room).emit(src_1.SOCKET_EVENTS.PARTNER_LOCATION_UPDATED, { coords: data.coords });
                    }
                });
            });
        }
        // Join delivery room (customer or partner)
        socket.on(src_1.SOCKET_EVENTS.JOIN_DELIVERY_ROOM, (deliveryId) => {
            socket.join(`delivery:${deliveryId}`);
            logger_1.logger.info(`${userId} joined delivery room: ${deliveryId}`);
        });
        socket.on(src_1.SOCKET_EVENTS.LEAVE_DELIVERY_ROOM, (deliveryId) => {
            socket.leave(`delivery:${deliveryId}`);
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
