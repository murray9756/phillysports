// Shared Header Component for PhillySports.com
// Matches homepage newspaper-style header with centered logo
// Include this script on every page and add <div id="site-header"></div> where the header should appear
// Version: 2.4 - Added global dark mode styles for entire page

(function() {
    'use strict';

    // Header HTML template
    const headerHTML = `
        <header class="header">
            <div class="header-top">
                <!-- Left Column: Google Search + Theme Toggle -->
                <div class="header-left">
                    <div class="header-search">
                        <form action="https://www.google.com/search" method="GET" target="_blank">
                            <img src="https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_92x30dp.png" alt="Google" class="google-logo">
                            <input type="text" name="q" placeholder="Search the web..." required>
                            <button type="submit">Go</button>
                        </form>
                    </div>
                    <button class="theme-toggle" id="themeToggle" title="Toggle dark mode">
                        <span class="theme-icon-light">&#9790;</span>
                        <span class="theme-icon-dark">&#9728;</span>
                        <span class="theme-label">Dark Mode</span>
                    </button>
                </div>
                <!-- Center Column: Logo -->
                <a href="/" class="header-logo">
                    <!-- Dark background logo (shows in light mode) -->
                    <div class="logo-for-light" style="position: relative; width: 440px; height: 140px; background: linear-gradient(180deg, #1A2744 0%, #0d1520 100%); border: 6px solid #F5F0E1; overflow: hidden;">
                        <div style="position: absolute; top: 6px; left: 6px; right: 6px; bottom: 6px; border: 2px solid #8B1A28; pointer-events: none; z-index: 10;"></div>
                        <img src="/ben.jpeg" alt="Ben Franklin" style="position: absolute; top: 50%; left: -10px; transform: translateY(-50%); height: 130px; width: auto; opacity: 0.25; filter: invert(1) brightness(1.2); z-index: 1;">
                        <div style="position: absolute; top: 8px; left: 70px; right: 20px; display: flex; justify-content: center; align-items: center; gap: 8px; z-index: 5;">
                            <svg style="width: 24px; height: 24px; filter: drop-shadow(1px 1px 2px rgba(0,0,0,0.6));" viewBox="0 0 40 40">
                                <defs><linearGradient id="redStarF2h" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#c42030"/><stop offset="50%" style="stop-color:#8B1A28"/><stop offset="100%" style="stop-color:#5a0f15"/></linearGradient></defs>
                                <polygon points="20,2 24,14 37,14 27,22 31,35 20,27 9,35 13,22 3,14 16,14" fill="url(#redStarF2h)"/>
                            </svg>
                            <span style="font-family: 'Brush Script MT', cursive; font-size: 18px; color: #F5F0E1; letter-spacing: 3px;">Est. 2026</span>
                            <svg style="width: 24px; height: 24px; filter: drop-shadow(1px 1px 2px rgba(0,0,0,0.6));" viewBox="0 0 40 40">
                                <defs><linearGradient id="blueStarF2h" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#6a8fc4"/><stop offset="50%" style="stop-color:#4a6fa0"/><stop offset="100%" style="stop-color:#3a5a8c"/></linearGradient></defs>
                                <polygon points="20,2 24,14 37,14 27,22 31,35 20,27 9,35 13,22 3,14 16,14" fill="url(#blueStarF2h)"/>
                            </svg>
                        </div>
                        <div style="position: absolute; top: 50%; left: 57%; transform: translate(-50%, -50%); display: flex; align-items: baseline; gap: 6px; z-index: 5;">
                            <span style="font-family: 'Brush Script MT', cursive; font-size: 42px; color: #F5F0E1; line-height: 1;">Philly</span>
                            <span style="font-family: 'Impact', 'Arial Black', sans-serif; font-size: 42px; color: #8B1A28; line-height: 1; letter-spacing: -1px;">SPORTS</span>
                            <span style="font-family: Georgia, serif; font-size: 16px; color: #F5F0E1; letter-spacing: 1px; font-weight: bold;">.COM</span>
                        </div>
                        <div style="position: absolute; bottom: 8px; left: 70px; right: 20px; text-align: center; font-family: Georgia, serif; font-size: 16px; font-weight: bold; font-style: italic; color: #F5F0E1; letter-spacing: 2px; z-index: 5;">Where the Diehards, Play Hard</div>
                    </div>
                    <!-- Light background logo (shows in dark mode) -->
                    <div class="logo-for-dark" style="position: relative; width: 440px; height: 140px; background: linear-gradient(180deg, #F5F0E1 0%, #e8e0cc 100%); border: 6px solid #1A2744; overflow: hidden;">
                        <div style="position: absolute; top: 6px; left: 6px; right: 6px; bottom: 6px; border: 2px solid #8B1A28; pointer-events: none; z-index: 10;"></div>
                        <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.2) 100%); z-index: 8; pointer-events: none;"></div>
                        <img src="/ben.jpeg" alt="Ben Franklin" style="position: absolute; top: 50%; left: -10px; transform: translateY(-50%); height: 130px; width: auto; opacity: 0.4; z-index: 1;">
                        <div style="position: absolute; top: 8px; left: 70px; right: 20px; display: flex; justify-content: center; align-items: center; gap: 8px; z-index: 5;">
                            <svg style="width: 24px; height: 24px; filter: drop-shadow(1px 1px 2px rgba(0,0,0,0.4));" viewBox="0 0 40 40">
                                <defs><linearGradient id="redStarF5h" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#c42030"/><stop offset="50%" style="stop-color:#8B1A28"/><stop offset="100%" style="stop-color:#5a0f15"/></linearGradient></defs>
                                <polygon points="20,2 24,14 37,14 27,22 31,35 20,27 9,35 13,22 3,14 16,14" fill="url(#redStarF5h)"/>
                            </svg>
                            <span style="font-family: 'Brush Script MT', cursive; font-size: 18px; color: #1A2744; letter-spacing: 3px;">Est. 2026</span>
                            <svg style="width: 24px; height: 24px; filter: drop-shadow(1px 1px 2px rgba(0,0,0,0.4));" viewBox="0 0 40 40">
                                <defs><linearGradient id="blueStarF5h" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#3a5a8c"/><stop offset="50%" style="stop-color:#1A2744"/><stop offset="100%" style="stop-color:#0d1520"/></linearGradient></defs>
                                <polygon points="20,2 24,14 37,14 27,22 31,35 20,27 9,35 13,22 3,14 16,14" fill="url(#blueStarF5h)"/>
                            </svg>
                        </div>
                        <div style="position: absolute; top: 50%; left: 57%; transform: translate(-50%, -50%); display: flex; align-items: baseline; gap: 6px; z-index: 5;">
                            <span style="font-family: 'Brush Script MT', cursive; font-size: 42px; color: #1A2744; line-height: 1;">Philly</span>
                            <span style="font-family: 'Impact', 'Arial Black', sans-serif; font-size: 42px; color: #8B1A28; line-height: 1; letter-spacing: -1px;">SPORTS</span>
                            <span style="font-family: Georgia, serif; font-size: 16px; color: #1A2744; letter-spacing: 1px; font-weight: bold;">.COM</span>
                        </div>
                        <div style="position: absolute; bottom: 8px; left: 70px; right: 20px; text-align: center; font-family: Georgia, serif; font-size: 16px; font-weight: bold; font-style: italic; color: #1A2744; letter-spacing: 2px; z-index: 5;">Where the Diehards, Play Hard</div>
                    </div>
                </a>
                <!-- Right Column: Auth -->
                <div class="header-right">
                    <div class="header-auth" id="headerAuth">
                        <a href="/login.html">Login</a>
                        <a href="/register.html" class="auth-btn">Sign Up</a>
                    </div>
                </div>
                <button class="mobile-menu-btn" aria-label="Menu">&#9776;</button>
            </div>
            <nav class="main-nav">
                <div class="nav-inner">
                    <a href="/" class="nav-item">Home</a>

                    <div class="nav-dropdown">
                        <span class="nav-item dropdown-trigger">Pro Teams <span class="dropdown-arrow">&#9660;</span></span>
                        <div class="dropdown-menu">
                            <a href="/eagles/">Eagles</a>
                            <a href="/phillies/">Phillies</a>
                            <a href="/sixers/">76ers</a>
                            <a href="/flyers/">Flyers</a>
                        </div>
                    </div>

                    <div class="nav-dropdown">
                        <span class="nav-item dropdown-trigger">College <span class="dropdown-arrow">&#9660;</span></span>
                        <div class="dropdown-menu">
                            <a href="/villanova/">Villanova</a>
                            <a href="/penn/">Penn</a>
                            <a href="/lasalle/">La Salle</a>
                            <a href="/drexel/">Drexel</a>
                            <a href="/stjosephs/">St. Joseph's</a>
                            <a href="/temple/">Temple</a>
                        </div>
                    </div>

                    <div class="nav-dropdown">
                        <span class="nav-item dropdown-trigger">Gaming <span class="dropdown-arrow">&#9660;</span></span>
                        <div class="dropdown-menu">
                            <a href="/fantasy.html">Fantasy</a>
                            <a href="/pools.html">Pools</a>
                            <a href="/poker.html">Poker</a>
                            <a href="/trivia.html">Trivia</a>
                            <a href="/predictions.html">Predictions</a>
                        </div>
                    </div>

                    <div class="nav-dropdown">
                        <span class="nav-item dropdown-trigger">Betting <span class="dropdown-arrow">&#9660;</span></span>
                        <div class="dropdown-menu">
                            <a href="/odds.html">Odds</a>
                            <a href="/bets.html">Bets</a>
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
                            <a href="/leaderboard.html">Leaderboard</a>
                        </div>
                    </div>

                    <div class="nav-dropdown">
                        <span class="nav-item dropdown-trigger">Shop <span class="dropdown-arrow">&#9660;</span></span>
                        <div class="dropdown-menu">
                            <a href="/shop.html">Shop</a>
                            <a href="/marketplace/">Marketplace</a>
                            <a href="/raffles/">Raffles</a>
                            <a href="/membership.html">Membership</a>
                        </div>
                    </div>

                    <a href="/esports/" class="nav-item">eSports</a>
                    <a href="/youth/" class="nav-item">Youth</a>
                    <a href="/game-threads.html" class="nav-item">Live</a>
                </div>
            </nav>
        </header>

        <!-- Mobile Menu Overlay -->
        <div class="mobile-menu-overlay" id="mobileMenuOverlay"></div>

        <!-- Mobile Menu Panel -->
        <nav class="mobile-menu" id="mobileMenu">
            <div class="mobile-menu-header">
                <span>Menu</span>
                <button class="mobile-menu-close" id="mobileMenuClose" aria-label="Close menu">&times;</button>
            </div>
            <div class="mobile-menu-search">
                <form action="https://www.google.com/search" method="GET" target="_blank">
                    <input type="text" name="q" placeholder="Search the web..." required>
                    <button type="submit">Go</button>
                </form>
            </div>
            <div class="mobile-menu-auth" id="mobileMenuAuth">
                <a href="/login.html" class="login-btn">Login</a>
                <a href="/register.html" class="signup-btn">Sign Up</a>
            </div>
            <div class="mobile-nav-items">
                <a href="/" class="mobile-nav-item">Home</a>

                <div class="mobile-nav-dropdown">
                    <div class="mobile-nav-dropdown-trigger">
                        <span>Pro Teams</span>
                        <span class="arrow">&#9660;</span>
                    </div>
                    <div class="mobile-nav-dropdown-menu">
                        <a href="/eagles/">Eagles</a>
                        <a href="/phillies/">Phillies</a>
                        <a href="/sixers/">76ers</a>
                        <a href="/flyers/">Flyers</a>
                    </div>
                </div>

                <div class="mobile-nav-dropdown">
                    <div class="mobile-nav-dropdown-trigger">
                        <span>College</span>
                        <span class="arrow">&#9660;</span>
                    </div>
                    <div class="mobile-nav-dropdown-menu">
                        <a href="/villanova/">Villanova</a>
                        <a href="/penn/">Penn</a>
                        <a href="/lasalle/">La Salle</a>
                        <a href="/drexel/">Drexel</a>
                        <a href="/stjosephs/">St. Joseph's</a>
                        <a href="/temple/">Temple</a>
                    </div>
                </div>

                <div class="mobile-nav-dropdown">
                    <div class="mobile-nav-dropdown-trigger">
                        <span>Gaming</span>
                        <span class="arrow">&#9660;</span>
                    </div>
                    <div class="mobile-nav-dropdown-menu">
                        <a href="/fantasy.html">Fantasy</a>
                        <a href="/pools.html">Pools</a>
                        <a href="/poker.html">Poker</a>
                        <a href="/trivia.html">Trivia</a>
                        <a href="/predictions.html">Predictions</a>
                    </div>
                </div>

                <div class="mobile-nav-dropdown">
                    <div class="mobile-nav-dropdown-trigger">
                        <span>Betting</span>
                        <span class="arrow">&#9660;</span>
                    </div>
                    <div class="mobile-nav-dropdown-menu">
                        <a href="/odds.html">Odds</a>
                        <a href="/bets.html">Bets</a>
                    </div>
                </div>

                <div class="mobile-nav-dropdown">
                    <div class="mobile-nav-dropdown-trigger">
                        <span>Community</span>
                        <span class="arrow">&#9660;</span>
                    </div>
                    <div class="mobile-nav-dropdown-menu">
                        <a href="/community/">Hub</a>
                        <a href="/community/forums.html">Forums</a>
                        <a href="/community/chat.html">Chat</a>
                        <a href="/community/clubs/">Clubs</a>
                        <a href="/community/tailgates/">Tailgates</a>
                        <a href="/community/watch-parties/">Watch Parties</a>
                        <a href="/leaderboard.html">Leaderboard</a>
                    </div>
                </div>

                <div class="mobile-nav-dropdown">
                    <div class="mobile-nav-dropdown-trigger">
                        <span>Shop</span>
                        <span class="arrow">&#9660;</span>
                    </div>
                    <div class="mobile-nav-dropdown-menu">
                        <a href="/shop.html">Shop</a>
                        <a href="/marketplace/">Marketplace</a>
                        <a href="/raffles/">Raffles</a>
                        <a href="/membership.html">Membership</a>
                    </div>
                </div>

                <a href="/esports/" class="mobile-nav-item">eSports</a>
                <a href="/youth/" class="mobile-nav-item">Youth</a>
                <a href="/game-threads.html" class="mobile-nav-item">Live</a>
            </div>
        </nav>
    `;

    // Header CSS - Always dark background with light text
    const headerCSS = `
        /* Theme Variables - Light Mode (default) */
        :root {
            --header-bg: #1a1a1a;
            --card-bg: #2a2a2a;
            --card-bg-hover: rgba(255,255,255,0.1);
            --border-color: #333;
            --text-primary: #ffffff;
            --text-secondary: #d0d0d0;
            --nav-text: #d0d0d0;

            /* Global Page Variables - Light Mode */
            --page-bg: #f5f5f5;
            --page-bg-alt: #ffffff;
            --page-text: #1a1a1a;
            --page-text-secondary: #666666;
            --page-text-muted: #888888;
            --page-border: #e0e0e0;
            --page-card-bg: #ffffff;
            --page-card-shadow: 0 2px 8px rgba(0,0,0,0.1);
            --page-link: #1A2744;
            --page-link-hover: #8B1A28;
            --page-accent: #8B1A28;
            --page-accent-light: rgba(139, 26, 40, 0.1);
            --page-input-bg: #ffffff;
            --page-input-border: #ccc;
            --page-button-bg: #1A2744;
            --page-button-text: #ffffff;
        }

        /* Theme Variables - Dark Mode */
        [data-theme="dark"] {
            --header-bg: #0d0d0d;
            --card-bg: #1a1a1a;
            --card-bg-hover: rgba(255,255,255,0.05);
            --border-color: #222;
            --text-primary: #ffffff;
            --text-secondary: #b0b0b0;
            --nav-text: #b0b0b0;

            /* Global Page Variables - Dark Mode */
            --page-bg: #121212;
            --page-bg-alt: #1a1a1a;
            --page-text: #e0e0e0;
            --page-text-secondary: #b0b0b0;
            --page-text-muted: #888888;
            --page-border: #333333;
            --page-card-bg: #1e1e1e;
            --page-card-shadow: 0 2px 8px rgba(0,0,0,0.4);
            --page-link: #6a9fd4;
            --page-link-hover: #ff6b6b;
            --page-accent: #ff6b6b;
            --page-accent-light: rgba(255, 107, 107, 0.15);
            --page-input-bg: #2a2a2a;
            --page-input-border: #444;
            --page-button-bg: #3a5a8c;
            --page-button-text: #ffffff;
        }

        /* ========== GLOBAL DARK MODE STYLES ========== */

        /* Page Background */
        [data-theme="dark"] body {
            background-color: var(--page-bg) !important;
            color: var(--page-text) !important;
        }

        [data-theme="dark"] main,
        [data-theme="dark"] .main-content,
        [data-theme="dark"] .content,
        [data-theme="dark"] .container {
            background-color: transparent;
            color: var(--page-text);
        }

        /* Headings */
        [data-theme="dark"] h1,
        [data-theme="dark"] h2,
        [data-theme="dark"] h3,
        [data-theme="dark"] h4,
        [data-theme="dark"] h5,
        [data-theme="dark"] h6 {
            color: var(--page-text) !important;
        }

        /* Paragraphs and Text */
        [data-theme="dark"] p,
        [data-theme="dark"] span,
        [data-theme="dark"] li,
        [data-theme="dark"] td,
        [data-theme="dark"] th,
        [data-theme="dark"] label {
            color: var(--page-text-secondary);
        }

        /* Links */
        [data-theme="dark"] a:not(.header a):not(.main-nav a):not(.mobile-menu a) {
            color: var(--page-link);
        }

        [data-theme="dark"] a:not(.header a):not(.main-nav a):not(.mobile-menu a):hover {
            color: var(--page-link-hover);
        }

        /* Cards and Sections */
        [data-theme="dark"] .card,
        [data-theme="dark"] .panel,
        [data-theme="dark"] .box,
        [data-theme="dark"] .section,
        [data-theme="dark"] .widget,
        [data-theme="dark"] article,
        [data-theme="dark"] .post,
        [data-theme="dark"] .item {
            background-color: var(--page-card-bg) !important;
            border-color: var(--page-border) !important;
            box-shadow: var(--page-card-shadow);
        }

        /* Forms and Inputs */
        [data-theme="dark"] input:not([type="submit"]):not([type="button"]),
        [data-theme="dark"] textarea,
        [data-theme="dark"] select {
            background-color: var(--page-input-bg) !important;
            border-color: var(--page-input-border) !important;
            color: var(--page-text) !important;
        }

        [data-theme="dark"] input::placeholder,
        [data-theme="dark"] textarea::placeholder {
            color: var(--page-text-muted) !important;
        }

        /* Buttons */
        [data-theme="dark"] button:not(.theme-toggle):not(.mobile-menu-btn):not(.mobile-menu-close),
        [data-theme="dark"] .btn,
        [data-theme="dark"] input[type="submit"],
        [data-theme="dark"] input[type="button"] {
            background-color: var(--page-button-bg);
            color: var(--page-button-text);
            border-color: var(--page-border);
        }

        /* Tables */
        [data-theme="dark"] table {
            border-color: var(--page-border);
        }

        [data-theme="dark"] th {
            background-color: var(--page-bg-alt) !important;
            color: var(--page-text) !important;
            border-color: var(--page-border) !important;
        }

        [data-theme="dark"] td {
            background-color: var(--page-card-bg);
            border-color: var(--page-border) !important;
        }

        [data-theme="dark"] tr:nth-child(even) td {
            background-color: var(--page-bg-alt);
        }

        /* Borders */
        [data-theme="dark"] hr {
            border-color: var(--page-border);
        }

        [data-theme="dark"] [style*="border"],
        [data-theme="dark"] .border {
            border-color: var(--page-border) !important;
        }

        /* Specific Site Elements */
        [data-theme="dark"] .hero,
        [data-theme="dark"] .banner,
        [data-theme="dark"] .jumbotron {
            background-color: var(--page-bg-alt) !important;
        }

        [data-theme="dark"] .sidebar,
        [data-theme="dark"] aside {
            background-color: var(--page-card-bg) !important;
        }

        [data-theme="dark"] footer {
            background-color: var(--page-bg-alt) !important;
            color: var(--page-text-secondary) !important;
        }

        /* Modal/Dialog Dark Mode */
        [data-theme="dark"] .modal,
        [data-theme="dark"] .dialog,
        [data-theme="dark"] .popup {
            background-color: var(--page-card-bg) !important;
            border-color: var(--page-border) !important;
        }

        [data-theme="dark"] .modal-overlay,
        [data-theme="dark"] .backdrop {
            background-color: rgba(0, 0, 0, 0.8) !important;
        }

        /* Code blocks */
        [data-theme="dark"] pre,
        [data-theme="dark"] code {
            background-color: #2d2d2d !important;
            color: #f8f8f2 !important;
            border-color: var(--page-border) !important;
        }

        /* Scrollbar Dark Mode */
        [data-theme="dark"] ::-webkit-scrollbar {
            background-color: var(--page-bg);
        }

        [data-theme="dark"] ::-webkit-scrollbar-thumb {
            background-color: #444;
            border-radius: 4px;
        }

        [data-theme="dark"] ::-webkit-scrollbar-thumb:hover {
            background-color: #555;
        }

        /* Team Colors - Keep vibrant in dark mode */
        [data-theme="dark"] .eagles,
        [data-theme="dark"] .eagles-bg {
            background-color: #004C54 !important;
        }

        [data-theme="dark"] .phillies,
        [data-theme="dark"] .phillies-bg {
            background-color: #8b0000 !important;
        }

        [data-theme="dark"] .sixers,
        [data-theme="dark"] .sixers-bg {
            background-color: #006bb6 !important;
        }

        [data-theme="dark"] .flyers,
        [data-theme="dark"] .flyers-bg {
            background-color: #f74902 !important;
        }

        /* Utility Classes for Dark Mode */
        [data-theme="dark"] .bg-white {
            background-color: var(--page-card-bg) !important;
        }

        [data-theme="dark"] .bg-light {
            background-color: var(--page-bg-alt) !important;
        }

        [data-theme="dark"] .text-dark {
            color: var(--page-text) !important;
        }

        [data-theme="dark"] .text-muted {
            color: var(--page-text-muted) !important;
        }

        /* Images - slight dim in dark mode for eye comfort */
        [data-theme="dark"] img:not(.header-logo img):not(.logo) {
            opacity: 0.9;
        }

        [data-theme="dark"] img:not(.header-logo img):not(.logo):hover {
            opacity: 1;
        }

        /* Header - Uses CSS variables for theme support */
        .header {
            background: var(--header-bg);
            border-bottom: 1px solid var(--border-color);
            position: sticky;
            top: 0;
            z-index: 1000;
        }

        .header-top {
            display: grid;
            grid-template-columns: 1fr auto 1fr;
            align-items: center;
            padding: 1rem 1.5rem;
            max-width: 1400px;
            margin: 0 auto;
            gap: 1rem;
        }

        .header-left {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            gap: 0.5rem;
        }

        .header-right {
            display: flex !important;
            flex-direction: column !important;
            justify-content: center !important;
            align-items: flex-end !important;
            gap: 0.5rem !important;
            position: static !important;
            transform: none !important;
        }

        .header-logo {
            display: block;
            text-decoration: none;
            width: 440px;
            height: 140px;
            overflow: visible;
            filter: drop-shadow(0 6px 20px rgba(0,0,0,0.7)) drop-shadow(0 2px 6px rgba(0,0,0,0.4));
            transition: transform 0.2s, filter 0.2s;
            align-self: center;
            margin: 0 auto;
        }

        .header-logo:hover {
            filter: drop-shadow(0 8px 25px rgba(0,0,0,0.8)) drop-shadow(0 3px 8px rgba(0,0,0,0.5));
            transform: scale(1.02);
        }

        /* Logo theme switching - light mode shows F5 (light/cream bg) */
        .header-logo .logo-for-light { display: none !important; }
        .header-logo .logo-for-dark { display: block !important; }

        /* Dark mode - show F2 (dark/navy bg) */
        [data-theme="dark"] .header-logo .logo-for-light { display: block !important; }
        [data-theme="dark"] .header-logo .logo-for-dark { display: none !important; }

        .header-search {
            display: flex;
            align-items: center;
        }

        .header-search form {
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }

        .header-search .google-logo {
            height: 20px;
            width: auto;
        }

        .header-search input {
            padding: 0.5rem 0.75rem;
            border: 3px solid #1A2744;
            box-shadow: inset 0 0 0 2px #8B1A28;
            background: linear-gradient(180deg, #F5F0E1 0%, #e8e0cc 100%);
            color: #1A2744;
            font-size: 0.8rem;
            width: 220px;
            font-family: Georgia, serif;
        }

        .header-search input::placeholder {
            color: #666;
            font-style: italic;
        }

        .header-search button {
            padding: 0.5rem 0.75rem;
            background: linear-gradient(180deg, #8B1A28 0%, #5a0f15 100%);
            border: 2px solid #F5F0E1;
            color: #F5F0E1;
            font-weight: 700;
            font-size: 0.75rem;
            cursor: pointer;
            font-family: Georgia, serif;
            transition: all 0.2s;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .header-search button:hover {
            background: linear-gradient(180deg, #a01f30 0%, #8B1A28 100%);
            transform: translateY(-1px);
        }

        .header-auth {
            display: flex !important;
            flex-direction: row !important;
            align-items: center !important;
            gap: 0.75rem !important;
            position: static !important;
            transform: none !important;
            top: auto !important;
            right: auto !important;
        }

        .header-auth a {
            font-family: Georgia, serif;
            color: #F5F0E1;
            font-size: 0.85rem;
            font-weight: 600;
            padding: 0.5rem 1rem;
            text-decoration: none;
            letter-spacing: 0.5px;
            transition: all 0.2s;
        }

        .header-auth a:hover {
            color: #ffd700;
        }

        .header-auth .auth-btn {
            background: linear-gradient(180deg, #F5F0E1 0%, #e8e0cc 100%);
            color: #1A2744;
            border: 3px solid #1A2744;
            box-shadow: inset 0 0 0 2px #8B1A28;
            padding: 0.5rem 1.25rem;
            font-weight: 700;
            text-transform: uppercase;
            font-size: 0.75rem;
            letter-spacing: 1px;
        }

        .header-auth .auth-btn:hover {
            background: linear-gradient(180deg, #ffffff 0%, #F5F0E1 100%);
            transform: translateY(-1px);
            box-shadow: inset 0 0 0 2px #8B1A28, 0 2px 4px rgba(0,0,0,0.3);
        }

        /* Coin Display - Americana Style */
        .coin-display {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 0.15rem;
            background: linear-gradient(180deg, #1A2744 0%, #0d1520 100%);
            border: 3px solid #F5F0E1;
            box-shadow: inset 0 0 0 2px #8B1A28;
            padding: 0.4rem 0.75rem;
            cursor: default;
            min-width: 110px;
        }

        .coin-label {
            font-family: Georgia, serif;
            font-size: 0.85rem;
            font-weight: 700;
            font-style: italic;
            color: #F5F0E1;
            text-transform: uppercase;
            letter-spacing: 1px;
        }

        .coin-amount-row {
            display: flex;
            align-items: center;
            gap: 0.4rem;
        }

        .coin-icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 26px;
            height: 26px;
            background: linear-gradient(135deg, #ffd700, #c9a000);
            border-radius: 50%;
            font-size: 0.7rem;
            font-weight: 800;
            color: #1A2744;
            border: 2px solid #F5F0E1;
            font-family: Georgia, serif;
        }

        .coin-balance {
            font-family: Georgia, serif;
            font-variant-numeric: tabular-nums;
            font-size: 1.25rem;
            font-weight: 700;
            color: #ffd700;
        }

        .buy-coins-link {
            font-family: Georgia, serif;
            color: #1A2744 !important;
            text-decoration: none;
            font-weight: 600;
            font-size: 0.4rem;
            margin-top: 0.15rem;
            padding: 0.1rem 0.3rem;
            transition: all 0.2s;
            background: linear-gradient(180deg, #F5F0E1 0%, #e8e0cc 100%);
            border: 1px solid #8B1A28;
            display: block;
            text-transform: uppercase;
            letter-spacing: 0.25px;
            text-align: center;
        }

        .buy-coins-link:hover {
            background: linear-gradient(180deg, #ffffff 0%, #F5F0E1 100%);
            transform: translateY(-1px);
        }

        /* User Actions Stack */
        .user-actions-stack {
            display: flex;
            flex-direction: column;
            align-items: stretch;
            gap: 0.3rem;
            background: linear-gradient(180deg, #1A2744 0%, #0d1520 100%);
            border: 3px solid #F5F0E1;
            box-shadow: inset 0 0 0 2px #8B1A28;
            padding: 0.5rem;
        }

        .user-actions-stack a {
            font-family: Georgia, serif;
            text-align: center;
            padding: 0.3rem 0.5rem !important;
            font-size: 0.7rem !important;
            color: #F5F0E1 !important;
            text-decoration: none;
            transition: color 0.2s;
        }

        .user-actions-stack a:hover {
            color: #ffd700 !important;
        }

        /* Premium Badge */
        .premium-badge {
            background: linear-gradient(180deg, #ffd700 0%, #c9a000 100%) !important;
            color: #1A2744 !important;
            font-family: Georgia, serif !important;
            font-size: 0.6rem !important;
            font-weight: 700 !important;
            padding: 0.25rem 0.5rem !important;
            text-decoration: none;
            letter-spacing: 0.5px;
            border: 2px solid #F5F0E1;
        }

        .premium-badge:hover {
            background: linear-gradient(180deg, #ffe44d 0%, #ffd700 100%) !important;
        }

        .go-premium-link {
            background: linear-gradient(180deg, #ffd700 0%, #c9a000 100%) !important;
            color: #1A2744 !important;
            font-family: Georgia, serif !important;
            font-size: 0.65rem !important;
            font-weight: 700 !important;
            padding: 0.3rem 0.6rem !important;
            text-decoration: none;
            letter-spacing: 0.5px;
            border: 2px solid #F5F0E1;
        }

        .go-premium-link:hover {
            background: linear-gradient(180deg, #ffe44d 0%, #ffd700 100%) !important;
        }

        /* Admin Link */
        .admin-link {
            background: linear-gradient(180deg, #8B1A28 0%, #5a0f15 100%) !important;
            color: #F5F0E1 !important;
            font-family: Georgia, serif !important;
            font-size: 0.65rem !important;
            font-weight: 700 !important;
            padding: 0.3rem 0.6rem !important;
            text-decoration: none;
            letter-spacing: 0.5px;
            border: 2px solid #F5F0E1;
        }

        .admin-link:hover {
            background: linear-gradient(180deg, #a01f30 0%, #8B1A28 100%) !important;
        }

        /* Theme Toggle - Americana Style */
        .theme-toggle {
            background: linear-gradient(180deg, #F5F0E1 0%, #e8e0cc 100%);
            border: 3px solid #1A2744;
            box-shadow: inset 0 0 0 2px #8B1A28;
            padding: 0.4rem 0.75rem;
            cursor: pointer;
            font-size: 1rem;
            line-height: 1;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            gap: 0.35rem;
            color: #1A2744;
            font-family: Georgia, serif;
        }

        .theme-toggle:hover {
            background: linear-gradient(180deg, #ffffff 0%, #F5F0E1 100%);
            transform: translateY(-1px);
        }

        .theme-toggle .theme-icon-light,
        .theme-toggle .theme-icon-dark {
            display: none;
            font-size: 1.1rem;
        }

        .theme-toggle .theme-icon-light { display: inline; }
        [data-theme="dark"] .theme-toggle .theme-icon-light { display: none; }
        [data-theme="dark"] .theme-toggle .theme-icon-dark { display: inline; }

        .theme-toggle .theme-label {
            font-size: 0.7rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        /* Main Navigation - Darker cream background for contrast */
        .main-nav {
            background: linear-gradient(180deg, #d4c9a8 0%, #c4b898 100%);
            border-top: 3px solid #1A2744;
            border-bottom: 3px solid #1A2744;
            box-shadow: inset 0 2px 0 #8B1A28, inset 0 -2px 0 #8B1A28;
        }

        .nav-inner {
            display: flex;
            max-width: 1400px;
            margin: 0 auto;
            padding: 0 1.5rem;
            align-items: center;
            justify-content: center;
            flex-wrap: wrap;
        }

        .nav-item {
            padding: 0.5rem 0.85rem;
            font-size: 1.125rem;
            font-weight: 700;
            font-family: Georgia, serif;
            color: #1A2744;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            cursor: pointer;
            transition: all 0.2s;
            white-space: nowrap;
            text-decoration: none;
        }

        .nav-item:hover {
            color: #8B1A28;
        }

        .nav-item.active {
            color: #8B1A28;
            border-bottom: 3px solid #8B1A28;
        }

        .nav-dropdown { position: relative; }

        .dropdown-trigger {
            display: flex;
            align-items: center;
            gap: 0.25rem;
        }

        .dropdown-arrow {
            font-size: 0.5rem;
            transition: transform 0.2s;
        }

        .dropdown-menu {
            position: absolute;
            top: 100%;
            left: 0;
            background: linear-gradient(180deg, #F5F0E1 0%, #e8e0cc 100%);
            border: 3px solid #1A2744;
            box-shadow: inset 0 0 0 2px #8B1A28, 0 4px 12px rgba(0,0,0,0.3);
            min-width: 180px;
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

        .nav-dropdown:hover .dropdown-arrow {
            transform: rotate(180deg);
        }

        .dropdown-menu a {
            display: block;
            padding: 0.6rem 1rem;
            color: #1A2744;
            font-family: Georgia, serif;
            font-size: 1.1rem;
            font-weight: 600;
            text-decoration: none;
            transition: all 0.2s;
            border-bottom: 1px solid rgba(26, 39, 68, 0.2);
        }

        .dropdown-menu a:last-child {
            border-bottom: none;
        }

        .dropdown-menu a:hover {
            background: #1A2744 !important;
            color: #F5F0E1 !important;
        }

        .dropdown-menu a.active {
            background: #8B1A28 !important;
            color: #F5F0E1 !important;
            font-weight: 700;
        }

        /* Mobile Menu Button */
        .mobile-menu-btn {
            display: none;
            background: none;
            border: none;
            color: #d0d0d0;
            font-size: 1.5rem;
            cursor: pointer;
            padding: 0.25rem;
            z-index: 1001;
            position: absolute;
            right: 1rem;
            top: 50%;
            transform: translateY(-50%);
        }

        /* Mobile Menu Overlay */
        .mobile-menu-overlay {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            z-index: 999;
            opacity: 0;
            transition: opacity 0.3s ease;
        }

        .mobile-menu-overlay.active {
            display: block;
            opacity: 1;
        }

        /* Mobile Menu Panel */
        .mobile-menu {
            position: fixed;
            top: 0;
            right: -300px;
            width: 300px;
            height: 100vh;
            background: var(--card-bg, #fff);
            z-index: 1000;
            transition: right 0.3s ease;
            overflow-y: auto;
            box-shadow: -2px 0 10px rgba(0, 0, 0, 0.3);
        }

        .mobile-menu.active { right: 0; }

        .mobile-menu-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 1rem;
            border-bottom: 1px solid var(--border-color, #e0e0e0);
            background: linear-gradient(135deg, #004C54, #8b0000);
        }

        .mobile-menu-header span {
            color: #ffffff;
            font-weight: 600;
            font-size: 1.1rem;
        }

        .mobile-menu-close {
            background: none;
            border: none;
            color: #ffffff;
            font-size: 1.5rem;
            cursor: pointer;
            padding: 0.25rem;
        }

        .mobile-menu-search {
            padding: 1rem;
            border-bottom: 1px solid var(--border-color, #e0e0e0);
        }

        .mobile-menu-search form {
            display: flex;
            gap: 0.5rem;
        }

        .mobile-menu-search input {
            flex: 1;
            padding: 0.5rem;
            border: 1px solid var(--border-color, #e0e0e0);
            border-radius: 4px;
            background: var(--card-bg, #fff);
            color: var(--text-primary, #1a1a1a);
        }

        .mobile-menu-search button {
            padding: 0.5rem 1rem;
            background: #004C54;
            color: #ffffff;
            border: none;
            border-radius: 4px;
            cursor: pointer;
        }

        .mobile-menu-auth {
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
            padding: 1rem;
            border-bottom: 1px solid var(--border-color, #e0e0e0);
        }

        .mobile-coin-display {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 0.25rem;
            background: linear-gradient(135deg, rgba(255, 215, 0, 0.25), rgba(255, 140, 0, 0.2));
            border: 2px solid #ffd700;
            padding: 0.75rem;
            border-radius: 12px;
            box-shadow: 0 0 10px rgba(255, 215, 0, 0.3);
        }

        .mobile-coin-display .coin-label {
            font-size: 0.6rem;
            font-weight: 700;
            color: #ffc800;
            text-transform: uppercase;
            letter-spacing: 1px;
        }

        .mobile-coin-display .coin-amount-row {
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }

        .mobile-coin-display .coin-icon {
            font-size: 1.25rem;
        }

        .mobile-coin-display .coin-balance {
            font-size: 1.25rem;
            font-weight: 800;
            color: #1a1a1a;
        }

        [data-theme="dark"] .mobile-coin-display .coin-balance {
            color: #ffffff;
        }

        .mobile-user-buttons {
            display: flex;
            gap: 0.5rem;
        }

        .mobile-menu-auth a {
            flex: 1;
            text-align: center;
            padding: 0.75rem;
            border-radius: 4px;
            text-decoration: none;
            font-weight: 500;
        }

        .mobile-menu-auth .login-btn {
            background: var(--card-bg, #fff);
            color: var(--text-primary, #1a1a1a);
            border: 1px solid var(--border-color, #e0e0e0);
        }

        .mobile-menu-auth .signup-btn {
            background: linear-gradient(135deg, #004C54, #8b0000);
            color: #ffffff;
        }

        .mobile-nav-items { padding: 0.5rem 0; }

        .mobile-nav-item {
            display: block;
            padding: 0.875rem 1rem;
            color: var(--text-primary, #1a1a1a);
            text-decoration: none;
            border-bottom: 1px solid var(--border-color, #e0e0e0);
            transition: background 0.2s;
        }

        .mobile-nav-item:hover {
            background: var(--card-bg-hover, #f5f5f5);
        }

        .mobile-nav-dropdown {
            border-bottom: 1px solid var(--border-color, #e0e0e0);
        }

        .mobile-nav-dropdown-trigger {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0.875rem 1rem;
            color: var(--text-primary, #1a1a1a);
            cursor: pointer;
            transition: background 0.2s;
        }

        .mobile-nav-dropdown-trigger:hover {
            background: var(--card-bg-hover, #f5f5f5);
        }

        .mobile-nav-dropdown-trigger .arrow {
            transition: transform 0.3s ease;
        }

        .mobile-nav-dropdown.open .mobile-nav-dropdown-trigger .arrow {
            transform: rotate(180deg);
        }

        .mobile-nav-dropdown-menu {
            display: none;
            background: var(--card-bg-hover, #f5f5f5);
        }

        .mobile-nav-dropdown.open .mobile-nav-dropdown-menu {
            display: block;
        }

        .mobile-nav-dropdown-menu a {
            display: block;
            padding: 0.75rem 1rem 0.75rem 2rem;
            color: var(--text-secondary, #444);
            text-decoration: none;
            border-top: 1px solid var(--border-color, #e0e0e0);
            transition: background 0.2s, color 0.2s;
        }

        .mobile-nav-dropdown-menu a:hover {
            background: var(--card-bg, #fff);
            color: var(--text-primary, #1a1a1a);
        }

        /* Responsive */
        @media (max-width: 1024px) {
            .header-search input { width: 200px; }
        }

        @media (max-width: 768px) {
            .header-search { display: none; }
            .header-auth { display: none; }
            .theme-toggle { display: none; }
            .main-nav { display: none; }
            .mobile-menu-btn { display: block; }
            .header-logo {
                margin-top: 0;
                width: 300px !important;
                height: 80px !important;
            }
            .header-logo .logo-for-light,
            .header-logo .logo-for-dark {
                width: 300px !important;
                height: 80px !important;
                transform: scale(0.577);
                transform-origin: top left;
            }
        }
    `;

    // Inject CSS
    function injectCSS() {
        if (document.getElementById('shared-header-styles')) return;
        const style = document.createElement('style');
        style.id = 'shared-header-styles';
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
        const toggle = document.getElementById('themeToggle');
        if (!toggle) {
            console.warn('Theme toggle button not found');
            return;
        }

        // Apply saved theme on load
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme) {
            document.documentElement.setAttribute('data-theme', savedTheme);
            document.body.setAttribute('data-theme', savedTheme);
        }

        // Update toggle label based on current theme
        function updateToggleLabel() {
            const current = document.documentElement.getAttribute('data-theme');
            const label = toggle.querySelector('.theme-label');
            if (label) {
                label.textContent = current === 'dark' ? 'Light Mode' : 'Dark Mode';
            }
        }
        updateToggleLabel();

        toggle.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();

            const current = document.documentElement.getAttribute('data-theme');
            const newTheme = current === 'dark' ? 'light' : 'dark';

            // Apply to both html and body for broader compatibility
            document.documentElement.setAttribute('data-theme', newTheme);
            document.body.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);

            updateToggleLabel();
            console.log('Theme changed to:', newTheme);
        });
    }

    // Mobile menu functionality
    function initMobileMenu() {
        const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
        const mobileMenu = document.getElementById('mobileMenu');
        const mobileMenuOverlay = document.getElementById('mobileMenuOverlay');
        const mobileMenuClose = document.getElementById('mobileMenuClose');
        const dropdownTriggers = document.querySelectorAll('.mobile-nav-dropdown-trigger');

        if (mobileMenuBtn && mobileMenu) {
            mobileMenuBtn.addEventListener('click', function() {
                mobileMenu.classList.add('active');
                mobileMenuOverlay.classList.add('active');
                document.body.style.overflow = 'hidden';
            });
        }

        if (mobileMenuClose) {
            mobileMenuClose.addEventListener('click', closeMobileMenu);
        }

        if (mobileMenuOverlay) {
            mobileMenuOverlay.addEventListener('click', closeMobileMenu);
        }

        function closeMobileMenu() {
            mobileMenu.classList.remove('active');
            mobileMenuOverlay.classList.remove('active');
            document.body.style.overflow = '';
        }

        // Mobile dropdown toggles
        dropdownTriggers.forEach(trigger => {
            trigger.addEventListener('click', function() {
                const parent = this.parentElement;
                parent.classList.toggle('open');
            });
        });
    }

    // Check authentication and update header
    async function checkAuth() {
        try {
            const response = await fetch('/api/auth/me', { credentials: 'include' });
            const data = await response.json();

            if (data.user) {
                const headerAuth = document.getElementById('headerAuth');
                const mobileMenuAuth = document.getElementById('mobileMenuAuth');

                const premiumBadge = data.user.isSubscribed
                    ? `<a href="/membership.html" class="premium-badge" title="${data.user.subscriptionTierName || 'Premium'}">${data.user.subscriptionTier === 'diehard_pro' ? 'PRO' : '+'}</a>`
                    : `<a href="/membership.html" class="go-premium-link">Go Premium</a>`;

                const adminLink = data.user.isAdmin
                    ? `<a href="/admin.html" class="admin-link" title="Admin Dashboard">Admin</a>`
                    : '';

                if (headerAuth) {
                    headerAuth.innerHTML = `
                        <div class="coin-display">
                            <span class="coin-label">Diehard Dollars</span>
                            <div class="coin-amount-row">
                                <span class="coin-icon">DD</span>
                                <span class="coin-balance">${Math.round(data.user.coinBalance || 0).toLocaleString()}</span>
                            </div>
                            <a href="/shop.html#coin-packs" class="buy-coins-link">Buy More</a>
                        </div>
                        <div class="user-actions-stack">
                            <a href="/profile.html">${data.user.username}</a>
                            ${premiumBadge}
                            ${adminLink}
                            <a href="#" id="logoutBtn">Logout</a>
                        </div>
                    `;

                    // Add logout handler
                    document.getElementById('logoutBtn')?.addEventListener('click', async (e) => {
                        e.preventDefault();
                        await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
                        localStorage.removeItem('auth_token');
                        window.location.reload();
                    });
                }

                // Update mobile menu auth
                if (mobileMenuAuth) {
                    mobileMenuAuth.innerHTML = `
                        <div class="mobile-coin-display">
                            <span class="coin-label">Diehard Dollars</span>
                            <div class="coin-amount-row">
                                <span class="coin-icon">DD</span>
                                <span class="coin-balance">${Math.round(data.user.coinBalance || 0).toLocaleString()}</span>
                            </div>
                        </div>
                        <div class="mobile-user-buttons">
                            <a href="/profile.html" class="login-btn">${data.user.username}</a>
                            <a href="#" class="signup-btn" id="mobileLogoutBtn">Logout</a>
                        </div>
                    `;

                    document.getElementById('mobileLogoutBtn')?.addEventListener('click', async (e) => {
                        e.preventDefault();
                        await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
                        localStorage.removeItem('auth_token');
                        window.location.reload();
                    });
                }
            }
        } catch (error) {
            // Not logged in, keep default header
        }
    }

    // Highlight current page in navigation
    function highlightCurrentPage() {
        const currentPath = window.location.pathname;

        // Check all nav links
        document.querySelectorAll('.main-nav a, .dropdown-menu a').forEach(link => {
            const href = link.getAttribute('href');
            if (!href) return;

            // Check if current path matches or starts with the link href
            if (currentPath === href ||
                (href !== '/' && currentPath.startsWith(href.replace(/\/$/, '')))) {
                link.classList.add('active');

                // If it's a dropdown item, also highlight the parent trigger
                const dropdown = link.closest('.nav-dropdown');
                if (dropdown) {
                    const trigger = dropdown.querySelector('.dropdown-trigger');
                    if (trigger) trigger.classList.add('active');
                }
            }
        });
    }

    // Initialize
    function init() {
        injectCSS();
        injectHeader();
        initThemeToggle();
        initMobileMenu();
        highlightCurrentPage();
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
        initThemeToggle,
        initMobileMenu
    };
})();
