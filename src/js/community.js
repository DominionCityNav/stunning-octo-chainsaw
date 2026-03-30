import db from './supabase.js';
import { APP } from './state.js';
import { auditLog } from './audit.js';
import { escHtml, timeAgo } from './utils.js';

// Module-level state
let communityPhotoFile = null;
let communityPostType = 'testimony';
let currentPostType = 'text';
let selectedPhotoFile = null;

function setCommunityType(type) {
  communityPostType = type;
  document.querySelectorAll('.community-type-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.type === type);
  });
}

function handleCommunityPhoto(input) {
  if (!input.files || !input.files[0]) return;
  communityPhotoFile = input.files[0];

  const preview = document.getElementById('community-photo-preview');
  if (preview) {
    const reader = new FileReader();
    reader.onload = (e) => {
      preview.innerHTML = `
        <img src="${e.target.result}" class="upload-preview-img">
        <button class="clear-photo-btn" onclick="clearCommunityPhoto()">Remove</button>`;
      preview.style.display = 'block';
    };
    reader.readAsDataURL(communityPhotoFile);
  }
}

function clearCommunityPhoto() {
  communityPhotoFile = null;
  const preview = document.getElementById('community-photo-preview');
  if (preview) {
    preview.innerHTML = '';
    preview.style.display = 'none';
  }
  const input = document.getElementById('community-photo-input');
  if (input) input.value = '';
}

async function uploadCommunityPhoto() {
  if (!communityPhotoFile || !db) return null;

  const ext = communityPhotoFile.name.split('.').pop();
  const path = `community/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  try {
    const { error } = await db.storage.from('photos').upload(path, communityPhotoFile);
    if (error) {
      auditLog('error', 'community_photo_upload_error', { message: error.message });
      return null;
    }

    const { data } = db.storage.from('photos').getPublicUrl(path);
    return data.publicUrl;
  } catch (err) {
    auditLog('error', 'community_photo_upload_error', { message: err.message });
    return null;
  }
}

async function submitCommunityPost() {
  if (!db || !APP.member) return;

  const input = document.getElementById('community-input');
  if (!input) return;

  const content = input.value.trim();
  if (!content) {
    alert('Please write something to share.');
    return;
  }

  let photoUrl = null;
  if (communityPhotoFile) {
    photoUrl = await uploadCommunityPhoto();
  }

  try {
    const { error } = await db.from('community_posts').insert({
      content,
      member_id: APP.member.id,
      member_name: APP.member.first_name + ' ' + APP.member.last_name,
      photo_url: APP.member.photo_url || null,
      image_url: photoUrl,
      type: communityPostType,
      likes: 0,
    });

    if (error) {
      auditLog('error', 'submit_community_post_error', { message: error.message });
      alert('Failed to post. Please try again.');
      return;
    }

    input.value = '';
    clearCommunityPhoto();
    auditLog('info', 'community_post_submitted', { type: communityPostType });
    loadCommunityFeed();
  } catch (err) {
    auditLog('error', 'submit_community_post_error', { message: err.message });
  }
}

async function loadCommunityFeed() {
  if (!db) return;
  const container = document.getElementById('community-feed');
  if (!container) return;

  try {
    const { data, error } = await db
      .from('community_posts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);

    if (error || !data || data.length === 0) {
      container.innerHTML = '<div class="empty-state">No posts yet. Share something with the community!</div>';
      return;
    }

    container.innerHTML = data.map((post) => {
      const avatar = post.photo_url
        ? `<img src="${escHtml(post.photo_url)}" class="feed-avatar" alt="">`
        : `<div class="feed-avatar-placeholder">${escHtml(post.member_name || 'M').charAt(0)}</div>`;
      const isOwn = post.member_id === APP.member?.id;

      return `
        <div class="community-post" id="community-post-${post.id}">
          <div class="post-header">
            ${avatar}
            <div class="post-author">
              <span class="post-name">${escHtml(post.member_name)}</span>
              <span class="post-type-badge">${escHtml(post.type || 'post')}</span>
              <span class="post-time">${timeAgo(post.created_at)}</span>
            </div>
          </div>
          <div class="post-content">${escHtml(post.content)}</div>
          ${post.image_url ? `<img src="${escHtml(post.image_url)}" class="post-image" onclick="openPhotoFull('${escHtml(post.image_url)}')">` : ''}
          <div class="post-actions">
            <button class="like-btn" onclick="toggleLikeCommunity('${post.id}')">
              Like (${post.likes || 0})
            </button>
            ${!isOwn ? `<button class="report-btn" onclick="reportCommunityPost('${post.id}')">Report</button>` : ''}
          </div>
        </div>`;
    }).join('');
  } catch (err) {
    auditLog('error', 'load_community_feed_error', { message: err.message });
  }
}

async function toggleLikeCommunity(postId) {
  if (!db) return;

  try {
    const { data, error: fetchError } = await db
      .from('community_posts')
      .select('likes')
      .eq('id', postId)
      .single();

    if (fetchError || !data) return;

    const { error } = await db
      .from('community_posts')
      .update({ likes: (data.likes || 0) + 1 })
      .eq('id', postId);

    if (!error) loadCommunityFeed();
  } catch (err) {
    auditLog('error', 'toggle_like_community_error', { message: err.message });
  }
}

async function reportCommunityPost(postId) {
  if (!confirm('Report this post as inappropriate?')) return;
  if (!db || !APP.member) return;

  try {
    const { error } = await db.from('reports').insert({
      post_id: postId,
      reporter_id: APP.member.id,
      type: 'community_post',
    });

    if (!error) {
      alert('Post reported. Thank you for helping keep our community safe.');
      auditLog('info', 'community_post_reported', { post_id: postId });
    }
  } catch (err) {
    auditLog('error', 'report_community_post_error', { message: err.message });
  }
}

async function updateCommunityAvatar(input) {
  if (!db || !APP.member || !input.files || !input.files[0]) return;

  const file = input.files[0];
  const ext = file.name.split('.').pop();
  const path = `avatars/${APP.member.id}.${ext}`;

  try {
    const { error: uploadError } = await db.storage.from('photos').upload(path, file, { upsert: true });
    if (uploadError) {
      alert('Upload failed.');
      return;
    }

    const { data } = db.storage.from('photos').getPublicUrl(path);

    const { error: updateError } = await db
      .from('members')
      .update({ photo_url: data.publicUrl })
      .eq('id', APP.member.id);

    if (!updateError) {
      APP.member.photo_url = data.publicUrl;
      auditLog('info', 'avatar_updated');
    }
  } catch (err) {
    auditLog('error', 'update_avatar_error', { message: err.message });
  }
}

// Legacy feed functions (alias for backward compat)
function setPostType(type) {
  currentPostType = type;
  document.querySelectorAll('.post-type-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.type === type);
  });
}

function handlePhotoSelect(input) {
  if (!input.files || !input.files[0]) return;
  selectedPhotoFile = input.files[0];

  const preview = document.getElementById('photo-preview');
  if (preview) {
    const reader = new FileReader();
    reader.onload = (e) => {
      preview.innerHTML = `
        <img src="${e.target.result}" class="upload-preview-img">
        <button class="clear-photo-btn" onclick="clearPhotoUpload()">Remove</button>`;
      preview.style.display = 'block';
    };
    reader.readAsDataURL(selectedPhotoFile);
  }
}

function clearPhotoUpload() {
  selectedPhotoFile = null;
  const preview = document.getElementById('photo-preview');
  if (preview) {
    preview.innerHTML = '';
    preview.style.display = 'none';
  }
  const input = document.getElementById('post-photo-input');
  if (input) input.value = '';
}

async function uploadPhotoToStorage(file) {
  if (!file || !db) return null;

  const ext = file.name.split('.').pop();
  const path = `feed/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  try {
    const { error } = await db.storage.from('photos').upload(path, file);
    if (error) return null;

    const { data } = db.storage.from('photos').getPublicUrl(path);
    return data.publicUrl;
  } catch {
    return null;
  }
}

function getVideoEmbed(url) {
  if (!url) return '';

  // YouTube
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) {
    return `<iframe class="video-embed" src="https://www.youtube.com/embed/${ytMatch[1]}" frameborder="0" allowfullscreen></iframe>`;
  }

  // Facebook
  if (url.includes('facebook.com')) {
    return `<iframe class="video-embed" src="https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}" frameborder="0" allowfullscreen></iframe>`;
  }

  return `<a href="${escHtml(url)}" target="_blank" class="video-link">${escHtml(url)}</a>`;
}

function prependFeedPost(post) {
  const container = document.getElementById('feed-posts');
  if (!container) return;

  const name = escHtml(post.member_name || 'Member');
  const avatar = post.photo_url
    ? `<img src="${escHtml(post.photo_url)}" class="feed-avatar">`
    : `<div class="feed-avatar-placeholder">${name.charAt(0)}</div>`;

  const html = `
    <div class="feed-post" id="feed-post-${post.id}">
      <div class="post-header">
        ${avatar}
        <div class="post-author">
          <span class="post-name">${name}</span>
          <span class="post-time">Just now</span>
        </div>
      </div>
      <div class="post-content">${escHtml(post.content)}</div>
      ${post.image_url ? `<img src="${escHtml(post.image_url)}" class="post-image">` : ''}
      ${post.video_url ? getVideoEmbed(post.video_url) : ''}
      <div class="post-actions">
        <button class="like-btn" onclick="toggleLike('${post.id}')">Like (0)</button>
        <button class="report-btn" onclick="reportPost('${post.id}')">Report</button>
      </div>
    </div>`;

  container.insertAdjacentHTML('afterbegin', html);
}

async function toggleLike(postId) {
  if (!db) return;

  try {
    const { data, error: fetchError } = await db
      .from('feed_posts')
      .select('likes')
      .eq('id', postId)
      .single();

    if (fetchError || !data) return;

    const { error } = await db
      .from('feed_posts')
      .update({ likes: (data.likes || 0) + 1 })
      .eq('id', postId);

    if (!error) loadFeedPosts();
  } catch (err) {
    auditLog('error', 'toggle_like_error', { message: err.message });
  }
}

async function reportPost(postId) {
  if (!confirm('Report this post as inappropriate?')) return;
  if (!db || !APP.member) return;

  try {
    const { error } = await db.from('reports').insert({
      post_id: postId,
      reporter_id: APP.member.id,
      type: 'feed_post',
    });

    if (!error) {
      alert('Post reported. Thank you.');
      auditLog('info', 'feed_post_reported', { post_id: postId });
    }
  } catch (err) {
    auditLog('error', 'report_post_error', { message: err.message });
  }
}

async function loadFeedPosts() {
  if (!db) return;
  const container = document.getElementById('feed-posts');
  if (!container) return;

  try {
    const { data, error } = await db
      .from('feed_posts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);

    if (error || !data || data.length === 0) {
      container.innerHTML = '<div class="empty-state">No posts yet.</div>';
      return;
    }

    container.innerHTML = data.map((post) => {
      const name = escHtml(post.member_name || 'Member');
      const avatar = post.photo_url
        ? `<img src="${escHtml(post.photo_url)}" class="feed-avatar">`
        : `<div class="feed-avatar-placeholder">${name.charAt(0)}</div>`;
      const isOwn = post.member_id === APP.member?.id;

      return `
        <div class="feed-post" id="feed-post-${post.id}">
          <div class="post-header">
            ${avatar}
            <div class="post-author">
              <span class="post-name">${name}</span>
              <span class="post-time">${timeAgo(post.created_at)}</span>
            </div>
          </div>
          <div class="post-content">${escHtml(post.content)}</div>
          ${post.image_url ? `<img src="${escHtml(post.image_url)}" class="post-image" onclick="openPhotoFull('${escHtml(post.image_url)}')">` : ''}
          ${post.video_url ? getVideoEmbed(post.video_url) : ''}
          <div class="post-actions">
            <button class="like-btn" onclick="toggleLike('${post.id}')">Like (${post.likes || 0})</button>
            ${!isOwn ? `<button class="report-btn" onclick="reportPost('${post.id}')">Report</button>` : ''}
          </div>
        </div>`;
    }).join('');
  } catch (err) {
    auditLog('error', 'load_feed_posts_error', { message: err.message });
  }
}

function setComposeType(type) {
  APP.composeType = type;
  document.querySelectorAll('.compose-type-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.type === type);
  });

  const photoSection = document.getElementById('compose-photo-section');
  const videoSection = document.getElementById('compose-video-section');
  const textSection = document.getElementById('compose-text-section');

  if (photoSection) photoSection.style.display = type === 'photo' ? 'block' : 'none';
  if (videoSection) videoSection.style.display = type === 'video' ? 'block' : 'none';
  if (textSection) textSection.style.display = type === 'text' ? 'block' : 'none';
}

function handleMediaUpload(input) {
  handlePhotoSelect(input);
}

async function submitPost() {
  if (!db || !APP.member) return;

  const contentInput = document.getElementById('post-content');
  if (!contentInput) return;

  const content = contentInput.value.trim();
  if (!content && !selectedPhotoFile) {
    alert('Please write something or select a photo.');
    return;
  }

  let imageUrl = null;
  if (selectedPhotoFile) {
    imageUrl = await uploadPhotoToStorage(selectedPhotoFile);
  }

  let videoUrl = null;
  const videoInput = document.getElementById('post-video-url');
  if (videoInput && videoInput.value.trim()) {
    videoUrl = videoInput.value.trim();
  }

  try {
    const postData = {
      content,
      member_id: APP.member.id,
      member_name: APP.member.first_name + ' ' + APP.member.last_name,
      photo_url: APP.member.photo_url || null,
      image_url: imageUrl,
      video_url: videoUrl,
      type: currentPostType,
      likes: 0,
    };

    const { data, error } = await db
      .from('feed_posts')
      .insert(postData)
      .select()
      .single();

    if (error) {
      alert('Failed to post. Please try again.');
      auditLog('error', 'submit_post_error', { message: error.message });
      return;
    }

    contentInput.value = '';
    if (videoInput) videoInput.value = '';
    clearPhotoUpload();

    if (data) prependFeedPost(data);
    auditLog('info', 'feed_post_submitted', { type: currentPostType });
  } catch (err) {
    auditLog('error', 'submit_post_error', { message: err.message });
  }
}

// Attach to window for HTML onclick handlers
window.setCommunityType = setCommunityType;
window.handleCommunityPhoto = handleCommunityPhoto;
window.clearCommunityPhoto = clearCommunityPhoto;
window.submitCommunityPost = submitCommunityPost;
window.loadCommunityFeed = loadCommunityFeed;
window.toggleLikeCommunity = toggleLikeCommunity;
window.reportCommunityPost = reportCommunityPost;
window.updateCommunityAvatar = updateCommunityAvatar;
window.setPostType = setPostType;
window.handlePhotoSelect = handlePhotoSelect;
window.clearPhotoUpload = clearPhotoUpload;
window.getVideoEmbed = getVideoEmbed;
window.prependFeedPost = prependFeedPost;
window.toggleLike = toggleLike;
window.reportPost = reportPost;
window.loadFeedPosts = loadFeedPosts;
window.setComposeType = setComposeType;
window.handleMediaUpload = handleMediaUpload;
window.submitPost = submitPost;

export {
  setCommunityType,
  handleCommunityPhoto,
  clearCommunityPhoto,
  uploadCommunityPhoto,
  submitCommunityPost,
  loadCommunityFeed,
  toggleLikeCommunity,
  reportCommunityPost,
  updateCommunityAvatar,
  setPostType,
  handlePhotoSelect,
  clearPhotoUpload,
  uploadPhotoToStorage,
  getVideoEmbed,
  prependFeedPost,
  toggleLike,
  reportPost,
  loadFeedPosts,
  setComposeType,
  handleMediaUpload,
  submitPost,
};
