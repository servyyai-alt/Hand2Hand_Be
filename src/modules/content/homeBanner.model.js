"use strict";
const mongoose = require('mongoose');

const homeBannerSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 80 },
  subtitle: { type: String, default: '', trim: true, maxlength: 140 },
  imageUrl: { type: String, required: true },
  actionCategory: { type: String, default: 'PARCEL' },
  active: { type: Boolean, default: true },
  order: { type: Number, default: 0 },
}, { timestamps: true });

homeBannerSchema.index({ active: 1, order: 1 });
exports.HomeBannerModel = mongoose.model('HomeBanner', homeBannerSchema);
