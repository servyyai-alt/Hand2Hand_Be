"use strict";
const { HomeCardModel } = require('./homeCard.model');
const { sendSuccess } = require('../../utils/response');

class HomeCardController {
  async listActive(_req, res, next) {
    try {
      const cards = await HomeCardModel.find({ active: true }).sort({ order: 1, createdAt: -1 }).lean();
      sendSuccess(res, cards, 'Home cards loaded');
    } catch (err) { next(err); }
  }

  async list(_req, res, next) {
    try {
      const cards = await HomeCardModel.find().sort({ order: 1, createdAt: -1 }).lean();
      sendSuccess(res, cards, 'Home cards loaded');
    } catch (err) { next(err); }
  }

  async create(req, res, next) {
    try {
      const card = await HomeCardModel.create(req.body);
      sendSuccess(res, card, 'Home card created', 201);
    } catch (err) { next(err); }
  }

  async update(req, res, next) {
    try {
      const card = await HomeCardModel.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }).lean();
      sendSuccess(res, card, 'Home card updated');
    } catch (err) { next(err); }
  }

  async remove(req, res, next) {
    try {
      await HomeCardModel.findByIdAndDelete(req.params.id);
      sendSuccess(res, null, 'Home card deleted');
    } catch (err) { next(err); }
  }
}

exports.HomeCardController = HomeCardController;
