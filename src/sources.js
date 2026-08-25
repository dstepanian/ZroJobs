// staff.am category ids (mapped by probing ?category=<id> pages):
// 1 software-development, 2 quality-assurance, 3 web-design,
// 4 product/project-management, 5 hardware-design, 6 other-it,
// 10 marketing.
// Marketing is a single category here but not a small one: it carries roughly
// as many open listings as software-development and other-it combined, which is
// why the digest caps how many of them one run may post.
export const STAFFAM_CATEGORIES = [1, 2, 3, 4, 5, 6, 10];

// job.am industry ids:
// 17 information technologies/programming, 32 product/project management,
// 2 marketing/advertising/PR, 21 copywriting/content writing/mass media.
export const JOBAM_INDUSTRIES = [17, 32, 2, 21];

// LinkedIn public guest search queries. Keep this list focused; each query hits
// the unauthenticated jobs search page and LinkedIn can throttle noisy clients.
export const LINKEDIN_QUERIES = [
  'software developer',
  'qa engineer',
  'devops engineer',
  'data engineer',
  'product manager',
  'ui ux designer',
  'marketing manager',
  'smm specialist',
];

// Public Telegram channels scraped via their t.me/s/<name> preview pages.
// Mixed-content channels are fine — the Gemini curation step drops the posts
// that belong to neither field.
export const TELEGRAM_CHANNELS = [
  'jobs_inarmenia',
];
