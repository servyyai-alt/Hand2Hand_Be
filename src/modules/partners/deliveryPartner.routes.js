"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const partnerApplication_controller_1 = require("./partnerApplication.controller");
const auth_middleware_1 = require("../../middlewares/auth.middleware");

const router = (0, express_1.Router)();
const ctrl = new partnerApplication_controller_1.PartnerApplicationController();

const optionalAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return (0, auth_middleware_1.authenticate)(req, res, next);
    }
    next();
};

// Public submission
router.post('/apply', ctrl.apply.bind(ctrl));

// Application status check (authenticated or via phone/applicationId query)
router.get('/application-status', optionalAuth, ctrl.getApplicationStatus.bind(ctrl));
router.post('/resubmit', auth_middleware_1.authenticate, ctrl.resubmit.bind(ctrl));

exports.default = router;
