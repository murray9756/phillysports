import { getCollection } from '../lib/mongodb.js';
import { comparePassword, generateToken, setAuthCookie } from '../lib/auth.js';
import { validateLogin } from '../lib/validate.js';
import { rateLimit } from '../lib/rateLimit.js';

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

    // Rate limit: 10 attempts per 15 minutes
    const allowed = await rateLimit(req, res, 'auth');
    if (!allowed) return;

    try {
        const { email, password } = req.body;

        const validation = validateLogin({ email, password });
        if (!validation.isValid) {
            return res.status(400).json({ error: validation.errors[0] });
        }

        const users = await getCollection('users');
        const user = await users.findOne({ email: email.toLowerCase() });

        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const isValidPassword = await comparePassword(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const token = generateToken(user);
        setAuthCookie(res, token);

        res.status(200).json({
            message: 'Login successful',
            token,
            user: {
                _id: user._id.toString(),
                username: user.username,
                email: user.email,
                displayName: user.displayName,
                favoriteTeam: user.favoriteTeam,
                profilePhoto: user.profilePhoto
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
}
