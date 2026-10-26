"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserRepository = void 0;
const user_model_1 = require("./user.model");
class UserRepository {
    async findById(id) {
        return user_model_1.UserModel.findById(id).exec();
    }
    async findByPhone(phone, includePassword = false) {
        const query = user_model_1.UserModel.findOne({ phone });
        if (includePassword)
            query.select('+passwordHash');
        return query.exec();
    }
    async findByEmail(email, includePassword = false) {
        const query = user_model_1.UserModel.findOne({ email });
        if (includePassword)
            query.select('+passwordHash');
        return query.exec();
    }
    async create(data) {
        const user = new user_model_1.UserModel(data);
        return user.save();
    }
    async update(id, data) {
        return user_model_1.UserModel.findByIdAndUpdate(id, { $set: data }, { new: true }).exec();
    }
    async findAll(filter = {}, skip = 0, limit = 20) {
        const [data, total] = await Promise.all([
            user_model_1.UserModel.find(filter).skip(skip).limit(limit).lean().exec(),
            user_model_1.UserModel.countDocuments(filter).exec(),
        ]);
        return { data, total };
    }
}
exports.UserRepository = UserRepository;
