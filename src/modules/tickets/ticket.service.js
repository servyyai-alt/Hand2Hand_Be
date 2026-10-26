"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TicketService = void 0;
const ticket_model_1 = require("./ticket.model");
const delivery_model_1 = require("../deliveries/delivery.model");
const user_model_1 = require("../users/user.model");
const AppError_1 = require("../../errors/AppError");
const pagination_util_1 = require("../../utils/pagination.util");

class TicketService {
    async createTicket(userId, userRole, data) {
        if (!data.category || !data.subject || !data.description) {
            throw new AppError_1.ValidationError('Category, subject, and description are required');
        }

        let relatedDeliveryId = undefined;
        if (data.relatedDeliveryId) {
            const delivery = await delivery_model_1.DeliveryModel.findById(data.relatedDeliveryId);
            if (!delivery) {
                throw new AppError_1.NotFoundError('Related delivery');
            }
            if (userRole === 'CUSTOMER' && delivery.customer.toString() !== userId) {
                throw new AppError_1.ForbiddenError('Delivery does not belong to your account');
            }
            relatedDeliveryId = delivery._id;
        }

        const sender = await user_model_1.UserModel.findById(userId).select('name');
        const senderName = sender?.name || 'Customer';

        const ticket = new ticket_model_1.TicketModel({
            customerId: userId,
            relatedDeliveryId,
            category: data.category,
            subject: String(data.subject).trim(),
            description: String(data.description).trim(),
            attachments: data.attachments || [],
            priority: data.priority || 'MEDIUM',
            contactPreference: data.contactPreference || 'IN_APP',
            status: 'OPEN',
            messages: [{
                senderId: userId,
                senderRole: userRole,
                senderName,
                message: String(data.description).trim(),
                attachments: data.attachments || [],
                createdAt: new Date(),
            }],
        });

        await ticket.save();
        return ticket;
    }

    async getTickets(user, query) {
        const filter = {};
        if (user.role === 'CUSTOMER') {
            filter.customerId = user.userId;
        } else if (['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
            if (query.customerId) filter.customerId = query.customerId;
        } else {
            throw new AppError_1.ForbiddenError('Access denied');
        }

        if (query.status) {
            filter.status = query.status.toUpperCase();
        }
        if (query.category) {
            filter.category = query.category.toUpperCase();
        }

        const { skip, page, limit } = (0, pagination_util_1.getPagination)({
            page: Number(query.page) || 1,
            limit: Number(query.limit) || 20,
        });

        const [tickets, total] = await Promise.all([
            ticket_model_1.TicketModel.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate('customerId', 'name phone email avatar')
                .populate('relatedDeliveryId', 'trackingId status pickup drop')
                .lean(),
            ticket_model_1.TicketModel.countDocuments(filter),
        ]);

        return {
            data: tickets,
            pagination: (0, pagination_util_1.buildPaginationMeta)(total, page, limit),
        };
    }

    async getTicketById(user, ticketId) {
        const ticket = await ticket_model_1.TicketModel.findById(ticketId)
            .populate('customerId', 'name phone email avatar')
            .populate('relatedDeliveryId', 'trackingId status pickup drop fare')
            .lean();

        if (!ticket) throw new AppError_1.NotFoundError('Ticket');

        const customerIdStr = ticket.customerId?._id ? ticket.customerId._id.toString() : ticket.customerId.toString();
        if (user.role === 'CUSTOMER' && customerIdStr !== user.userId) {
            throw new AppError_1.ForbiddenError('Access denied. This ticket belongs to another account.');
        }

        return ticket;
    }

    async addMessage(user, ticketId, messageText, attachments = []) {
        if (!messageText || !String(messageText).trim()) {
            throw new AppError_1.ValidationError('Message content is required');
        }

        const ticket = await ticket_model_1.TicketModel.findById(ticketId);
        if (!ticket) throw new AppError_1.NotFoundError('Ticket');

        if (user.role === 'CUSTOMER' && ticket.customerId.toString() !== user.userId) {
            throw new AppError_1.ForbiddenError('Access denied');
        }

        if (ticket.status === 'CLOSED') {
            throw new AppError_1.AppError('Cannot reply to a closed ticket. Please raise a new ticket.', 400, 'TICKET_CLOSED');
        }

        const sender = await user_model_1.UserModel.findById(user.userId).select('name');
        const senderName = sender?.name || (user.role === 'CUSTOMER' ? 'Customer' : 'Support Team');

        ticket.messages.push({
            senderId: user.userId,
            senderRole: user.role === 'CUSTOMER' ? 'CUSTOMER' : 'SUPPORT',
            senderName,
            message: String(messageText).trim(),
            attachments: Array.isArray(attachments) ? attachments : [],
            createdAt: new Date(),
        });

        if (['ADMIN', 'SUPER_ADMIN'].includes(user.role) && ticket.status === 'OPEN') {
            ticket.status = 'IN_PROGRESS';
        }

        await ticket.save();
        return ticket;
    }

    async updateStatus(user, ticketId, status) {
        if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
            throw new AppError_1.ForbiddenError('Only administrators can update ticket status');
        }

        const allowed = ['OPEN', 'IN_PROGRESS', 'WAITING_ON_CUSTOMER', 'ESCALATED', 'RESOLVED', 'CLOSED'];
        if (!allowed.includes(status)) {
            throw new AppError_1.ValidationError(`Invalid status. Allowed: ${allowed.join(', ')}`);
        }

        const ticket = await ticket_model_1.TicketModel.findById(ticketId);
        if (!ticket) throw new AppError_1.NotFoundError('Ticket');

        ticket.status = status;
        if (status === 'RESOLVED') {
            ticket.resolvedAt = new Date();
        }

        await ticket.save();
        return ticket;
    }
}
exports.TicketService = TicketService;
