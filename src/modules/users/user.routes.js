"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const user_controller_1 = require("./user.controller");
const auth_middleware_1 = require("../../middlewares/auth.middleware");

const router = (0, express_1.Router)();
const ctrl = new user_controller_1.UserController();

router.use(auth_middleware_1.authenticate);

router.get('/me', ctrl.getMe.bind(ctrl));
router.patch('/me', ctrl.updateMe.bind(ctrl));
router.delete('/me', ctrl.deleteAccount.bind(ctrl));

router.get('/me/preferences', ctrl.getPreferences.bind(ctrl));
router.patch('/me/preferences', ctrl.updatePreferences.bind(ctrl));

router.get('/me/addresses', ctrl.getAddresses.bind(ctrl));
router.post('/me/addresses', ctrl.addAddress.bind(ctrl));
router.patch('/me/addresses/:addressId', ctrl.updateAddress.bind(ctrl));
router.delete('/me/addresses/:addressId', ctrl.deleteAddress.bind(ctrl));

exports.default = router;
