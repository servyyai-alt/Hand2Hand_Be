"use strict";
const mongoose = require('mongoose');

const homeCardSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 60 },
  subtitle: { type: String, required: true, trim: true, maxlength: 100 },
  emoji: { type: String, default: '📦', maxlength: 8 },
  accent: { type: String, default: '#FFF0E7' },
  actionCategory: { type: String, default: 'PARCEL' },
  active: { type: Boolean, default: true },
  order: { type: Number, default: 0 },
}, { timestamps: true });

homeCardSchema.index({ active: 1, order: 1 });
exports.HomeCardModel = mongoose.model('HomeCard', homeCardSchema);
