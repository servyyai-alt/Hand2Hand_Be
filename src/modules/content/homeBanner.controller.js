"use strict";
const { HomeBannerModel } = require('./homeBanner.model');
const { sendSuccess } = require('../../utils/response');

class HomeBannerController {
  async listActive(_req, res, next) {
    try {
      const banners = await HomeBannerModel.find({ active: true }).sort({ order: 1, createdAt: -1 }).lean();
      sendSuccess(res, banners, 'Home banners loaded');
    } catch (err) { next(err); }
  }

  async list(_req, res, next) {
    try {
      const banners = await HomeBannerModel.find().sort({ order: 1, createdAt: -1 }).lean();
      sendSuccess(res, banners, 'Home banners loaded');
    } catch (err) { next(err); }
  }

  async create(req, res, next) {
    try {
      const banner = await HomeBannerModel.create({ ...req.body, imageUrl: `${req.protocol}://${req.get('host')}/uploads/banners/${req.file.filename}` });
      sendSuccess(res, banner, 'Home banner created', 201);
    } catch (err) { next(err); }
  }

  async update(req, res, next) {
    try {
      const changes = { ...req.body };
      if (req.file) changes.imageUrl = `${req.protocol}://${req.get('host')}/uploads/banners/${req.file.filename}`;
      const banner = await HomeBannerModel.findByIdAndUpdate(req.params.id, changes, { new: true, runValidators: true }).lean();
      sendSuccess(res, banner, 'Home banner updated');
    } catch (err) { next(err); }
  }

  async remove(req, res, next) {
    try {
      await HomeBannerModel.findByIdAndDelete(req.params.id);
      sendSuccess(res, null, 'Home banner deleted');
    } catch (err) { next(err); }
  }
}
exports.HomeBannerController = HomeBannerController;
