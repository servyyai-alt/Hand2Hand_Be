"use strict";
const { Router } = require('express');
const { HomeCardController } = require('./homeCard.controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/role.middleware');

const router = Router();
const controller = new HomeCardController();

router.get('/active', controller.listActive.bind(controller));
router.use(authenticate, authorize('SUPER_ADMIN'));
router.get('/', controller.list.bind(controller));
router.post('/', controller.create.bind(controller));
router.put('/:id', controller.update.bind(controller));
router.delete('/:id', controller.remove.bind(controller));

exports.default = router;
