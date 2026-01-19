# PhillySports.com Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           PHILLYSPORTS.COM ARCHITECTURE                                  │
└─────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                      CLIENTS                                             │
├─────────────────────────────────┬───────────────────────────────────────────────────────┤
│                                 │                                                       │
│   ┌─────────────────────┐       │       ┌─────────────────────────────────────────┐    │
│   │    WEB BROWSER      │       │       │         MOBILE APP                      │    │
│   │  ─────────────────  │       │       │  ─────────────────────────────────────  │    │
│   │  69 HTML Pages      │       │       │  React Native + Expo                    │    │
│   │  Vanilla JS         │       │       │  iOS + Android                          │    │
│   │  CSS                │       │       │  Push Notifications                     │    │
│   │  Shared Components: │       │       │  Biometric Auth (Face ID/Touch ID)      │    │
│   │  - header.js        │       │       │  Deep Linking                           │    │
│   │  - live-ticker.js   │       │       │  64,708 lines TypeScript                │    │
│   └──────────┬──────────┘       │       └──────────────────┬──────────────────────┘    │
│              │                  │                          │                            │
└──────────────┼──────────────────┴──────────────────────────┼────────────────────────────┘
               │                                             │
               │              HTTPS Requests                 │
               ▼                                             ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                    VERCEL EDGE                                           │
│                              (CDN + Serverless Functions)                                │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                          │
│   ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│   │                           API ENDPOINTS (239 total)                               │  │
│   ├──────────────────────────────────────────────────────────────────────────────────┤  │
│   │                                                                                   │  │
│   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │  │
│   │  │    AUTH     │  │   CONTENT   │  │   GAMING    │  │  COMMUNITY  │              │  │
│   │  │ ─────────── │  │ ─────────── │  │ ─────────── │  │ ─────────── │              │  │
│   │  │ /login      │  │ /content    │  │ /poker      │  │ /forums     │              │  │
│   │  │ /register   │  │ /articles   │  │ /fantasy    │  │ /clubs      │              │  │
│   │  │ /logout     │  │ /curated    │  │ /pools      │  │ /chat       │              │  │
│   │  │ /me         │  │ /sources    │  │ /trivia     │  │ /tailgates  │              │  │
│   │  │ /profile    │  │ /live-ticker│  │ /predictions│  │ /watch-party│              │  │
│   │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘              │  │
│   │                                                                                   │  │
│   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │  │
│   │  │  COMMERCE   │  │    ADMIN    │  │    COINS    │  │   SPORTS    │              │  │
│   │  │ ─────────── │  │ ─────────── │  │ ─────────── │  │ ─────────── │              │  │
│   │  │ /shop       │  │ /admin/*    │  │ /coins      │  │ /scores     │              │  │
│   │  │ /marketplace│  │ /content/*  │  │ /daily-bonus│  │ /schedules  │              │  │
│   │  │ /orders     │  │ /users      │  │ /leaderboard│  │ /standings  │              │  │
│   │  │ /raffles    │  │ /stats      │  │ /badges     │  │ /game-thread│              │  │
│   │  │ /membership │  │ /moderate   │  │ /rewards    │  │ /teams      │              │  │
│   │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘              │  │
│   │                                                                                   │  │
│   └──────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                          │
│   ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│   │                              SHARED LIBRARIES                                     │  │
│   │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐  │  │
│   │  │  auth.js   │  │ mongodb.js │  │  pusher.js │  │  stripe.js │  │  email.js  │  │  │
│   │  │  (JWT)     │  │(Connection)│  │(Real-time) │  │ (Payments) │  │(Nodemailer)│  │  │
│   │  └────────────┘  └────────────┘  └────────────┘  └────────────┘  └────────────┘  │  │
│   └──────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                          │
└───────────────┬─────────────────────┬─────────────────────┬─────────────────────────────┘
                │                     │                     │
                ▼                     ▼                     ▼
┌───────────────────────┐ ┌───────────────────┐ ┌───────────────────────────────────────┐
│       MONGODB         │ │      PUSHER       │ │         EXTERNAL SERVICES             │
│  ─────────────────    │ │  ───────────────  │ │  ───────────────────────────────────  │
│                       │ │                   │ │                                       │
│  Collections:         │ │  Real-time:       │ │  ┌─────────┐  ┌─────────┐            │
│  • users              │ │  • Game threads   │ │  │ STRIPE  │  │ PAYPAL  │            │
│  • curated_content    │ │  • Live chat      │ │  │Payments │  │Payments │            │
│  • content_sources    │ │  • Poker tables   │ │  └─────────┘  └─────────┘            │
│  • articles           │ │  • Notifications  │ │                                       │
│  • forums/threads     │ │  • Live scores    │ │  ┌─────────┐  ┌─────────┐            │
│  • clubs              │ │                   │ │  │  ESPN   │  │ Sports  │            │
│  • chat_messages      │ └───────────────────┘ │  │  API    │  │  APIs   │            │
│  • poker_*            │                       │  └─────────┘  └─────────┘            │
│  • fantasy_*          │                       │                                       │
│  • pools              │                       │  ┌─────────┐  ┌─────────┐            │
│  • predictions        │                       │  │ Google  │  │ Elfsight│            │
│  • shop_products      │                       │  │ AdSense │  │ Widgets │            │
│  • marketplace_*      │                       │  └─────────┘  └─────────┘            │
│  • orders             │                       │                                       │
│  • raffles            │                       │  ┌─────────┐  ┌─────────┐            │
│  • badges             │                       │  │  VAPID  │  │  RSS    │            │
│  • subscriptions      │                       │  │  Push   │  │  Feeds  │            │
│  • notifications      │                       │  └─────────┘  └─────────┘            │
│                       │                       │                                       │
└───────────────────────┘                       └───────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                    DATA FLOW                                             │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                          │
│  AUTHENTICATION FLOW:                                                                    │
│  User → /api/auth/login → JWT Token (HttpOnly Cookie) → Authenticated Requests          │
│                                                                                          │
│  CONTENT CURATION FLOW:                                                                  │
│  RSS Feeds → /api/admin/content/queue/fetch → Admin Review → /api/content (Published)   │
│                                                                                          │
│  REAL-TIME FLOW:                                                                         │
│  User Action → API → Pusher Trigger → All Connected Clients                             │
│                                                                                          │
│  PAYMENT FLOW:                                                                           │
│  User → Stripe/PayPal → Webhook → /api/webhooks/* → Update DB → Confirmation            │
│                                                                                          │
│  GAMIFICATION FLOW:                                                                      │
│  User Action → Earn Diehard Dollars → Update Balance → Unlock Badges/Rewards            │
│                                                                                          │
└─────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                   TECH STACK                                             │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│  Frontend:  HTML5, CSS3, Vanilla JavaScript, Shared Components                           │
│  Backend:   Node.js, Vercel Serverless Functions                                         │
│  Database:  MongoDB Atlas                                                                │
│  Real-time: Pusher Channels                                                              │
│  Payments:  Stripe, PayPal                                                               │
│  Auth:      JWT (HttpOnly Cookies), bcrypt                                               │
│  Mobile:    React Native, Expo, TypeScript                                               │
│  Hosting:   Vercel (CDN + Edge Functions)                                                │
│  Domain:    phillysports.com                                                             │
└─────────────────────────────────────────────────────────────────────────────────────────┘

                              TOTAL: ~158,744 Lines of Code
                              239 API Endpoints | 69 HTML Pages
```

## Directory Structure

```
/
├── api/                    # Serverless API endpoints (239 files)
│   ├── auth/              # Authentication (login, register, logout, me)
│   ├── admin/             # Admin endpoints (content, users, moderation)
│   ├── content/           # Curated content API
│   ├── poker/             # Poker game logic
│   ├── fantasy/           # Fantasy contests
│   ├── pools/             # Sports pools
│   ├── forums/            # Forum threads and posts
│   ├── clubs/             # User clubs
│   ├── chat/              # Real-time chat
│   ├── shop/              # Shop and products
│   ├── marketplace/       # User marketplace
│   ├── raffles/           # Raffle system
│   ├── coins/             # Diehard Dollars economy
│   ├── webhooks/          # Payment webhooks
│   └── lib/               # Shared libraries
│
├── js/                     # Shared JavaScript components
│   ├── header.js          # Unified header component
│   └── live-ticker.js     # Live game scores ticker
│
├── css/                    # Stylesheets
│
├── eagles/                 # Eagles team pages
├── phillies/              # Phillies team pages
├── sixers/                # 76ers team pages
├── flyers/                # Flyers team pages
├── villanova/             # College team pages
├── temple/
├── penn/
├── drexel/
├── lasalle/
├── stjosephs/
│
├── community/             # Community features
│   ├── forums.html
│   ├── chat.html
│   ├── clubs/
│   ├── tailgates/
│   └── watch-parties/
│
├── esports/               # Esports section
├── youth/                 # Youth sports
│
├── mobile-app/            # React Native mobile app (64,708 lines)
│   ├── app/              # Expo Router pages
│   ├── components/       # Reusable components
│   └── services/         # API service layer
│
├── index.html             # Homepage
├── admin.html             # Admin dashboard
├── login.html             # Authentication
├── register.html
├── profile.html
├── poker.html             # Gaming features
├── fantasy.html
├── pools.html
├── trivia.html
├── predictions.html
├── shop.html              # Commerce
├── membership.html
├── leaderboard.html       # Gamification
└── game-threads.html      # Live game discussions
```

## Key Features

- **Content Curation**: Admin-curated news from multiple sources with editorial reviews
- **Gamification**: Diehard Dollars virtual currency, badges, daily bonuses, leaderboards
- **Real-time**: Live game threads, chat, poker tables via Pusher
- **Commerce**: Shop, marketplace, raffles with Stripe/PayPal payments
- **Community**: Forums, clubs, watch parties, tailgates
- **Mobile**: Full-featured React Native app with biometric auth
