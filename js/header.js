// Shared Header Component for PhillySports.com
// Matches homepage newspaper-style header with centered logo
// Include this script on every page and add <div id="site-header"></div> where the header should appear
// Version: 2.8 - Consolidated user panel (DD, badges, links in single clean control)

(function() {
    'use strict';

    // Header HTML template
    const headerHTML = `
        <header class="header">
            <div class="header-top">
                <!-- Left Column: Google Search + Theme Toggle -->
                <div class="header-left" style="display: flex; flex-direction: column; align-items: flex-start; gap: 0.75rem; position: relative; z-index: 10;">
                    <div class="header-search" style="display: flex; align-items: center;">
                        <form action="https://www.google.com/search" method="GET" target="_blank" style="display: flex; align-items: center; gap: 0.5rem;">
                            <img src="https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_92x30dp.png" alt="Google" class="google-logo">
                            <input type="text" name="q" placeholder="Search the web..." required>
                            <button type="submit">Go</button>
                        </form>
                    </div>
                    <div style="display: flex; gap: 0.5rem; align-items: stretch;">
                        <button type="button" class="theme-toggle" id="themeToggle" title="Toggle dark mode" style="position: relative; z-index: 20; cursor: pointer;">
                            <span class="theme-icon-light">&#9790;</span>
                            <span class="theme-icon-dark">&#9728;</span>
                            <span class="theme-label">Dark Mode</span>
                        </button>
                        <button type="button" class="feedback-link" onclick="window.openFeedbackModal && window.openFeedbackModal()" title="Report an Issue">
                            <span>&#9888;</span>
                            <span class="feedback-label">Report Issue</span>
                        </button>
                    </div>
                    <!-- Founders Club Progress -->
                    <div class="founders-club-widget" id="foundersWidget" style="display: none;">
                        <a href="/founders.html" class="founders-progress-link" id="foundersProgress" title="Join the Founders Club - Limited to 76 members!">
                            <span class="founders-bell">&#128276;</span>
                            <span class="founders-text">Founders Club</span>
                            <span class="founders-bar">
                                <span class="founders-bar-fill" id="foundersBarFill"></span>
                            </span>
                            <span class="founders-count" id="foundersCount">0/76</span>
                        </a>
                        <a href="/founders.html#about" class="founders-info-link" title="Learn more about the Founders Club">More Info</a>
                    </div>
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
                <div class="header-right" style="display: flex; flex-direction: column; justify-content: center; align-items: flex-end; gap: 0.5rem; position: static; transform: none;">
                    <div class="header-auth" id="headerAuth" style="display: flex; flex-direction: row; align-items: center; gap: 1rem; position: static; transform: none;">
                        <a href="/login.html" class="sign-in-btn">Sign In</a>
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
                        <span class="nav-item dropdown-trigger">Games <span class="dropdown-arrow">&#9660;</span></span>
                        <div class="dropdown-menu">
                            <a href="/fantasy.html">Fantasy</a>
                            <a href="/pools.html">Pools</a>
                            <a href="/poker.html">Poker</a>
                            <a href="/trivia.html">Trivia</a>
                        </div>
                    </div>

                    <div class="nav-dropdown">
                        <span class="nav-item dropdown-trigger">Odds <span class="dropdown-arrow">&#9660;</span></span>
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
                            <a href="/game-threads.html">Game Chats</a>
                            <a href="/community/clubs/">Clubs</a>
                            <a href="/community/tailgates/">Tailgates</a>
                            <a href="/community/watch-parties/">Watch Parties</a>
                            <a href="/leaderboard.html">Leaderboard</a>
                        </div>
                    </div>

                    <a href="/marketplace/" class="nav-item">Marketplace</a>

                    <a href="/esports/" class="nav-item">eSports</a>
                    <a href="/youth/" class="nav-item">Youth</a>
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
                        <span>Games</span>
                        <span class="arrow">&#9660;</span>
                    </div>
                    <div class="mobile-nav-dropdown-menu">
                        <a href="/fantasy.html">Fantasy</a>
                        <a href="/pools.html">Pools</a>
                        <a href="/poker.html">Poker</a>
                        <a href="/trivia.html">Trivia</a>
                    </div>
                </div>

                <div class="mobile-nav-dropdown">
                    <div class="mobile-nav-dropdown-trigger">
                        <span>Odds</span>
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
                        <a href="/game-threads.html">Game Chats</a>
                        <a href="/community/clubs/">Clubs</a>
                        <a href="/community/tailgates/">Tailgates</a>
                        <a href="/community/watch-parties/">Watch Parties</a>
                        <a href="/leaderboard.html">Leaderboard</a>
                    </div>
                </div>

                <a href="/marketplace/" class="mobile-nav-item">Marketplace</a>

                <a href="/esports/" class="mobile-nav-item">eSports</a>
                <a href="/youth/" class="mobile-nav-item">Youth</a>
            </div>
        </nav>
    `;

    // Header CSS - Follows global theme (light in light mode, dark in dark mode)
    const headerCSS = `
        /* ==========================================================================
           SECTION 1: CSS VARIABLES - LIGHT MODE (defaults)
           ========================================================================== */
        :root {
            /* Header-specific variables */
            --header-bg: #f5f2eb;
            --header-text: #1A2744;
            --header-text-muted: #4d4a47;
            --header-border: #1A2744;
            --header-accent: #8B1A28;
            --card-bg: #ffffff;
            --card-bg-hover: rgba(0,0,0,0.05);
            --border-color: #1A2744;
            --text-primary: #1A2744;
            --text-secondary: #4d4a47;
            --nav-text: #1A2744;

            /* Global page variables */
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

        /* ==========================================================================
           SECTION 2: CSS VARIABLES - DARK MODE (overrides)
           ========================================================================== */
        [data-theme="dark"] {
            /* Header-specific variables */
            --header-bg: #000000;
            --header-text: #F5F0E1;
            --header-text-muted: #b0b0b0;
            --header-border: #F5F0E1;
            --header-accent: #8B1A28;
            --card-bg: #2a2a2a;
            --card-bg-hover: rgba(255,255,255,0.05);
            --border-color: #333;
            --text-primary: #F5F0E1;
            --text-secondary: #b0b0b0;
            --nav-text: #F5F0E1;

            /* Global page variables */
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

        /* ==========================================================================
           SECTION 3: GLOBAL DARK MODE PAGE STYLES (for page content, NOT header)
           These styles apply to the main page content areas, excluding the header.
           ========================================================================== */

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

        /* Paragraphs and Text - exclude header elements */
        [data-theme="dark"] p:not(.header p),
        [data-theme="dark"] span:not(.header span):not(.main-nav span),
        [data-theme="dark"] li:not(.header li),
        [data-theme="dark"] td,
        [data-theme="dark"] th,
        [data-theme="dark"] label:not(.header label) {
            color: var(--page-text-secondary);
        }

        /* Links - exclude header, nav, and mobile menu */
        [data-theme="dark"] a:not(.header a):not(.header-logo):not(.main-nav a):not(.nav-item):not(.dropdown-menu a):not(.mobile-menu a) {
            color: var(--page-link);
        }

        [data-theme="dark"] a:not(.header a):not(.header-logo):not(.main-nav a):not(.nav-item):not(.dropdown-menu a):not(.mobile-menu a):hover {
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

        /* Forms and Inputs - exclude header */
        [data-theme="dark"] input:not([type="submit"]):not([type="button"]):not(.header-search input),
        [data-theme="dark"] textarea,
        [data-theme="dark"] select {
            background-color: var(--page-input-bg) !important;
            border-color: var(--page-input-border) !important;
            color: var(--page-text) !important;
        }

        /* Exclude header inputs from global dark styles */
        [data-theme="dark"] .header input,
        [data-theme="dark"] .header button,
        [data-theme="dark"] .header-search input,
        [data-theme="dark"] .header-search button {
            background-color: unset;
            border-color: unset;
            color: unset;
        }

        [data-theme="dark"] input::placeholder,
        [data-theme="dark"] textarea::placeholder {
            color: var(--page-text-muted) !important;
        }

        /* Buttons - exclude header buttons */
        [data-theme="dark"] button:not(.theme-toggle):not(.mobile-menu-btn):not(.mobile-menu-close):not(.header-search button),
        [data-theme="dark"] .btn:not(.header .btn),
        [data-theme="dark"] input[type="submit"]:not(.header input),
        [data-theme="dark"] input[type="button"]:not(.header input) {
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

        /* ==========================================================================
           SECTION 4: HEADER STRUCTURE STYLES (layout, positioning)
           ========================================================================== */
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

        /* ==========================================================================
           SECTION 5: HEADER COMPONENT STYLES (logo, search, auth, nav)
           ========================================================================== */

        /* ----- Logo ----- */
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

        /* Logo theme switching - light mode shows cream background logo */
        .header-logo .logo-for-light { display: none !important; }
        .header-logo .logo-for-dark { display: block !important; }

        /* ----- Search ----- */
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

        /* ----- Auth ----- */
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
            font-size: 0.85rem;
            font-weight: 600;
            padding: 0.5rem 1rem;
            text-decoration: none;
            letter-spacing: 0.5px;
            transition: all 0.2s;
            color: #1A2744;
        }

        .header-auth a:hover {
            color: #8B1A28;
        }

        /* Sign In Button - Light Mode */
        .header-auth .sign-in-btn {
            color: #1A2744;
            border: 2px solid #1A2744;
        }

        .header-auth .sign-in-btn:hover {
            color: #8B1A28;
            border-color: #8B1A28;
        }

        /* Sign Up Button - Light Mode */
        .header-auth .auth-btn {
            background: linear-gradient(180deg, #1A2744 0%, #0d1520 100%);
            color: #F5F0E1;
            border: 3px solid #1A2744;
            box-shadow: inset 0 0 0 2px #8B1A28;
            padding: 0.5rem 1.25rem;
            font-weight: 700;
            text-transform: uppercase;
            font-size: 0.75rem;
            letter-spacing: 1px;
        }

        .header-auth .auth-btn:hover {
            background: linear-gradient(180deg, #2a3a5c 0%, #1A2744 100%);
            transform: translateY(-1px);
            box-shadow: inset 0 0 0 2px #8B1A28, 0 2px 4px rgba(0,0,0,0.3);
        }

        /* ----- User Panel (Consolidated) ----- */
        .user-panel {
            display: flex;
            flex-direction: row;
            align-items: center;
            gap: 0.75rem;
            background: linear-gradient(180deg, #F5F0E1 0%, #e8e0cc 100%);
            border: 3px solid #1A2744;
            box-shadow: inset 0 0 0 2px #8B1A28;
            padding: 0.5rem 0.75rem;
            font-family: Georgia, serif;
        }

        .user-panel-header {
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }

        .user-avatar {
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background: linear-gradient(135deg, #1A2744, #0d1520);
            color: #F5F0E1;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 0.9rem;
            font-weight: 700;
            border: 2px solid #8B1A28;
            text-transform: uppercase;
            overflow: hidden;
            flex-shrink: 0;
        }

        .user-avatar img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }

        .user-panel-info {
            display: flex;
            flex-direction: column;
            gap: 0.15rem;
        }

        .user-panel-name {
            font-size: 0.8rem;
            font-weight: 700;
            color: #1A2744;
            text-decoration: none;
            line-height: 1.2;
            white-space: nowrap;
        }

        .user-panel-name:hover {
            color: #8B1A28;
        }

        .user-panel-badges {
            display: flex;
            gap: 0.2rem;
            flex-wrap: wrap;
        }

        .badge-premium {
            font-size: 0.5rem;
            font-weight: 700;
            padding: 0.1rem 0.25rem;
            background: linear-gradient(135deg, #ffd700, #c9a000);
            color: #1A2744;
            border-radius: 2px;
            text-transform: uppercase;
            letter-spacing: 0.3px;
        }

        .badge-founder {
            font-size: 0.5rem;
            font-weight: 700;
            padding: 0.1rem 0.25rem;
            background: linear-gradient(135deg, #1A2744, #0d1520);
            color: #ffd700;
            border-radius: 2px;
            letter-spacing: 0.3px;
        }

        .badge-admin {
            font-size: 0.5rem;
            font-weight: 700;
            padding: 0.1rem 0.25rem;
            background: linear-gradient(135deg, #8B1A28, #5a0f15);
            color: #F5F0E1;
            border-radius: 2px;
            text-transform: uppercase;
            letter-spacing: 0.3px;
        }

        .user-panel-coins {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0 0.5rem;
            border-left: 1px solid rgba(26, 39, 68, 0.2);
        }

        .coin-info {
            display: flex;
            align-items: center;
            gap: 0.3rem;
        }

        .coin-icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 20px;
            height: 20px;
            background: linear-gradient(135deg, #ffd700, #c9a000);
            border-radius: 50%;
            font-size: 0.55rem;
            font-weight: 800;
            color: #1A2744;
            border: 2px solid #1A2744;
            font-family: Georgia, serif;
        }

        .coin-balance {
            font-family: Georgia, serif;
            font-variant-numeric: tabular-nums;
            font-size: 0.9rem;
            font-weight: 700;
            color: #1A2744;
        }

        .coin-label {
            display: none;
        }

        .buy-coins-link {
            font-size: 0.55rem;
            font-weight: 600;
            color: #8B1A28;
            text-decoration: none;
            padding: 0.15rem 0.3rem;
            border: 1px solid #8B1A28;
            border-radius: 2px;
            transition: all 0.2s;
        }

        .buy-coins-link:hover {
            background: #8B1A28;
            color: #F5F0E1;
        }

        .user-panel-links {
            display: flex;
            align-items: center;
            gap: 0.4rem;
            padding-left: 0.5rem;
            border-left: 1px solid rgba(26, 39, 68, 0.2);
        }

        .user-panel-links a {
            font-size: 0.65rem;
            color: #1A2744;
            text-decoration: none;
            transition: color 0.2s;
            white-space: nowrap;
        }

        .user-panel-links a:hover {
            color: #8B1A28;
        }

        .user-panel-links .link-sep {
            color: rgba(26, 39, 68, 0.3);
            font-size: 0.5rem;
        }

        /* Legacy styles kept for backwards compatibility */
        .premium-badge, .go-premium-link, .mail-link, .admin-link {
            display: none;
        }

        /* ----- Theme Toggle ----- */
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
            height: 100%;
            box-sizing: border-box;
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

        .theme-toggle .theme-label {
            font-size: 0.7rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        /* ----- Feedback Link ----- */
        .feedback-link {
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
            height: 100%;
            box-sizing: border-box;
            gap: 0.35rem;
            color: #1A2744;
            font-family: Georgia, serif;
        }

        .feedback-link:hover {
            background: linear-gradient(180deg, #ffffff 0%, #F5F0E1 100%);
            transform: translateY(-1px);
        }

        .feedback-link .feedback-label {
            font-size: 0.7rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        [data-theme="dark"] .feedback-link {
            background: linear-gradient(180deg, #F5F0E1 0%, #e8e0cc 100%) !important;
            border: 3px solid #1A2744 !important;
            color: #1A2744 !important;
        }

        /* ----- Main Navigation ----- */
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
            color: #1A2744;
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

        /* ----- Mobile Menu Button ----- */
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

        /* ----- Mobile Menu Overlay ----- */
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

        /* ----- Mobile Menu Panel ----- */
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

        /* ==========================================================================
           SECTION 6: HEADER DARK MODE OVERRIDES
           All header-specific dark mode rules consolidated in one place.
           ========================================================================== */

        /* Protect header elements from global dark mode styles */
        [data-theme="dark"] .header,
        [data-theme="dark"] .header-top,
        [data-theme="dark"] .header-left,
        [data-theme="dark"] .header-right,
        [data-theme="dark"] .header-logo,
        [data-theme="dark"] .header-search,
        [data-theme="dark"] .header-auth,
        [data-theme="dark"] .main-nav,
        [data-theme="dark"] .nav-inner {
            background-color: inherit;
            color: inherit;
        }

        /* Header background */
        [data-theme="dark"] .header {
            background: var(--header-bg) !important;
        }

        /* Logo - show navy/dark background logo in dark mode */
        [data-theme="dark"] .header-logo .logo-for-light { display: block !important; }
        [data-theme="dark"] .header-logo .logo-for-dark { display: none !important; }

        /* Search input and button */
        [data-theme="dark"] .header-search input {
            background: linear-gradient(180deg, #F5F0E1 0%, #e8e0cc 100%) !important;
            color: #1A2744 !important;
            border: 3px solid #1A2744 !important;
        }

        [data-theme="dark"] .header-search button {
            background: linear-gradient(180deg, #8B1A28 0%, #5a0f15 100%) !important;
            color: #F5F0E1 !important;
        }

        /* Auth links */
        [data-theme="dark"] .header-auth a {
            color: #F5F0E1;
        }

        [data-theme="dark"] .header-auth a:hover {
            color: #ffd700;
        }

        /* Sign In Button - Dark Mode */
        [data-theme="dark"] .header-auth .sign-in-btn {
            color: #F5F0E1;
            border: 2px solid #F5F0E1;
        }

        [data-theme="dark"] .header-auth .sign-in-btn:hover {
            color: #ffd700;
            border-color: #ffd700;
        }

        /* Sign Up Button - Dark Mode */
        [data-theme="dark"] .header-auth .auth-btn {
            background: linear-gradient(180deg, #F5F0E1 0%, #e8e0cc 100%);
            color: #1A2744;
            border: 3px solid #F5F0E1;
        }

        [data-theme="dark"] .header-auth .auth-btn:hover {
            background: linear-gradient(180deg, #ffffff 0%, #F5F0E1 100%);
        }

        /* User Panel - Dark Mode (same cream styling on black header) */
        [data-theme="dark"] .user-panel {
            background: linear-gradient(180deg, #F5F0E1 0%, #e8e0cc 100%);
            border: 3px solid #F5F0E1;
            box-shadow: inset 0 0 0 2px #8B1A28;
        }

        [data-theme="dark"] .user-panel-name {
            color: #1A2744;
        }

        [data-theme="dark"] .user-panel-name:hover {
            color: #8B1A28;
        }

        [data-theme="dark"] .coin-balance {
            color: #1A2744;
        }

        [data-theme="dark"] .user-panel-links a {
            color: #1A2744;
        }

        [data-theme="dark"] .user-panel-links a:hover {
            color: #8B1A28;
        }

        /* Theme toggle - dark mode icon visibility */
        [data-theme="dark"] .theme-toggle .theme-icon-light { display: none; }
        [data-theme="dark"] .theme-toggle .theme-icon-dark { display: inline; }

        /* Dark mode toggle button styling - keep visible in dark mode */
        [data-theme="dark"] .theme-toggle {
            background: linear-gradient(180deg, #F5F0E1 0%, #e8e0cc 100%) !important;
            border: 3px solid #1A2744 !important;
            color: #1A2744 !important;
            display: flex !important;
        }

        /* Force nav to keep dark cream in dark mode */
        [data-theme="dark"] .main-nav {
            background: linear-gradient(180deg, #d4c9a8 0%, #c4b898 100%) !important;
        }

        /* Mobile coin balance in dark mode */
        [data-theme="dark"] .mobile-coin-display .coin-balance {
            color: #ffffff;
        }

        /* ==========================================================================
           SECTION 6B: FOUNDERS CLUB WIDGET (in header-left)
           ========================================================================== */
        .founders-club-widget {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            gap: 0.25rem;
            margin-top: 0.5rem;
        }

        .founders-progress-link {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.4rem 0.75rem;
            background: linear-gradient(135deg, #1a1a2e, #16213e);
            border: 2px solid #ffd700;
            border-radius: 20px;
            text-decoration: none;
            transition: all 0.2s;
            animation: foundersGlow 2s infinite alternate;
        }

        @keyframes foundersGlow {
            from { box-shadow: 0 0 5px rgba(255, 215, 0, 0.3); }
            to { box-shadow: 0 0 15px rgba(255, 215, 0, 0.6); }
        }

        .founders-progress-link:hover {
            transform: scale(1.05);
            border-color: #fff;
        }

        .founders-bell {
            font-size: 1rem;
        }

        .founders-text {
            font-family: Georgia, serif;
            font-size: 0.7rem;
            font-weight: 700;
            color: #ffd700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .founders-bar {
            width: 50px;
            height: 6px;
            background: rgba(255, 255, 255, 0.2);
            border-radius: 3px;
            overflow: hidden;
        }

        .founders-bar-fill {
            height: 100%;
            background: linear-gradient(90deg, #ffd700, #ff8c00);
            border-radius: 3px;
            transition: width 0.5s ease;
        }

        .founders-count {
            font-family: Georgia, serif;
            font-size: 0.7rem;
            font-weight: 700;
            color: #fff;
        }

        .founders-count.urgent {
            color: #ff4444;
            animation: urgentPulse 1s infinite;
        }

        @keyframes urgentPulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }

        .founders-info-link {
            font-family: Georgia, serif;
            font-size: 0.65rem;
            color: #1A2744;
            text-decoration: underline;
            margin-left: 0.5rem;
            transition: color 0.2s;
        }

        .founders-info-link:hover {
            color: #8B1A28;
        }

        [data-theme="dark"] .founders-info-link {
            color: #ffd700;
        }

        [data-theme="dark"] .founders-info-link:hover {
            color: #fff;
        }

        /* Hide founders widget when full */
        .founders-club-widget.full {
            display: none !important;
        }

        /* ==========================================================================
           SECTION 7: MOBILE/RESPONSIVE STYLES
           ========================================================================== */
        @media (max-width: 1024px) {
            .header-search input { width: 200px; }
        }

        @media (max-width: 1100px) {
            .founders-club-widget { display: none !important; }
        }

        @media (max-width: 768px) {
            .header-search { display: none; }
            .header-auth { display: none; }
            .theme-toggle { display: none; }
            .feedback-link { display: none; }
            .main-nav { display: none; }
            .mobile-menu-btn { display: block; }
            .founders-club-widget { display: none !important; }
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
        console.log('initThemeToggle called, toggle element:', toggle);
        if (!toggle) {
            console.warn('Theme toggle button not found');
            return;
        }

        // Prevent duplicate event listeners
        if (toggle.dataset.initialized) {
            console.log('Theme toggle already initialized, skipping');
            return;
        }
        toggle.dataset.initialized = 'true';

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
            console.log('Theme toggle clicked!');
            e.preventDefault();
            e.stopPropagation();

            const current = document.documentElement.getAttribute('data-theme');
            const newTheme = current === 'dark' ? 'light' : 'dark';

            console.log('Changing theme from', current, 'to', newTheme);

            // Apply to both html and body for broader compatibility
            document.documentElement.setAttribute('data-theme', newTheme);
            document.body.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);

            updateToggleLabel();
            console.log('Theme changed to:', newTheme);
        });

        console.log('Theme toggle event listener attached');
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
                // Store admin status for GA exclusion
                localStorage.setItem('isAdmin', data.user.isAdmin ? 'true' : 'false');

                const headerAuth = document.getElementById('headerAuth');
                const mobileMenuAuth = document.getElementById('mobileMenuAuth');

                // Premium badge - handles new single tier and legacy tiers
                const isPremium = data.user.isSubscribed ||
                    data.user.subscriptionTier === 'premium' ||
                    data.user.subscriptionTier === 'diehard_plus' ||
                    data.user.subscriptionTier === 'diehard_pro';
                const premiumBadge = isPremium
                    ? `<a href="/membership.html" class="premium-badge" title="Diehard Premium">PREMIUM</a>`
                    : `<a href="/membership.html" class="go-premium-link">Go Premium</a>`;

                const mailLink = isPremium
                    ? `<a href="/mail.html" class="mail-link" title="Your @phillysports.com inbox">📧 Mail</a>`
                    : '';

                const adminLink = data.user.isAdmin
                    ? `<a href="/admin.html" class="admin-link" title="Admin Dashboard">Admin</a>`
                    : '';

                if (headerAuth) {
                    // Get user initials for avatar
                    const initials = (data.user.displayName || data.user.username || 'U').charAt(0).toUpperCase();
                    const avatarContent = data.user.profilePhoto
                        ? `<img src="${data.user.profilePhoto}" alt="${data.user.username}">`
                        : initials;

                    // Build badges array
                    const badges = [];
                    if (isPremium) badges.push('<span class="badge-premium">Premium</span>');
                    if (data.user.founderNumber) badges.push(`<span class="badge-founder">#${data.user.founderNumber}</span>`);
                    if (data.user.isAdmin) badges.push('<span class="badge-admin">Admin</span>');
                    const badgesHtml = badges.length > 0 ? `<div class="user-panel-badges">${badges.join('')}</div>` : '';

                    // Build quick links
                    const quickLinks = ['<a href="/profile.html">Profile</a>'];
                    if (isPremium) quickLinks.push('<a href="/mail.html">Mail</a>');
                    quickLinks.push('<a href="/settings.html">Settings</a>');
                    if (data.user.isAdmin) quickLinks.push('<a href="/admin.html">Admin</a>');
                    quickLinks.push('<a href="#" id="logoutBtn">Logout</a>');

                    headerAuth.innerHTML = `
                        <div class="user-panel">
                            <div class="user-panel-header">
                                <div class="user-avatar">${avatarContent}</div>
                                <div class="user-panel-info">
                                    <a href="/profile.html" class="user-panel-name">${data.user.displayName || data.user.username}</a>
                                    ${badgesHtml}
                                </div>
                            </div>
                            <div class="user-panel-coins">
                                <div class="coin-info">
                                    <span class="coin-icon">DD</span>
                                    <span class="coin-balance">${Math.round(data.user.coinBalance || 0).toLocaleString()}</span>
                                    <span class="coin-label">DD</span>
                                </div>
                                <a href="/shop.html#coin-packs" class="buy-coins-link">Buy</a>
                            </div>
                            <div class="user-panel-links">
                                ${quickLinks.join('<span class="link-sep">·</span>')}
                            </div>
                        </div>
                    `;

                    // Add logout handler
                    document.getElementById('logoutBtn')?.addEventListener('click', async (e) => {
                        e.preventDefault();
                        await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
                        localStorage.removeItem('auth_token');
                        localStorage.removeItem('isAdmin');
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
                        localStorage.removeItem('isAdmin');
                        window.location.reload();
                    });
                }

                // Initialize Pusher for real-time notifications
                initPusher(data.user.id || data.user._id);
            }
        } catch (error) {
            // Not logged in, keep default header
        }
    }

    // ========== PUSHER REAL-TIME NOTIFICATIONS ==========
    let pusherInstance = null;
    let userChannel = null;

    // Load Pusher JS library dynamically
    function loadPusherScript() {
        return new Promise((resolve, reject) => {
            if (window.Pusher) {
                resolve();
                return;
            }
            const script = document.createElement('script');
            script.src = 'https://js.pusher.com/8.3/pusher.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    // Initialize Pusher for real-time notifications
    async function initPusher(userId) {
        try {
            // Load Pusher library
            await loadPusherScript();

            // Get Pusher config from API
            const configRes = await fetch('/api/pusher/config');
            const config = await configRes.json();

            if (!config.key) {
                console.log('Pusher not configured');
                return;
            }

            // Initialize Pusher
            pusherInstance = new window.Pusher(config.key, {
                cluster: config.cluster,
                authEndpoint: '/api/pusher/auth',
                auth: {
                    headers: {}
                }
            });

            // Subscribe to private user channel
            userChannel = pusherInstance.subscribe(`private-user-${userId}`);

            // Listen for trivia events
            userChannel.bind('trivia-matched', (data) => {
                showNotification({
                    title: 'Match Found!',
                    message: data.message || `You've been matched for trivia!`,
                    type: 'success',
                    action: {
                        text: 'Join Game',
                        url: `/trivia-match.html?id=${data.challengeId}`
                    }
                });
            });

            userChannel.bind('trivia-challenge-received', (data) => {
                showNotification({
                    title: 'New Challenge!',
                    message: data.message || `${data.challenger?.username} challenged you!`,
                    type: 'info',
                    action: {
                        text: 'View Challenge',
                        url: '/trivia.html'
                    }
                });
            });

            userChannel.bind('trivia-your-turn', (data) => {
                showNotification({
                    title: 'Your Turn!',
                    message: data.message || `It's your turn in trivia!`,
                    type: 'info',
                    action: {
                        text: 'Play Now',
                        url: `/trivia-match.html?id=${data.challengeId}`
                    }
                });
            });

            userChannel.bind('trivia-match-complete', (data) => {
                const isWinner = data.winner?.userId === userId;
                showNotification({
                    title: isWinner ? 'You Won!' : 'Match Complete',
                    message: data.message || (isWinner ? 'Congratulations!' : 'Better luck next time!'),
                    type: isWinner ? 'success' : 'info',
                    action: {
                        text: 'View Results',
                        url: `/trivia-match.html?id=${data.challengeId}`
                    }
                });
            });

            console.log('Pusher initialized for user:', userId);
        } catch (error) {
            console.error('Pusher initialization error:', error);
        }
    }

    // Show notification banner
    function showNotification({ title, message, type = 'info', action, duration = 8000 }) {
        // Create notification container if it doesn't exist
        let container = document.getElementById('site-notifications');
        if (!container) {
            container = document.createElement('div');
            container.id = 'site-notifications';
            container.style.cssText = 'position: fixed; top: 80px; right: 20px; z-index: 10000; display: flex; flex-direction: column; gap: 10px; max-width: 350px;';
            document.body.appendChild(container);
        }

        // Create notification element
        const notification = document.createElement('div');
        notification.className = `site-notification site-notification-${type}`;
        notification.style.cssText = `
            background: ${type === 'success' ? '#4caf50' : type === 'error' ? '#f44336' : '#1A2744'};
            color: white;
            padding: 1rem;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            animation: slideInRight 0.3s ease;
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
        `;

        notification.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <strong style="font-size: 0.95rem;">${title}</strong>
                <button onclick="this.parentElement.parentElement.remove()" style="background: none; border: none; color: white; font-size: 1.2rem; cursor: pointer; opacity: 0.7;">&times;</button>
            </div>
            <p style="margin: 0; font-size: 0.85rem; opacity: 0.9;">${message}</p>
            ${action ? `<a href="${action.url}" style="background: rgba(255,255,255,0.2); color: white; padding: 0.5rem 1rem; border-radius: 4px; text-decoration: none; text-align: center; font-weight: 600; font-size: 0.85rem; margin-top: 0.25rem;">${action.text}</a>` : ''}
        `;

        // Add animation keyframes if not already added
        if (!document.getElementById('notification-styles')) {
            const style = document.createElement('style');
            style.id = 'notification-styles';
            style.textContent = `
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideOutRight {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }

        container.appendChild(notification);

        // Play notification sound (optional)
        try {
            const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleC4EWI6+yeB5U0A8e6jH4o92QkNMg6TF54d8S1dgmM3xvZJDKDV1uP/ZqXNNPUBnqNnwn3FWSFV7r9zqmmhDOkhkqeLnnG9OO0hTg7ji6aBwQi9AZpvN7sGdWzEhQHKjxfLQoFoxJk2Cp83yupo8Gip0vP/tvYxLMEZcj8Hx2qlBGRpPi7Tr7a5hNDQ/Xo2958WsVCIZMmaTxO7frk8fEj9wqNnowqBQHxM8cpnK88WnPBQNPXGk1PLTsEQHCUp+sc3086c4BQBBc6bT8+S0OgAAQ3On0fPlszcAAEN0p9Hz5LM3AABDdKfR8+SzNwAAQ3Sn0fPkszcAAEN0p9Hz5LM3AAA=');
            audio.volume = 0.3;
            audio.play().catch(() => {});
        } catch (e) {}

        // Auto-remove after duration
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease forwards';
            setTimeout(() => notification.remove(), 300);
        }, duration);
    }

    // Cleanup Pusher on page unload
    window.addEventListener('beforeunload', () => {
        if (pusherInstance) {
            pusherInstance.disconnect();
        }
    });

    // Fetch and display Founders Club progress
    async function loadFoundersProgress() {
        try {
            const res = await fetch('/api/subscriptions/founders');
            const data = await res.json();

            if (!data.success || !data.foundersClub) return;

            const { current, limit, spotsRemaining, isFull } = data.foundersClub;
            const widgetEl = document.getElementById('foundersWidget');
            const barFill = document.getElementById('foundersBarFill');
            const countEl = document.getElementById('foundersCount');

            if (!widgetEl) return;

            if (isFull) {
                // Hide if full
                widgetEl.classList.add('full');
                widgetEl.style.display = 'none';
            } else {
                // Show progress
                widgetEl.style.display = 'flex';
                const percent = (current / limit) * 100;
                if (barFill) barFill.style.width = percent + '%';
                if (countEl) {
                    countEl.textContent = `${current}/${limit}`;

                    // Add urgency styling when few spots left
                    if (spotsRemaining <= 10) {
                        countEl.classList.add('urgent');
                        countEl.textContent = `${spotsRemaining} left!`;
                    }
                }
            }
        } catch (e) {
            console.error('Failed to load founders progress:', e);
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
        // Prevent double initialization
        if (window.PhillySportsHeaderInitialized) {
            console.log('Header already initialized, skipping');
            return;
        }
        window.PhillySportsHeaderInitialized = true;

        injectCSS();
        injectHeader();
        initThemeToggle();
        initMobileMenu();
        highlightCurrentPage();
        checkAuth();
        loadFoundersProgress();
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
        initMobileMenu,
        showNotification,
        initPusher
    };
})();
