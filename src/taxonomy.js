// What the channel posts, as one registry.
//
// The channel was IT-only, so a job's "tag" was a flat enum that picked an
// emoji and nothing else. Now that it posts marketing too, a vacancy belongs to
// a FIELD (the umbrella: IT or marketing) and to a ROLE inside that field, and
// three separate decisions hang off the pair: the umbrella hashtag, whether the
// post opens with a field label, and which emoji palette the role draws from.
// Keeping all of it here means adding a third field later is one edit, not a
// hunt through the formatter, the curator and the scrapers.

export const FIELDS = {
  it: {
    key: 'it',
    hashtag: '#IT',
    // IT is the channel's original feed and still the bulk of it, so its posts
    // stay exactly as subscribers already know them: no label, nothing extra to
    // scroll past. Only the newcomer announces itself.
    labelEmoji: '',
    labelHy: '',
  },
  marketing: {
    key: 'marketing',
    hashtag: '#marketing',
    labelEmoji: '📣',
    labelHy: 'ՄԱՐՔԵԹԻՆԳ',
  },
};

// `hashtag: ''` means the role adds no tag of its own: the "other" buckets know
// nothing the field hashtag doesn't already say, and a second tag meaning the
// same thing only makes the line longer.
export const ROLES = {
  // IT: cool, tool-shaped emoji.
  dev: { field: 'it', emoji: '💻', hashtag: '#dev', hy: 'Ծրագրավորում' },
  qa: { field: 'it', emoji: '🧪', hashtag: '#QA', hy: 'Թեստավորում' },
  design: { field: 'it', emoji: '🎨', hashtag: '#design', hy: 'Դիզայն' },
  product: { field: 'it', emoji: '📦', hashtag: '#product', hy: 'Փրոդուկտ/նախագծերի կառավարում' },
  data: { field: 'it', emoji: '📊', hashtag: '#data', hy: 'Տվյալներ' },
  ai: { field: 'it', emoji: '🧠', hashtag: '#AI', hy: 'AI / մեքենայական ուսուցում' },
  devops: { field: 'it', emoji: '⚙️', hashtag: '#devops', hy: 'DevOps / ինֆրակառուցվածք' },
  'other-tech': { field: 'it', emoji: '🖥️', hashtag: '', hy: 'ՏՏ ոլորտ' },

  // Marketing: a warm palette, so the two fields separate at a glance even
  // before the label line is read. Deliberately no megaphone here, because the
  // field label already owns that shape.
  brand: { field: 'marketing', emoji: '🎯', hashtag: '#brand', hy: 'Բրենդ' },
  content: { field: 'marketing', emoji: '✍️', hashtag: '#content', hy: 'Կոնտենտ' },
  smm: { field: 'marketing', emoji: '📱', hashtag: '#SMM', hy: 'SMM / սոցցանցեր' },
  pr: { field: 'marketing', emoji: '🗞', hashtag: '#PR', hy: 'PR / հանրային կապեր' },
  performance: { field: 'marketing', emoji: '🚀', hashtag: '#performance', hy: 'Performance / գովազդ' },
  'other-marketing': { field: 'marketing', emoji: '🧡', hashtag: '', hy: 'Մարքեթինգ' },
};

export const TAGS = Object.keys(ROLES);

export const tagsOfField = (field) => TAGS.filter((tag) => ROLES[tag].field === field);

// An unknown or missing tag reads as IT: featured listings are hand-written and
// carry no tag, and they have always rendered as ordinary IT posts.
export const roleOf = (tag) => ROLES[tag] || ROLES['other-tech'];
export const fieldOf = (tag) => FIELDS[roleOf(tag).field];
export const isMarketing = (job) => roleOf(job?.tag).field === 'marketing';
