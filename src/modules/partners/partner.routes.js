"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const partner_controller_1 = require("./partner.controller");
const partnerApplication_controller_1 = require("./partnerApplication.controller");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const role_middleware_1 = require("../../middlewares/role.middleware");
const approvedPartner_middleware_1 = require("../../middlewares/approvedPartner.middleware");

const router = (0, express_1.Router)();
const ctrl = new partner_controller_1.PartnerController();
const appCtrl = new partnerApplication_controller_1.PartnerApplicationController();

router.use(auth_middleware_1.authenticate, (0, role_middleware_1.authorize)('DELIVERY_PARTNER'));

// Non-operational routes accessible while pending/rejected
router.get('/profile', ctrl.getProfile.bind(ctrl));
router.get('/application-status', appCtrl.getApplicationStatus.bind(appCtrl));
router.post('/resubmit', appCtrl.resubmit.bind(appCtrl));

// Operational routes strictly restricted to approved and active partners only
router.post('/availability', approvedPartner_middleware_1.requireApprovedPartner, ctrl.setAvailability.bind(ctrl));
router.patch('/availability', approvedPartner_middleware_1.requireApprovedPartner, ctrl.setAvailability.bind(ctrl));
router.get('/earnings', approvedPartner_middleware_1.requireApprovedPartner, ctrl.getEarnings.bind(ctrl));
router.get('/deliveries/available', approvedPartner_middleware_1.requireApprovedPartner, ctrl.getAvailableRequests.bind(ctrl));
router.get('/deliveries/active', approvedPartner_middleware_1.requireApprovedPartner, ctrl.getActiveDelivery.bind(ctrl));
router.get('/deliveries', approvedPartner_middleware_1.requireApprovedPartner, ctrl.getDeliveries.bind(ctrl));
router.get('/deliveries/:id', approvedPartner_middleware_1.requireApprovedPartner, ctrl.getDeliveryById.bind(ctrl));
router.post('/deliveries/:id/accept', approvedPartner_middleware_1.requireApprovedPartner, ctrl.acceptDelivery.bind(ctrl));
router.post('/deliveries/:id/arrived-pickup', approvedPartner_middleware_1.requireApprovedPartner, ctrl.arriveAtPickup.bind(ctrl));
router.post('/deliveries/:id/verify-item', approvedPartner_middleware_1.requireApprovedPartner, ctrl.verifyItem.bind(ctrl));
router.post('/deliveries/:id/report-mismatch', approvedPartner_middleware_1.requireApprovedPartner, ctrl.reportMismatch.bind(ctrl));
router.post('/deliveries/:id/location', approvedPartner_middleware_1.requireApprovedPartner, ctrl.updateDeliveryLocation.bind(ctrl));
router.post('/deliveries/:id/request-recipient-otp', approvedPartner_middleware_1.requireApprovedPartner, ctrl.requestRecipientOTP.bind(ctrl));
router.post('/deliveries/:id/verify-pickup-otp', approvedPartner_middleware_1.requireApprovedPartner, ctrl.verifyPickupOTP.bind(ctrl));
router.post('/deliveries/:id/pickup', approvedPartner_middleware_1.requireApprovedPartner, ctrl.verifyPickupOTP.bind(ctrl));
router.post('/deliveries/:id/in-transit', approvedPartner_middleware_1.requireApprovedPartner, ctrl.startTransit.bind(ctrl));
router.post('/deliveries/:id/verify-delivery-otp', approvedPartner_middleware_1.requireApprovedPartner, ctrl.verifyDeliveryOTP.bind(ctrl));
router.post('/deliveries/:id/deliver', approvedPartner_middleware_1.requireApprovedPartner, ctrl.verifyDeliveryOTP.bind(ctrl));

exports.default = router;
