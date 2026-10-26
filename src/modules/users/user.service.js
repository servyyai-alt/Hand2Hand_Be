"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserService = void 0;
const user_model_1 = require("./user.model");
const customerProfile_model_1 = require("../customers/customerProfile.model");
const delivery_model_1 = require("../deliveries/delivery.model");
const refreshToken_model_1 = require("../auth/refreshToken.model");
const AppError_1 = require("../../errors/AppError");

class UserService {
    async getProfile(userId) {
        const user = await user_model_1.UserModel.findById(userId);
        if (!user) throw new AppError_1.NotFoundError('User');
        const customerProfile = await customerProfile_model_1.CustomerProfileModel.findOne({ userId });
        const addresses = customerProfile?.addresses || [];
        return {
            ...user.toJSON(),
            addresses,
            savedAddresses: addresses,
            addressesCount: addresses.length,
        };
    }

    async updateProfile(userId, data) {
        const user = await user_model_1.UserModel.findById(userId);
        if (!user) throw new AppError_1.NotFoundError('User');

        if (data.name !== undefined) {
            const trimmed = String(data.name).trim();
            if (trimmed.length < 2) throw new AppError_1.ValidationError('Name must be at least 2 characters');
            user.name = trimmed;
        }

        if (data.email !== undefined) {
            const email = String(data.email).trim().toLowerCase();
            if (email) {
                const existing = await user_model_1.UserModel.findOne({ email, _id: { $ne: userId } });
                if (existing) throw new AppError_1.ConflictError('Email already in use by another account');
                user.email = email;
            } else {
                user.email = undefined;
            }
        }

        if (data.avatar !== undefined) {
            user.avatar = String(data.avatar).trim();
        }

        await user.save();
        return user;
    }

    async getPreferences(userId) {
        const user = await user_model_1.UserModel.findById(userId).select('notificationPreferences');
        if (!user) throw new AppError_1.NotFoundError('User');
        return {
            deliveryAccepted: user.notificationPreferences?.deliveryAccepted ?? true,
            partnerArriving: user.notificationPreferences?.partnerArriving ?? true,
            itemPickedUp: user.notificationPreferences?.itemPickedUp ?? true,
            deliveryInProgress: user.notificationPreferences?.deliveryInProgress ?? true,
            deliveryCompleted: user.notificationPreferences?.deliveryCompleted ?? true,
            paymentUpdates: user.notificationPreferences?.paymentUpdates ?? true,
            promotions: user.notificationPreferences?.promotions ?? false,
        };
    }

    async updatePreferences(userId, prefs) {
        const user = await user_model_1.UserModel.findById(userId);
        if (!user) throw new AppError_1.NotFoundError('User');

        user.notificationPreferences = {
            deliveryAccepted: prefs.deliveryAccepted !== undefined ? Boolean(prefs.deliveryAccepted) : (user.notificationPreferences?.deliveryAccepted ?? true),
            partnerArriving: prefs.partnerArriving !== undefined ? Boolean(prefs.partnerArriving) : (user.notificationPreferences?.partnerArriving ?? true),
            itemPickedUp: prefs.itemPickedUp !== undefined ? Boolean(prefs.itemPickedUp) : (user.notificationPreferences?.itemPickedUp ?? true),
            deliveryInProgress: prefs.deliveryInProgress !== undefined ? Boolean(prefs.deliveryInProgress) : (user.notificationPreferences?.deliveryInProgress ?? true),
            deliveryCompleted: prefs.deliveryCompleted !== undefined ? Boolean(prefs.deliveryCompleted) : (user.notificationPreferences?.deliveryCompleted ?? true),
            paymentUpdates: prefs.paymentUpdates !== undefined ? Boolean(prefs.paymentUpdates) : (user.notificationPreferences?.paymentUpdates ?? true),
            promotions: prefs.promotions !== undefined ? Boolean(prefs.promotions) : (user.notificationPreferences?.promotions ?? false),
        };

        await user.save();
        return user.notificationPreferences;
    }

    async getAddresses(userId) {
        let profile = await customerProfile_model_1.CustomerProfileModel.findOne({ userId });
        if (!profile) {
            profile = await customerProfile_model_1.CustomerProfileModel.create({ userId, addresses: [] });
        }
        return profile.addresses || [];
    }

    async addAddress(userId, data) {
        const addressText = data.address || data.addressLine;
        if (!data.label || !addressText) {
            throw new AppError_1.ValidationError('Label and address are required');
        }

        let profile = await customerProfile_model_1.CustomerProfileModel.findOne({ userId });
        if (!profile) {
            profile = await customerProfile_model_1.CustomerProfileModel.create({ userId, addresses: [] });
        }

        const isDefault = Boolean(data.isDefault);
        if (isDefault) {
            profile.addresses.forEach(addr => { addr.isDefault = false; });
        } else if (profile.addresses.length === 0) {
            data.isDefault = true;
        }

        // Validate and parse coordinates if provided
        let lat = data.latitude !== undefined && data.latitude !== '' && data.latitude !== null ? Number(data.latitude) : undefined;
        let lng = data.longitude !== undefined && data.longitude !== '' && data.longitude !== null ? Number(data.longitude) : undefined;

        if (lat === undefined && data.coordinates) {
            const rawLat = data.coordinates.lat ?? data.coordinates.latitude;
            if (rawLat !== undefined && rawLat !== '' && rawLat !== null) lat = Number(rawLat);
        }
        if (lng === undefined && data.coordinates) {
            const rawLng = data.coordinates.lng ?? data.coordinates.longitude;
            if (rawLng !== undefined && rawLng !== '' && rawLng !== null) lng = Number(rawLng);
        }

        if (lat !== undefined && (isNaN(lat) || lat < -90 || lat > 90)) {
            throw new AppError_1.ValidationError('Latitude must be a valid number between -90 and 90');
        }
        if (lng !== undefined && (isNaN(lng) || lng < -180 || lng > 180)) {
            throw new AppError_1.ValidationError('Longitude must be a valid number between -180 and 180');
        }

        const coords = (lat !== undefined && lng !== undefined) ? {
            lat,
            lng,
            latitude: lat,
            longitude: lng,
        } : undefined;

        const newAddress = {
            type: data.type || 'Other',
            label: String(data.label).trim(),
            address: String(addressText).trim(),
            landmark: data.landmark ? String(data.landmark).trim() : '',
            city: data.city ? String(data.city).trim() : 'Vellore',
            state: data.state ? String(data.state).trim() : 'Tamil Nadu',
            pincode: data.pincode ? String(data.pincode).trim() : '',
            latitude: lat,
            longitude: lng,
            coordinates: coords,
            isDefault: Boolean(data.isDefault),
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        profile.addresses.push(newAddress);
        await profile.save();
        return profile.addresses[profile.addresses.length - 1];
    }

    async updateAddress(userId, addressId, data) {
        const profile = await customerProfile_model_1.CustomerProfileModel.findOne({ userId });
        if (!profile) throw new AppError_1.NotFoundError('Address');

        const address = profile.addresses.id(addressId);
        if (!address) throw new AppError_1.NotFoundError('Address');

        if (data.isDefault === true) {
            profile.addresses.forEach(addr => { addr.isDefault = false; });
            address.isDefault = true;
        } else if (data.isDefault === false) {
            address.isDefault = false;
        }

        if (data.type !== undefined) address.type = data.type;
        if (data.label !== undefined) address.label = String(data.label).trim();
        if (data.address !== undefined) address.address = String(data.address).trim();
        if (data.landmark !== undefined) address.landmark = String(data.landmark).trim();
        if (data.city !== undefined) address.city = String(data.city).trim();
        if (data.state !== undefined) address.state = String(data.state).trim();
        if (data.pincode !== undefined) address.pincode = String(data.pincode).trim();

        // Check if latitude or longitude or coordinates are passed
        let lat = data.latitude !== undefined && data.latitude !== '' && data.latitude !== null ? Number(data.latitude) : undefined;
        let lng = data.longitude !== undefined && data.longitude !== '' && data.longitude !== null ? Number(data.longitude) : undefined;

        if (lat === undefined && data.coordinates) {
            const rawLat = data.coordinates.lat ?? data.coordinates.latitude;
            if (rawLat !== undefined && rawLat !== '' && rawLat !== null) lat = Number(rawLat);
        }
        if (lng === undefined && data.coordinates) {
            const rawLng = data.coordinates.lng ?? data.coordinates.longitude;
            if (rawLng !== undefined && rawLng !== '' && rawLng !== null) lng = Number(rawLng);
        }

        if (lat !== undefined && (isNaN(lat) || lat < -90 || lat > 90)) {
            throw new AppError_1.ValidationError('Latitude must be a valid number between -90 and 90');
        }
        if (lng !== undefined && (isNaN(lng) || lng < -180 || lng > 180)) {
            throw new AppError_1.ValidationError('Longitude must be a valid number between -180 and 180');
        }

        // Only overwrite coordinates if explicitly provided (preserve existing otherwise)
        if (lat !== undefined) address.latitude = lat;
        if (lng !== undefined) address.longitude = lng;
        if (lat !== undefined || lng !== undefined) {
            const finalLat = address.latitude;
            const finalLng = address.longitude;
            if (finalLat !== undefined && finalLng !== undefined) {
                address.coordinates = {
                    lat: finalLat,
                    lng: finalLng,
                    latitude: finalLat,
                    longitude: finalLng,
                };
            }
        }

        address.updatedAt = new Date();

        await profile.save();
        return address;
    }

    async deleteAddress(userId, addressId) {
        const profile = await customerProfile_model_1.CustomerProfileModel.findOne({ userId });
        if (!profile) throw new AppError_1.NotFoundError('Address');

        const address = profile.addresses.id(addressId);
        if (!address) throw new AppError_1.NotFoundError('Address');

        const wasDefault = Boolean(address.isDefault);
        profile.addresses.pull({ _id: addressId });

        if (wasDefault && profile.addresses.length > 0) {
            profile.addresses[0].isDefault = true;
        }

        await profile.save();
        return { message: 'Address deleted successfully', remainingCount: profile.addresses.length };
    }

    async deleteAccount(userId) {
        const activeCount = await delivery_model_1.DeliveryModel.countDocuments({
            customer: userId,
            status: { $nin: ['DELIVERED', 'CANCELLED'] }
        });
        if (activeCount > 0) {
            throw new AppError_1.AppError('Cannot delete account while you have active deliveries in progress', 400, 'ACTIVE_DELIVERIES_EXIST');
        }

        const user = await user_model_1.UserModel.findById(userId);
        if (!user) throw new AppError_1.NotFoundError('User');

        user.status = 'INACTIVE';
        user.name = 'Deactivated User';
        user.email = undefined;
        user.tokenVersion = (user.tokenVersion || 0) + 1;
        await user.save();

        await refreshToken_model_1.RefreshTokenModel.updateMany({ userId: user._id.toString(), isRevoked: false }, { isRevoked: true });
        return { message: 'Account deactivated successfully' };
    }
}
exports.UserService = UserService;
