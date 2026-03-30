import CONFIG from '../config.js';
import db from './supabase.js';
import { ROOMS } from './state.js';
import { auditLog } from './audit.js';
import { getMonday } from './utils.js';
import { loadScripture } from './scripture.js';
import { loadQOTW } from './ministry.js';
import { loadAnnouncements } from './announcements.js';

const DCC_GOVERNANCE = {
  role: 'You are the AI assistant for ' + CONFIG.churchName + ', a ' + CONFIG.spiritualFlow + ' church.',
  pastor: CONFIG.pastor,
  mission: CONFIG.mission,
  vision: CONFIG.vision,
  coreValues: CONFIG.coreValues,
  rules: [
    'Always align with biblical truth and church doctrine.',
    'Never contradict the pastor or church leadership.',
    'Be encouraging, faith-building, and Scripture-based.',
    'Maintain confidentiality of member information.',
    'Do not engage in political or divisive topics.',
    'Always point people toward prayer and faith.',
  ],
};

const DCC_CACHE = {};

async function claudeCall(prompt, systemPrompt) {
  const system = systemPrompt || `${DCC_GOVERNANCE.role}\nMission: ${DCC_GOVERNANCE.mission}\nVision: ${DCC_GOVERNANCE.vision}\nRules: ${DCC_GOVERNANCE.rules.join('; ')}`;

  try {
    const res = await fetch(`${CONFIG.supabaseUrl}/functions/v1/dcc-claude`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CONFIG.supabaseKey}`,
      },
      body: JSON.stringify({ prompt, system }),
    });

    if (!res.ok) {
      auditLog('error', 'claude_call_failed', { status: res.status });
      return null;
    }

    const data = await res.json();
    return data.response || data.content || null;
  } catch (err) {
    auditLog('error', 'claude_call_error', { message: err.message });
    return null;
  }
}

async function getChurchContext() {
  if (DCC_CACHE.context && Date.now() - DCC_CACHE.contextTime < 3600000) {
    return DCC_CACHE.context;
  }

  const context = {
    churchName: CONFIG.churchName,
    pastor: CONFIG.pastor,
    rooms: Object.keys(ROOMS),
    memberCount: 0,
    recentEvents: [],
  };

  if (db) {
    try {
      const { count } = await db.from('members').select('*', { count: 'exact', head: true });
      context.memberCount = count || 0;

      const { data: events } = await db
        .from('events')
        .select('title, event_date')
        .gte('event_date', new Date().toISOString().split('T')[0])
        .order('event_date', { ascending: true })
        .limit(5);

      context.recentEvents = events || [];
    } catch {
      /* Silent */
    }
  }

  DCC_CACHE.context = context;
  DCC_CACHE.contextTime = Date.now();
  return context;
}

async function generateWeeklyQOTW() {
  const _context = await getChurchContext();
  const monday = getMonday();

  for (const roomKey of Object.keys(ROOMS)) {
    const room = ROOMS[roomKey];
    const prompt = `Generate a thought-provoking Question of the Week for the "${room.name}" ministry room at ${CONFIG.churchName}. The question should be relevant to their focus: ${room.sub}. Include a supporting Scripture reference. Return JSON: {"question": "...", "scripture": "..."}`;

    const response = await claudeCall(prompt);
    if (!response) continue;

    try {
      const parsed = JSON.parse(response);
      if (parsed.question && db) {
        await db.from('qotw').upsert({
          room: roomKey,
          week_of: monday,
          question: parsed.question,
          scripture: parsed.scripture || null,
        }, { onConflict: 'room,week_of' });
      }
    } catch {
      auditLog('warn', 'qotw_parse_error', { room: roomKey });
    }
  }

  auditLog('info', 'weekly_qotw_generated');
  loadQOTW();
}

async function generateAnnouncementDrafts() {
  const context = await getChurchContext();
  const prompt = `Based on the following church context, generate 3 announcement drafts for ${CONFIG.churchName}. Consider upcoming events: ${JSON.stringify(context.recentEvents)}. Return JSON array: [{"title": "...", "content": "..."}]`;

  const response = await claudeCall(prompt);
  if (!response) return;

  try {
    const drafts = JSON.parse(response);
    if (Array.isArray(drafts) && db) {
      for (const draft of drafts) {
        await db.from('announcements').insert({
          title: draft.title,
          content: draft.content,
          approved: false,
          ai_generated: true,
        });
      }
      auditLog('info', 'announcement_drafts_generated', { count: drafts.length });
    }
  } catch {
    auditLog('warn', 'announcement_drafts_parse_error');
  }
}

async function approveAnnouncement(announcementId) {
  if (!db) return;

  try {
    const { error } = await db
      .from('announcements')
      .update({ approved: true })
      .eq('id', announcementId);

    if (!error) {
      auditLog('info', 'announcement_approved', { id: announcementId });
      loadAnnouncements();
    }
  } catch (err) {
    auditLog('error', 'approve_announcement_error', { message: err.message });
  }
}

async function generateOutreachSuggestions() {
  const _context = await getChurchContext();
  const prompt = `Generate 5 community outreach suggestions for ${CONFIG.churchName} in ${CONFIG.city}, ${CONFIG.state} (${CONFIG.county}). Consider the church mission: ${CONFIG.mission}. Return JSON array: [{"title": "...", "description": "...", "impact": "..."}]`;

  const response = await claudeCall(prompt);
  if (!response) return [];

  try {
    return JSON.parse(response);
  } catch {
    auditLog('warn', 'outreach_suggestions_parse_error');
    return [];
  }
}

async function generateDailyScripture() {
  const today = new Date().toISOString().split('T')[0];
  const prompt = `Select an inspiring Bible verse for today (${today}) for ${CONFIG.churchName}, a ${CONFIG.spiritualFlow} church. Include a brief pastoral reflection. Return JSON: {"text": "...", "reference": "...", "reflection": "..."}`;

  const response = await claudeCall(prompt);
  if (!response) return;

  try {
    const parsed = JSON.parse(response);
    if (parsed.text && parsed.reference && db) {
      await db.from('daily_scripture').upsert({
        date: today,
        text: parsed.text,
        reference: parsed.reference,
        reflection: parsed.reflection || null,
      }, { onConflict: 'date' });

      auditLog('info', 'daily_scripture_generated');
      loadScripture();
    }
  } catch {
    auditLog('warn', 'daily_scripture_parse_error');
  }
}

async function moderateFeed() {
  if (!db) return;

  try {
    const { data: reports } = await db
      .from('reports')
      .select('*, community_posts(*), feed_posts(*)')
      .eq('reviewed', false)
      .limit(10);

    if (!reports || reports.length === 0) return;

    for (const report of reports) {
      const postContent = report.community_posts?.content || report.feed_posts?.content || '';
      const prompt = `Review this church community post for inappropriate content. Post: "${postContent}". Should this be removed? Return JSON: {"remove": true/false, "reason": "..."}`;

      const response = await claudeCall(prompt);
      if (!response) continue;

      try {
        const decision = JSON.parse(response);
        await db.from('reports').update({
          reviewed: true,
          ai_decision: decision.remove ? 'remove' : 'keep',
          ai_reason: decision.reason,
        }).eq('id', report.id);

        if (decision.remove) {
          if (report.community_posts) {
            await db.from('community_posts').delete().eq('id', report.post_id);
          } else if (report.feed_posts) {
            await db.from('feed_posts').delete().eq('id', report.post_id);
          }
          auditLog('info', 'post_moderated_removed', { post_id: report.post_id, reason: decision.reason });
        }
      } catch {
        /* Silent parse error */
      }
    }

    auditLog('info', 'feed_moderation_complete');
  } catch (err) {
    auditLog('error', 'moderate_feed_error', { message: err.message });
  }
}

async function generatePastoralReport() {
  const context = await getChurchContext();
  const prompt = `Generate a weekly pastoral report summary for ${CONFIG.pastor} at ${CONFIG.churchName}. Church stats: ${context.memberCount} members. Include sections: attendance trends, prayer request themes, ministry activity, and suggested action items. Return as formatted text.`;

  const response = await claudeCall(prompt);
  return response || 'Report generation unavailable.';
}

async function generateSermonTopics() {
  const prompt = `Suggest 5 sermon topics for ${CONFIG.pastor} at ${CONFIG.churchName}. The church is ${CONFIG.spiritualFlow} in nature with a mission to: ${CONFIG.mission}. Include relevant Scripture passages. Return JSON array: [{"topic": "...", "scripture": "...", "outline": "..."}]`;

  const response = await claudeCall(prompt);
  if (!response) return [];

  try {
    return JSON.parse(response);
  } catch {
    auditLog('warn', 'sermon_topics_parse_error');
    return [];
  }
}

async function runClaudeEngine() {
  auditLog('info', 'claude_engine_started');

  try {
    await generateDailyScripture();

    // Weekly tasks (Monday)
    const today = new Date();
    if (today.getDay() === 1) {
      await generateWeeklyQOTW();
      await generateAnnouncementDrafts();
    }

    // Daily moderation
    await moderateFeed();

    auditLog('info', 'claude_engine_complete');
  } catch (err) {
    auditLog('error', 'claude_engine_error', { message: err.message });
  }
}

// Attach to window for HTML onclick handlers
window.generateWeeklyQOTW = generateWeeklyQOTW;
window.generateAnnouncementDrafts = generateAnnouncementDrafts;
window.approveAnnouncement = approveAnnouncement;
window.generateOutreachSuggestions = generateOutreachSuggestions;
window.generateDailyScripture = generateDailyScripture;
window.generatePastoralReport = generatePastoralReport;
window.generateSermonTopics = generateSermonTopics;
window.runClaudeEngine = runClaudeEngine;

export {
  DCC_GOVERNANCE,
  DCC_CACHE,
  claudeCall,
  getChurchContext,
  generateWeeklyQOTW,
  generateAnnouncementDrafts,
  approveAnnouncement,
  generateOutreachSuggestions,
  generateDailyScripture,
  moderateFeed,
  generatePastoralReport,
  generateSermonTopics,
  runClaudeEngine,
};
