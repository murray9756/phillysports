// Shared Footer Component for PhillySports.com
// Matches the vintage americana theme with newspaper styling
// Include this script on every page and add <div id="site-footer"></div> where the footer should appear
// Version: 1.0

(function() {
    'use strict';

    const currentYear = new Date().getFullYear();

    // Footer HTML template
    const footerHTML = `
        <footer class="site-footer">
            <div class="footer-content">
                <div class="footer-main">
                    <div class="footer-brand">
                        <a href="/" class="footer-logo-link">
                            <span class="footer-logo-philly">Philly</span><span class="footer-logo-sports">SPORTS</span><span class="footer-logo-com">.COM</span>
                        </a>
                        <p class="footer-tagline">Where the Diehards, Play Hard</p>
                    </div>
                    <div class="footer-links">
                        <div class="footer-links-group">
                            <h4>Site</h4>
                            <a href="/">Home</a>
                            <a href="/about.html">About Us</a>
                            <a href="/contact.html">Contact Us</a>
                            <a href="/membership.html">Premium Membership</a>
                        </div>
                        <div class="footer-links-group">
                            <h4>Features</h4>
                            <a href="/trivia.html">Daily Trivia</a>
                            <a href="/poker/">Poker Room</a>
                            <a href="/marketplace/">Marketplace</a>
                            <a href="/shop/">Merch Shop</a>
                        </div>
                        <div class="footer-links-group">
                            <h4>Community</h4>
                            <a href="/community/tailgates/">Tailgates</a>
                            <a href="/community/watch-parties/">Watch Parties</a>
                            <a href="/community/clubs/">Fan Clubs</a>
                            <a href="/founders.html">Founders Club</a>
                        </div>
                        <div class="footer-links-group">
                            <h4>Connect</h4>
                            <a href="https://twitter.com/phlsports" target="_blank" rel="noopener">Twitter/X</a>
                            <a href="/newsletter.html">Newsletter</a>
                            <a href="/privacy.html">Privacy Policy</a>
                            <a href="/terms.html">Terms of Service</a>
                        </div>
                    </div>
                </div>
                <div class="footer-bottom">
                    <div class="footer-copyright">
                        &copy; ${currentYear} PhillySports.com. All rights reserved. Est. 2026
                    </div>
                    <div class="footer-legal">
                        Not affiliated with any professional sports team or league.
                    </div>
                </div>
            </div>
        </footer>
    `;

    // Footer CSS styles
    const footerStyles = `
        <style id="footer-styles">
            .site-footer {
                background: linear-gradient(180deg, #1A2744 0%, #0d1520 100%);
                border-top: 4px solid #8B1A28;
                margin-top: 2rem;
                padding: 0;
                font-family: var(--ps-font-body, 'Helvetica Neue', Arial, sans-serif);
            }

            .footer-content {
                max-width: 1200px;
                margin: 0 auto;
                padding: 2rem 1.5rem 1rem;
            }

            .footer-main {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                gap: 2rem;
                padding-bottom: 1.5rem;
                border-bottom: 1px solid rgba(245, 240, 225, 0.2);
            }

            .footer-brand {
                flex-shrink: 0;
            }

            .footer-logo-link {
                display: flex;
                align-items: baseline;
                gap: 4px;
                text-decoration: none;
            }

            .footer-logo-philly {
                font-family: 'Brush Script MT', cursive;
                font-size: 28px;
                color: #F5F0E1;
            }

            .footer-logo-sports {
                font-family: 'Impact', 'Arial Black', sans-serif;
                font-size: 28px;
                color: #8B1A28;
                letter-spacing: -1px;
            }

            .footer-logo-com {
                font-family: Georgia, serif;
                font-size: 12px;
                color: #F5F0E1;
                font-weight: bold;
            }

            .footer-tagline {
                font-family: Georgia, serif;
                font-size: 0.8rem;
                font-style: italic;
                color: rgba(245, 240, 225, 0.7);
                margin: 0.5rem 0 0;
            }

            .footer-links {
                display: flex;
                gap: 3rem;
                flex-wrap: wrap;
            }

            .footer-links-group {
                min-width: 120px;
            }

            .footer-links-group h4 {
                font-family: Georgia, serif;
                font-size: 0.85rem;
                font-weight: 600;
                color: #F5F0E1;
                margin: 0 0 0.75rem;
                text-transform: uppercase;
                letter-spacing: 1px;
            }

            .footer-links-group a {
                display: block;
                font-size: 0.8rem;
                color: rgba(245, 240, 225, 0.7);
                text-decoration: none;
                padding: 0.25rem 0;
                transition: color 0.2s;
            }

            .footer-links-group a:hover {
                color: #F5F0E1;
            }

            .footer-bottom {
                padding-top: 1rem;
                text-align: center;
            }

            .footer-copyright {
                font-size: 0.75rem;
                color: rgba(245, 240, 225, 0.6);
                margin-bottom: 0.25rem;
            }

            .footer-legal {
                font-size: 0.7rem;
                color: rgba(245, 240, 225, 0.4);
                font-style: italic;
            }

            /* Responsive */
            @media (max-width: 768px) {
                .footer-main {
                    flex-direction: column;
                    align-items: center;
                    text-align: center;
                }

                .footer-brand {
                    margin-bottom: 1rem;
                }

                .footer-links {
                    justify-content: center;
                    gap: 1.5rem 2rem;
                }

                .footer-links-group {
                    min-width: 100px;
                }
            }

            @media (max-width: 480px) {
                .footer-content {
                    padding: 1.5rem 1rem 1rem;
                }

                .footer-links {
                    gap: 1rem 1.5rem;
                }

                .footer-links-group {
                    min-width: 80px;
                }

                .footer-links-group h4 {
                    font-size: 0.75rem;
                }

                .footer-links-group a {
                    font-size: 0.7rem;
                }
            }

            /* Dark mode adjustments - footer stays the same since it's already dark */
            [data-theme="dark"] .site-footer {
                background: linear-gradient(180deg, #0a0a0a 0%, #000000 100%);
                border-top-color: #8B1A28;
            }
        </style>
    `;

    // Inject styles if not already present
    function injectStyles() {
        if (!document.getElementById('footer-styles')) {
            document.head.insertAdjacentHTML('beforeend', footerStyles);
        }
    }

    // Initialize footer
    function initFooter() {
        const container = document.getElementById('site-footer');
        if (container) {
            injectStyles();
            container.innerHTML = footerHTML;
        }
    }

    // Run when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initFooter);
    } else {
        initFooter();
    }
})();
