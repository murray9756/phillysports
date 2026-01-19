const pptxgen = require('pptxgenjs');

const pptx = new pptxgen();

// Set presentation properties
pptx.author = 'PhillySports.com';
pptx.title = 'PhillySports.com - Pre-Seed Pitch Deck';
pptx.subject = 'Investor Pitch Deck';

// Colors
const DARK_BG = '1a1a1a';
const ACCENT_RED = '8b0000';
const ACCENT_GOLD = 'ffd700';
const EAGLES_GREEN = '004C54';
const WHITE = 'ffffff';
const GRAY = 'b0b0b0';
const LIGHT_GRAY = 'e0e0e0';

// Helper function for section headers
function addSectionHeader(slide, text) {
    slide.addText(text, {
        x: 0.5, y: 0.3, w: '90%', h: 0.6,
        fontSize: 32, bold: true, color: ACCENT_GOLD, align: 'center'
    });
}

// ============================================
// SLIDE 1: TITLE
// ============================================
let slide1 = pptx.addSlide();
slide1.background = { color: DARK_BG };
slide1.addText('PHILLYSPORTS.COM', {
    x: 0.5, y: 1.2, w: '90%', h: 0.8,
    fontSize: 52, bold: true, color: WHITE, align: 'center'
});
slide1.addText('Where the Diehards, Play Hard', {
    x: 0.5, y: 2.0, w: '90%', h: 0.5,
    fontSize: 24, italic: true, color: GRAY, align: 'center'
});
slide1.addShape(pptx.ShapeType.rect, {
    x: 3.5, y: 2.8, w: 3, h: 0.08, fill: { color: ACCENT_GOLD }
});
slide1.addText('PRE-SEED FUNDING', {
    x: 0.5, y: 3.2, w: '90%', h: 0.5,
    fontSize: 20, bold: true, color: ACCENT_RED, align: 'center'
});
slide1.addText('$250,000 - $500,000', {
    x: 0.5, y: 3.7, w: '90%', h: 0.6,
    fontSize: 28, bold: true, color: ACCENT_GOLD, align: 'center'
});
slide1.addText('The All-in-One Platform for Philadelphia Sports Fans', {
    x: 0.5, y: 4.8, w: '90%', h: 0.4,
    fontSize: 16, color: LIGHT_GRAY, align: 'center'
});

// ============================================
// SLIDE 2: PROBLEM
// ============================================
let slide2 = pptx.addSlide();
slide2.background = { color: DARK_BG };
addSectionHeader(slide2, 'THE PROBLEM');

const problems = [
    { icon: '📱', text: 'Philly sports fans are FRAGMENTED across generic platforms' },
    { icon: '😤', text: 'ESPN, Reddit, Twitter - none built FOR Philadelphia' },
    { icon: '🔇', text: 'No dedicated hub combining news + community + engagement' },
    { icon: '💸', text: 'Local content creators struggle to monetize' },
];

problems.forEach((p, i) => {
    slide2.addText(p.icon, { x: 0.8, y: 1.2 + (i * 0.9), w: 0.6, h: 0.7, fontSize: 28 });
    slide2.addText(p.text, {
        x: 1.5, y: 1.2 + (i * 0.9), w: 8, h: 0.7,
        fontSize: 20, color: WHITE, valign: 'middle'
    });
});

slide2.addShape(pptx.ShapeType.rect, {
    x: 0.5, y: 4.7, w: 9, h: 0.8, fill: { color: '2a2a2a' }, line: { color: ACCENT_RED, pt: 2 }
});
slide2.addText('6.2 MILLION people in Philly metro with NO dedicated sports platform', {
    x: 0.7, y: 4.8, w: 8.6, h: 0.6,
    fontSize: 18, bold: true, color: ACCENT_GOLD, align: 'center', valign: 'middle'
});

// ============================================
// SLIDE 3: SOLUTION
// ============================================
let slide3 = pptx.addSlide();
slide3.background = { color: DARK_BG };
addSectionHeader(slide3, 'THE SOLUTION');

slide3.addText('PhillySports.com is the ALL-IN-ONE platform for Philly sports fans', {
    x: 0.5, y: 1.0, w: '90%', h: 0.5,
    fontSize: 18, color: LIGHT_GRAY, align: 'center'
});

const solutions = [
    { title: 'CURATED CONTENT', desc: 'Hand-picked news, podcasts, videos from 50+ sources', color: 'ff6b6b' },
    { title: 'REAL-TIME COMMUNITY', desc: 'Forums, live game threads, clubs, watch parties', color: '4ecdc4' },
    { title: 'GAMIFICATION', desc: 'Diehard Dollars, badges, leaderboards, daily rewards', color: ACCENT_GOLD },
    { title: 'GAMING', desc: 'Poker, fantasy, pools, trivia, predictions', color: '95e1d3' },
    { title: 'COMMERCE', desc: 'Shop, marketplace, raffles, merchandise', color: 'f38181' },
    { title: 'MOBILE APP', desc: 'iOS + Android with push notifications', color: 'aa96da' },
];

solutions.forEach((s, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 0.5 + (col * 4.8);
    const y = 1.7 + (row * 1.0);

    slide3.addShape(pptx.ShapeType.rect, { x: x, y: y, w: 4.5, h: 0.85, fill: { color: '2a2a2a' }, line: { color: s.color, pt: 2 } });
    slide3.addText(s.title, { x: x + 0.15, y: y + 0.08, w: 4.2, h: 0.35, fontSize: 14, bold: true, color: s.color });
    slide3.addText(s.desc, { x: x + 0.15, y: y + 0.45, w: 4.2, h: 0.35, fontSize: 11, color: GRAY });
});

// ============================================
// SLIDE 4: MARKET OPPORTUNITY
// ============================================
let slide4 = pptx.addSlide();
slide4.background = { color: DARK_BG };
addSectionHeader(slide4, 'MARKET OPPORTUNITY');

// Market stats boxes
const markets = [
    { num: '6.2M', label: 'Philly Metro Population', color: EAGLES_GREEN },
    { num: '4', label: 'Major Pro Teams', color: ACCENT_RED },
    { num: '$22B', label: 'US Sports Media Market', color: ACCENT_GOLD },
    { num: '#1', label: 'Most Passionate Fanbase', color: '4ecdc4' },
];

markets.forEach((m, i) => {
    const x = 0.5 + (i * 2.4);
    slide4.addShape(pptx.ShapeType.rect, { x: x, y: 1.2, w: 2.2, h: 1.5, fill: { color: '2a2a2a' }, line: { color: m.color, pt: 2 } });
    slide4.addText(m.num, { x: x, y: 1.3, w: 2.2, h: 0.7, fontSize: 32, bold: true, color: m.color, align: 'center' });
    slide4.addText(m.label, { x: x, y: 2.0, w: 2.2, h: 0.6, fontSize: 11, color: GRAY, align: 'center' });
});

slide4.addText('WHY HYPER-LOCAL WINS', {
    x: 0.5, y: 3.0, w: '90%', h: 0.4,
    fontSize: 18, bold: true, color: ACCENT_GOLD, align: 'center'
});

const reasons = [
    'National platforms can\'t replicate local passion and knowledge',
    'Philly fans have unique culture - "Diehard" identity',
    'Defensible niche - hard for competitors to enter',
    'Expandable model to other sports cities',
];

reasons.forEach((r, i) => {
    slide4.addText('•  ' + r, {
        x: 1.5, y: 3.5 + (i * 0.45), w: 7, h: 0.4,
        fontSize: 14, color: WHITE
    });
});

// ============================================
// SLIDE 5: PRODUCT DEMO
// ============================================
let slide5 = pptx.addSlide();
slide5.background = { color: DARK_BG };
addSectionHeader(slide5, 'THE PRODUCT');

slide5.addText('158,744 Lines of Code  |  239 API Endpoints  |  69 Pages', {
    x: 0.5, y: 1.0, w: '90%', h: 0.4,
    fontSize: 14, color: ACCENT_GOLD, align: 'center'
});

// Feature boxes representing screenshots
const features = [
    { title: 'HOMEPAGE', desc: 'Curated news feed with curator reviews', icon: '🏠' },
    { title: 'TEAM PAGES', desc: 'Eagles, Phillies, Sixers, Flyers + College', icon: '🏈' },
    { title: 'POKER', desc: 'Real-time tournaments & cash games', icon: '🃏' },
    { title: 'COMMUNITY', desc: 'Forums, chat, clubs, watch parties', icon: '💬' },
    { title: 'MOBILE APP', desc: 'React Native iOS + Android', icon: '📱' },
    { title: 'ADMIN', desc: 'Content curation & moderation tools', icon: '⚙️' },
];

features.forEach((f, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = 0.5 + (col * 3.2);
    const y = 1.6 + (row * 1.7);

    slide5.addShape(pptx.ShapeType.rect, { x: x, y: y, w: 3, h: 1.5, fill: { color: '2a2a2a' }, line: { color: '444444', pt: 1 } });
    slide5.addText(f.icon, { x: x, y: y + 0.1, w: 3, h: 0.5, fontSize: 28, align: 'center' });
    slide5.addText(f.title, { x: x, y: y + 0.65, w: 3, h: 0.35, fontSize: 12, bold: true, color: WHITE, align: 'center' });
    slide5.addText(f.desc, { x: x + 0.1, y: y + 1.0, w: 2.8, h: 0.4, fontSize: 9, color: GRAY, align: 'center' });
});

slide5.addText('Visit: phillysports.com', {
    x: 0.5, y: 5.0, w: '90%', h: 0.3,
    fontSize: 14, color: ACCENT_GOLD, align: 'center'
});

// ============================================
// SLIDE 6: TRACTION
// ============================================
let slide6 = pptx.addSlide();
slide6.background = { color: DARK_BG };
addSectionHeader(slide6, 'TRACTION');

slide6.addText('Early Stage - Building Foundation', {
    x: 0.5, y: 1.0, w: '90%', h: 0.4,
    fontSize: 16, italic: true, color: GRAY, align: 'center'
});

const traction = [
    { metric: 'Platform Built', value: '100%', desc: 'Full-featured MVP complete' },
    { metric: 'API Endpoints', value: '239', desc: 'Comprehensive backend' },
    { metric: 'Mobile App', value: 'Ready', desc: 'iOS pending approval, Android built' },
    { metric: 'Content Sources', value: '50+', desc: 'RSS feeds integrated' },
];

traction.forEach((t, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 1 + (col * 4.5);
    const y = 1.6 + (row * 1.4);

    slide6.addShape(pptx.ShapeType.rect, { x: x, y: y, w: 4, h: 1.2, fill: { color: '2a2a2a' }, line: { color: ACCENT_GOLD, pt: 2 } });
    slide6.addText(t.value, { x: x, y: y + 0.1, w: 4, h: 0.5, fontSize: 36, bold: true, color: ACCENT_GOLD, align: 'center' });
    slide6.addText(t.metric, { x: x, y: y + 0.6, w: 4, h: 0.3, fontSize: 14, bold: true, color: WHITE, align: 'center' });
    slide6.addText(t.desc, { x: x, y: y + 0.9, w: 4, h: 0.25, fontSize: 10, color: GRAY, align: 'center' });
});

slide6.addText('* User metrics to be updated with actual data post-launch', {
    x: 0.5, y: 4.6, w: '90%', h: 0.3,
    fontSize: 10, italic: true, color: GRAY, align: 'center'
});

// ============================================
// SLIDE 7: BUSINESS MODEL
// ============================================
let slide7 = pptx.addSlide();
slide7.background = { color: DARK_BG };
addSectionHeader(slide7, 'BUSINESS MODEL');

const revenue = [
    { stream: 'Premium Memberships', price: '$4.99-$9.99/mo', desc: 'Ad-free, bonuses, @phillysports.com email', pct: '35%' },
    { stream: 'Affiliate Revenue', price: '$50-200 CPA', desc: 'Sportsbooks, merchandise, tickets', pct: '25%' },
    { stream: 'Advertising', price: '$2-25 RPM', desc: 'Display ads, sponsored content', pct: '20%' },
    { stream: 'Virtual Currency', price: '$0.99-9.99', desc: 'Diehard Dollar packs', pct: '10%' },
    { stream: 'Marketplace Fees', price: '10% fee', desc: 'User-to-user transactions', pct: '10%' },
];

slide7.addText('Revenue Stream', { x: 0.5, y: 1.1, w: 2.5, h: 0.4, fontSize: 12, bold: true, color: ACCENT_GOLD });
slide7.addText('Pricing', { x: 3.2, y: 1.1, w: 1.8, h: 0.4, fontSize: 12, bold: true, color: ACCENT_GOLD });
slide7.addText('Description', { x: 5.2, y: 1.1, w: 3, h: 0.4, fontSize: 12, bold: true, color: ACCENT_GOLD });
slide7.addText('Mix', { x: 8.5, y: 1.1, w: 1, h: 0.4, fontSize: 12, bold: true, color: ACCENT_GOLD });

revenue.forEach((r, i) => {
    const y = 1.55 + (i * 0.65);
    const bgColor = i % 2 === 0 ? '252525' : '2a2a2a';
    slide7.addShape(pptx.ShapeType.rect, { x: 0.4, y: y - 0.05, w: 9.2, h: 0.6, fill: { color: bgColor } });
    slide7.addText(r.stream, { x: 0.5, y: y, w: 2.5, h: 0.5, fontSize: 12, bold: true, color: WHITE });
    slide7.addText(r.price, { x: 3.2, y: y, w: 1.8, h: 0.5, fontSize: 11, color: ACCENT_GOLD });
    slide7.addText(r.desc, { x: 5.2, y: y, w: 3, h: 0.5, fontSize: 10, color: GRAY });
    slide7.addText(r.pct, { x: 8.5, y: y, w: 1, h: 0.5, fontSize: 12, bold: true, color: WHITE });
});

slide7.addShape(pptx.ShapeType.rect, { x: 0.5, y: 4.6, w: 9, h: 0.7, fill: { color: '2a2a2a' }, line: { color: ACCENT_GOLD, pt: 2 } });
slide7.addText('Target ARPU: $0.50-$2.00/month  |  Break-even: 50K-100K MAU', {
    x: 0.7, y: 4.7, w: 8.6, h: 0.5,
    fontSize: 14, color: WHITE, align: 'center', valign: 'middle'
});

// ============================================
// SLIDE 8: GO-TO-MARKET
// ============================================
let slide8 = pptx.addSlide();
slide8.background = { color: DARK_BG };
addSectionHeader(slide8, 'GO-TO-MARKET STRATEGY');

const gtm = [
    { phase: 'PHASE 1: LAUNCH', items: ['Soft launch to Philly sports communities', 'Reddit r/eagles, r/phillies, r/sixers, r/flyers', 'Twitter/X sports accounts', 'App store launch'], color: 'ff6b6b' },
    { phase: 'PHASE 2: GROW', items: ['Local sports radio partnerships (WIP, 97.5)', 'Content creator collaborations', 'SEO for "Philly sports" keywords', 'Referral program with DD rewards'], color: '4ecdc4' },
    { phase: 'PHASE 3: SCALE', items: ['Paid social ads (targeted)', 'Local event sponsorships', 'Partnership with local businesses', 'Expand to college sports'], color: ACCENT_GOLD },
];

gtm.forEach((g, i) => {
    const x = 0.5 + (i * 3.2);
    slide8.addShape(pptx.ShapeType.rect, { x: x, y: 1.1, w: 3, h: 3.8, fill: { color: '2a2a2a' }, line: { color: g.color, pt: 2 } });
    slide8.addText(g.phase, { x: x + 0.1, y: 1.2, w: 2.8, h: 0.5, fontSize: 12, bold: true, color: g.color, align: 'center' });

    g.items.forEach((item, j) => {
        slide8.addText('• ' + item, { x: x + 0.15, y: 1.8 + (j * 0.6), w: 2.7, h: 0.55, fontSize: 10, color: WHITE });
    });
});

slide8.addText('CAC Target: $2-5 (organic-heavy strategy)', {
    x: 0.5, y: 5.0, w: '90%', h: 0.3,
    fontSize: 12, color: GRAY, align: 'center'
});

// ============================================
// SLIDE 9: COMPETITION
// ============================================
let slide9 = pptx.addSlide();
slide9.background = { color: DARK_BG };
addSectionHeader(slide9, 'COMPETITIVE LANDSCAPE');

// Header row
slide9.addText('', { x: 0.5, y: 1.1, w: 2, h: 0.4 });
slide9.addText('PhillySports', { x: 2.6, y: 1.1, w: 1.5, h: 0.4, fontSize: 10, bold: true, color: ACCENT_GOLD, align: 'center' });
slide9.addText('Crossing Broad', { x: 4.2, y: 1.1, w: 1.5, h: 0.4, fontSize: 10, bold: true, color: GRAY, align: 'center' });
slide9.addText('Reddit', { x: 5.8, y: 1.1, w: 1.3, h: 0.4, fontSize: 10, bold: true, color: GRAY, align: 'center' });
slide9.addText('ESPN', { x: 7.2, y: 1.1, w: 1.3, h: 0.4, fontSize: 10, bold: true, color: GRAY, align: 'center' });
slide9.addText('Team Sites', { x: 8.5, y: 1.1, w: 1.3, h: 0.4, fontSize: 10, bold: true, color: GRAY, align: 'center' });

const compFeatures = [
    { feature: 'Philly-Only Focus', vals: ['✓', '✓', '~', '✗', '~'] },
    { feature: 'Curated Content', vals: ['✓', '~', '✗', '✗', '✓'] },
    { feature: 'Community/Forums', vals: ['✓', '✗', '✓', '✗', '✗'] },
    { feature: 'Gamification', vals: ['✓', '✗', '✗', '✗', '✗'] },
    { feature: 'Gaming (Poker/Fantasy)', vals: ['✓', '✗', '✗', '✓', '✗'] },
    { feature: 'Mobile App', vals: ['✓', '✗', '✓', '✓', '✓'] },
    { feature: 'Virtual Currency', vals: ['✓', '✗', '✗', '✗', '✗'] },
    { feature: 'Marketplace', vals: ['✓', '✗', '✗', '✗', '✗'] },
];

compFeatures.forEach((f, i) => {
    const y = 1.55 + (i * 0.42);
    const bgColor = i % 2 === 0 ? '252525' : '2a2a2a';
    slide9.addShape(pptx.ShapeType.rect, { x: 0.4, y: y - 0.02, w: 9.4, h: 0.4, fill: { color: bgColor } });
    slide9.addText(f.feature, { x: 0.5, y: y, w: 2, h: 0.35, fontSize: 10, color: WHITE });

    f.vals.forEach((v, j) => {
        const vColor = v === '✓' ? '4ade80' : v === '~' ? ACCENT_GOLD : 'ff6b6b';
        slide9.addText(v, { x: 2.6 + (j * 1.5), y: y, w: 1.3, h: 0.35, fontSize: 12, color: vColor, align: 'center' });
    });
});

slide9.addText('PhillySports.com is the ONLY all-in-one platform built exclusively for Philadelphia', {
    x: 0.5, y: 5.0, w: '90%', h: 0.3,
    fontSize: 12, bold: true, color: ACCENT_GOLD, align: 'center'
});

// ============================================
// SLIDE 10: TECH & MOAT
// ============================================
let slide10 = pptx.addSlide();
slide10.background = { color: DARK_BG };
addSectionHeader(slide10, 'TECHNOLOGY & MOAT');

const tech = [
    { label: 'Lines of Code', value: '158,744', color: ACCENT_GOLD },
    { label: 'API Endpoints', value: '239', color: '4ecdc4' },
    { label: 'HTML Pages', value: '69', color: 'ff6b6b' },
    { label: 'Mobile App Lines', value: '64,708', color: 'aa96da' },
];

tech.forEach((t, i) => {
    const x = 0.5 + (i * 2.4);
    slide10.addText(t.value, { x: x, y: 1.1, w: 2.2, h: 0.6, fontSize: 28, bold: true, color: t.color, align: 'center' });
    slide10.addText(t.label, { x: x, y: 1.65, w: 2.2, h: 0.35, fontSize: 11, color: GRAY, align: 'center' });
});

slide10.addText('TECH STACK', { x: 0.5, y: 2.2, w: '90%', h: 0.35, fontSize: 14, bold: true, color: WHITE });

const stack = [
    'Frontend: HTML5, CSS3, Vanilla JavaScript',
    'Backend: Node.js, Vercel Serverless Functions',
    'Database: MongoDB Atlas',
    'Real-time: Pusher Channels',
    'Payments: Stripe + PayPal',
    'Mobile: React Native + Expo',
];

stack.forEach((s, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    slide10.addText('• ' + s, { x: 0.7 + (col * 4.5), y: 2.6 + (row * 0.4), w: 4.3, h: 0.35, fontSize: 11, color: LIGHT_GRAY });
});

slide10.addText('COMPETITIVE MOAT', { x: 0.5, y: 4.0, w: '90%', h: 0.35, fontSize: 14, bold: true, color: WHITE });

const moat = [
    { icon: '🏈', text: 'Hyper-local focus - national players can\'t replicate' },
    { icon: '💎', text: 'Gamification creates switching costs (Diehard Dollars, badges)' },
    { icon: '👥', text: 'Community network effects - value grows with users' },
    { icon: '📊', text: 'First-mover advantage in dedicated Philly sports platform' },
];

moat.forEach((m, i) => {
    slide10.addText(m.icon + '  ' + m.text, { x: 0.7, y: 4.4 + (i * 0.38), w: 8.5, h: 0.35, fontSize: 11, color: LIGHT_GRAY });
});

// ============================================
// SLIDE 11: TEAM
// ============================================
let slide11 = pptx.addSlide();
slide11.background = { color: DARK_BG };
addSectionHeader(slide11, 'THE TEAM');

slide11.addShape(pptx.ShapeType.ellipse, { x: 4, y: 1.2, w: 2, h: 2, fill: { color: '333333' }, line: { color: ACCENT_GOLD, pt: 3 } });
slide11.addText('👤', { x: 4, y: 1.5, w: 2, h: 1.5, fontSize: 48, align: 'center' });

slide11.addText('FOUNDER', {
    x: 0.5, y: 3.4, w: '90%', h: 0.4,
    fontSize: 14, color: ACCENT_GOLD, align: 'center'
});

slide11.addText('[Your Name Here]', {
    x: 0.5, y: 3.8, w: '90%', h: 0.5,
    fontSize: 24, bold: true, color: WHITE, align: 'center'
});

slide11.addText('Solo Founder & Developer', {
    x: 0.5, y: 4.3, w: '90%', h: 0.35,
    fontSize: 14, color: GRAY, align: 'center'
});

const founderPoints = [
    'Built entire platform (158K+ lines of code)',
    'Lifelong Philadelphia sports fan',
    'Deep understanding of the target market',
    'Technical expertise in full-stack development',
];

founderPoints.forEach((p, i) => {
    slide11.addText('• ' + p, { x: 2.5, y: 4.8 + (i * 0.35), w: 5, h: 0.3, fontSize: 11, color: LIGHT_GRAY });
});

// ============================================
// SLIDE 12: FINANCIALS
// ============================================
let slide12 = pptx.addSlide();
slide12.background = { color: DARK_BG };
addSectionHeader(slide12, 'FINANCIAL PROJECTIONS');

// Year headers
slide12.addText('', { x: 0.5, y: 1.1, w: 2.5, h: 0.4 });
slide12.addText('YEAR 1', { x: 3.2, y: 1.1, w: 2, h: 0.4, fontSize: 14, bold: true, color: ACCENT_GOLD, align: 'center' });
slide12.addText('YEAR 2', { x: 5.4, y: 1.1, w: 2, h: 0.4, fontSize: 14, bold: true, color: ACCENT_GOLD, align: 'center' });
slide12.addText('YEAR 3', { x: 7.6, y: 1.1, w: 2, h: 0.4, fontSize: 14, bold: true, color: ACCENT_GOLD, align: 'center' });

const financials = [
    { metric: 'Monthly Active Users', y1: '10,000', y2: '50,000', y3: '150,000' },
    { metric: 'Premium Subscribers', y1: '200', y2: '2,500', y3: '12,000' },
    { metric: 'Annual Revenue', y1: '$25,000', y2: '$180,000', y3: '$720,000' },
    { metric: 'Monthly Burn', y1: '$15,000', y2: '$25,000', y3: '$40,000' },
    { metric: 'Net Income', y1: '($155K)', y2: '($120K)', y3: '$240,000' },
];

financials.forEach((f, i) => {
    const y = 1.55 + (i * 0.6);
    const bgColor = i % 2 === 0 ? '252525' : '2a2a2a';
    slide12.addShape(pptx.ShapeType.rect, { x: 0.4, y: y - 0.05, w: 9.4, h: 0.55, fill: { color: bgColor } });
    slide12.addText(f.metric, { x: 0.5, y: y, w: 2.5, h: 0.45, fontSize: 12, color: WHITE, valign: 'middle' });
    slide12.addText(f.y1, { x: 3.2, y: y, w: 2, h: 0.45, fontSize: 12, color: LIGHT_GRAY, align: 'center', valign: 'middle' });
    slide12.addText(f.y2, { x: 5.4, y: y, w: 2, h: 0.45, fontSize: 12, color: LIGHT_GRAY, align: 'center', valign: 'middle' });
    slide12.addText(f.y3, { x: 7.6, y: y, w: 2, h: 0.45, fontSize: 14, bold: true, color: ACCENT_GOLD, align: 'center', valign: 'middle' });
});

slide12.addText('Path to profitability: Year 3 with 150K MAU and 8% premium conversion', {
    x: 0.5, y: 4.7, w: '90%', h: 0.3,
    fontSize: 11, italic: true, color: GRAY, align: 'center'
});

// ============================================
// SLIDE 13: THE ASK
// ============================================
let slide13 = pptx.addSlide();
slide13.background = { color: DARK_BG };
addSectionHeader(slide13, 'THE ASK');

slide13.addText('$250,000 - $500,000', {
    x: 0.5, y: 1.2, w: '90%', h: 0.8,
    fontSize: 48, bold: true, color: ACCENT_GOLD, align: 'center'
});

slide13.addText('PRE-SEED FUNDING', {
    x: 0.5, y: 2.0, w: '90%', h: 0.4,
    fontSize: 18, color: WHITE, align: 'center'
});

slide13.addText('USE OF FUNDS', {
    x: 0.5, y: 2.6, w: '90%', h: 0.4,
    fontSize: 16, bold: true, color: WHITE, align: 'center'
});

const useOfFunds = [
    { category: 'Product Development', pct: '40%', amount: '$100-200K', color: 'ff6b6b' },
    { category: 'Marketing & User Acquisition', pct: '30%', amount: '$75-150K', color: '4ecdc4' },
    { category: 'Operations & Infrastructure', pct: '15%', amount: '$37-75K', color: ACCENT_GOLD },
    { category: 'Legal & Admin', pct: '10%', amount: '$25-50K', color: 'aa96da' },
    { category: 'Reserve', pct: '5%', amount: '$12-25K', color: '95e1d3' },
];

useOfFunds.forEach((u, i) => {
    const y = 3.1 + (i * 0.5);
    slide13.addShape(pptx.ShapeType.rect, { x: 1, y: y, w: parseFloat(u.pct) * 0.07, h: 0.4, fill: { color: u.color } });
    slide13.addText(u.category, { x: 4.5, y: y, w: 3, h: 0.4, fontSize: 11, color: WHITE, valign: 'middle' });
    slide13.addText(u.pct, { x: 7.6, y: y, w: 0.8, h: 0.4, fontSize: 11, bold: true, color: u.color, valign: 'middle' });
    slide13.addText(u.amount, { x: 8.4, y: y, w: 1.3, h: 0.4, fontSize: 10, color: GRAY, valign: 'middle' });
});

// ============================================
// SLIDE 14: CONTACT
// ============================================
let slide14 = pptx.addSlide();
slide14.background = { color: DARK_BG };

slide14.addText('LET\'S BUILD THE FUTURE OF', {
    x: 0.5, y: 1.5, w: '90%', h: 0.5,
    fontSize: 20, color: GRAY, align: 'center'
});

slide14.addText('PHILLY SPORTS', {
    x: 0.5, y: 2.0, w: '90%', h: 0.8,
    fontSize: 48, bold: true, color: ACCENT_GOLD, align: 'center'
});

slide14.addText('TOGETHER', {
    x: 0.5, y: 2.7, w: '90%', h: 0.5,
    fontSize: 20, color: GRAY, align: 'center'
});

slide14.addShape(pptx.ShapeType.rect, { x: 3.5, y: 3.3, w: 3, h: 0.06, fill: { color: ACCENT_GOLD } });

slide14.addText('phillysports.com', {
    x: 0.5, y: 3.7, w: '90%', h: 0.5,
    fontSize: 24, bold: true, color: WHITE, align: 'center'
});

slide14.addText('[your@email.com]', {
    x: 0.5, y: 4.3, w: '90%', h: 0.4,
    fontSize: 16, color: LIGHT_GRAY, align: 'center'
});

slide14.addText('[Your Phone Number]', {
    x: 0.5, y: 4.7, w: '90%', h: 0.4,
    fontSize: 14, color: GRAY, align: 'center'
});

// Save the file
pptx.writeFile({ fileName: 'PITCH_DECK.pptx' })
    .then(fileName => {
        console.log(`Created: ${fileName}`);
    })
    .catch(err => {
        console.error(err);
    });
