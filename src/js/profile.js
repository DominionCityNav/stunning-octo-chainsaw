import db from './supabase.js';
import { APP } from './state.js';
import { auditLog } from './audit.js';

function openMemberProfile() {
  const overlay = document.getElementById('overlay-profile');
  if (!overlay) return;

  overlay.classList.add('active');
  overlay.style.display = 'flex';
  APP.activeOverlay = 'profile';

  populateMemberProfile();
}

function closeMemberProfile() {
  const overlay = document.getElementById('overlay-profile');
  if (overlay) {
    overlay.classList.remove('active');
    overlay.style.display = 'none';
  }
  if (APP.activeOverlay === 'profile') {
    APP.activeOverlay = null;
  }
}

function populateMemberProfile() {
  if (!APP.member) return;

  const m = APP.member;

  const nameEl = document.getElementById('profile-name');
  if (nameEl) nameEl.textContent = m.first_name + ' ' + m.last_name;

  const emailEl = document.getElementById('profile-email');
  if (emailEl) emailEl.textContent = m.email || '';

  const phoneEl = document.getElementById('profile-phone');
  if (phoneEl) phoneEl.textContent = m.phone || '';

  const roleEl = document.getElementById('profile-role');
  if (roleEl) roleEl.textContent = m.role || 'Member';

  const photoEl = document.getElementById('profile-photo');
  if (photoEl && m.photo_url) {
    photoEl.src = m.photo_url;
    photoEl.style.display = 'block';
  }

  const ministriesEl = document.getElementById('profile-ministries');
  if (ministriesEl && m.ministries) {
    ministriesEl.textContent = Array.isArray(m.ministries) ? m.ministries.join(', ') : m.ministries;
  }

  // Populate edit form
  const fNameInput = document.getElementById('edit-first-name');
  if (fNameInput) fNameInput.value = m.first_name || '';

  const lNameInput = document.getElementById('edit-last-name');
  if (lNameInput) lNameInput.value = m.last_name || '';

  const emailInput = document.getElementById('edit-email');
  if (emailInput) emailInput.value = m.email || '';

  const phoneInput = document.getElementById('edit-phone');
  if (phoneInput) phoneInput.value = m.phone || '';
}

async function uploadProfilePhoto(input) {
  if (!db || !APP.member || !input.files || !input.files[0]) return;

  const file = input.files[0];
  const ext = file.name.split('.').pop();
  const path = `profiles/${APP.member.id}.${ext}`;

  try {
    const { error: uploadError } = await db.storage
      .from('photos')
      .upload(path, file, { upsert: true });

    if (uploadError) {
      alert('Photo upload failed. Please try again.');
      auditLog('error', 'profile_photo_upload_error', { message: uploadError.message });
      return;
    }

    const { data } = db.storage.from('photos').getPublicUrl(path);

    const { error: updateError } = await db
      .from('members')
      .update({ photo_url: data.publicUrl })
      .eq('id', APP.member.id);

    if (!updateError) {
      APP.member.photo_url = data.publicUrl;
      const photoEl = document.getElementById('profile-photo');
      if (photoEl) {
        photoEl.src = data.publicUrl;
        photoEl.style.display = 'block';
      }
      auditLog('info', 'profile_photo_updated');
    }
  } catch (err) {
    alert('Photo upload failed.');
    auditLog('error', 'profile_photo_upload_error', { message: err.message });
  }
}

async function saveProfileChanges() {
  if (!db || !APP.member) return;

  const firstName = document.getElementById('edit-first-name')?.value.trim();
  const lastName = document.getElementById('edit-last-name')?.value.trim();
  const email = document.getElementById('edit-email')?.value.trim();
  const phone = document.getElementById('edit-phone')?.value.trim();

  if (!firstName || !lastName) {
    alert('First and last name are required.');
    return;
  }

  try {
    const { error } = await db
      .from('members')
      .update({ first_name: firstName, last_name: lastName, email, phone })
      .eq('id', APP.member.id);

    if (error) {
      alert('Failed to save changes.');
      auditLog('error', 'save_profile_error', { message: error.message });
      return;
    }

    APP.member.first_name = firstName;
    APP.member.last_name = lastName;
    APP.member.email = email;
    APP.member.phone = phone;

    populateMemberProfile();
    alert('Profile updated!');
    auditLog('info', 'profile_updated');
  } catch (err) {
    alert('Failed to save changes.');
    auditLog('error', 'save_profile_error', { message: err.message });
  }
}

function openFamilyRegistration() {
  const overlay = document.getElementById('overlay-family');
  if (!overlay) return;

  overlay.classList.add('active');
  overlay.style.display = 'flex';
}

function closeFamilyRegistration() {
  const overlay = document.getElementById('overlay-family');
  if (overlay) {
    overlay.classList.remove('active');
    overlay.style.display = 'none';
  }
}

async function submitFamilyMember() {
  if (!db || !APP.member) return;

  const firstName = document.getElementById('family-first-name')?.value.trim();
  const lastName = document.getElementById('family-last-name')?.value.trim();
  const relationship = document.getElementById('family-relationship')?.value.trim();

  if (!firstName || !lastName) {
    alert('Please enter first and last name.');
    return;
  }

  try {
    const { error } = await db.from('family_members').insert({
      member_id: APP.member.id,
      first_name: firstName,
      last_name: lastName,
      relationship,
    });

    if (error) {
      alert('Failed to add family member.');
      auditLog('error', 'submit_family_error', { message: error.message });
      return;
    }

    alert('Family member added!');
    closeFamilyRegistration();

    // Clear form
    const fnInput = document.getElementById('family-first-name');
    const lnInput = document.getElementById('family-last-name');
    const relInput = document.getElementById('family-relationship');
    if (fnInput) fnInput.value = '';
    if (lnInput) lnInput.value = '';
    if (relInput) relInput.value = '';

    auditLog('info', 'family_member_added', { name: firstName + ' ' + lastName });
  } catch (err) {
    alert('Failed to add family member.');
    auditLog('error', 'submit_family_error', { message: err.message });
  }
}

// Attach to window for HTML onclick handlers
window.openMemberProfile = openMemberProfile;
window.closeMemberProfile = closeMemberProfile;
window.uploadProfilePhoto = uploadProfilePhoto;
window.saveProfileChanges = saveProfileChanges;
window.openFamilyRegistration = openFamilyRegistration;
window.closeFamilyRegistration = closeFamilyRegistration;
window.submitFamilyMember = submitFamilyMember;

export {
  openMemberProfile,
  closeMemberProfile,
  populateMemberProfile,
  uploadProfilePhoto,
  saveProfileChanges,
  openFamilyRegistration,
  closeFamilyRegistration,
  submitFamilyMember,
};
