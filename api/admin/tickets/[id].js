// PUT/DELETE /api/admin/tickets/[id] - Update or delete ticket listing
import { ObjectId } from 'mongodb';
import { getCollection } from '../../lib/mongodb.js';
import { authenticate } from '../../lib/auth.js';

// Valid ticket sources
const VALID_SOURCES = ['seatgeek', 'stubhub', 'ticketmaster', 'vividseats', 'other'];

// Valid ticket tiers
const VALID_TIERS = ['lower_level', 'mid_level', 'upper_level', 'budget'];

// Valid teams
const VALID_TEAMS = ['eagles', 'phillies', 'sixers', 'flyers', 'union'];

// Valid ticket statuses
const VALID_TICKET_STATUSES = ['available', 'sold', 'expired'];

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS');
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

        const { id } = req.query;
        if (!id || !ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid ticket ID' });
        }

        const products = await getCollection('shop_products');
        const ticket = await products.findOne({
            _id: new ObjectId(id),
            category: 'tickets'
        });

        if (!ticket) {
            return res.status(404).json({ error: 'Ticket listing not found' });
        }

        if (req.method === 'GET') {
            // Get single ticket details
            return res.status(200).json({
                ticket: {
                    _id: ticket._id.toString(),
                    name: ticket.name,
                    team: ticket.team,
                    priceUSD: ticket.priceUSD,
                    status: ticket.status,
                    ticketData: ticket.ticketData,
                    images: ticket.images || [],
                    createdAt: ticket.createdAt,
                    updatedAt: ticket.updatedAt,
                    createdBy: ticket.createdBy?.toString()
                }
            });
        }

        if (req.method === 'PUT') {
            // Update ticket listing
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
                images,
                ticketStatus,  // available, sold, expired
                productStatus  // active, inactive
            } = req.body;

            // Build update object
            const update = { updatedAt: new Date() };
            const ticketDataUpdate = {};

            // Update basic fields
            if (team !== undefined) {
                if (team && !VALID_TEAMS.includes(team)) {
                    return res.status(400).json({
                        error: `Invalid team. Must be one of: ${VALID_TEAMS.join(', ')}`
                    });
                }
                update.team = team || null;
            }

            if (images !== undefined) {
                update.images = images;
            }

            if (productStatus !== undefined) {
                if (!['active', 'inactive'].includes(productStatus)) {
                    return res.status(400).json({ error: 'Invalid product status' });
                }
                update.status = productStatus;
            }

            // Update ticket data fields
            if (eventTitle !== undefined) {
                ticketDataUpdate.eventTitle = eventTitle.trim();
            }

            if (eventDate !== undefined) {
                const eventDateObj = new Date(eventDate);
                if (isNaN(eventDateObj.getTime())) {
                    return res.status(400).json({ error: 'Invalid event date' });
                }
                ticketDataUpdate.eventDate = eventDateObj;
            }

            if (venue !== undefined) {
                ticketDataUpdate.venue = venue.trim();
            }

            if (city !== undefined) {
                ticketDataUpdate.city = city.trim();
            }

            if (section !== undefined) {
                ticketDataUpdate.section = section.trim();
            }

            if (row !== undefined) {
                ticketDataUpdate.row = row?.trim() || null;
            }

            if (quantity !== undefined) {
                if (parseInt(quantity) < 1) {
                    return res.status(400).json({ error: 'Quantity must be at least 1' });
                }
                ticketDataUpdate.quantity = parseInt(quantity);
            }

            if (pricePerTicket !== undefined) {
                if (parseFloat(pricePerTicket) <= 0) {
                    return res.status(400).json({ error: 'Price must be greater than 0' });
                }
                const priceInCents = Math.round(parseFloat(pricePerTicket) * 100);
                ticketDataUpdate.pricePerTicket = priceInCents;
                update.priceUSD = priceInCents;
            }

            if (tier !== undefined) {
                if (tier && !VALID_TIERS.includes(tier)) {
                    return res.status(400).json({
                        error: `Invalid tier. Must be one of: ${VALID_TIERS.join(', ')}`
                    });
                }
                ticketDataUpdate.tier = tier;
            }

            if (source !== undefined) {
                if (!VALID_SOURCES.includes(source)) {
                    return res.status(400).json({
                        error: `Invalid source. Must be one of: ${VALID_SOURCES.join(', ')}`
                    });
                }
                ticketDataUpdate.source = source;
            }

            if (sourceUrl !== undefined) {
                if (!sourceUrl.startsWith('http')) {
                    return res.status(400).json({ error: 'Valid source URL is required' });
                }
                ticketDataUpdate.sourceUrl = sourceUrl;
            }

            if (ticketStatus !== undefined) {
                if (!VALID_TICKET_STATUSES.includes(ticketStatus)) {
                    return res.status(400).json({
                        error: `Invalid ticket status. Must be one of: ${VALID_TICKET_STATUSES.join(', ')}`
                    });
                }
                ticketDataUpdate.status = ticketStatus;
                ticketDataUpdate.lastChecked = new Date();
            }

            // Merge ticketData updates
            if (Object.keys(ticketDataUpdate).length > 0) {
                for (const [key, value] of Object.entries(ticketDataUpdate)) {
                    update[`ticketData.${key}`] = value;
                }
            }

            // Rebuild name if relevant fields changed
            if (eventTitle !== undefined || section !== undefined || row !== undefined) {
                const newEventTitle = eventTitle !== undefined ? eventTitle.trim() : ticket.ticketData.eventTitle;
                const newSection = section !== undefined ? section.trim() : ticket.ticketData.section;
                const newRow = row !== undefined ? (row?.trim() || null) : ticket.ticketData.row;
                const rowDisplay = newRow ? `, Row ${newRow}` : '';
                update.name = `${newEventTitle} - Sec ${newSection}${rowDisplay}`;
            }

            await products.updateOne(
                { _id: new ObjectId(id) },
                { $set: update }
            );

            const updatedTicket = await products.findOne({ _id: new ObjectId(id) });

            return res.status(200).json({
                success: true,
                ticket: {
                    _id: updatedTicket._id.toString(),
                    name: updatedTicket.name,
                    team: updatedTicket.team,
                    priceUSD: updatedTicket.priceUSD,
                    status: updatedTicket.status,
                    ticketData: updatedTicket.ticketData,
                    images: updatedTicket.images || [],
                    createdAt: updatedTicket.createdAt,
                    updatedAt: updatedTicket.updatedAt
                }
            });
        }

        if (req.method === 'DELETE') {
            await products.deleteOne({ _id: new ObjectId(id) });

            return res.status(200).json({
                success: true,
                message: 'Ticket listing deleted'
            });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('Admin ticket update error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
}
