"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TicketController = void 0;
const ticket_service_1 = require("./ticket.service");
const response_1 = require("../../utils/response");

const ticketService = new ticket_service_1.TicketService();

class TicketController {
    async create(req, res, next) {
        try {
            const ticket = await ticketService.createTicket(req.user.userId, req.user.role, req.body);
            (0, response_1.sendSuccess)(res, ticket, 'Ticket created successfully', 201);
        } catch (err) {
            next(err);
        }
    }

    async list(req, res, next) {
        try {
            const result = await ticketService.getTickets(req.user, req.query);
            (0, response_1.sendSuccess)(res, result, 'Tickets retrieved successfully');
        } catch (err) {
            next(err);
        }
    }

    async getById(req, res, next) {
        try {
            const ticket = await ticketService.getTicketById(req.user, req.params.id);
            (0, response_1.sendSuccess)(res, ticket, 'Ticket details retrieved successfully');
        } catch (err) {
            next(err);
        }
    }

    async addMessage(req, res, next) {
        try {
            const ticket = await ticketService.addMessage(req.user, req.params.id, req.body.message, req.body.attachments);
            (0, response_1.sendSuccess)(res, ticket, 'Message added to ticket successfully');
        } catch (err) {
            next(err);
        }
    }

    async updateStatus(req, res, next) {
        try {
            const ticket = await ticketService.updateStatus(req.user, req.params.id, req.body.status);
            (0, response_1.sendSuccess)(res, ticket, 'Ticket status updated successfully');
        } catch (err) {
            next(err);
        }
    }
}
exports.TicketController = TicketController;
