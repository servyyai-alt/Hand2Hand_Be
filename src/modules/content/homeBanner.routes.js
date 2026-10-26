"use strict";
const { Router } = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { HomeBannerController } = require('./homeBanner.controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/role.middleware');

const uploadDir = path.join(process.cwd(), 'uploads', 'banners');
fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '-')}`),
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, /^image\/(jpeg|png|webp|jpg)$/.test(file.mimetype)),
});

const router = Router();
const controller = new HomeBannerController();
router.get('/active', controller.listActive.bind(controller));
router.use(authenticate, authorize('SUPER_ADMIN'));
router.get('/', controller.list.bind(controller));
router.post('/', upload.single('image'), controller.create.bind(controller));
router.put('/:id', upload.single('image'), controller.update.bind(controller));
router.delete('/:id', controller.remove.bind(controller));
exports.default = router;
