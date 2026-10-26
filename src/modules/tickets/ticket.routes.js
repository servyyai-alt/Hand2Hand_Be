"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const ticket_controller_1 = require("./ticket.controller");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const role_middleware_1 = require("../../middlewares/role.middleware");

const router = (0, express_1.Router)();
const ctrl = new ticket_controller_1.TicketController();

router.use(auth_middleware_1.authenticate);

router.post('/', ctrl.create.bind(ctrl));
router.get('/', ctrl.list.bind(ctrl));
router.get('/:id', ctrl.getById.bind(ctrl));
router.post('/:id/messages', ctrl.addMessage.bind(ctrl));
router.patch('/:id/status', (0, role_middleware_1.authorize)('ADMIN', 'SUPER_ADMIN'), ctrl.updateStatus.bind(ctrl));
exports.default = router;
