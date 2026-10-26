"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const payment_controller_1 = require("./payment.controller");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const role_middleware_1 = require("../../middlewares/role.middleware");

const router = (0, express_1.Router)();
const ctrl = new payment_controller_1.PaymentController();

router.use(auth_middleware_1.authenticate);

router.get('/summary', (0, role_middleware_1.authorize)('CUSTOMER'), ctrl.getSummary.bind(ctrl));
router.get('/my', (0, role_middleware_1.authorize)('CUSTOMER'), ctrl.getHistory.bind(ctrl));
router.get('/', (0, role_middleware_1.authorize)('CUSTOMER'), ctrl.getHistory.bind(ctrl));
router.get('/:id', (0, role_middleware_1.authorize)('CUSTOMER'), ctrl.getById.bind(ctrl));
router.get('/:id/invoice', (0, role_middleware_1.authorize)('CUSTOMER'), ctrl.getInvoice.bind(ctrl));

exports.default = router;
