const { getCollection } = require('../lib/mongodb');
const { comparePassword, generateToken, setAuthCookie } = require('../lib/auth');
const { validateLogin } = require('../lib/validate');

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
        const { email, password } = req.body;

        // Validate input
        const validation = validateLogin({ email, password });
        if (!validation.isValid) {
            return res.status(400).json({ error: validation.errors[0], errors: validation.errors });
        }

        const users = await getCollection('users');

        // Find user by email
        const user = await users.findOne({
            email: email.toLowerCase()
        });

        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Check password
        const isValidPassword = await comparePassword(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Generate token
        const token = generateToken(user);

        // Set cookie
        setAuthCookie(res, token);

        // Return user (without password)
        const { password: _, ...userWithoutPassword } = user;

        res.status(200).json({
            message: 'Login successful',
            user: userWithoutPassword,
            token
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Failed to login' });
    }
};
