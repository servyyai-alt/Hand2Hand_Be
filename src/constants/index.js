"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SOCKET_EVENTS = exports.DELIVERY_STATUS_TRANSITIONS = void 0;

const DELIVERY_STATUS_TRANSITIONS = {
    CREATED: ['PARTNER_ASSIGNED', 'CANCELLED'],
    PARTNER_ASSIGNED: ['PICKED_UP', 'CANCELLED'],
    PICKED_UP: ['IN_TRANSIT', 'CANCELLED'],
    IN_TRANSIT: ['DELIVERED', 'CANCELLED'],
    DELIVERED: [],
    CANCELLED: [],
};
exports.DELIVERY_STATUS_TRANSITIONS = DELIVERY_STATUS_TRANSITIONS;

const SOCKET_EVENTS = {
    PARTNER_GO_ONLINE: 'partner:goOnline',
    PARTNER_GO_OFFLINE: 'partner:goOffline',
    PARTNER_LOCATION_UPDATE: 'partner:locationUpdate',
    PARTNER_LOCATION_UPDATED: 'partner:locationUpdated',
    JOIN_DELIVERY_ROOM: 'delivery:joinRoom',
    LEAVE_DELIVERY_ROOM: 'delivery:leaveRoom',
};
exports.SOCKET_EVENTS = SOCKET_EVENTS;
