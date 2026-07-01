// staff.am tech/IT category ids (mapped by probing ?category=<id> pages):
// 1 software-development, 2 quality-assurance, 3 web-design,
// 4 product/project-management, 5 hardware-design, 6 other-it
export const STAFFAM_CATEGORIES = [1, 2, 3, 4, 5, 6];

// Public Telegram channels scraped via their t.me/s/<name> preview pages.
// Mixed-content channels are fine — the Gemini curation step drops non-tech posts.
export const TELEGRAM_CHANNELS = [
  'jobs_inarmenia',
];
