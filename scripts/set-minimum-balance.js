#!/usr/bin/env node
// Script to set minimum balance for all users
// Usage: MONGODB_URI="your-uri" node scripts/set-minimum-balance.js

import { MongoClient } from 'mongodb';

const MINIMUM_BALANCE = 5000;

async function main() {
    const uri = process.env.MONGODB_URI;

    if (!uri) {
        console.error('Error: MONGODB_URI environment variable is required');
        console.log('Usage: MONGODB_URI="mongodb+srv://..." node scripts/set-minimum-balance.js');
        process.exit(1);
    }

    console.log('Connecting to MongoDB...');
    const client = new MongoClient(uri);

    try {
        await client.connect();
        const db = client.db('phillysports');
        const users = db.collection('users');

        // Get current stats
        const totalUsers = await users.countDocuments({ isBot: { $ne: true } });
        const usersBelowMinimum = await users.countDocuments({
            isBot: { $ne: true },
            $or: [
                { coinBalance: { $lt: MINIMUM_BALANCE } },
                { coinBalance: { $exists: false } }
            ]
        });

        console.log(`\nFound ${totalUsers} total users (excluding bots)`);
        console.log(`${usersBelowMinimum} users have less than ${MINIMUM_BALANCE} DD`);

        if (usersBelowMinimum === 0) {
            console.log('\nAll users already have at least the minimum balance!');
            return;
        }

        console.log(`\nUpdating ${usersBelowMinimum} users to ${MINIMUM_BALANCE} DD...`);

        // Update all non-bot users with balance below minimum
        const result = await users.updateMany(
            {
                isBot: { $ne: true },
                $or: [
                    { coinBalance: { $lt: MINIMUM_BALANCE } },
                    { coinBalance: { $exists: false } }
                ]
            },
            [
                {
                    $set: {
                        coinBalance: MINIMUM_BALANCE,
                        lifetimeCoins: {
                            $max: [{ $ifNull: ['$lifetimeCoins', 0] }, MINIMUM_BALANCE]
                        },
                        updatedAt: new Date()
                    }
                }
            ]
        );

        console.log(`\n✓ Successfully updated ${result.modifiedCount} users!`);
        console.log(`  - All users now have at least ${MINIMUM_BALANCE} Diehard Dollars`);

        // Log the transaction
        const transactions = db.collection('transactions');
        await transactions.insertOne({
            type: 'admin_balance_adjustment',
            description: `Set minimum balance to ${MINIMUM_BALANCE} DD for all users`,
            usersAffected: result.modifiedCount,
            minimumBalance: MINIMUM_BALANCE,
            adminAction: true,
            createdAt: new Date()
        });

        console.log('  - Transaction logged');

    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    } finally {
        await client.close();
        console.log('\nDone!');
    }
}

main();
