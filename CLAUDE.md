# Dominion City Church PWA

## Rules — Read These First
- **No workarounds.** Solve problems correctly or flag them — never patch around the root cause.
- **No shortcuts.** Every file, function, and style must be done right the first time.
- **Zero lint errors.** Run `npm run lint` and `npm run lint:css` before considering any change complete.
- **Zero tech debt.** Do not leave TODOs, dead code, commented-out blocks, or half-finished implementations.

## Overview
Progressive Web App for Dominion City Church (Navasota, TX). Built with Vite, deployed on Vercel.

## Architecture
```
index.html          — Clean semantic HTML (Vite entry point references src/main.js)
src/
  main.js           — Vite entry: imports all styles and JS modules, registers SW
  config.js         — White-label app config (identity, contact, giving, Supabase, AI)
  styles/
    variables.css   — CSS custom properties (colors, fonts, spacing ONLY)
    reset.css       — CSS reset and base element styles
    layout.css      — App shell, splash, auth, nav, content area, desktop phone frame
    components.css  — Reusable components (cards, buttons, forms, toasts, tiles)
    screens.css     — Screen-specific styles (all screens, overlays, panels)
  js/
    supabase.js     — Supabase client initialization
    state.js        — APP state object and ROOMS definitions
    audit.js        — Audit logger (replaces console, routes to Supabase)
    auth.js         — PIN auth, biometric (WebAuthn)
    navigation.js   — Tab switching, overlay history management
    app.js          — App launch orchestrator (applyConfig, launchApp)
    scripture.js    — Daily scripture loader
    ministry.js     — Ministry rooms, chat, photos, QOTW
    chat.js         — Chat message sending
    prayer.js       — Prayer wall
    community.js    — Community feed (posts, photos, video, likes)
    announcements.js — Announcements and events loader
    calendar.js     — Calendar rendering
    giving.js       — Giving options, gift logging, totals
    notifications.js — Notification panel
    profile.js      — Member profile, photo upload
    reactions.js    — Emoji reaction system with skin tones
    blast.js        — Pastor blast messages (text + voice)
    claude-engine.js — AI engine (QOTW gen, scripture gen, moderation, reports)
    pastor-dashboard.js — Pastor dashboard, diagnostics, member approvals
    setlists.js     — Setlist management (musicians)
    giving-reports.js — Finance giving reports
    home.js         — Home screen functions, pastor page
    connect.js      — Connect card, guest prayer
    emember.js      — E-member form
    mentions.js     — @mention system in chat
    registration.js — Member registration flow
    utils.js        — escHtml, timeAgo, getMonday
public/
  sw.js             — Service worker (offline cache, push, bg sync)
  manifest.json     — PWA manifest
  icon-*.png        — App icons
  *.jpg             — Images
tests/              — Vitest test files
```

## Key Conventions
- **Config in JS, not CSS.** App config (church name, Supabase, giving links) lives in `src/config.js`. CSS variables are for style values only.
- **ES modules.** All JS uses `import`/`export`. Functions called from HTML `onclick` are attached to `window`.
- **No inline styles in HTML.** All styling is in CSS files.
- **No inline scripts in HTML.** All JS is in module files.
- **Supabase key is publishable** (anon/public key — safe in client code).

## Commands
```bash
npm run dev          # Start Vite dev server (port 3000)
npm run build        # Production build to dist/
npm run preview      # Preview production build
npm run lint         # ESLint check
npm run lint:css     # Stylelint check
npm run lint:fix     # Auto-fix lint issues
npm run test         # Run Vitest tests
npm run test:watch   # Vitest in watch mode
```

## Deployment
Push to `main` branch. Vercel auto-builds with `npm run build` and serves from `dist/`. All routes fall back to `/index.html`.

## Design System
- Mobile-first, max-width 430px phone frame on desktop
- Dark theme: deep purple background (#0f0a1a), gold accents (#c9952a)
- Fonts: Cinzel (display/headings), Nunito (body)
- Font Awesome 6.5 for icons
- Tab-based navigation (Home, News, Community, Members, Prayer, Connect)

## Backend
- **Supabase**: Auth (PIN-based, not email/password), database, storage, edge functions
- **AI**: Claude API via `dcc-ai-proxy` edge function with governance covenant
- **Audit**: All events route to `dcc-audit` edge function, never to browser console
