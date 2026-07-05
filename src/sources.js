// staff.am tech/IT category ids (mapped by probing ?category=<id> pages):
// 1 software-development, 2 quality-assurance, 3 web-design,
// 4 product/project-management, 5 hardware-design, 6 other-it
export const STAFFAM_CATEGORIES = [1, 2, 3, 4, 5, 6];

// job.am industry ids:
// 17 information technologies/programming, 32 product/project management.
export const JOBAM_INDUSTRIES = [17, 32];

// LinkedIn public guest search queries. Keep this list focused; each query hits
// the unauthenticated jobs search page and LinkedIn can throttle noisy clients.
export const LINKEDIN_QUERIES = [
  'software developer',
  'qa engineer',
  'devops engineer',
  'data engineer',
  'product manager',
  'ui ux designer',
];

// Public Telegram channels scraped via their t.me/s/<name> preview pages.
// Mixed-content channels are fine — the Gemini curation step drops non-tech posts.
export const TELEGRAM_CHANNELS = [
  'jobs_inarmenia',
];
