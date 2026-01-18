// Shared Header Component for PhillySports.com
// Include this script on every page and add <div id="site-header"></div> where the header should appear

(function() {
    'use strict';

    // Header HTML template
    const headerHTML = `
        <header class="header">
            <div class="header-left">
                <button class="mobile-menu-btn" aria-label="Open menu">&#9776;</button>
                <a href="/" class="logo">PhillySports</a>
            </div>
            <div class="header-right" id="headerAuth">
                <button class="theme-toggle" id="themeToggleDefault" title="Toggle dark mode">
                    <span class="theme-icon-light">&#9790;</span>
                    <span class="theme-icon-dark">&#9728;</span>
                </button>
                <a href="/login.html">Login</a>
                <a href="/register.html">Sign Up</a>
            </div>
        </header>
        <nav class="main-nav">
            <div class="nav-inner">
                <div class="nav-dropdown">
                    <span class="nav-item dropdown-trigger">Pro Teams <span class="dropdown-arrow">&#9660;</span></span>
                    <div class="dropdown-menu">
                        <a href="/eagles/">Eagles</a>
                        <a href="/phillies/">Phillies</a>
                        <a href="/sixers/">Sixers</a>
                        <a href="/flyers/">Flyers</a>
                    </div>
                </div>
                <div class="nav-dropdown">
                    <span class="nav-item dropdown-trigger">College <span class="dropdown-arrow">&#9660;</span></span>
                    <div class="dropdown-menu">
                        <a href="/temple/">Temple</a>
                        <a href="/villanova/">Villanova</a>
                        <a href="/penn/">Penn</a>
                        <a href="/drexel/">Drexel</a>
                        <a href="/stjosephs/">St. Joe's</a>
                        <a href="/lasalle/">La Salle</a>
                    </div>
                </div>
                <div class="nav-dropdown">
                    <span class="nav-item dropdown-trigger">Gaming <span class="dropdown-arrow">&#9660;</span></span>
                    <div class="dropdown-menu">
                        <a href="/poker.html">Poker</a>
                        <a href="/fantasy.html">Fantasy</a>
                        <a href="/pools.html">Pools</a>
                        <a href="/trivia.html">Trivia</a>
                        <a href="/predictions.html">Predictions</a>
                        <a href="/esports/">Esports</a>
                    </div>
                </div>
                <div class="nav-dropdown">
                    <span class="nav-item dropdown-trigger">Community <span class="dropdown-arrow">&#9660;</span></span>
                    <div class="dropdown-menu">
                        <a href="/community/">Hub</a>
                        <a href="/community/forums.html">Forums</a>
                        <a href="/community/chat.html">Chat</a>
                        <a href="/community/clubs/">Clubs</a>
                        <a href="/community/tailgates/">Tailgates</a>
                        <a href="/community/watch-parties/">Watch Parties</a>
                    </div>
                </div>
                <a href="/game-threads.html" class="nav-item">Live</a>
                <a href="/report-issue.html" class="nav-item">Report Issue</a>
                <div class="nav-dropdown">
                    <span class="nav-item dropdown-trigger">Shop <span class="dropdown-arrow">&#9660;</span></span>
                    <div class="dropdown-menu">
                        <a href="/shop.html">Shop</a>
                        <a href="/marketplace/">Marketplace</a>
                        <a href="/raffles/">Raffles</a>
                    </div>
                </div>
                <div class="nav-search">
                    <form action="/search.html" method="GET">
                        <input type="search" name="q" placeholder="Search..." class="nav-search-input">
                    </form>
                </div>
            </div>
        </nav>
    `;

    // Header CSS
    const headerCSS = `
        .header {
            background: var(--header-bg, #2c2c2c);
            padding: 0.75rem 1.5rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
            position: sticky;
            top: 0;
            z-index: 100;
        }
        .header-left {
            display: flex;
            align-items: center;
            gap: 1rem;
        }
        .logo {
            color: #fff;
            font-size: 1.5rem;
            font-weight: 700;
            text-decoration: none;
        }
        .header-right {
            display: flex;
            align-items: center;
            gap: 1rem;
        }
        .header-right a {
            color: #ccc;
            text-decoration: none;
            font-size: 0.875rem;
        }
        .header-right a:hover {
            color: #fff;
        }
        .mobile-menu-btn {
            display: none;
            background: none;
            border: none;
            color: #fff;
            font-size: 1.5rem;
            cursor: pointer;
            padding: 0.25rem;
        }
        @media (max-width: 768px) {
            .mobile-menu-btn { display: block; }
            .main-nav { display: none; }
        }

        /* Navigation */
        .main-nav {
            background: var(--header-bg, #2c2c2c);
            border-bottom: 1px solid var(--border-color, #333);
        }
        .nav-inner {
            display: flex;
            max-width: 1400px;
            margin: 0 auto;
            padding: 0 1.5rem;
            align-items: center;
        }
        .nav-item {
            padding: 0.75rem 1rem;
            font-size: 0.75rem;
            font-weight: 600;
            color: var(--nav-text, #d0d0d0);
            text-transform: uppercase;
            letter-spacing: 0.5px;
            cursor: pointer;
            transition: color 0.2s;
            white-space: nowrap;
            text-decoration: none;
        }
        .nav-item:hover { color: var(--accent-color, #8b0000); }
        .nav-dropdown { position: relative; }
        .dropdown-trigger { display: flex; align-items: center; gap: 0.25rem; }
        .dropdown-arrow { font-size: 0.5rem; transition: transform 0.2s; }
        .dropdown-menu {
            position: absolute;
            top: 100%;
            left: 0;
            background: var(--header-bg, #2c2c2c);
            border: 1px solid var(--border-color, #333);
            border-radius: 4px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            min-width: 150px;
            opacity: 0;
            visibility: hidden;
            transform: translateY(-10px);
            transition: all 0.2s;
            z-index: 1000;
        }
        .nav-dropdown:hover .dropdown-menu {
            opacity: 1;
            visibility: visible;
            transform: translateY(0);
        }
        .nav-dropdown:hover .dropdown-arrow { transform: rotate(180deg); }
        .dropdown-menu a {
            display: block;
            padding: 0.6rem 1rem;
            color: var(--nav-text, #d0d0d0);
            text-decoration: none;
            font-size: 0.8rem;
            transition: background 0.2s;
        }
        .dropdown-menu a:hover {
            background: rgba(255,255,255,0.1);
            color: #fff;
        }
        .nav-search { margin-left: auto; }
        .nav-search-input {
            background: rgba(255,255,255,0.1);
            border: 1px solid var(--border-color, #333);
            border-radius: 4px;
            padding: 0.4rem 0.75rem;
            color: #fff;
            font-size: 0.8rem;
            width: 150px;
        }
        .nav-search-input::placeholder { color: #888; }
        .nav-search-input:focus {
            outline: none;
            border-color: var(--accent-color, #8b0000);
            width: 200px;
        }

        /* Coin Display */
        .coin-display {
            display: flex;
            align-items: center;
            gap: 0.25rem;
            background: rgba(255,255,255,0.1);
            padding: 0.3rem 0.6rem;
            border-radius: 20px;
            font-size: 0.85rem;
            color: #ffd700;
        }
        .coin-icon { font-size: 1rem; }
        .buy-coins-link {
            color: #ffd700 !important;
            font-weight: bold;
            margin-left: 0.25rem;
        }

        /* Premium Badge */
        .premium-badge {
            background: linear-gradient(135deg, #ffd700, #ff8c00);
            color: #000 !important;
            font-size: 0.65rem !important;
            font-weight: 700 !important;
            padding: 0.2rem 0.5rem !important;
            border-radius: 4px;
            text-decoration: none;
            letter-spacing: 0.5px;
        }
        .premium-badge:hover {
            background: linear-gradient(135deg, #ffdf00, #ffa500) !important;
        }
        .go-premium-link {
            background: linear-gradient(135deg, #ffd700, #ff8c00);
            color: #000 !important;
            font-size: 0.7rem !important;
            font-weight: 700 !important;
            padding: 0.4rem 0.75rem !important;
            border-radius: 4px;
            text-decoration: none;
            letter-spacing: 0.3px;
            animation: pulse-glow 2s infinite;
        }
        .go-premium-link:hover {
            background: linear-gradient(135deg, #ffdf00, #ffa500) !important;
            transform: scale(1.05);
        }
        @keyframes pulse-glow {
            0%, 100% { box-shadow: 0 0 5px rgba(255, 215, 0, 0.5); }
            50% { box-shadow: 0 0 15px rgba(255, 215, 0, 0.8); }
        }

        /* Admin Link */
        .admin-link {
            background: var(--accent-color, #8b0000);
            color: #fff !important;
            font-size: 0.7rem !important;
            font-weight: 700 !important;
            padding: 0.3rem 0.6rem !important;
            border-radius: 4px;
            text-decoration: none;
            letter-spacing: 0.3px;
        }
        .admin-link:hover {
            background: #a00000 !important;
            transform: scale(1.05);
        }

        /* Theme Toggle */
        .theme-toggle {
            background: none;
            border: 1px solid var(--border-color, #333);
            border-radius: 20px;
            padding: 0.4rem 0.6rem;
            cursor: pointer;
            font-size: 1rem;
            line-height: 1;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            gap: 0.25rem;
            color: inherit;
        }
        .theme-toggle:hover { background: rgba(255,255,255,0.1); }
        .theme-icon-light, .theme-icon-dark { display: none; }
        .theme-icon-light { display: inline; }
        [data-theme="dark"] .theme-icon-light { display: none; }
        [data-theme="dark"] .theme-icon-dark { display: inline; }
    `;

    // Inject CSS
    function injectCSS() {
        if (document.getElementById('header-styles')) return;
        const style = document.createElement('style');
        style.id = 'header-styles';
        style.textContent = headerCSS;
        document.head.appendChild(style);
    }

    // Inject Header HTML
    function injectHeader() {
        const container = document.getElementById('site-header');
        if (container) {
            container.innerHTML = headerHTML;
        } else {
            // If no container, insert at beginning of body
            document.body.insertAdjacentHTML('afterbegin', headerHTML);
        }
    }

    // Theme toggle functionality
    function initThemeToggle() {
        const toggle = document.getElementById('themeToggle') || document.getElementById('themeToggleDefault');
        if (!toggle) return;

        const savedTheme = localStorage.getItem('theme');
        if (savedTheme) {
            document.documentElement.setAttribute('data-theme', savedTheme);
        }

        toggle.addEventListener('click', function() {
            const current = document.documentElement.getAttribute('data-theme');
            const newTheme = current === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
        });
    }

    // Check authentication and update header
    async function checkAuth() {
        try {
            const response = await fetch('/api/auth/me', { credentials: 'include' });
            const data = await response.json();

            if (data.user) {
                const headerAuth = document.getElementById('headerAuth');

                const premiumBadge = data.user.isSubscribed
                    ? `<a href="/membership.html" class="premium-badge" title="${data.user.subscriptionTierName || 'Premium'}">${data.user.subscriptionTier === 'diehard_pro' ? 'PRO' : '+'}</a>`
                    : `<a href="/membership.html" class="go-premium-link">Go Premium</a>`;

                const adminLink = data.user.isAdmin
                    ? `<a href="/admin.html" class="admin-link" title="Admin Dashboard">Admin</a>`
                    : '';

                headerAuth.innerHTML = `
                    <button class="theme-toggle" id="themeToggle" title="Toggle dark mode">
                        <span class="theme-icon-light">&#9790;</span>
                        <span class="theme-icon-dark">&#9728;</span>
                    </button>
                    <div class="coin-display" title="Diehard Dollars">
                        <span class="coin-icon">&#129689;</span>
                        <span class="coin-balance">${Math.round(data.user.coinBalance || 0)}</span>
                        <a href="/shop.html#coin-packs" class="buy-coins-link" title="Buy Diehard Dollars">+</a>
                    </div>
                    ${premiumBadge}
                    ${adminLink}
                    <a href="/profile.html">${data.user.username}</a>
                    <a href="#" id="logoutBtn">Logout</a>
                `;

                // Re-init theme toggle after updating header
                initThemeToggle();

                // Add logout handler
                document.getElementById('logoutBtn')?.addEventListener('click', async (e) => {
                    e.preventDefault();
                    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
                    localStorage.removeItem('auth_token');
                    window.location.reload();
                });
            }
        } catch (error) {
            // Not logged in, keep default header
        }
    }

    // Initialize
    function init() {
        injectCSS();
        injectHeader();
        initThemeToggle();
        checkAuth();
    }

    // Run on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Export for external use if needed
    window.PhillySportsHeader = {
        checkAuth,
        initThemeToggle
    };
})();
