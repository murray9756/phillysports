// Shared Header Component for PhillySports.com
// Matches homepage newspaper-style header with centered logo
// Include this script on every page and add <div id="site-header"></div> where the header should appear

(function() {
    'use strict';

    // Header HTML template
    const headerHTML = `
        <header class="header">
            <div class="header-top">
                <!-- Left Column: Google Search -->
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
                    <!-- F2: Dark Mode - EXACT copy from logo-preview.html -->
                    <div class="logo-for-light" style="position: relative; width: 100%; max-width: 480px; height: 280px; background: linear-gradient(180deg, #1A2744 0%, #0d1520 100%); border: 8px solid #F5F0E1; overflow: hidden; margin: 0 auto;">
                        <div style="position: absolute; top: 8px; left: 8px; right: 8px; bottom: 8px; border: 3px solid #8B1A28; pointer-events: none; z-index: 10;"></div>
                        <img src="/ben.jpeg" alt="Ben Franklin" style="position: absolute; top: 50%; left: -20px; transform: translateY(-50%); height: 220px; width: auto; opacity: 0.25; filter: invert(1) brightness(1.2); z-index: 1;">
                        <div style="position: absolute; top: 12px; width: 100%; display: flex; justify-content: center; align-items: center; gap: 12px; z-index: 5;">
                            <svg style="width: 22px; height: 22px; filter: drop-shadow(2px 2px 3px rgba(0,0,0,0.6));" viewBox="0 0 40 40">
                                <defs><linearGradient id="redStarF2h" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#c42030"/><stop offset="50%" style="stop-color:#8B1A28"/><stop offset="100%" style="stop-color:#5a0f15"/></linearGradient></defs>
                                <polygon points="20,2 24,14 37,14 27,22 31,35 20,27 9,35 13,22 3,14 16,14" fill="url(#redStarF2h)"/>
                            </svg>
                            <span style="font-family: 'Brush Script MT', cursive; font-size: 16px; color: #F5F0E1; letter-spacing: 4px;">Est. 2026</span>
                            <svg style="width: 22px; height: 22px; filter: drop-shadow(2px 2px 3px rgba(0,0,0,0.6));" viewBox="0 0 40 40">
                                <defs><linearGradient id="blueStarF2h" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#6a8fc4"/><stop offset="50%" style="stop-color:#4a6fa0"/><stop offset="100%" style="stop-color:#3a5a8c"/></linearGradient></defs>
                                <polygon points="20,2 24,14 37,14 27,22 31,35 20,27 9,35 13,22 3,14 16,14" fill="url(#blueStarF2h)"/>
                            </svg>
                        </div>
                        <div style="position: absolute; top: 90px; right: 25px; text-align: right; z-index: 5;">
                            <div style="font-family: 'Brush Script MT', cursive; font-size: 58px; color: #F5F0E1; line-height: 0.9;">Philly</div>
                            <div style="font-family: 'Impact', 'Arial Black', sans-serif; font-size: 52px; color: #8B1A28; line-height: 0.85; letter-spacing: -1px;">SPORTS</div>
                            <div style="font-family: Georgia, serif; font-size: 14px; color: #F5F0E1; letter-spacing: 2px;">.COM</div>
                        </div>
                        <div style="position: absolute; bottom: 22px; width: 100%; text-align: center; font-family: Georgia, serif; font-size: 13px; font-weight: bold; font-style: italic; color: #F5F0E1; letter-spacing: 2px; z-index: 5;">Where the Diehards Play Hard</div>
                    </div>
                    <!-- F5: Vignette - EXACT copy from logo-preview.html -->
                    <div class="logo-for-dark" style="position: relative; width: 100%; max-width: 480px; height: 280px; background: linear-gradient(180deg, #F5F0E1 0%, #e8e0cc 100%); border: 8px solid #1A2744; overflow: hidden; margin: 0 auto;">
                        <div style="position: absolute; top: 8px; left: 8px; right: 8px; bottom: 8px; border: 3px solid #8B1A28; pointer-events: none; z-index: 10;"></div>
                        <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.3) 100%); z-index: 8; pointer-events: none;"></div>
                        <img src="/ben.jpeg" alt="Ben Franklin" style="position: absolute; top: 50%; left: -20px; transform: translateY(-50%); height: 220px; width: auto; opacity: 0.5; z-index: 1;">
                        <div style="position: absolute; top: 12px; width: 100%; display: flex; justify-content: center; align-items: center; gap: 12px; z-index: 5;">
                            <svg style="width: 22px; height: 22px; filter: drop-shadow(2px 2px 3px rgba(0,0,0,0.4));" viewBox="0 0 40 40">
                                <defs><linearGradient id="redStarF5h" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#c42030"/><stop offset="50%" style="stop-color:#8B1A28"/><stop offset="100%" style="stop-color:#5a0f15"/></linearGradient></defs>
                                <polygon points="20,2 24,14 37,14 27,22 31,35 20,27 9,35 13,22 3,14 16,14" fill="url(#redStarF5h)"/>
                            </svg>
                            <span style="font-family: 'Brush Script MT', cursive; font-size: 16px; color: #1A2744; letter-spacing: 4px;">Est. 2026</span>
                            <svg style="width: 22px; height: 22px; filter: drop-shadow(2px 2px 3px rgba(0,0,0,0.4));" viewBox="0 0 40 40">
                                <defs><linearGradient id="blueStarF5h" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#3a5a8c"/><stop offset="50%" style="stop-color:#1A2744"/><stop offset="100%" style="stop-color:#0d1520"/></linearGradient></defs>
                                <polygon points="20,2 24,14 37,14 27,22 31,35 20,27 9,35 13,22 3,14 16,14" fill="url(#blueStarF5h)"/>
                            </svg>
                        </div>
                        <div style="position: absolute; top: 90px; right: 25px; text-align: right; z-index: 5;">
                            <div style="font-family: 'Brush Script MT', cursive; font-size: 58px; color: #1A2744; line-height: 0.9;">Philly</div>
                            <div style="font-family: 'Impact', 'Arial Black', sans-serif; font-size: 52px; color: #8B1A28; line-height: 0.85; letter-spacing: -1px;">SPORTS</div>
                            <div style="font-family: Georgia, serif; font-size: 14px; color: #1A2744; letter-spacing: 2px;">.COM</div>
                        </div>
                        <div style="position: absolute; bottom: 22px; width: 100%; text-align: center; font-family: Georgia, serif; font-size: 13px; font-weight: bold; font-style: italic; color: #1A2744; letter-spacing: 2px; z-index: 5;">Where the Diehards Play Hard</div>
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
        /* Header - Uses CSS variables for theme support */
        .header {
            background: var(--header-bg, #1a1a1a);
            border-bottom: 1px solid var(--border-color, #333);
            position: sticky;
            top: 0;
            z-index: 1000;
        }

        .header-top {
            display: grid;
            grid-template-columns: 1fr auto 1fr;
            align-items: center;
            padding: 0.75rem 1.5rem;
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
            display: flex;
            justify-content: flex-end;
            align-items: center;
        }

        .header-logo {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 0.25rem;
            text-decoration: none;
            max-width: 360px;
        }

        /* Logo theme switching - light mode default shows F2 (dark bg) */
        .header-logo .logo-for-light { display: block !important; }
        .header-logo .logo-for-dark { display: none !important; }

        /* Dark mode - show F5 (light bg) */
        [data-theme="dark"] .header-logo .logo-for-light { display: none !important; }
        [data-theme="dark"] .header-logo .logo-for-dark { display: block !important; }

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
            border: 1px solid #333;
            border-radius: 4px;
            background: #2a2a2a;
            color: #e8e8e8;
            font-size: 0.8rem;
            width: 280px;
            font-family: inherit;
        }

        .header-search input::placeholder {
            color: #888;
        }

        .header-search button {
            padding: 0.5rem 0.75rem;
            background: #8b0000;
            border: none;
            border-radius: 4px;
            color: white;
            font-weight: 600;
            font-size: 0.75rem;
            cursor: pointer;
            font-family: inherit;
            transition: opacity 0.2s;
        }

        .header-search button:hover {
            opacity: 0.9;
        }

        .header-auth {
            display: flex;
            align-items: center;
            gap: 1rem;
        }

        .header-auth a {
            color: var(--nav-text, #d0d0d0);
            font-size: 0.8rem;
            font-weight: 600;
            padding: 0.5rem 0.75rem;
            border-radius: 4px;
            transition: background 0.2s;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            text-decoration: none;
        }

        .header-auth a:hover {
            background: var(--card-bg-hover, rgba(255,255,255,0.1));
            color: var(--text-primary, #fff);
        }

        .header-auth .auth-btn {
            background: #8b0000;
            color: #ffffff;
            padding: 0.5rem 1rem;
        }

        .header-auth .auth-btn:hover {
            opacity: 0.9;
            background: #8b0000;
        }

        /* Coin Display - Prominent Square */
        .coin-display {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 0.35rem;
            background: linear-gradient(135deg, rgba(255, 215, 0, 0.2), rgba(255, 140, 0, 0.15));
            border: 3px solid #ffd700;
            padding: 1rem 1.5rem;
            border-radius: 4px;
            cursor: default;
            box-shadow: 0 0 20px rgba(255, 215, 0, 0.4);
            min-width: 140px;
        }

        .coin-label {
            font-size: 0.7rem;
            font-weight: 700;
            color: #ffd700;
            text-transform: uppercase;
            letter-spacing: 1.5px;
        }

        .coin-amount-row {
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }

        .coin-icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 32px;
            height: 32px;
            background: linear-gradient(135deg, #ffd700, #ff8c00);
            border-radius: 50%;
            font-size: 1rem;
            font-weight: 800;
            color: #000;
            box-shadow: inset 0 -2px 4px rgba(0,0,0,0.3), 0 2px 4px rgba(0,0,0,0.2);
            border: 2px solid #ffaa00;
        }

        .coin-balance {
            font-variant-numeric: tabular-nums;
            font-size: 2rem;
            font-weight: 800;
            color: #ffffff;
            text-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
        }

        .buy-coins-link {
            color: #000 !important;
            text-decoration: none;
            font-weight: 700;
            font-size: 0.65rem;
            margin-top: 0.5rem;
            padding: 0.4rem 0.75rem;
            transition: all 0.2s;
            background: linear-gradient(135deg, #ffd700, #ffaa00);
            border-radius: 4px;
            display: block;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            text-align: center;
        }

        .buy-coins-link:hover {
            background: linear-gradient(135deg, #ffe44d, #ffbb33);
            transform: scale(1.05);
            box-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
        }

        /* User Actions Stack */
        .user-actions-stack {
            display: flex;
            flex-direction: column;
            align-items: stretch;
            gap: 0.35rem;
        }

        .user-actions-stack a {
            text-align: center;
            padding: 0.35rem 0.75rem !important;
            font-size: 0.7rem !important;
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
            margin-left: -0.5rem;
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
            background: var(--card-bg, #2a2a2a);
            border: 1px solid var(--border-color, #444);
            border-radius: 20px;
            padding: 0.4rem 0.6rem;
            cursor: pointer;
            font-size: 1rem;
            line-height: 1;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            gap: 0.25rem;
            color: var(--nav-text, #d0d0d0);
        }

        .theme-toggle:hover {
            background: var(--card-bg-hover, rgba(255,255,255,0.1));
        }

        .theme-toggle .theme-icon-light,
        .theme-toggle .theme-icon-dark {
            display: none;
        }

        .theme-toggle .theme-icon-light { display: inline; }
        [data-theme="dark"] .theme-toggle .theme-icon-light { display: none; }
        [data-theme="dark"] .theme-toggle .theme-icon-dark { display: inline; }

        .theme-toggle .theme-label {
            font-size: 0.7rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        /* Main Navigation - Uses CSS variables for theme support */
        .main-nav {
            background: var(--header-bg, #1a1a1a);
            border-bottom: 1px solid var(--border-color, #333);
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
            background: var(--header-bg, #1a1a1a);
            border: 1px solid var(--border-color, #333);
            border-radius: 4px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
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

        .nav-dropdown:hover .dropdown-arrow {
            transform: rotate(180deg);
        }

        .dropdown-menu a {
            display: block;
            padding: 0.6rem 1rem;
            color: var(--nav-text, #d0d0d0);
            font-size: 0.8rem;
            font-weight: 500;
            text-decoration: none;
            transition: background 0.2s, color 0.2s;
        }

        .dropdown-menu a:hover {
            background: var(--card-bg-hover, rgba(255,255,255,0.1));
            color: var(--text-primary, #fff);
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
            .header-logo { margin-top: 0; }
            .header-logo .logo-for-light,
            .header-logo .logo-for-dark {
                width: 320px !important;
                height: 187px !important;
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

    // Initialize
    function init() {
        injectCSS();
        injectHeader();
        initThemeToggle();
        initMobileMenu();
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
