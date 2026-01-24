// Live Ticker Component - Shows live Philly games at top of page
// Include this script on any page to show the live ticker

(function() {
    const API_URL = '/api/live-ticker';
    const REFRESH_INTERVAL = 30000; // 30 seconds
    let tickerContainer = null;
    let isMinimized = localStorage.getItem('tickerMinimized') === 'true';
    let refreshTimer = null;

    // Inject styles
    function injectStyles() {
        if (document.getElementById('live-ticker-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'live-ticker-styles';
        styles.textContent = `
            .live-ticker {
                position: relative;
                z-index: 998;
                background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                border-bottom: 2px solid #e94560;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                transition: transform 0.3s ease, max-height 0.3s ease, opacity 0.3s ease;
            }

            .live-ticker.minimized {
                max-height: 0;
                overflow: hidden;
                border-bottom: none;
            }

            /* Expand button - positioned in wrapper, not inside ticker */
            .ticker-expand {
                display: none;
                position: absolute;
                top: 0;
                left: 50%;
                transform: translateX(-50%);
                background: linear-gradient(135deg, #e94560, #d63850);
                color: white;
                border: none;
                padding: 6px 20px;
                border-radius: 0 0 8px 8px;
                cursor: pointer;
                font-size: 12px;
                font-weight: 600;
                align-items: center;
                gap: 6px;
                z-index: 999;
                box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            }

            .live-ticker-wrapper.minimized .ticker-expand {
                display: flex;
            }

            .ticker-expand:hover {
                background: linear-gradient(135deg, #ff6b6b, #e94560);
            }

            .ticker-expand .live-dot {
                width: 8px;
                height: 8px;
                background: #fff;
                border-radius: 50%;
                animation: pulse 1.5s infinite;
            }

            .ticker-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 6px 16px;
                background: rgba(0, 0, 0, 0.2);
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            }

            .ticker-title {
                display: flex;
                align-items: center;
                gap: 8px;
                color: #e94560;
                font-weight: 700;
                font-size: 12px;
                text-transform: uppercase;
                letter-spacing: 1px;
            }

            .ticker-title .live-dot {
                width: 8px;
                height: 8px;
                background: #e94560;
                border-radius: 50%;
                animation: pulse 1.5s infinite;
            }

            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.4; }
            }

            .ticker-controls {
                display: flex;
                gap: 8px;
            }

            .ticker-btn {
                background: rgba(255, 255, 255, 0.1);
                border: none;
                color: white;
                padding: 4px 8px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 11px;
                transition: background 0.2s;
            }

            .ticker-btn:hover {
                background: rgba(255, 255, 255, 0.2);
            }

            .ticker-games {
                display: flex;
                overflow-x: auto;
                scroll-behavior: smooth;
                -webkit-overflow-scrolling: touch;
                scrollbar-width: none;
                -ms-overflow-style: none;
            }

            .ticker-games::-webkit-scrollbar {
                display: none;
            }

            .ticker-game {
                flex-shrink: 0;
                display: flex;
                align-items: stretch;
                border-right: 1px solid rgba(255, 255, 255, 0.1);
                min-width: 320px;
            }

            .ticker-game:last-child {
                border-right: none;
            }

            .game-score-section {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 10px 16px;
                background: rgba(0, 0, 0, 0.2);
                cursor: pointer;
                transition: background 0.2s;
            }

            .game-score-section:hover {
                background: rgba(0, 0, 0, 0.4);
            }

            .team-block {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 2px;
                min-width: 50px;
            }

            .team-block.philly .team-abbr {
                color: #4ade80;
            }

            .team-logo {
                width: 32px;
                height: 32px;
                object-fit: contain;
            }

            .team-abbr {
                color: white;
                font-weight: 700;
                font-size: 13px;
            }

            .team-score-value {
                font-size: 24px;
                font-weight: 800;
                color: white;
            }

            .game-vs {
                color: rgba(255, 255, 255, 0.4);
                font-size: 11px;
                font-weight: 600;
            }

            .game-status-block {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 0 12px;
                min-width: 90px;
                gap: 4px;
            }

            .game-details-btn {
                background: linear-gradient(135deg, #e94560, #d63850);
                color: white;
                border: none;
                padding: 4px 10px;
                border-radius: 4px;
                font-size: 10px;
                font-weight: 600;
                cursor: pointer;
                text-transform: uppercase;
                transition: background 0.2s;
                white-space: nowrap;
            }

            .game-details-btn:hover {
                background: linear-gradient(135deg, #ff6b6b, #e94560);
            }

            .game-period {
                color: #e94560;
                font-weight: 700;
                font-size: 12px;
            }

            .game-clock {
                color: white;
                font-size: 14px;
                font-weight: 600;
            }

            .game-final {
                color: #888;
                font-size: 11px;
                font-weight: 600;
                text-transform: uppercase;
            }

            .game-plays-section {
                flex: 1;
                padding: 8px 12px;
                display: flex;
                flex-direction: column;
                justify-content: center;
                gap: 4px;
                min-width: 200px;
                max-width: 280px;
                border-left: 1px solid rgba(255, 255, 255, 0.1);
            }

            .play-item {
                color: rgba(255, 255, 255, 0.8);
                font-size: 11px;
                line-height: 1.3;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .play-item:first-child {
                color: white;
                font-weight: 500;
            }

            .game-situation {
                background: rgba(233, 69, 96, 0.2);
                color: #e94560;
                font-size: 11px;
                font-weight: 600;
                padding: 2px 6px;
                border-radius: 3px;
                margin-bottom: 4px;
            }

            .no-games {
                padding: 12px 20px;
                color: rgba(255, 255, 255, 0.6);
                font-size: 13px;
                text-align: center;
                width: 100%;
            }

            .ticker-loading {
                padding: 12px 20px;
                color: rgba(255, 255, 255, 0.6);
                font-size: 13px;
                text-align: center;
                width: 100%;
            }

            /* Ticker wrapper for positioning */
            .live-ticker-wrapper {
                position: relative;
            }

            /* Mobile adjustments */
            @media (max-width: 768px) {
                .ticker-game {
                    min-width: 280px;
                }

                .game-plays-section {
                    display: none;
                }

                .team-logo {
                    width: 24px;
                    height: 24px;
                }

                .team-score-value {
                    font-size: 20px;
                }
            }
        `;
        document.head.appendChild(styles);
    }

    // Create ticker HTML
    let tickerWrapper = null;

    function createTicker() {
        if (document.getElementById('live-ticker')) return;

        // Create wrapper for positioning the expand button
        tickerWrapper = document.createElement('div');
        tickerWrapper.className = 'live-ticker-wrapper' + (isMinimized ? ' minimized' : '');
        tickerWrapper.id = 'live-ticker-wrapper';

        tickerContainer = document.createElement('div');
        tickerContainer.id = 'live-ticker';
        tickerContainer.className = 'live-ticker' + (isMinimized ? ' minimized' : '');
        tickerContainer.innerHTML = `
            <div class="ticker-header">
                <div class="ticker-title">
                    <span class="live-dot"></span>
                    Live Philly Sports
                </div>
                <div class="ticker-controls">
                    <a href="/game-threads.html" class="ticker-btn" style="text-decoration: none;">Game Chats</a>
                    <button class="ticker-btn" onclick="window.liveTicker.refresh()">Refresh</button>
                    <button class="ticker-btn" onclick="window.liveTicker.minimize()">Minimize</button>
                </div>
            </div>
            <div class="ticker-games">
                <div class="ticker-loading">Loading live games...</div>
            </div>
        `;

        // Expand button goes in wrapper, not ticker (so it's visible when ticker is hidden)
        const expandBtn = document.createElement('button');
        expandBtn.className = 'ticker-expand';
        expandBtn.onclick = window.liveTicker.expand;
        expandBtn.innerHTML = '<span class="live-dot"></span> Show Live Games';

        tickerWrapper.appendChild(tickerContainer);
        tickerWrapper.appendChild(expandBtn);
        const wrapper = tickerWrapper;

        // Insert after the site-header div (which contains the header)
        const siteHeader = document.getElementById('site-header');
        const header = document.querySelector('.header');

        if (siteHeader && siteHeader.parentNode) {
            // Insert after the site-header container
            siteHeader.parentNode.insertBefore(wrapper, siteHeader.nextSibling);
        } else if (header && header.parentNode) {
            // Insert after the header element
            if (header.parentNode.id === 'site-header') {
                // Header is inside site-header, insert after site-header
                header.parentNode.parentNode.insertBefore(wrapper, header.parentNode.nextSibling);
            } else {
                header.parentNode.insertBefore(wrapper, header.nextSibling);
            }
        } else {
            // Fallback: insert before main content
            const body = document.body;
            const firstMain = body.querySelector('main, .main-container');
            if (firstMain) {
                body.insertBefore(wrapper, firstMain);
            } else {
                body.insertBefore(wrapper, body.firstChild);
            }
        }
    }

    // Render games
    function renderGames(games) {
        const container = tickerContainer.querySelector('.ticker-games');

        if (!games || games.length === 0) {
            container.innerHTML = '<div class="no-games">No live Philly games right now</div>';
            return;
        }

        const html = games.map(game => {
            const phillyWinning = (game.homeTeam.isPhilly && game.homeTeam.score > game.awayTeam.score) ||
                                  (game.awayTeam.isPhilly && game.awayTeam.score > game.homeTeam.score);

            let statusHtml = '';
            if (game.status.isFinal) {
                statusHtml = `<span class="game-final">Final</span>`;
            } else if (game.status.isInProgress) {
                statusHtml = `
                    <span class="game-period">${game.status.description || ''}</span>
                    ${game.status.clock ? `<span class="game-clock">${game.status.clock}</span>` : ''}
                `;
            }

            let playsHtml = '';
            if (game.status.isInProgress) {
                if (game.situation?.display) {
                    playsHtml += `<div class="game-situation">${game.situation.display}</div>`;
                }
                if (game.recentPlays && game.recentPlays.length > 0) {
                    playsHtml += game.recentPlays.map(play =>
                        `<div class="play-item">${play.text}</div>`
                    ).join('');
                }
            }

            const buttonText = game.status.isInProgress ? 'Game Details' : (game.status.isFinal ? 'Box Score' : 'Game Preview');

            return `
                <div class="ticker-game" data-sport="${game.sport}" data-game-id="${game.id}">
                    <div class="game-score-section">
                        <div class="team-block ${game.awayTeam.isPhilly ? 'philly' : ''}">
                            <img class="team-logo" src="${game.awayTeam.logo}" alt="${game.awayTeam.shortName}" onerror="this.style.display='none'">
                            <span class="team-abbr">${game.awayTeam.shortName}</span>
                        </div>
                        <span class="team-score-value">${game.awayTeam.score}</span>
                        <div class="game-status-block">
                            ${statusHtml}
                            <button class="game-details-btn" onclick="window.liveTicker.openGame('${game.sport}', '${game.id}')">${buttonText}</button>
                        </div>
                        <span class="team-score-value">${game.homeTeam.score}</span>
                        <div class="team-block ${game.homeTeam.isPhilly ? 'philly' : ''}">
                            <img class="team-logo" src="${game.homeTeam.logo}" alt="${game.homeTeam.shortName}" onerror="this.style.display='none'">
                            <span class="team-abbr">${game.homeTeam.shortName}</span>
                        </div>
                    </div>
                    ${playsHtml ? `<div class="game-plays-section">${playsHtml}</div>` : ''}
                </div>
            `;
        }).join('');

        container.innerHTML = html;
    }

    // Fetch and update
    async function fetchGames() {
        try {
            const response = await fetch(API_URL);
            if (!response.ok) throw new Error('Failed to fetch');
            const data = await response.json();

            if (data.success && data.games) {
                renderGames(data.games);

                // Hide ticker if no games
                if (data.games.length === 0 && !isMinimized) {
                    // Keep visible but show "no games" message
                }
            }
        } catch (error) {
            console.error('Live ticker error:', error);
            const container = tickerContainer.querySelector('.ticker-games');
            container.innerHTML = '<div class="no-games">Unable to load live games</div>';
        }
    }

    // Public API
    window.liveTicker = {
        init: function() {
            injectStyles();
            createTicker();
            fetchGames();
            refreshTimer = setInterval(fetchGames, REFRESH_INTERVAL);
        },

        refresh: function() {
            fetchGames();
        },

        minimize: function() {
            isMinimized = true;
            localStorage.setItem('tickerMinimized', 'true');
            tickerContainer.classList.add('minimized');
            if (tickerWrapper) tickerWrapper.classList.add('minimized');
        },

        expand: function() {
            isMinimized = false;
            localStorage.setItem('tickerMinimized', 'false');
            tickerContainer.classList.remove('minimized');
            if (tickerWrapper) tickerWrapper.classList.remove('minimized');
            fetchGames();
        },

        openGame: function(sport, gameId) {
            // Open game preview page with ESPN game data
            window.location.href = `/game-preview.html?id=${gameId}&sport=${sport}&source=espn`;
        },

        destroy: function() {
            if (refreshTimer) clearInterval(refreshTimer);
            const wrapper = document.querySelector('.live-ticker-wrapper');
            if (wrapper) wrapper.remove();
        }
    };

    // Auto-init when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', window.liveTicker.init);
    } else {
        window.liveTicker.init();
    }
})();
