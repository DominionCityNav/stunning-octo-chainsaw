/**
 * White-label master config for Dominion City Church.
 * All app config lives here — identity, contact, giving, Supabase, brand, AI governance.
 * Nothing else needs to change when deploying to a new client.
 */
const CONFIG = {
  // Identity
  churchName: 'Dominion City Church',
  shortName: 'DCC',
  pastor: 'Pastor Shan E. Davis',
  pastorEmail: 'Psed@dominioncity.net',
  tagline: 'We put the DO in Dominion',
  foundingVerse: 'Jeremiah 31:3',
  youthMinistry: 'beYOUtiful Empowerment',
  spiritualFlow: 'Prophetic and Apostolic',

  // Location & Contact
  address: '625 Blackshear St, Navasota, TX 77868',
  city: 'Navasota',
  state: 'TX',
  zip: '77868',
  county: 'Grimes County',
  phone: '936-320-1852',
  email: 'info@dominioncity.net',
  mailingAddress: 'P.O. Box 183, Navasota, TX 77868',
  serviceTime: 'Sunday 9:00 AM',
  mapsUrl: 'https://maps.google.com/?q=625+Blackshear+St+Navasota+TX+77868',

  // Social
  facebook: 'https://www.facebook.com/DCCNAVASOTA',
  youtube: 'https://www.youtube.com/channel/UCdI8qjPlo-sI_hn_Pl3MaGg',
  website: 'https://www.dominioncity.net',
  churchPhoto: '/church-building.jpg',
  pastorPhoto: '/pastor-photo.jpg',

  // Giving
  giving: {
    square: 'https://checkout.square.site/merchant/MLM37VA9CDQG6/checkout/FXSTTO7TGCBG52XBCHWB4VMX?src=sms',
    zelle: 'admin@dominioncity.net',
    cashapp: '$DCCNAVASOTA',
  },

  // Supabase
  supabaseUrl: 'https://dmjdkowpskvrcjrxlcud.supabase.co',
  supabaseKey: 'sb_publishable_rflFSxTH9UorqyXPe6AVOA_r43hOw-D',

  // Brand colors (keep in sync with CSS variables)
  primaryColor: '#1a0a2e',
  accentColor: '#c9952a',

  // Service worker cache name — change per client so caches don't collide
  swCacheName: 'dcc-v2',

  // Mission (drives AI governance)
  mission: 'Pray for mankind, prepare believers for their purpose, and propel them forward',
  vision: 'Help people become everything God has ordained them to be',
  coreValues: 'Pursuing Godly Maturity, Praying for All Men, Serving the Community',
};

export default CONFIG;
