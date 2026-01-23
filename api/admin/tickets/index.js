// GET/POST /api/admin/tickets - List all ticket listings or create new
import { ObjectId } from 'mongodb';
import { getCollection } from '../../lib/mongodb.js';
import { authenticate } from '../../lib/auth.js';

// Valid ticket sources
const VALID_SOURCES = ['seatgeek', 'stubhub', 'ticketmaster', 'vividseats', 'other'];

// Valid ticket tiers
const VALID_TIERS = ['lower_level', 'mid_level', 'upper_level', 'budget'];

// Valid teams
const VALID_TEAMS = ['eagles', 'phillies', 'sixers', 'flyers', 'union'];

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        // Require admin authentication
        const user = await authenticate(req);
        if (!user) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        if (!user.isAdmin) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const products = await getCollection('shop_products');

        if (req.method === 'GET') {
            // List all ticket listings
            const { status, team, source } = req.query;

            const query = { category: 'tickets' };

            if (status) {
                query['ticketData.status'] = status;
            }
            if (team) {
                query.team = team;
            }
            if (source) {
                query['ticketData.source'] = source;
            }

            const tickets = await products.find(query)
                .sort({ 'ticketData.eventDate': 1, createdAt: -1 })
                .toArray();

            return res.status(200).json({
                tickets: tickets.map(t => ({
                    _id: t._id.toString(),
                    name: t.name,
                    team: t.team,
                    priceUSD: t.priceUSD,
                    status: t.status,
                    ticketData: t.ticketData,
                    images: t.images || [],
                    createdAt: t.createdAt,
                    updatedAt: t.updatedAt
                })),
                count: tickets.length
            });
        }

        if (req.method === 'POST') {
            // Create new ticket listing
            const {
                eventTitle,
                eventDate,
                venue,
                city,
                team,
                section,
                row,
                quantity,
                pricePerTicket,
                tier,
                source,
                sourceUrl,
                images
            } = req.body;

            // Validation
            if (!eventTitle || eventTitle.trim().length === 0) {
                return res.status(400).json({ error: 'Event title is required' });
            }

            if (!eventDate) {
                return res.status(400).json({ error: 'Event date is required' });
            }

            const eventDateObj = new Date(eventDate);
            if (isNaN(eventDateObj.getTime())) {
                return res.status(400).json({ error: 'Invalid event date' });
            }

            if (eventDateObj <= new Date()) {
                return res.status(400).json({ error: 'Event date must be in the future' });
            }

            if (!venue || venue.trim().length === 0) {
                return res.status(400).json({ error: 'Venue is required' });
            }

            if (!section || section.trim().length === 0) {
                return res.status(400).json({ error: 'Section is required' });
            }

            if (!quantity || parseInt(quantity) < 1) {
                return res.status(400).json({ error: 'Quantity must be at least 1' });
            }

            if (!pricePerTicket || parseFloat(pricePerTicket) <= 0) {
                return res.status(400).json({ error: 'Price per ticket is required' });
            }

            if (!source || !VALID_SOURCES.includes(source)) {
                return res.status(400).json({
                    error: `Invalid source. Must be one of: ${VALID_SOURCES.join(', ')}`
                });
            }

            if (!sourceUrl || !sourceUrl.startsWith('http')) {
                return res.status(400).json({ error: 'Valid source URL is required' });
            }

            if (tier && !VALID_TIERS.includes(tier)) {
                return res.status(400).json({
                    error: `Invalid tier. Must be one of: ${VALID_TIERS.join(', ')}`
                });
            }

            if (team && !VALID_TEAMS.includes(team)) {
                return res.status(400).json({
                    error: `Invalid team. Must be one of: ${VALID_TEAMS.join(', ')}`
                });
            }

            // Build name from ticket details
            const sectionDisplay = section.trim();
            const rowDisplay = row ? `, Row ${row.trim()}` : '';
            const name = `${eventTitle.trim()} - Sec ${sectionDisplay}${rowDisplay}`;

            // Convert price to cents for storage
            const priceInCents = Math.round(parseFloat(pricePerTicket) * 100);

            const newTicket = {
                name,
                category: 'tickets',
                team: team || null,
                priceUSD: priceInCents,
                status: 'active',
                ticketData: {
                    eventTitle: eventTitle.trim(),
                    eventDate: eventDateObj,
                    venue: venue.trim(),
                    city: city?.trim() || 'Philadelphia',
                    section: sectionDisplay,
                    row: row?.trim() || null,
                    quantity: parseInt(quantity),
                    pricePerTicket: priceInCents,
                    tier: tier || 'mid_level',
                    source,
                    sourceUrl,
                    status: 'available',
                    lastChecked: new Date()
                },
                images: images || [],
                createdBy: user._id,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            const result = await products.insertOne(newTicket);

            return res.status(201).json({
                success: true,
                ticket: {
                    ...newTicket,
                    _id: result.insertedId.toString(),
                    createdBy: user._id.toString()
                }
            });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('Admin tickets error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
}
