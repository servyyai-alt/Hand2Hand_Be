"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TicketModel = void 0;
const mongoose_1 = require("mongoose");

const ticketMessageSchema = new mongoose_1.Schema({
    senderId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    senderRole: { type: String, enum: ['CUSTOMER', 'DELIVERY_PARTNER', 'ADMIN', 'SUPER_ADMIN'], required: true },
    senderName: { type: String, default: '' },
    message: { type: String, required: true, trim: true },
    attachments: [{ type: String }],
    createdAt: { type: Date, default: Date.now },
});

const ticketSchema = new mongoose_1.Schema({
    customerId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    relatedDeliveryId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Delivery', default: null, index: true },
    category: {
        type: String,
        enum: ['DELIVERY_DELAY', 'DAMAGED_PACKAGE', 'WRONG_LOCATION', 'BILLING', 'DRIVER_BEHAVIOR', 'ACCOUNT_ISSUE', 'OTHER'],
        required: true,
        index: true,
    },
    subject: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, required: true, trim: true },
    priority: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'], default: 'MEDIUM' },
    status: { type: String, enum: ['OPEN', 'IN_PROGRESS', 'WAITING_ON_CUSTOMER', 'ESCALATED', 'RESOLVED', 'CLOSED'], default: 'OPEN', index: true },
    contactPreference: { type: String, enum: ['IN_APP', 'CALL', 'EMAIL', 'WHATSAPP'], default: 'IN_APP' },
    attachments: [{ type: String }],
    resolutionNotes: { type: String, default: null },
    resolvedAt: { type: Date, default: null },
    messages: [ticketMessageSchema],
}, {
    timestamps: true,
});

ticketSchema.index({ customerId: 1, status: 1 });
ticketSchema.index({ createdAt: -1 });

exports.TicketModel = (0, mongoose_1.model)('Ticket', ticketSchema);
