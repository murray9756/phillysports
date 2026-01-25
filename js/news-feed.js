// Shared News Feed Component for PhillySports.com
// Include this script on any page that needs a news feed
// Usage: PhillySportsNewsFeed.init({ containerId: 'articleList', team: 'eagles' })
// Version: 1.0

(function() {
    'use strict';

    // Source logos for fallback thumbnails
    const sourceLogos = {
        // Local Philly coverage
        'Crossing Broad': 'https://www.crossingbroad.com/wp-content/uploads/2023/01/cropped-CB-Logo-2023-1-192x192.png',
        'PhillyVoice Sports': 'https://media.phillyvoice.com/media/images/phillyvoice-social-default.2e16d0ba.fill-1200x630-c0.jpg',
        'NBC Sports Philadelphia': 'https://www.nbcsports.com/sites/rsnunited/files/favicons/rsn-philadelphia/apple-touch-icon.png',
        'Philadelphia Inquirer Sports': 'https://www.inquirer.com/apple-touch-icon.png',
        'On Pattison': 'https://accessglobal.media.clients.ellingtoncms.com/static-4/assets/images/on-pattison-logo.png',
        // Eagles
        'Bleeding Green Nation': 'https://cdn.vox-cdn.com/uploads/chorus_asset/file/7396113/bgn_icon.0.png',
        'Eagles Wire': 'https://eagleswire.usatoday.com/wp-content/uploads/sites/54/2023/08/cropped-usatoday-eagles-wire-site-icon-2.png?w=192',
        // Phillies
        'The Good Phight': 'https://cdn.vox-cdn.com/uploads/chorus_asset/file/7396225/goodphight_icon.0.png',
        'Phillies Nation': 'https://www.philliesnation.com/wp-content/uploads/2023/02/cropped-PN-Site-Icon-192x192.png',
        // Sixers
        'Liberty Ballers': 'https://cdn.vox-cdn.com/uploads/chorus_asset/file/7396183/libballers_icon.0.png',
        'Sixers Wire': 'https://sixerswire.usatoday.com/wp-content/uploads/sites/30/2023/08/cropped-usatoday-sixerswire-site-icon-1.png?w=192',
        // Flyers
        'Broad Street Hockey': 'https://cdn.vox-cdn.com/uploads/chorus_asset/file/7396071/bsh_icon.0.png',
        'Flyers Nation': 'https://flyersnation.com/wp-content/uploads/2023/01/cropped-FlyersNation-Logo-Square-1-192x192.png',
        // College
        'VU Hoops (Villanova)': 'https://cdn.vox-cdn.com/uploads/chorus_asset/file/23936828/236.png',
        'Black Shoe Diaries (Penn State)': 'https://cdn.vox-cdn.com/uploads/chorus_asset/file/7396055/bsd_icon.0.png',
        // Esports
        'Dot Esports': 'https://dotesports.com/wp-content/uploads/2021/08/cropped-favicon-192x192.png',
        // National
        'ESPN': 'https://a.espncdn.com/combiner/i?img=/i/espn/espn_logos/espn_red.png&w=80&h=80',
        'The Athletic': 'https://cdn.theathletic.com/app/themes/flavor-developer/assets/img/the-athletic-icon.png',
        'Yahoo Sports': 'https://s.yimg.com/cv/apiv2/social/images/yahoo_sports/social_share_logo.png',
        'CBS Sports': 'https://sportsfly.cbsistatic.com/fly-0626/bundles/sportsmediacss/images/core/cbssports-logo-60x60.png',
        'Bleacher Report': 'https://media.bleacherreport.com/image/upload/c_fill,g_faces,w_200,h_200,q_95/v1706639222/br_logo.png',
        'Fox Sports': 'https://a57.foxsports.com/statics.foxsports.com/www.foxsports.com/content/uploads/2023/08/favicon-180.png'
    };

    // Team tag CSS classes
    const teamTagClass = {
        'eagles': 'tag-eagles',
        'phillies': 'tag-phillies',
        'sixers': 'tag-sixers',
        '76ers': 'tag-sixers',
        'flyers': 'tag-flyers',
        'union': 'tag-union',
        'college': 'tag-college',
        'esports': 'tag-esports',
        'youth': 'tag-youth',
        'general': 'tag-general'
    };

    // Sport emojis for fallback
    const sportEmoji = {
        'eagles': '🏈',
        'phillies': '⚾',
        'sixers': '🏀',
        '76ers': '🏀',
        'flyers': '🏒',
        'union': '⚽',
        'college': '🎓',
        'esports': '🎮',
        'youth': '👦'
    };

    // CSS styles for the news feed
    const newsFeedStyles = `
        <style id="news-feed-styles">
            /* Story Item Styles */
            .story-item {
                display: flex;
                gap: 0.75rem;
                padding: 0.75rem;
                background: var(--ps-cream, #f5f2eb);
                border: 2px solid var(--ps-navy, #1a1a1a);
                border-radius: 2px;
                transition: border-color 0.2s;
            }
            .story-item:hover {
                border-color: var(--ps-red, #8B0000);
            }
            .story-thumb {
                width: 120px;
                height: 83px;
                flex-shrink: 0;
                border-radius: 6px;
                background-size: cover;
                background-position: center;
                background-color: var(--border-color);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 1.25rem;
            }
            .story-info {
                flex: 1;
                min-width: 0;
            }
            .story-meta {
                font-size: 0.7rem;
                color: var(--text-muted);
                margin-bottom: 0.2rem;
                display: flex;
                align-items: center;
                gap: 0.35rem;
            }
            .story-title {
                font-size: 0.9rem;
                font-weight: 600;
                line-height: 1.3;
                color: var(--text-primary);
                overflow: hidden;
                text-overflow: ellipsis;
                display: -webkit-box;
                -webkit-line-clamp: 2;
                -webkit-box-orient: vertical;
            }
            .story-teaser {
                font-size: 0.75rem;
                color: var(--text-muted);
                line-height: 1.4;
                margin-top: 0.25rem;
                overflow: hidden;
                text-overflow: ellipsis;
                display: -webkit-box;
                -webkit-line-clamp: 2;
                -webkit-box-orient: vertical;
            }
            .story-curator-note {
                font-size: 0.8rem;
                color: var(--text-secondary);
                font-style: italic;
                margin-top: 0.35rem;
                padding: 0.4rem 0.6rem;
                background: rgba(139, 0, 0, 0.05);
                border-left: 2px solid var(--accent-color, #8B1A28);
                border-radius: 0 4px 4px 0;
            }
            .story-curator-note::before { content: '"'; }
            .story-curator-note::after { content: '"'; }

            .story-item-wrapper {
                display: flex;
                align-items: flex-start;
                gap: 0.5rem;
                padding: 0.75rem 0;
                border-bottom: 1px solid var(--border-color);
            }
            .story-item-wrapper:last-child {
                border-bottom: none;
            }
            .story-item-wrapper .story-item {
                order: 1;
            }
            .story-item-wrapper .vote-buttons {
                flex-shrink: 0;
                order: 2;
                align-self: center;
            }

            .story-actions-row {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                margin-top: 0.35rem;
            }
            .story-comment-btn {
                display: inline-flex;
                align-items: center;
                gap: 0.25rem;
                font-size: 0.75rem;
                color: var(--text-muted);
                text-decoration: none;
                padding: 0.2rem 0.4rem;
                border-radius: 3px;
                transition: all 0.2s;
            }
            .story-comment-btn:hover {
                background: rgba(0,0,0,0.05);
                color: var(--accent-color, #8B1A28);
            }

            /* Vote Buttons */
            .vote-buttons {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 0.15rem;
                padding-left: 0.75rem;
                flex-shrink: 0;
                order: 3;
            }
            .vote-btn {
                background: none;
                border: none;
                cursor: pointer;
                padding: 0.25rem;
                font-size: 1rem;
                line-height: 1;
                transition: color 0.2s, transform 0.1s;
                border-radius: 4px;
            }
            .vote-btn.upvote { color: #4caf50; }
            .vote-btn.upvote:hover { color: #2e7d32; transform: scale(1.2); }
            .vote-btn.upvote.active { color: #1b5e20; }
            .vote-btn.downvote { color: #f44336; }
            .vote-btn.downvote:hover { color: #c62828; transform: scale(1.2); }
            .vote-btn.downvote.active { color: #b71c1c; }
            .vote-score {
                font-size: 0.8rem;
                font-weight: 600;
                color: var(--text-secondary);
                min-width: 20px;
                text-align: center;
            }
            .vote-score.positive { color: #4caf50; }
            .vote-score.negative { color: #f44336; }

            /* Load More Button */
            .load-more-btn {
                width: 100%;
                padding: 0.75rem;
                background: var(--ps-cream, #f5f2eb);
                border: 2px solid var(--ps-navy, #1a1a1a);
                border-radius: 2px;
                color: var(--ps-navy, #1a1a1a);
                font-weight: 600;
                font-size: 0.85rem;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                cursor: pointer;
                transition: all 0.2s;
                margin-top: 0.75rem;
            }
            .load-more-btn:hover {
                background: var(--ps-navy, #1a1a1a);
                color: var(--ps-cream, #f5f2eb);
            }

            /* Article Tags */
            .article-tag {
                display: inline-block;
                padding: 0.15rem 0.4rem;
                border-radius: 3px;
                font-size: 0.65rem;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            .tag-eagles { background: rgba(0, 76, 84, 0.1); color: #004C54; border: 1px solid rgba(0, 76, 84, 0.3); }
            .tag-phillies { background: rgba(232, 24, 40, 0.1); color: #E81828; border: 1px solid rgba(232, 24, 40, 0.3); }
            .tag-sixers { background: rgba(0, 107, 182, 0.1); color: #006BB6; border: 1px solid rgba(0, 107, 182, 0.3); }
            .tag-flyers { background: rgba(247, 73, 2, 0.1); color: #F74902; border: 1px solid rgba(247, 73, 2, 0.3); }
            .tag-union { background: rgba(181, 152, 93, 0.1); color: #B5985D; border: 1px solid rgba(181, 152, 93, 0.3); }
            .tag-college { background: rgba(128, 0, 128, 0.1); color: #800080; border: 1px solid rgba(128, 0, 128, 0.3); }
            .tag-esports { background: rgba(75, 0, 130, 0.1); color: #4B0082; border: 1px solid rgba(75, 0, 130, 0.3); }
            .tag-youth { background: rgba(255, 165, 0, 0.1); color: #FF8C00; border: 1px solid rgba(255, 165, 0, 0.3); }
            .tag-general { background: rgba(100, 100, 100, 0.1); color: #646464; border: 1px solid rgba(100, 100, 100, 0.3); }

            /* Dark Mode */
            [data-theme="dark"] .story-item {
                background: #1e1e1e !important;
                border-color: #333 !important;
                color: #e8e8e8 !important;
            }
            [data-theme="dark"] .story-item:hover {
                border-color: #8B0000 !important;
            }
            [data-theme="dark"] .story-title { color: #e8e8e8 !important; }
            [data-theme="dark"] .story-teaser { color: #808080 !important; }
            [data-theme="dark"] .story-meta { color: #808080 !important; }
            [data-theme="dark"] .story-curator-note { background: rgba(139, 0, 0, 0.15); }
            [data-theme="dark"] .load-more-btn {
                background: #1e1e1e !important;
                border-color: #333 !important;
                color: #e8e8e8 !important;
            }
            [data-theme="dark"] .load-more-btn:hover {
                background: #333 !important;
                color: #fff !important;
            }
            [data-theme="dark"] .vote-btn {
                border-color: #333 !important;
                background: transparent !important;
            }
            [data-theme="dark"] .vote-btn.upvote { color: #66bb6a !important; }
            [data-theme="dark"] .vote-btn.upvote:hover,
            [data-theme="dark"] .vote-btn.upvote.active { color: #81c784 !important; }
            [data-theme="dark"] .vote-btn.downvote { color: #ef5350 !important; }
            [data-theme="dark"] .vote-btn.downvote:hover,
            [data-theme="dark"] .vote-btn.downvote.active { color: #e57373 !important; }
            [data-theme="dark"] .story-item-wrapper { border-color: #333 !important; }
            [data-theme="dark"] .story-comment-btn:hover { background: rgba(255,255,255,0.1); }
        </style>
    `;

    // Helper functions
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function truncateText(text, maxLength = 140) {
        if (!text) return '';
        text = text.trim();
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength).trim() + '...';
    }

    function timeAgo(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        const now = new Date();
        const seconds = Math.floor((now - date) / 1000);

        if (seconds < 60) return 'Just now';
        if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
        if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
        if (seconds < 604800) return Math.floor(seconds / 86400) + 'd ago';
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    function getSourceLogo(source, fallbackEmoji) {
        if (source && sourceLogos[source]) {
            return `<img src="${sourceLogos[source]}" alt="${source}" style="max-width:60%;max-height:60%;object-fit:contain;">`;
        }
        if (!source) {
            return `<img src="${sourceLogos['ESPN']}" alt="ESPN" style="max-width:60%;max-height:60%;object-fit:contain;">`;
        }
        return fallbackEmoji || '&#128240;';
    }

    function getYouTubeVideoId(url) {
        if (!url) return null;
        const patterns = [
            /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s?]+)/,
            /youtube\.com\/shorts\/([^&\s?]+)/
        ];
        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) return match[1];
        }
        return null;
    }

    function isTikTokUrl(url) {
        return url && url.includes('tiktok.com');
    }

    // Main News Feed class
    class NewsFeed {
        constructor(options = {}) {
            this.containerId = options.containerId || 'articleList';
            this.team = options.team || null; // Single team filter for team pages
            this.categories = options.categories || ['eagles', 'phillies', 'sixers', 'flyers', 'college', 'esports', 'youth'];
            this.type = 'all';
            this.offset = 0;
            this.limit = options.limit || 15;
            this.userVotes = {};
            this.photoCache = new Map();

            this.injectStyles();
        }

        injectStyles() {
            if (!document.getElementById('news-feed-styles')) {
                document.head.insertAdjacentHTML('beforeend', newsFeedStyles);
            }
        }

        getContainer() {
            return document.getElementById(this.containerId);
        }

        async load(filters = {}) {
            if (filters.type) this.type = filters.type;
            if (filters.categories) this.categories = filters.categories;
            this.offset = this.limit;

            const container = this.getContainer();
            if (!container) return;

            container.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:2rem;font-size:0.9rem;">Loading...</div>';

            try {
                // Build query params
                let queryParams = `limit=${this.limit}`;
                if (this.team) {
                    queryParams += `&teams=${this.team}`;
                } else if (this.categories.length > 0 && this.categories.length < 7) {
                    queryParams += `&teams=${this.categories.join(',')}`;
                }
                if (this.type !== 'all') {
                    queryParams += `&type=${this.type}`;
                }

                // Try curated content first
                const curatedRes = await fetch(`/api/content?${queryParams}`);
                const curatedData = await curatedRes.json();

                let allItems = [];
                if (curatedData && curatedData.featured) {
                    allItems.push(curatedData.featured);
                }
                if (curatedData && curatedData.items) {
                    allItems = allItems.concat(curatedData.items);
                }

                if (allItems.length > 0) {
                    this.renderItems(container, allItems, curatedData.hasMore);
                    this.updateMissingThumbnails();
                    return;
                }

                // Fall back to news API
                await this.loadFromNewsAPI(container);
            } catch (error) {
                console.error('Failed to load curated content:', error);
                try {
                    await this.loadFromNewsAPI(container);
                } catch (e) {
                    container.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:2rem;">Unable to load news</div>';
                }
            }
        }

        async loadFromNewsAPI(container) {
            let url = '/api/news';
            if (this.team) {
                url += `?team=${this.team}`;
            }
            const response = await fetch(url);
            const data = await response.json();

            if (data.articles && data.articles.length > 0) {
                this.renderNewsItems(container, data.articles.slice(0, this.limit));
                this.updateMissingThumbnails();
            } else {
                container.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:2rem;">No news available</div>';
            }
        }

        renderItems(container, items, hasMore) {
            if (items.length === 0) {
                container.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:1rem;">No stories available.</div>';
                return;
            }

            container.innerHTML = items.map(item => this.renderStoryItem(item, true)).join('');

            if (hasMore) {
                container.insertAdjacentHTML('beforeend', `<button class="load-more-btn" id="loadMoreBtn">Load More Stories</button>`);
                document.getElementById('loadMoreBtn').addEventListener('click', () => this.loadMore());
            }
        }

        renderNewsItems(container, articles) {
            container.innerHTML = articles.map(item => this.renderStoryItem(item, false)).join('');
        }

        renderStoryItem(item, isCurated) {
            const teamTag = isCurated ? (item.teams?.[0] || 'eagles') : (item.team || 'eagles');
            const tagClass = teamTagClass[teamTag] || 'tag-eagles';
            const title = isCurated ? item.title : item.headline;
            const url = isCurated ? item.sourceUrl : item.link;
            const thumbnail = isCurated ? item.thumbnail : item.image;
            const source = isCurated ? item.sourceName : item.source;
            const description = item.description;
            const curatorReview = isCurated ? item.curatorReview : null;
            const date = isCurated ? (item.curatedAt || item.publishedAt) : item.published;
            const itemId = isCurated ? item._id : ('news-' + btoa(url || '').slice(0, 12));

            const thumbStyle = thumbnail
                ? `background-image:url('${thumbnail}');`
                : `background:var(--border-color);`;
            const needsPhoto = !thumbnail;
            const thumbContent = thumbnail ? '' : getSourceLogo(source, sportEmoji[teamTag]);
            const photoDataAttrs = needsPhoto
                ? `data-needs-photo="true" data-title="${escapeHtml(title || '')}" data-description="${escapeHtml(description || '')}" data-team="${teamTag}"`
                : '';

            // Video overlay for YouTube/TikTok
            let videoOverlay = '';
            const youtubeId = getYouTubeVideoId(url);
            if (youtubeId) {
                videoOverlay = '<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:32px;height:22px;background:rgba(255,0,0,0.9);border-radius:4px;display:flex;align-items:center;justify-content:center;"><div style="width:0;height:0;border-left:8px solid #fff;border-top:5px solid transparent;border-bottom:5px solid transparent;margin-left:2px;"></div></div>';
            } else if (isTikTokUrl(url)) {
                videoOverlay = '<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:28px;height:28px;background:linear-gradient(135deg,#25F4EE,#FE2C55);border-radius:4px;display:flex;align-items:center;justify-content:center;"><div style="width:0;height:0;border-left:8px solid #fff;border-top:5px solid transparent;border-bottom:5px solid transparent;margin-left:2px;"></div></div>';
            }

            return `
                <div class="story-item-wrapper">
                    <a href="${url}" target="_blank" class="story-item" style="text-decoration:none;flex:1;">
                        <div class="story-thumb" style="${thumbStyle};position:relative;" ${photoDataAttrs}>
                            ${thumbContent}
                            ${videoOverlay}
                        </div>
                        <div class="story-info">
                            <div class="story-meta">
                                <span class="article-tag ${tagClass}" style="font-size:0.65rem;padding:0.1rem 0.35rem;">${teamTag.toUpperCase()}</span>
                                <span>${source || 'PhillySports'}</span>
                                <span>·</span>
                                <span>${timeAgo(date)}</span>
                            </div>
                            <div class="story-title">${escapeHtml(title)}</div>
                            ${description ? `<div class="story-teaser">${escapeHtml(truncateText(description, 140))}</div>` : ''}
                            ${curatorReview ? `<div class="story-curator-note">${escapeHtml(curatorReview)}</div>` : ''}
                            <div class="story-actions-row">
                                <a href="/article.html?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title || '')}&image=${encodeURIComponent(thumbnail || '')}" class="story-comment-btn" title="Discuss this story" onclick="event.stopPropagation();">
                                    &#128172; Comments
                                </a>
                            </div>
                        </div>
                    </a>
                    <div class="vote-buttons">
                        <button class="vote-btn upvote" data-article="${itemId}" onclick="window.PhillySportsNewsFeed.vote('${itemId}', 1, event)">&#9650;</button>
                        <span class="vote-score" id="score-${itemId}">0</span>
                        <button class="vote-btn downvote" data-article="${itemId}" onclick="window.PhillySportsNewsFeed.vote('${itemId}', -1, event)">&#9660;</button>
                    </div>
                </div>
            `;
        }

        async loadMore() {
            const container = this.getContainer();
            const btn = container.querySelector('.load-more-btn');
            if (btn) {
                btn.textContent = 'Loading...';
                btn.disabled = true;
            }

            try {
                let queryParams = `limit=10&offset=${this.offset}`;
                if (this.team) {
                    queryParams += `&teams=${this.team}`;
                } else if (this.categories.length > 0 && this.categories.length < 7) {
                    queryParams += `&teams=${this.categories.join(',')}`;
                }
                if (this.type !== 'all') {
                    queryParams += `&type=${this.type}`;
                }

                const res = await fetch(`/api/content?${queryParams}`);
                const data = await res.json();

                if (data.items && data.items.length > 0) {
                    if (btn) btn.remove();

                    const newItems = data.items.map(item => this.renderStoryItem(item, true)).join('');
                    container.insertAdjacentHTML('beforeend', newItems);
                    this.offset += 10;
                    this.updateMissingThumbnails();

                    if (data.hasMore) {
                        container.insertAdjacentHTML('beforeend', `<button class="load-more-btn" id="loadMoreBtn">Load More Stories</button>`);
                        document.getElementById('loadMoreBtn').addEventListener('click', () => this.loadMore());
                    }
                }
            } catch (e) {
                console.error('Failed to load more:', e);
                if (btn) {
                    btn.textContent = 'Load More Stories';
                    btn.disabled = false;
                }
            }
        }

        async vote(articleId, voteValue, event) {
            event.preventDefault();
            event.stopPropagation();

            const currentVote = this.userVotes[articleId] || 0;
            const newVote = currentVote === voteValue ? 0 : voteValue;

            try {
                const response = await fetch('/api/news/vote', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': localStorage.getItem('token') ? `Bearer ${localStorage.getItem('token')}` : ''
                    },
                    body: JSON.stringify({ articleId, vote: newVote })
                });

                const data = await response.json();

                if (data.success) {
                    this.userVotes[articleId] = newVote;

                    const scoreEl = document.getElementById(`score-${articleId}`);
                    if (scoreEl) {
                        scoreEl.textContent = data.score;
                        scoreEl.className = 'vote-score' + (data.score > 0 ? ' positive' : data.score < 0 ? ' negative' : '');
                    }

                    const upBtns = document.querySelectorAll(`.vote-btn.upvote[data-article="${articleId}"]`);
                    const downBtns = document.querySelectorAll(`.vote-btn.downvote[data-article="${articleId}"]`);
                    upBtns.forEach(btn => btn.classList.toggle('active', newVote === 1));
                    downBtns.forEach(btn => btn.classList.toggle('active', newVote === -1));
                }
            } catch (error) {
                console.error('Vote error:', error);
            }
        }

        async updateMissingThumbnails() {
            const thumbs = document.querySelectorAll('[data-needs-photo="true"]');
            for (const thumb of thumbs) {
                const title = thumb.dataset.title || '';
                const description = thumb.dataset.description || '';
                const team = thumb.dataset.team || '';

                const photo = await this.findPhotoForArticle(title, description, team);
                if (photo) {
                    thumb.style.backgroundImage = `url('${photo}')`;
                    thumb.style.backgroundSize = 'cover';
                    thumb.style.backgroundPosition = 'center';
                    thumb.innerHTML = '';
                    thumb.removeAttribute('data-needs-photo');
                }
            }
        }

        async findPhotoForArticle(title, description, team) {
            const searchText = `${title || ''} ${description || ''}`.trim();
            if (!searchText && !team) return null;

            const cacheKey = `${searchText.substring(0, 50)}-${team || ''}`;
            if (this.photoCache.has(cacheKey)) {
                return this.photoCache.get(cacheKey);
            }

            try {
                const params = new URLSearchParams();
                if (searchText) params.append('q', searchText);
                if (team) params.append('team', team);
                params.append('limit', '1');

                const response = await fetch(`/api/photos/search?${params.toString()}`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.photos && data.photos.length > 0) {
                        const photoUrl = data.photos[0].url;
                        this.photoCache.set(cacheKey, photoUrl);
                        return photoUrl;
                    }
                }
            } catch (e) {
                // Silently fail
            }

            this.photoCache.set(cacheKey, null);
            return null;
        }
    }

    // Global instance and API
    let instance = null;

    window.PhillySportsNewsFeed = {
        init: function(options = {}) {
            instance = new NewsFeed(options);
            instance.load();
            return instance;
        },
        load: function(filters) {
            if (instance) instance.load(filters);
        },
        vote: function(articleId, voteValue, event) {
            if (instance) instance.vote(articleId, voteValue, event);
        },
        getInstance: function() {
            return instance;
        }
    };

})();
