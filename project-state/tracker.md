# DCC App — Project State Tracker

## Current State (2026-03-30)
- **App is WORKING** — reverted to original single-file index.html (5906 lines)
- **Deployed on Vercel** — auto-deploys from main branch
- **Supabase Edge Functions** — dcc-ai-proxy (v7 with hooks) and dcc-audit are live and working
- **No build step** — plain static files, no Vite, no bundler

## What Was Done This Session

### Completed (kept)
1. **dcc-ai-proxy v7** — deployed to Supabase with 5 server-side hooks:
   - Hook 1: Governance covenant (input) — doctrinal boundaries injected server-side
   - Hook 2: Output validation (post-response) — scans for banned terms, auto-retry, block if retry fails
   - Hook 3: Rate limiter — 30 calls/hour per session
   - Hook 4: Prompt injection guard — strips jailbreak attempts
   - Hook 5: Cost tracking — logs token usage to audit_log
2. **dcc-audit** — already working, sanitizes PINs/passwords in logs

### Attempted and Reverted
- Full refactor (split into Vite + ES modules + separate CSS/JS files) was attempted but broke the app
- **Root cause**: HTML was rewritten with new class names but CSS was generated separately and didn't match. JS modules used wrong Supabase field names (pin vs pin_hash, first_name/last_name vs full_name, ministries vs ministry_affiliations). Multiple element IDs wrong. Missing overlay panels, missing splash-to-auth transition.

## What Still Needs To Be Done

### Priority 1: Calendar Event System (was working before revert)
The calendar feature was built and working before the revert. Needs to be re-added to the SINGLE FILE:
- [ ] Calendar grid shows real event dots from Supabase events table (not just hardcoded Sundays)
- [ ] Click a day to see real events for that date
- [ ] "+ Add Event" form for ministry members and admins
- [ ] Admin events go live immediately, ministry events require approval
- [ ] Pending events section in pastor dashboard with approve/reject

### Priority 2: Reduce File Size (user request)
The user wants to make the file smaller without breaking anything:
- [ ] Remove hardcoded/duplicate photos that can be loaded from Supabase storage
- [ ] Remove any duplicate CSS rules
- [ ] Remove any duplicate JS functions (there are two `escHtml`, two `submitCommunityPost`, two `loadCommunityFeed` in the original)
- [ ] Minify if possible without a build step

### Priority 3: Future Refactor (DO NOT ATTEMPT until tracker items above are done)
If a refactor is ever attempted again, these are the rules:
1. **NEVER change class names** — use the exact same class names as the original
2. **NEVER change element IDs** — use the exact same IDs as the original
3. **NEVER change Supabase field names** — pin_hash, full_name, ministry_affiliations, etc.
4. **Test every screen visually before pushing** — splash, auth, home, news, community, members, prayer, connect, pastor page, pastor dashboard, profile, registration, e-member, family reg
5. **Keep inline styles if they work** — don't convert inline styles to classes unless the CSS is verified
6. **Split JS only** — the safest refactor is to extract the JS into modules while keeping the HTML and CSS exactly as-is
7. **One change at a time** — don't refactor everything at once

## Supabase Schema (known field names)
- `members`: id, full_name, pin_hash, status, gender, ministry_affiliations, profile_complete, is_admin, photo_url, phone, bio, webauthn_credential_id, webauthn_public_key, birthday_month, birthday_day, is_intercessory_team, profile_last_updated, created_at
- `events`: id, title, event_date, event_time, location, description, is_public, created_by, created_at
- `messages`: id, sender_id, room, content, is_church_wide, pinned, deleted_at, expires_at, created_at
- `prayer_requests`: id, member_id, request_type (public/private), content, is_anonymous, prayed_count, resolved, created_at
- `feed_posts`: id, member_id, post_type, content, media_url, video_link, like_count, comment_count, reported, pinned, deleted_at, expires_at, created_at
- `announcements`: id, title, body, youtube_url, image_url, published, created_by, created_at
- `daily_scripture`: id, display_date, reference, verse, translation
- `weekly_questions`: id, room, week_start, question
- `connect_cards`: id, full_name, email, phone, visit_type, prayer_request, created_at
- `blast_messages`: id, sender_id, content, audio_url, message_type, pinned, deleted_at, created_at
- `blast_reactions`: id, blast_id, member_id
- `blast_replies`: id, blast_id, member_id, content, deleted_at, created_at
- `feed_likes`: id, post_id, member_id, reaction
- `audit_log`: id, level, event, detail, member_id, session_id, user_agent, created_at
- `ai_response_cache`: id, cache_key, response, expires_at
- `event_reminders`: id, member_id, event_name, reminder_set
- `room_photos`: id, room, member_id, photo_url, caption, created_at
- `member_giving`: id, member_id, amount, method, given_at, notes
- `giving_reports`: id, report_period, period_start, period_end, total_tithes, total_offerings, total_special, total_online, grand_total, notes, created_by
- `setlists`: id, service_date, title, notes, created_by
- `setlist_songs`: id, setlist_id, position, song_title, key, artist
- `notifications`: id (structure TBD)
- `watch_care`: id (structure TBD)
- `ministry_memberships`: id (structure TBD)
- `prayer_prayed`: id, prayer_id, member_id

## Edge Function URLs
- AI Proxy: `https://dmjdkowpskvrcjrxlcud.supabase.co/functions/v1/dcc-ai-proxy`
- Audit: `https://dmjdkowpskvrcjrxlcud.supabase.co/functions/v1/dcc-audit`

## Config (from index.html CONFIG object)
- Church: Dominion City Church
- Location: 625 Blackshear St, Navasota, TX 77868
- Pastor: Pastor Shan E. Davis
- Service: Sunday 9:00 AM
- Supabase project: dmjdkowpskvrcjrxlcud
