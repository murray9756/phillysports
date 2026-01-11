// Validation utilities

export function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

export function isValidUsername(username) {
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    return usernameRegex.test(username);
}

export function isValidPassword(password) {
    return password && password.length >= 8;
}

export function isValidTeam(team) {
    const validTeams = ['eagles', 'phillies', 'sixers', 'flyers', null, ''];
    return validTeams.includes(team?.toLowerCase());
}

export function sanitizeString(str, maxLength = 500) {
    if (!str) return '';
    return str
        .replace(/<[^>]*>/g, '')
        .trim()
        .substring(0, maxLength);
}

export function validateRegistration(data) {
    const errors = [];

    if (!data.username) {
        errors.push('Username is required');
    } else if (!isValidUsername(data.username)) {
        errors.push('Username must be 3-20 characters and contain only letters, numbers, and underscores');
    }

    if (!data.email) {
        errors.push('Email is required');
    } else if (!isValidEmail(data.email)) {
        errors.push('Invalid email format');
    }

    if (!data.password) {
        errors.push('Password is required');
    } else if (!isValidPassword(data.password)) {
        errors.push('Password must be at least 8 characters');
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}

export function validateLogin(data) {
    const errors = [];

    if (!data.email) {
        errors.push('Email is required');
    }

    if (!data.password) {
        errors.push('Password is required');
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}

export function validateProfileUpdate(data) {
    const errors = [];

    if (data.username !== undefined && !isValidUsername(data.username)) {
        errors.push('Username must be 3-20 characters and contain only letters, numbers, and underscores');
    }

    if (data.email !== undefined && !isValidEmail(data.email)) {
        errors.push('Invalid email format');
    }

    if (data.bio !== undefined && data.bio.length > 500) {
        errors.push('Bio must be 500 characters or less');
    }

    if (data.favoriteTeam !== undefined && !isValidTeam(data.favoriteTeam)) {
        errors.push('Invalid team selection');
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}
