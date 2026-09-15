"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequest = void 0;
const zod_1 = require("zod");
const AppError_1 = require("../errors/AppError");
const validateRequest = (schema) => {
    return (req, _res, next) => {
        try {
            req.body = schema.parse(req.body);
            next();
        }
        catch (err) {
            if (err instanceof zod_1.ZodError) {
                next(new AppError_1.ValidationError('Validation failed', err.errors));
            }
            else {
                next(err);
            }
        }
    };
};
exports.validateRequest = validateRequest;
