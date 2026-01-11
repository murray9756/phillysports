import { getCollection } from '../lib/mongodb.js';
import { hashPassword, generateToken, setAuthCookie } from '../lib/auth.js';
import { validateRegistration, sanitizeString } from '../lib/validate.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { username, email, password, favoriteTeam } = req.body;

        const validation = validateRegistration({ username, email, password });
        if (!validation.isValid) {
            return res.status(400).json({ error: validation.errors[0] });
        }

        const users = await getCollection('users');

        const existingUser = await users.findOne({
            $or: [
                { email: email.toLowerCase() },
                { username: username.toLowerCase() }
            ]
        });

        if (existingUser) {
            if (existingUser.email === email.toLowerCase()) {
                return res.status(400).json({ error: 'Email already registered' });
            }
            return res.status(400).json({ error: 'Username already taken' });
        }

        const hashedPassword = await hashPassword(password);

        const newUser = {
            username: sanitizeString(username, 20),
            email: email.toLowerCase(),
            password: hashedPassword,
            favoriteTeam: favoriteTeam || null,
            displayName: sanitizeString(username, 50),
            profilePhoto: null,
            bio: '',
            following: [],
            followers: [],
            savedArticles: [],
            notifications: [],
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const result = await users.insertOne(newUser);
        newUser._id = result.insertedId;

        const token = generateToken(newUser);
        setAuthCookie(res, token);

        res.status(201).json({
            message: 'Registration successful',
            token,
            user: {
                _id: newUser._id.toString(),
                username: newUser.username,
                email: newUser.email,
                displayName: newUser.displayName,
                favoriteTeam: newUser.favoriteTeam
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
}
