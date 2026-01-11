// Shipping Addresses API
// GET: List user's saved addresses
// POST: Create new shipping address

import { ObjectId } from 'mongodb';
import { getCollection } from '../lib/mongodb.js';
import { authenticate } from '../lib/auth.js';

const MAX_ADDRESSES = 10;

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // All address operations require authentication
    const decoded = await authenticate(req);
    if (!decoded) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    const addresses = await getCollection('shipping_addresses');

    // GET - List user's addresses
    if (req.method === 'GET') {
        try {
            const userAddresses = await addresses
                .find({ userId: new ObjectId(decoded.userId) })
                .sort({ isDefault: -1, createdAt: -1 })
                .toArray();

            return res.status(200).json({
                success: true,
                addresses: userAddresses.map(addr => ({
                    ...addr,
                    _id: addr._id.toString(),
                    userId: addr.userId.toString()
                }))
            });
        } catch (error) {
            console.error('Get addresses error:', error);
            return res.status(500).json({ error: 'Failed to get addresses' });
        }
    }

    // POST - Create new address
    if (req.method === 'POST') {
        try {
            const {
                label,
                fullName,
                addressLine1,
                addressLine2,
                city,
                state,
                postalCode,
                country,
                phone,
                isDefault
            } = req.body;

            // Validation
            const errors = [];

            if (!fullName || fullName.trim().length < 2) {
                errors.push('Full name is required');
            }
            if (!addressLine1 || addressLine1.trim().length < 5) {
                errors.push('Address line 1 is required');
            }
            if (!city || city.trim().length < 2) {
                errors.push('City is required');
            }
            if (!state || state.trim().length < 2) {
                errors.push('State is required');
            }
            if (!postalCode || !/^\d{5}(-\d{4})?$/.test(postalCode.trim())) {
                errors.push('Valid postal code is required (e.g., 12345 or 12345-6789)');
            }

            if (errors.length > 0) {
                return res.status(400).json({ error: errors[0], errors });
            }

            // Check address limit
            const existingCount = await addresses.countDocuments({
                userId: new ObjectId(decoded.userId)
            });

            if (existingCount >= MAX_ADDRESSES) {
                return res.status(400).json({
                    error: `Maximum ${MAX_ADDRESSES} addresses allowed. Please delete an existing address first.`
                });
            }

            // If this is the first address or marked as default, update others
            const shouldBeDefault = isDefault || existingCount === 0;

            if (shouldBeDefault) {
                await addresses.updateMany(
                    { userId: new ObjectId(decoded.userId) },
                    { $set: { isDefault: false } }
                );
            }

            const newAddress = {
                userId: new ObjectId(decoded.userId),
                label: label?.trim() || 'Address',
                fullName: fullName.trim(),
                addressLine1: addressLine1.trim(),
                addressLine2: addressLine2?.trim() || null,
                city: city.trim(),
                state: state.trim().toUpperCase(),
                postalCode: postalCode.trim(),
                country: country?.trim() || 'US',
                phone: phone?.trim() || null,
                isDefault: shouldBeDefault,
                isVerified: false, // Would use address validation API in production
                createdAt: new Date(),
                updatedAt: new Date()
            };

            const result = await addresses.insertOne(newAddress);
            newAddress._id = result.insertedId;

            return res.status(201).json({
                success: true,
                message: 'Address saved successfully',
                address: {
                    ...newAddress,
                    _id: newAddress._id.toString(),
                    userId: newAddress.userId.toString()
                }
            });
        } catch (error) {
            console.error('Create address error:', error);
            return res.status(500).json({ error: 'Failed to save address' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
