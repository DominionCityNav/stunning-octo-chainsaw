const APP = {
  pin: '',
  authed: false,
  member: null,
  currentRoom: null,
  currentRoomTab: 'chat',
  currentTab: 'visitors',
  prayerType: 'public',
  composeType: 'text',
  calYear: new Date().getFullYear(),
  calMonth: new Date().getMonth(),
  cal2Year: null,
  cal2Month: null,
  biometricEnabled: false,
  guestMode: false,
  activeOverlay: null,
  unreadCount: 0,
};

const ROOMS = {
  five_fold: { name: '5-Fold Ministers', icon: '\u{1F451}', sub: 'Pastors \u00B7 Apostles \u00B7 Prophets \u00B7 Evangelists' },
  pastors_aide: { name: "Pastor's Aide", icon: '\u{1F4CB}', sub: 'Administration & Support' },
  mens: { name: "Men's Ministry", icon: '\u2694\uFE0F', sub: 'Brotherhood & Accountability' },
  womens: { name: "Women's Ministry", icon: '\u{1F478}', sub: 'Sisterhood & Growth' },
  youth: { name: 'Youth Ministry', icon: '\u2728', sub: 'Boys & Girls \u00B7 Ages 6\u201318' },
  prayer: { name: 'Prayer Ministry', icon: '\u{1F64F}', sub: 'Intercession & Warfare' },
  musicians: { name: 'Musicians', icon: '\u{1F3B5}', sub: 'Worship Team' },
  deacons: { name: 'Deacons', icon: '\u{1F6E1}\uFE0F', sub: 'Service & Leadership' },
  finance: { name: 'Finance', icon: '\u{1F4B0}', sub: 'Stewardship Team' },
  media: { name: 'Media Ministry', icon: '\u{1F4F8}', sub: 'Content & Communications' },
};

export { APP, ROOMS };
