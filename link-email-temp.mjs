import { MongoClient } from 'mongodb';

// INSTRUCTIONS:
// 1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
// 2. Find MONGODB_URI and click the eye icon to reveal it
// 3. Copy the full value and paste it below (replace the placeholder)
// 4. Save this file and run: node link-email-temp.mjs

const uri = "PASTE_YOUR_MONGODB_URI_HERE";

async function linkEmail() {
    if (uri === "PASTE_YOUR_MONGODB_URI_HERE") {
        console.log("ERROR: Please paste your MONGODB_URI from Vercel first!");
        console.log("Go to: Vercel Dashboard → Settings → Environment Variables → MONGODB_URI");
        return;
    }

    const client = new MongoClient(uri);

    try {
        await client.connect();
        const db = client.db();
        const users = db.collection('users');

        // Find murray44 specifically
        const user = await users.findOne({ username: 'murray44' });
        
        if (!user) {
            console.log('User murray44 not found');
            return;
        }
        
        console.log('Found user:', user.username, user._id.toString());
        
        const result = await users.updateOne(
            { _id: user._id },
            { 
                $set: { 
                    premiumEmail: {
                        prefix: 'kevin',
                        email: 'kevin@phillysports.com',
                        zohoAccountId: '6751363000000008001',
                        createdAt: new Date(),
                        status: 'active'
                    },
                    isSubscribed: true,
                    subscriptionTier: 'premium',
                    subscriptionStatus: 'active',
                    updatedAt: new Date()
                }
            }
        );
        
        console.log('Updated:', result.modifiedCount, 'document(s)');
        console.log('\nSUCCESS! kevin@phillysports.com is now linked to murray44');
        console.log('Test by logging in as murray44 and visiting /mail.html');
        
    } finally {
        await client.close();
    }
}

linkEmail().catch(console.error);
