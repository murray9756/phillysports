const { getCollection } = require('../lib/mongodb');
const { hashPassword, generateToken, setAuthCookie } = require('../lib/auth');
const { validateRegistration, sanitizeString } = require('../lib/validate');

module.exports = async function handler(req, res) {
    // Set CORS headers
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

        // Validate input
        const validation = validateRegistration({ username, email, password });
        if (!validation.isValid) {
            return res.status(400).json({ error: validation.errors[0], errors: validation.errors });
        }

        const users = await getCollection('users');

        // Check if username already exists
        const existingUsername = await users.findOne({
            username: username.toLowerCase()
        });
        if (existingUsername) {
            return res.status(400).json({ error: 'Username already taken' });
        }

        // Check if email already exists
        const existingEmail = await users.findOne({
            email: email.toLowerCase()
        });
        if (existingEmail) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        // Hash password
        const hashedPassword = await hashPassword(password);

        // Create user
        const newUser = {
            username: username.toLowerCase(),
            displayName: username,
            email: email.toLowerCase(),
            password: hashedPassword,
            favoriteTeam: favoriteTeam?.toLowerCase() || null,
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

        // Generate token
        const token = generateToken(newUser);

        // Set cookie
        setAuthCookie(res, token);

        // Return user (without password)
        const { password: _, ...userWithoutPassword } = newUser;

        res.status(201).json({
            message: 'Account created successfully',
            user: userWithoutPassword,
            token
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Failed to create account' });
    }
};
