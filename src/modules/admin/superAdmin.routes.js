"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const admin_controller_1 = require("./admin.controller");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const role_middleware_1 = require("../../middlewares/role.middleware");

const router = (0, express_1.Router)();
const ctrl = new admin_controller_1.AdminController();

router.use(auth_middleware_1.authenticate, (0, role_middleware_1.authorize)('SUPER_ADMIN'));

router.get('/delivery-partner-applications', ctrl.getPartners.bind(ctrl));
router.get('/delivery-partner-applications/:id', ctrl.getPartnerApplicationById.bind(ctrl));
router.post('/delivery-partner-applications/:id/approve', ctrl.approvePartnerBySuperAdmin.bind(ctrl));
router.post('/delivery-partner-applications/:id/reject', ctrl.rejectPartnerBySuperAdmin.bind(ctrl));

router.get('/partners', ctrl.getPartners.bind(ctrl));
router.get('/partners/:id', ctrl.getPartnerApplicationById.bind(ctrl));
router.post('/partners/:id/approve', ctrl.approvePartnerBySuperAdmin.bind(ctrl));
router.post('/partners/:id/reject', ctrl.rejectPartnerBySuperAdmin.bind(ctrl));

exports.default = router;
