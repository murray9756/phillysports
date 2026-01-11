// Shipping Address Detail API
// GET: Get single address
// PUT: Update address
// DELETE: Delete address
// POST: Set as default (with action=default)

import { ObjectId } from 'mongodb';
import { getCollection } from '../lib/mongodb.js';
import { authenticate } from '../lib/auth.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // All address operations require authentication
    const decoded = await authenticate(req);
    if (!decoded) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.query;

    if (!id || !ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid address ID' });
    }

    const addresses = await getCollection('shipping_addresses');
    const addressId = new ObjectId(id);
    const userId = new ObjectId(decoded.userId);

    // Verify ownership
    const address = await addresses.findOne({ _id: addressId });

    if (!address) {
        return res.status(404).json({ error: 'Address not found' });
    }

    if (address.userId.toString() !== decoded.userId) {
        return res.status(403).json({ error: 'Not authorized to access this address' });
    }

    // GET - Get single address
    if (req.method === 'GET') {
        return res.status(200).json({
            success: true,
            address: {
                ...address,
                _id: address._id.toString(),
                userId: address.userId.toString()
            }
        });
    }

    // POST - Set as default
    if (req.method === 'POST') {
        const { action } = req.body;

        if (action === 'default') {
            try {
                // Remove default from all other addresses
                await addresses.updateMany(
                    { userId, _id: { $ne: addressId } },
                    { $set: { isDefault: false } }
                );

                // Set this one as default
                await addresses.updateOne(
                    { _id: addressId },
                    { $set: { isDefault: true, updatedAt: new Date() } }
                );

                return res.status(200).json({
                    success: true,
                    message: 'Default address updated'
                });
            } catch (error) {
                console.error('Set default address error:', error);
                return res.status(500).json({ error: 'Failed to update default address' });
            }
        }

        return res.status(400).json({ error: 'Invalid action' });
    }

    // PUT - Update address
    if (req.method === 'PUT') {
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

            const updateFields = { updatedAt: new Date() };

            // Only update provided fields
            if (label !== undefined) updateFields.label = label.trim();
            if (fullName !== undefined) {
                if (!fullName || fullName.trim().length < 2) {
                    return res.status(400).json({ error: 'Full name is required' });
                }
                updateFields.fullName = fullName.trim();
            }
            if (addressLine1 !== undefined) {
                if (!addressLine1 || addressLine1.trim().length < 5) {
                    return res.status(400).json({ error: 'Address line 1 is required' });
                }
                updateFields.addressLine1 = addressLine1.trim();
            }
            if (addressLine2 !== undefined) updateFields.addressLine2 = addressLine2?.trim() || null;
            if (city !== undefined) {
                if (!city || city.trim().length < 2) {
                    return res.status(400).json({ error: 'City is required' });
                }
                updateFields.city = city.trim();
            }
            if (state !== undefined) {
                if (!state || state.trim().length < 2) {
                    return res.status(400).json({ error: 'State is required' });
                }
                updateFields.state = state.trim().toUpperCase();
            }
            if (postalCode !== undefined) {
                if (!postalCode || !/^\d{5}(-\d{4})?$/.test(postalCode.trim())) {
                    return res.status(400).json({ error: 'Valid postal code is required' });
                }
                updateFields.postalCode = postalCode.trim();
            }
            if (country !== undefined) updateFields.country = country.trim();
            if (phone !== undefined) updateFields.phone = phone?.trim() || null;

            // Handle default address change
            if (isDefault === true && !address.isDefault) {
                await addresses.updateMany(
                    { userId, _id: { $ne: addressId } },
                    { $set: { isDefault: false } }
                );
                updateFields.isDefault = true;
            }

            await addresses.updateOne(
                { _id: addressId },
                { $set: updateFields }
            );

            const updatedAddress = await addresses.findOne({ _id: addressId });

            return res.status(200).json({
                success: true,
                message: 'Address updated successfully',
                address: {
                    ...updatedAddress,
                    _id: updatedAddress._id.toString(),
                    userId: updatedAddress.userId.toString()
                }
            });
        } catch (error) {
            console.error('Update address error:', error);
            return res.status(500).json({ error: 'Failed to update address' });
        }
    }

    // DELETE - Delete address
    if (req.method === 'DELETE') {
        try {
            const wasDefault = address.isDefault;

            await addresses.deleteOne({ _id: addressId });

            // If deleted address was default, set another one as default
            if (wasDefault) {
                const nextAddress = await addresses.findOne(
                    { userId },
                    { sort: { createdAt: -1 } }
                );

                if (nextAddress) {
                    await addresses.updateOne(
                        { _id: nextAddress._id },
                        { $set: { isDefault: true } }
                    );
                }
            }

            return res.status(200).json({
                success: true,
                message: 'Address deleted successfully'
            });
        } catch (error) {
            console.error('Delete address error:', error);
            return res.status(500).json({ error: 'Failed to delete address' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
