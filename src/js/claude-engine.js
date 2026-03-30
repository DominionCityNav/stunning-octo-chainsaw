import CONFIG from '../config.js';
import db from './supabase.js';
import { APP, ROOMS } from './state.js';
import { auditLog } from './audit.js';
import { escHtml, getMonday } from './utils.js';
import { loadScripture } from './scripture.js';
import { loadQOTW } from './ministry.js';

// DCC Governance Covenant — the law of the app.
// Every Claude call inherits these boundaries.
const DCC_GOVERNANCE = `
IDENTITY
You are the embedded AI ministry assistant inside the Dominion City Church (DCC) app in Navasota, TX.
Pastor Shan E. Davis is the lead pastor. You serve him, his leadership team, and his congregation.

CHURCH PROFILE
- Mission: ${CONFIG.mission}
- Vision: ${CONFIG.vision}
- Tagline: "${CONFIG.tagline}"
- Spiritual flow: ${CONFIG.spiritualFlow}
- Congregation: Diverse — all backgrounds, denominations, ethnicities, gathered in the name of Jesus
- Core values: ${CONFIG.coreValues}
- Key scripture: ${CONFIG.foundingVerse}
- Youth ministry: ${CONFIG.youthMinistry}
- Location: ${CONFIG.city}, ${CONFIG.state} ${CONFIG.zip} (small city, rural ${CONFIG.county})

VOICE & TONE
- Lead with the love of God — always capitalize "God," never write "god"
- Write in a bold, faith-grounded, Kingdom-focused, prophetic-apostolic voice
- Be encouraging, specific, and Spirit-led — not generic or corporate
- Do not water down the Gospel to make it comfortable or politically palatable
- Do not over-whitewash — the Gospel has edges; honor them

HARD DOCTRINAL BOUNDARIES — NEVER VIOLATE
- Do NOT reference, quote, or draw from Catholic doctrine, Catholic saints, or Catholic tradition
- Do NOT reference Jewish religious tradition, Jewish law, or Rabbinic teaching as spiritual authority
- Do NOT include anything obscene, sexually suggestive, violent, or inappropriate for a church community
- Do NOT introduce New Age, occult, or mystical practices not rooted in Scripture
- Do NOT suggest ecumenical compromise that dilutes the Gospel of Jesus Christ
- Do NOT soften biblical truth to avoid offense — speak the truth in love (Ephesians 4:15)

SCRIPTURE
- Use KJV as the primary translation unless otherwise specified
- Always cite reference after the verse (e.g., — Romans 8:28)
- Only quote Scripture that is contextually accurate — do not misapply verses

OUTPUT RULES
- Be concise and actionable
- Format cleanly — no unnecessary filler phrases
- When generating JSON, return ONLY valid JSON with no markdown, no backticks, no preamble
`.trim();

// Proxy URL — routes through Supabase Edge Function
const DCC_PROXY = `${CONFIG.supabaseUrl}/functions/v1/dcc-ai-proxy`;

// Church context sent with every call
function getChurchContext() {
  return {
    churchName: CONFIG.churchName,
    pastor: CONFIG.pastor,
    city: CONFIG.city,
    state: CONFIG.state,
    zip: CONFIG.zip,
    mission: CONFIG.mission,
    vision: CONFIG.vision,
    tagline: CONFIG.tagline,
    spiritualFlow: CONFIG.spiritualFlow,
    coreValues: CONFIG.coreValues,
    foundingVerse: CONFIG.foundingVerse,
    youthMinistry: CONFIG.youthMinistry,
  };
}

const MODEL_HAIKU = 'claude-haiku-4-5-20251001';
const MODEL_SONNET = 'claude-sonnet-4-20250514';

async function claudeCall(prompt, callType, systemOverride, useSonnet) {
  const model = useSonnet ? MODEL_SONNET : MODEL_HAIKU;
  try {
    const res = await fetch(DCC_PROXY, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CONFIG.supabaseKey}`,
      },
      body: JSON.stringify({
        prompt,
        model,
        call_type: callType || 'default',
        system_override: systemOverride || null,
        church_context: getChurchContext(),
      }),
    });
    const data = await res.json();
    if (data.error) {
      auditLog('warn', 'dcc_proxy_error', { detail: String(data.error).substring(0, 200) });
      return '';
    }
    return data.text || '';
  } catch (err) {
    auditLog('warn', 'dcc_proxy_call_failed', { detail: String(err).substring(0, 200) });
    return '';
  }
}

// 1. Weekly QOTW Generator
async function generateWeeklyQOTW() {
  const el = document.getElementById('qotw-gen-status');
  if (el) { el.textContent = 'Generating...'; el.className = 'ai-status thinking'; }

  const rooms = Object.entries(ROOMS);
  const weekStart = getMonday();
  let generated = 0;

  for (const [key, room] of rooms) {
    try {
      const text = await claudeCall(
        `Generate ONE weekly discussion question for the ${room.name} at Dominion City Church in Navasota TX.
         The question should be spiritually challenging, specific to this ministry's role, and encourage
         personal reflection and Kingdom action. Return ONLY the question text, no preamble, no quotes.`,
        'qotw'
      );
      const clean = text.trim().replace(/^["']|["']$/g, '');
      if (clean && db) {
        await db.from('weekly_questions').upsert({
          room: key,
          week_start: weekStart,
          question: clean,
        }, { onConflict: 'room,week_start' });
      }
      generated++;
      if (el) el.textContent = `Generated ${generated}/${rooms.length}...`;
    } catch (err) {
      auditLog('warn', 'qotw_gen_error', { detail: String(err).substring(0, 200) });
    }
  }

  if (el) { el.textContent = `\u2713 All ${generated} questions generated`; el.className = 'ai-status done'; }
  loadQOTW();
  return generated;
}

// 2. Announcement Draft Writer
async function generateAnnouncementDrafts() {
  const container = document.getElementById('ann-drafts-container');
  if (!container) return;
  container.innerHTML = '<div class="ai-status thinking">\u2726 Claude is drafting announcements...</div>';

  try {
    const { data: events } = await db
      .from('events').select('*')
      .eq('is_public', true)
      .gte('event_date', new Date().toISOString())
      .order('event_date', { ascending: true })
      .limit(5);

    const eventList = events?.length
      ? events.map((e) => `- ${e.title} on ${new Date(e.event_date).toLocaleDateString()}`).join('\n')
      : 'No upcoming events in database yet.';

    const draft = await claudeCall(
      `Write 2 church announcement drafts for Dominion City Church in Navasota TX this week.
       Upcoming events:\n${eventList}
       Write in Pastor Shan's warm, Kingdom-focused voice.
       Format as JSON array: [{"title":"...","body":"..."},{"title":"...","body":"..."}]
       Return ONLY the JSON, no markdown, no preamble.`,
      'announcement'
    );

    let drafts = [];
    try { drafts = JSON.parse(draft.replace(/```json|```/g, '')); } catch { /* parse failed */ }

    container.innerHTML = '';
    if (!drafts.length) {
      container.innerHTML = '<div class="ai-status">No drafts generated. Try again.</div>';
      return;
    }

    drafts.forEach((d, i) => {
      const el = document.createElement('div');
      el.className = 'ann-draft-card';
      el.innerHTML = `
        <div class="ann-draft-label">\u2726 AI Draft ${i + 1}</div>
        <div class="ann-draft-title" contenteditable="true">${escHtml(d.title)}</div>
        <div class="ann-draft-body" contenteditable="true">${escHtml(d.body)}</div>
        <div class="ann-draft-actions">
          <button class="btn-gold" style="font-size:11px;padding:8px 16px" onclick="approveAnnouncementDraft(this)">\u2713 Approve & Publish</button>
          <button class="btn-outline" style="font-size:11px;padding:8px 16px" onclick="this.closest('.ann-draft-card').remove()">\u2717 Discard</button>
        </div>`;
      container.appendChild(el);
    });
  } catch (err) {
    container.innerHTML = '<div class="ai-status error">Error generating drafts. Check connection.</div>';
    auditLog('warn', 'ann_drafts_error', { detail: String(err).substring(0, 200) });
  }
}

async function approveAnnouncementDraft(btn) {
  const card = btn.closest('.ann-draft-card');
  const title = card.querySelector('.ann-draft-title').textContent.trim();
  const body = card.querySelector('.ann-draft-body').textContent.trim();
  if (!db) return;
  try {
    await db.from('announcements').insert({ title, body, published: true, created_by: null });
    card.innerHTML = '<div class="ai-status done">\u2713 Published to announcements</div>';
    setTimeout(() => card.remove(), 2000);
  } catch (err) {
    auditLog('warn', 'approve_ann', { detail: String(err).substring(0, 200) });
  }
}

// 3. Outreach Suggester
async function generateOutreachSuggestions() {
  const container = document.getElementById('outreach-suggestions-container');
  if (!container) return;
  container.innerHTML = '<div class="ai-status thinking">\u2726 Analyzing community and generating outreach ideas...</div>';

  try {
    const suggestions = await claudeCall(
      `Generate 4 specific, actionable outreach ideas for Dominion City Church in Navasota, TX.
       Navasota TX is a small city (pop ~8,000) in Grimes County, rural Texas.
       Focus on: community presence, local partnerships, digital reach, and youth engagement.
       Format as JSON array: [{"title":"...","description":"...","effort":"Low|Medium|High","impact":"..."}]
       Return ONLY the JSON, no markdown, no preamble.`,
      'outreach'
    );

    let ideas = [];
    try { ideas = JSON.parse(suggestions.replace(/```json|```/g, '')); } catch { /* parse failed */ }

    container.innerHTML = '';
    if (!ideas.length) {
      container.innerHTML = '<div class="ai-status">No suggestions generated.</div>';
      return;
    }

    ideas.forEach((idea) => {
      const effortColor = idea.effort === 'Low' ? '#86efac' : idea.effort === 'High' ? '#fca5a5' : '#fde68a';
      const el = document.createElement('div');
      el.className = 'outreach-idea-card';
      el.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <div style="font-family:var(--font-display);font-size:13px;color:var(--gold-light)">${escHtml(idea.title)}</div>
          <span style="font-size:10px;padding:3px 8px;border-radius:10px;background:rgba(0,0,0,0.3);color:${effortColor}">${escHtml(idea.effort)} effort</span>
        </div>
        <div style="font-size:13px;line-height:1.6;color:rgba(255,255,255,0.8);margin-bottom:6px">${escHtml(idea.description)}</div>
        <div style="font-size:11px;color:var(--gold)">Impact: ${escHtml(idea.impact)}</div>`;
      container.appendChild(el);
    });
  } catch (err) {
    container.innerHTML = '<div class="ai-status error">Error generating suggestions.</div>';
    auditLog('warn', 'outreach_error', { detail: String(err).substring(0, 200) });
  }
}

// 4. Daily Scripture Generator
async function generateDailyScripture() {
  const el = document.getElementById('scripture-gen-status');
  if (el) { el.textContent = 'Generating 30 days of scripture...'; el.className = 'ai-status thinking'; }

  try {
    const raw = await claudeCall(
      `Generate 30 daily scriptures for Dominion City Church. Focus on themes of dominion, authority,
       purpose, faith, healing, provision, and community. Use KJV translation.
       Return ONLY a JSON array of 30 objects:
       [{"date_offset":1,"reference":"Book Chapter:Verse","verse":"full verse text"}]
       Date offset 1 = tomorrow. No markdown, no preamble, only the JSON array.`
    );

    let scriptures = [];
    try { scriptures = JSON.parse(raw.replace(/```json|```/g, '')); } catch { /* parse failed */ }

    let inserted = 0;
    for (const s of scriptures) {
      const d = new Date();
      d.setDate(d.getDate() + (s.date_offset || 0));
      const displayDate = d.toISOString().split('T')[0];
      try {
        if (db) {
          await db.from('daily_scripture').upsert(
            { display_date: displayDate, reference: s.reference, verse: s.verse, translation: 'KJV' },
            { onConflict: 'display_date' }
          );
          inserted++;
        }
      } catch { /* skip individual failures */ }
    }

    if (el) { el.textContent = `\u2713 ${inserted} scriptures written to database`; el.className = 'ai-status done'; }
    loadScripture();
  } catch (err) {
    if (el) { el.textContent = 'Error generating scripture.'; el.className = 'ai-status error'; }
    auditLog('warn', 'scripture_gen', { detail: String(err).substring(0, 200) });
  }
}

// 5. Feed Moderation
async function moderateFeed() {
  if (!db) return;
  try {
    const { data: posts } = await db
      .from('feed_posts')
      .select('id, content, members(full_name)')
      .is('deleted_at', null)
      .eq('reported', false)
      .order('created_at', { ascending: false })
      .limit(20);

    if (!posts?.length) return;

    const postList = posts
      .filter((p) => p.content)
      .map((p) => `ID:${p.id} | ${p.members?.full_name || 'Member'}: ${p.content.substring(0, 150)}`)
      .join('\n');

    const result = await claudeCall(
      `You are a pastoral content moderator for Dominion City Church. Review these recent community feed posts and identify any that need pastoral attention.
       Posts:\n${postList}
       Return ONLY a JSON array of flagged post IDs with reason:
       [{"id":"...","reason":"...","urgency":"low|medium|high"}]
       If nothing needs attention, return empty array: []`,
      'moderation'
    );

    let flagged = [];
    try { flagged = JSON.parse(result.replace(/```json|```/g, '')); } catch { /* parse failed */ }

    const container = document.getElementById('feed-flags-container');
    if (!container || !flagged.length) {
      if (container) container.innerHTML = '<div class="muted-text">No flagged posts \u2713</div>';
      return;
    }

    container.innerHTML = '';
    flagged.forEach((f) => {
      const post = posts.find((p) => p.id === f.id);
      if (!post) return;
      const urgencyColor = f.urgency === 'high' ? '#fca5a5' : f.urgency === 'medium' ? '#fde68a' : '#86efac';
      const el = document.createElement('div');
      el.className = 'feed-flag-item';
      el.innerHTML = `
        <div style="display:flex;justify-content:space-between;margin-bottom:6px">
          <span style="font-size:12px;font-weight:700;color:var(--white)">${escHtml(post.members?.full_name || 'Member')}</span>
          <span style="font-size:10px;padding:2px 8px;border-radius:10px;background:rgba(0,0,0,0.3);color:${urgencyColor}">${f.urgency} urgency</span>
        </div>
        <div style="font-size:12px;color:rgba(255,255,255,0.7);margin-bottom:6px">"${escHtml(post.content?.substring(0, 100) || '')}..."</div>
        <div style="font-size:11px;color:var(--gold)">\u2691 ${escHtml(f.reason)}</div>`;
      container.appendChild(el);
    });

    const flagBadge = document.getElementById('feed-flag-badge');
    if (flagBadge && flagged.length) {
      flagBadge.textContent = flagged.length;
      flagBadge.classList.remove('hidden');
    }
  } catch (err) {
    auditLog('warn', 'feed_moderation', { detail: String(err).substring(0, 200) });
  }
}

// 6. Weekly Pastoral Report (uses Sonnet)
async function generatePastoralReport() {
  const container = document.getElementById('pastoral-report-container');
  if (!container || !db) return;
  container.innerHTML = '<div class="ai-status thinking">\u2726 Compiling your weekly pastoral report...</div>';

  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const [cards, prayers, posts] = await Promise.all([
      db.from('connect_cards').select('*').gte('created_at', since),
      db.from('prayer_requests').select('*').gte('created_at', since),
      db.from('feed_posts').select('*').gte('created_at', since).is('deleted_at', null),
    ]);

    const newVisitors = cards.data?.length || 0;
    const prayerCount = prayers.data?.length || 0;
    const feedPosts = posts.data?.length || 0;

    const report = await claudeCall(
      `Write a brief, warm weekly pastoral report for Pastor Shan E. Davis of Dominion City Church.
       This week's data:
       - Connect cards received: ${newVisitors}
       - Prayer requests: ${prayerCount}
       - Community feed posts: ${feedPosts}
       Write 3-4 short paragraphs. Under 300 words.`,
      'pastoral', null, true
    );

    container.innerHTML = `
      <div style="background:rgba(201,149,42,0.06);border:1px solid rgba(201,149,42,0.2);border-radius:var(--radius-sm);padding:16px">
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:16px">
          <div style="text-align:center;padding:12px 8px;background:rgba(255,255,255,0.04);border-radius:8px">
            <div style="font-size:24px;font-weight:700;color:var(--gold-light)">${newVisitors}</div>
            <div style="font-size:10px;color:var(--text-muted);letter-spacing:1px">CONNECT CARDS</div>
          </div>
          <div style="text-align:center;padding:12px 8px;background:rgba(255,255,255,0.04);border-radius:8px">
            <div style="font-size:24px;font-weight:700;color:var(--gold-light)">${prayerCount}</div>
            <div style="font-size:10px;color:var(--text-muted);letter-spacing:1px">PRAYER REQUESTS</div>
          </div>
          <div style="text-align:center;padding:12px 8px;background:rgba(255,255,255,0.04);border-radius:8px">
            <div style="font-size:24px;font-weight:700;color:var(--gold-light)">${feedPosts}</div>
            <div style="font-size:10px;color:var(--text-muted);letter-spacing:1px">FEED POSTS</div>
          </div>
        </div>
        <div style="font-size:14px;line-height:1.8;color:rgba(255,255,255,0.85)">${report.replace(/\n\n/g, '<br><br>')}</div>
      </div>`;
  } catch (err) {
    container.innerHTML = '<div class="ai-status error">Error generating report.</div>';
    auditLog('warn', 'pastoral_report', { detail: String(err).substring(0, 200) });
  }
}

// 7. Sermon Topic Suggester (uses Sonnet)
async function generateSermonTopics() {
  const container = document.getElementById('sermon-topics-container');
  if (!container || !db) return;
  container.innerHTML = '<div class="ai-status thinking">\u2726 Reading the congregation\'s heart...</div>';

  try {
    const { data: prayers } = await db
      .from('prayer_requests')
      .select('content, request_type')
      .eq('request_type', 'public')
      .order('created_at', { ascending: false })
      .limit(30);

    const prayerThemes = prayers?.map((p) => p.content.substring(0, 100)).join(' | ') || 'No recent prayers';

    const topics = await claudeCall(
      `Analyze the spiritual pulse of the congregation based on their prayer requests.
       Recent prayer themes: ${prayerThemes}
       Suggest 4 sermon topic ideas that would directly minister to what this congregation is experiencing.
       Format as JSON: [{"title":"...","scripture":"...","description":"..."}]
       Return ONLY the JSON, no markdown, no preamble.`,
      'sermon_topics',
      'You are speaking privately to Pastor Shan E. Davis only.',
      true
    );

    let suggestions = [];
    try { suggestions = JSON.parse(topics.replace(/```json|```/g, '')); } catch { /* parse failed */ }

    container.innerHTML = '';
    if (!suggestions.length) {
      container.innerHTML = '<div class="ai-status">No topics generated. More congregation data needed.</div>';
      return;
    }

    suggestions.forEach((s) => {
      const el = document.createElement('div');
      el.className = 'sermon-topic-card';
      el.innerHTML = `
        <div style="margin-bottom:8px">
          <div style="font-family:var(--font-display);font-size:14px;color:var(--gold-light);margin-bottom:3px">${escHtml(s.title)}</div>
          <div style="font-size:12px;color:var(--gold);font-style:italic">${escHtml(s.scripture)}</div>
        </div>
        <div style="font-size:13px;line-height:1.6;color:rgba(255,255,255,0.8)">${escHtml(s.description)}</div>`;
      container.appendChild(el);
    });
  } catch (err) {
    container.innerHTML = '<div class="ai-status error">Error generating sermon topics.</div>';
    auditLog('warn', 'sermon_topics', { detail: String(err).substring(0, 200) });
  }
}

// Auto-run engine on app launch
async function runClaudeEngine() {
  const today = new Date();

  // QOTW — generate every Monday
  if (today.getDay() === 1 && db) {
    const weekStart = getMonday();
    const { data } = await db
      .from('weekly_questions')
      .select('id')
      .eq('week_start', weekStart)
      .limit(1);
    if (!data?.length) generateWeeklyQOTW();
  }

  // Scripture — generate if fewer than 7 days ahead
  if (db) {
    const future = new Date(today);
    future.setDate(future.getDate() + 7);
    const { data: upcoming } = await db
      .from('daily_scripture')
      .select('id')
      .gte('display_date', today.toISOString().split('T')[0])
      .lte('display_date', future.toISOString().split('T')[0]);
    if (!upcoming || upcoming.length < 5) generateDailyScripture();
  }

  // Feed moderation — run silently for leadership
  if (APP.member?.status === 'leadership' || APP.member?.is_admin) {
    moderateFeed();
  }
}

// Attach to window for HTML onclick handlers
window.generateWeeklyQOTW = generateWeeklyQOTW;
window.generateAnnouncementDrafts = generateAnnouncementDrafts;
window.approveAnnouncementDraft = approveAnnouncementDraft;
window.generateOutreachSuggestions = generateOutreachSuggestions;
window.generateDailyScripture = generateDailyScripture;
window.generatePastoralReport = generatePastoralReport;
window.generateSermonTopics = generateSermonTopics;
window.runClaudeEngine = runClaudeEngine;

export {
  DCC_GOVERNANCE,
  claudeCall,
  getChurchContext,
  generateWeeklyQOTW,
  generateAnnouncementDrafts,
  approveAnnouncementDraft,
  generateOutreachSuggestions,
  generateDailyScripture,
  moderateFeed,
  generatePastoralReport,
  generateSermonTopics,
  runClaudeEngine,
};
