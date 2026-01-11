import { ObjectId } from 'mongodb';
import { getCollection } from '../lib/mongodb.js';
import { authenticate, hashPassword, comparePassword } from '../lib/auth.js';
import { validateProfileUpdate, sanitizeString } from '../lib/validate.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const decoded = await authenticate(req);
        if (!decoded) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const users = await getCollection('users');
        const userId = new ObjectId(decoded.userId);

        if (req.method === 'DELETE') {
            const { password } = req.body;

            if (!password) {
                return res.status(400).json({ error: 'Password is required to delete account' });
            }

            const user = await users.findOne({ _id: userId });
            const isValid = await comparePassword(password, user.password);

            if (!isValid) {
                return res.status(401).json({ error: 'Invalid password' });
            }

            await users.deleteOne({ _id: userId });
            return res.status(200).json({ message: 'Account deleted successfully' });
        }

        if (req.method !== 'PUT') {
            return res.status(405).json({ error: 'Method not allowed' });
        }

        const { displayName, bio, favoriteTeam, profilePhoto, email, currentPassword, newPassword } = req.body;

        if (newPassword) {
            if (!currentPassword) {
                return res.status(400).json({ error: 'Current password is required' });
            }

            const user = await users.findOne({ _id: userId });
            const isValid = await comparePassword(currentPassword, user.password);

            if (!isValid) {
                return res.status(401).json({ error: 'Current password is incorrect' });
            }

            if (newPassword.length < 8) {
                return res.status(400).json({ error: 'New password must be at least 8 characters' });
            }

            const hashedPassword = await hashPassword(newPassword);
            await users.updateOne(
                { _id: userId },
                { $set: { password: hashedPassword, updatedAt: new Date() } }
            );

            return res.status(200).json({ message: 'Password updated successfully' });
        }

        const validation = validateProfileUpdate({ email, bio, favoriteTeam });
        if (!validation.isValid) {
            return res.status(400).json({ error: validation.errors[0] });
        }

        const updateData = { updatedAt: new Date() };

        if (displayName !== undefined) updateData.displayName = sanitizeString(displayName, 50);
        if (bio !== undefined) updateData.bio = sanitizeString(bio, 500);
        if (favoriteTeam !== undefined) updateData.favoriteTeam = favoriteTeam || null;
        if (profilePhoto !== undefined) updateData.profilePhoto = profilePhoto;
        if (email !== undefined) updateData.email = email.toLowerCase();

        await users.updateOne({ _id: userId }, { $set: updateData });

        res.status(200).json({ message: 'Profile updated successfully' });
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
}
