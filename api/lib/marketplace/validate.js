// Marketplace Listing Validation
// Validates user-submitted marketplace listings

const VALID_CATEGORIES = [
    'jerseys',
    'memorabilia',
    'tickets',
    'cards',
    'apparel',
    'accessories',
    'collectibles',
    'other'
];

const VALID_TEAMS = ['eagles', 'phillies', 'sixers', 'flyers'];

const VALID_CONDITIONS = ['new', 'like_new', 'good', 'fair', 'poor'];

const VALID_PRODUCT_TYPES = ['physical', 'digital'];

const VALID_SHIPPING_METHODS = ['standard', 'priority', 'express'];

const VALID_DIGITAL_DELIVERY_TYPES = ['download', 'email', 'in-app'];

/**
 * Validate a marketplace listing
 * @param {Object} data - Listing data to validate
 * @returns {{ isValid: boolean, errors: string[] }}
 */
export function validateListing(data) {
    const errors = [];

    // Title validation
    if (!data.title || typeof data.title !== 'string') {
        errors.push('Title is required');
    } else {
        const titleLength = data.title.trim().length;
        if (titleLength < 5) {
            errors.push('Title must be at least 5 characters');
        }
        if (titleLength > 200) {
            errors.push('Title must be 200 characters or less');
        }
    }

    // Description validation
    if (!data.description || typeof data.description !== 'string') {
        errors.push('Description is required');
    } else {
        const descLength = data.description.trim().length;
        if (descLength < 20) {
            errors.push('Description must be at least 20 characters');
        }
        if (descLength > 5000) {
            errors.push('Description must be 5000 characters or less');
        }
    }

    // Category validation
    if (!data.category) {
        errors.push('Category is required');
    } else if (!VALID_CATEGORIES.includes(data.category)) {
        errors.push(`Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}`);
    }

    // Team validation (optional but must be valid if provided)
    if (data.team && !VALID_TEAMS.includes(data.team)) {
        errors.push(`Invalid team. Must be one of: ${VALID_TEAMS.join(', ')}`);
    }

    // Condition validation
    if (!data.condition) {
        errors.push('Condition is required');
    } else if (!VALID_CONDITIONS.includes(data.condition)) {
        errors.push(`Invalid condition. Must be one of: ${VALID_CONDITIONS.join(', ')}`);
    }

    // Product type validation
    if (!data.productType) {
        errors.push('Product type is required');
    } else if (!VALID_PRODUCT_TYPES.includes(data.productType)) {
        errors.push(`Invalid product type. Must be one of: ${VALID_PRODUCT_TYPES.join(', ')}`);
    }

    // Payment method validation
    if (!data.acceptsUSD && !data.acceptsDiehardDollars) {
        errors.push('Must accept at least one payment method (USD or Diehard Dollars)');
    }

    // USD price validation
    if (data.acceptsUSD) {
        if (!data.priceUSD || typeof data.priceUSD !== 'number') {
            errors.push('USD price is required when accepting USD');
        } else if (data.priceUSD < 100) {
            errors.push('USD price must be at least $1.00 (100 cents)');
        } else if (data.priceUSD > 100000000) {
            errors.push('USD price cannot exceed $1,000,000');
        }
    }

    // Diehard Dollars price validation
    if (data.acceptsDiehardDollars) {
        if (!data.priceDiehardDollars || typeof data.priceDiehardDollars !== 'number') {
            errors.push('Diehard Dollars price is required when accepting DD');
        } else if (data.priceDiehardDollars < 10) {
            errors.push('Diehard Dollars price must be at least 10');
        } else if (data.priceDiehardDollars > 10000000) {
            errors.push('Diehard Dollars price cannot exceed 10,000,000');
        }
    }

    // Quantity validation
    if (data.quantity !== undefined) {
        if (typeof data.quantity !== 'number' || data.quantity < 1) {
            errors.push('Quantity must be at least 1');
        } else if (data.quantity > 1000) {
            errors.push('Quantity cannot exceed 1000');
        }
    }

    // Physical product validations
    if (data.productType === 'physical') {
        if (!data.shippingInfo) {
            errors.push('Shipping information is required for physical items');
        } else {
            const shipping = data.shippingInfo;

            if (!shipping.shipsFrom || typeof shipping.shipsFrom !== 'string') {
                errors.push('Ships from location is required');
            } else if (shipping.shipsFrom.trim().length < 2) {
                errors.push('Ships from location is too short');
            }

            if (!shipping.handlingTime || typeof shipping.handlingTime !== 'number') {
                errors.push('Handling time is required');
            } else if (shipping.handlingTime < 1 || shipping.handlingTime > 30) {
                errors.push('Handling time must be between 1 and 30 days');
            }

            if (!shipping.shippingOptions || !Array.isArray(shipping.shippingOptions)) {
                errors.push('At least one shipping option is required');
            } else if (shipping.shippingOptions.length === 0) {
                errors.push('At least one shipping option is required');
            } else {
                shipping.shippingOptions.forEach((option, index) => {
                    if (!VALID_SHIPPING_METHODS.includes(option.method)) {
                        errors.push(`Shipping option ${index + 1}: Invalid method`);
                    }
                    if (typeof option.priceUSD !== 'number' || option.priceUSD < 0) {
                        errors.push(`Shipping option ${index + 1}: Invalid price`);
                    }
                    if (!option.estimatedDays || typeof option.estimatedDays !== 'string') {
                        errors.push(`Shipping option ${index + 1}: Estimated days required`);
                    }
                });
            }
        }
    }

    // Digital product validations
    if (data.productType === 'digital') {
        if (!data.digitalDelivery) {
            errors.push('Digital delivery information is required for digital items');
        } else {
            const delivery = data.digitalDelivery;

            if (!VALID_DIGITAL_DELIVERY_TYPES.includes(delivery.type)) {
                errors.push(`Invalid digital delivery type. Must be one of: ${VALID_DIGITAL_DELIVERY_TYPES.join(', ')}`);
            }

            if (!delivery.description || typeof delivery.description !== 'string') {
                errors.push('Digital delivery description is required');
            } else if (delivery.description.trim().length < 10) {
                errors.push('Digital delivery description must be at least 10 characters');
            }
        }
    }

    // Images validation
    if (data.images) {
        if (!Array.isArray(data.images)) {
            errors.push('Images must be an array');
        } else if (data.images.length > 8) {
            errors.push('Maximum 8 images allowed');
        } else {
            data.images.forEach((image, index) => {
                if (!image.url || typeof image.url !== 'string') {
                    errors.push(`Image ${index + 1}: URL is required`);
                }
            });
        }
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}

/**
 * Validate listing update (partial validation)
 * @param {Object} data - Partial listing data to validate
 * @returns {{ isValid: boolean, errors: string[] }}
 */
export function validateListingUpdate(data) {
    const errors = [];

    // Only validate fields that are being updated
    if (data.title !== undefined) {
        if (typeof data.title !== 'string') {
            errors.push('Title must be a string');
        } else {
            const titleLength = data.title.trim().length;
            if (titleLength < 5) {
                errors.push('Title must be at least 5 characters');
            }
            if (titleLength > 200) {
                errors.push('Title must be 200 characters or less');
            }
        }
    }

    if (data.description !== undefined) {
        if (typeof data.description !== 'string') {
            errors.push('Description must be a string');
        } else {
            const descLength = data.description.trim().length;
            if (descLength < 20) {
                errors.push('Description must be at least 20 characters');
            }
            if (descLength > 5000) {
                errors.push('Description must be 5000 characters or less');
            }
        }
    }

    if (data.category !== undefined && !VALID_CATEGORIES.includes(data.category)) {
        errors.push(`Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}`);
    }

    if (data.team !== undefined && data.team !== null && !VALID_TEAMS.includes(data.team)) {
        errors.push(`Invalid team. Must be one of: ${VALID_TEAMS.join(', ')}`);
    }

    if (data.condition !== undefined && !VALID_CONDITIONS.includes(data.condition)) {
        errors.push(`Invalid condition. Must be one of: ${VALID_CONDITIONS.join(', ')}`);
    }

    if (data.priceUSD !== undefined) {
        if (typeof data.priceUSD !== 'number' || data.priceUSD < 100) {
            errors.push('USD price must be at least $1.00 (100 cents)');
        }
    }

    if (data.priceDiehardDollars !== undefined) {
        if (typeof data.priceDiehardDollars !== 'number' || data.priceDiehardDollars < 10) {
            errors.push('Diehard Dollars price must be at least 10');
        }
    }

    if (data.quantity !== undefined) {
        if (typeof data.quantity !== 'number' || data.quantity < 1) {
            errors.push('Quantity must be at least 1');
        }
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}

/**
 * Get valid categories
 * @returns {string[]}
 */
export function getValidCategories() {
    return [...VALID_CATEGORIES];
}

/**
 * Get valid teams
 * @returns {string[]}
 */
export function getValidTeams() {
    return [...VALID_TEAMS];
}

/**
 * Get valid conditions
 * @returns {string[]}
 */
export function getValidConditions() {
    return [...VALID_CONDITIONS];
}
