"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildPaginationMeta = exports.getPagination = void 0;
const getPagination = (options) => {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const skip = (page - 1) * limit;
    return { skip, limit, page };
};
exports.getPagination = getPagination;
const buildPaginationMeta = (total, page, limit) => ({
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
});
exports.buildPaginationMeta = buildPaginationMeta;
