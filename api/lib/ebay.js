// eBay Browse API Client
// Requires: EBAY_APP_ID, EBAY_CERT_ID, EBAY_AFFILIATE_CAMPAIGN_ID in environment

// eBay API endpoints
const EBAY_AUTH_URL = 'https://api.ebay.com/identity/v1/oauth2/token';
const EBAY_BROWSE_URL = 'https://api.ebay.com/buy/browse/v1';

// Cache for OAuth token
let tokenCache = {
    token: null,
    expiresAt: null
};

/**
 * Get OAuth token for eBay API (Application token - no user auth needed)
 */
async function getAccessToken() {
    // Return cached token if still valid
    if (tokenCache.token && tokenCache.expiresAt && Date.now() < tokenCache.expiresAt) {
        return tokenCache.token;
    }

    const appId = process.env.EBAY_APP_ID;
    const certId = process.env.EBAY_CERT_ID;

    if (!appId || !certId) {
        throw new Error('eBay API credentials not configured (EBAY_APP_ID, EBAY_CERT_ID)');
    }

    // Base64 encode credentials
    const credentials = Buffer.from(`${appId}:${certId}`).toString('base64');

    const response = await fetch(EBAY_AUTH_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${credentials}`
        },
        body: 'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope'
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`eBay auth failed: ${error}`);
    }

    const data = await response.json();

    // Cache token (expires_in is in seconds, subtract 5 min buffer)
    tokenCache = {
        token: data.access_token,
        expiresAt: Date.now() + (data.expires_in - 300) * 1000
    };

    return data.access_token;
}

/**
 * Search eBay items
 * @param {Object} options - Search options
 * @param {string} options.query - Search keywords
 * @param {string} options.category - eBay category ID (optional)
 * @param {number} options.limit - Number of results (default 20, max 200)
 * @param {number} options.offset - Pagination offset
 * @param {string} options.sort - Sort order (price, -price, newlyListed, etc)
 * @param {string} options.filter - Filter string (e.g., "buyingOptions:{FIXED_PRICE}")
 */
export async function searchItems(options = {}) {
    const token = await getAccessToken();

    const params = new URLSearchParams();
    params.set('q', options.query || 'philadelphia eagles');
    params.set('limit', Math.min(options.limit || 20, 200).toString());

    if (options.offset) params.set('offset', options.offset.toString());
    if (options.sort) params.set('sort', options.sort);

    // Default filters for better results
    const filters = [
        'buyingOptions:{FIXED_PRICE|AUCTION}',
        'deliveryCountry:US',
        'itemLocationCountry:US'
    ];

    if (options.filter) {
        filters.push(options.filter);
    }

    params.set('filter', filters.join(','));

    // Add affiliate tracking
    const campaignId = process.env.EBAY_AFFILIATE_CAMPAIGN_ID;
    if (campaignId) {
        params.set('X-EBAY-C-ENDUSERCTX', `affiliateCampaignId=${campaignId}`);
    }

    const response = await fetch(`${EBAY_BROWSE_URL}/item_summary/search?${params}`, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
            'Content-Type': 'application/json'
        }
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`eBay search failed: ${error}`);
    }

    const data = await response.json();

    // Transform results to our format
    return {
        total: data.total || 0,
        items: (data.itemSummaries || []).map(transformItem),
        offset: data.offset || 0,
        limit: data.limit || 20
    };
}

/**
 * Get single item details
 * @param {string} itemId - eBay item ID (e.g., "v1|123456789|0")
 */
export async function getItem(itemId) {
    const token = await getAccessToken();

    const response = await fetch(`${EBAY_BROWSE_URL}/item/${encodeURIComponent(itemId)}`, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
            'Content-Type': 'application/json'
        }
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`eBay get item failed: ${error}`);
    }

    const item = await response.json();
    return transformItemDetails(item);
}

/**
 * Get item by legacy ID (the 12-digit number from eBay URLs)
 */
export async function getItemByLegacyId(legacyItemId) {
    const token = await getAccessToken();

    const response = await fetch(`${EBAY_BROWSE_URL}/item/get_item_by_legacy_id?legacy_item_id=${legacyItemId}`, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
            'Content-Type': 'application/json'
        }
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`eBay get item failed: ${error}`);
    }

    const item = await response.json();
    return transformItemDetails(item);
}

/**
 * Build affiliate link for an item
 */
export function buildAffiliateLink(itemWebUrl) {
    const campaignId = process.env.EBAY_AFFILIATE_CAMPAIGN_ID;

    if (!campaignId || !itemWebUrl) {
        return itemWebUrl;
    }

    // eBay Partner Network tracking URL format
    const affiliateUrl = new URL('https://rover.ebay.com/rover/1/' + campaignId + '/1');
    affiliateUrl.searchParams.set('mpre', itemWebUrl);
    affiliateUrl.searchParams.set('toolid', '10001');

    return affiliateUrl.toString();
}

/**
 * Transform eBay item summary to our format
 */
function transformItem(item) {
    return {
        itemId: item.itemId,
        legacyItemId: item.legacyItemId,
        title: item.title,
        shortDescription: item.shortDescription || null,
        price: item.price?.value ? parseFloat(item.price.value) : null,
        currency: item.price?.currency || 'USD',
        condition: item.condition || 'Unknown',
        conditionId: item.conditionId || null,
        images: item.thumbnailImages?.map(img => img.imageUrl) ||
                (item.image?.imageUrl ? [item.image.imageUrl] : []),
        itemWebUrl: item.itemWebUrl,
        affiliateLink: buildAffiliateLink(item.itemWebUrl),
        seller: {
            username: item.seller?.username || 'Unknown',
            feedbackPercentage: item.seller?.feedbackPercentage || null,
            feedbackScore: item.seller?.feedbackScore || null
        },
        shippingCost: item.shippingOptions?.[0]?.shippingCost?.value
            ? parseFloat(item.shippingOptions[0].shippingCost.value)
            : null,
        freeShipping: item.shippingOptions?.[0]?.shippingCost?.value === '0.00',
        buyingOptions: item.buyingOptions || [],
        categories: item.categories?.map(c => ({ id: c.categoryId, name: c.categoryName })) || [],
        location: item.itemLocation?.city
            ? `${item.itemLocation.city}, ${item.itemLocation.stateOrProvince || ''}`
            : null
    };
}

/**
 * Transform full item details to our format
 */
function transformItemDetails(item) {
    const base = transformItem(item);

    return {
        ...base,
        description: item.description || item.shortDescription || '',
        images: item.additionalImages?.map(img => img.imageUrl) ||
                item.image?.imageUrl ? [item.image.imageUrl] : [],
        brand: item.brand || null,
        mpn: item.mpn || null,
        color: item.color || null,
        size: item.size || null,
        itemEndDate: item.itemEndDate || null,
        quantityAvailable: item.estimatedAvailabilities?.[0]?.estimatedAvailableQuantity || 1,
        returnTerms: item.returnTerms?.returnsAccepted ? {
            accepted: true,
            period: item.returnTerms.returnPeriod?.value
                ? `${item.returnTerms.returnPeriod.value} ${item.returnTerms.returnPeriod.unit}`
                : null
        } : { accepted: false }
    };
}

/**
 * Philly sports team search presets
 */
export const PHILLY_TEAM_SEARCHES = {
    eagles: [
        'philadelphia eagles jersey',
        'philadelphia eagles autograph',
        'philadelphia eagles memorabilia',
        'eagles super bowl'
    ],
    phillies: [
        'philadelphia phillies jersey',
        'phillies autograph',
        'phillies game used',
        'phillies world series'
    ],
    sixers: [
        'philadelphia 76ers jersey',
        'sixers autograph',
        '76ers memorabilia',
        'allen iverson signed'
    ],
    flyers: [
        'philadelphia flyers jersey',
        'flyers autograph signed',
        'flyers game worn',
        'flyers stanley cup'
    ]
};

/**
 * eBay category IDs for sports memorabilia
 */
export const EBAY_CATEGORIES = {
    sports_memorabilia: '64482',
    sports_cards: '212',
    jerseys: '24409',
    autographs: '165',
    game_used: '50127',
    tickets: '173634'
};
