// Shared eligibility rules for remote boards. A listing must explicitly be
// global/remote or cover a region that includes Armenia; country-locked roles
// are intentionally excluded before they reach Gemini.
const BROAD_SCOPE = /worldwide|anywhere|global|\bremote\b|europe|emea|asia|middle east|africa|armenia|all locations|multiple locations/i;
const NARROW_SCOPE = /united states|\busa\b|canada|australia|new zealand|latin america|north america|united kingdom|\buk\b/i;

const TECH_ROLE = /developer|engineer|architect|devops|site reliability|\bsre\b|\bqa\b|quality assurance|test automation|product manager|product owner|designer|design lead|\bux\b|\bui\b|data|machine learning|\bai\b|security|software|technical|technology|\bcto\b|head of engineering|engineering manager|scrum|web3|blockchain|smart contract/i;

export const isArmeniaAccessible = (scope = '') => {
  const value = String(scope).trim();
  if (NARROW_SCOPE.test(value)) return false;
  return !value || BROAD_SCOPE.test(value);
};

export const isTechnicalRole = (title = '', category = '') =>
  TECH_ROLE.test(`${title}\n${category}`);

// Sales is not marketing, and the two arrive mixed: We Work Remotely files both
// under one "Sales and Marketing" category, and the Armenian boards' marketing
// sections carry account-management roles as well. This channel does not post
// sales, so a sales title is rejected before anything else looks at it.
//
// Matched against the TITLE only, deliberately. A category naming both fields
// would otherwise reject every marketing job in the feed alongside the sales.
const SALES_ROLE = /account executive|account manager|\bsales\b|business development|\bbdr\b|\bsdr\b|վաճառք/i;

export const isSalesRole = (title = '') => SALES_ROLE.test(title);

// Marketing roles, for the boards that now carry them too. Matched on explicit
// marketing vocabulary rather than on soft words like "content" or
// "communications" alone, so a "Content Designer" stays a design job.
const MARKETING_ROLE = /marketing|\bseo\b|\bsem\b|\bppc\b|\bsmm\b|social media|copywriter|copywriting|content writer|content manager|content creator|content strategist|brand manager|brand strategist|\bpr\b|public relations|advertis|media buyer|community manager|\bcmo\b|growth manager|growth lead|մարքեթինգ|գովազդ/i;

export const isMarketingRole = (title = '', category = '') =>
  !isSalesRole(title) && MARKETING_ROLE.test(`${title}\n${category}`);

// AI roles used to fall into 'data' and disappear inside it. They are the most
// searched thing in this feed and the natural bridge to the sibling AI channel,
// so they get a tag of their own. Tested first on purpose: an "AI Infrastructure
// Engineer" is an AI job before it is an infra job.
const AI_ROLE = /machine learning|\bml\b|\bmlops\b|artificial intelligence|\bai\b|\bllm\b|deep learning|\bnlp\b|computer vision|generative|prompt engineer/i;

// Which marketing role, once MARKETING_ROLE has established that it is one.
// Ordered from the most specific vocabulary to the least, so "Digital Marketing
// Specialist" lands on performance rather than falling through to the bucket.
const marketingTag = (value) => {
  if (/\bseo\b|\bsem\b|\bppc\b|performance marketing|digital marketing|media buyer|paid (?:ads|media|social)|advertis|growth/i.test(value)) return 'performance';
  if (/\bsmm\b|social media|community manager/i.test(value)) return 'smm';
  if (/copywriter|copywriting|content/i.test(value)) return 'content';
  if (/\bpr\b|public relations|communications|media relations/i.test(value)) return 'pr';
  if (/brand/i.test(value)) return 'brand';
  return 'other-marketing';
};

const techTag = (value) => {
  if (AI_ROLE.test(value)) return 'ai';
  if (/devops|site reliability|\bsre\b|infrastructure|cloud/i.test(value)) return 'devops';
  if (/\bqa\b|quality assurance|test automation|test engineer/i.test(value)) return 'qa';
  if (/designer|\bdesign\b|\bux\b|\bui\b/i.test(value)) return 'design';
  if (/product manager|product owner|product management|project management|scrum/i.test(value)) return 'product';
  // Analytics, BI and data engineering. The modelling roles already left as 'ai'.
  if (/data|analytics/i.test(value)) return 'data';
  if (/developer|engineer|programmer|software development/i.test(value)) return 'dev';
  return '';
};

// The role match on its own, returning '' when nothing honestly fits. Callers
// with no guarantee the posting belongs to either field need to be able to say
// "unknown" rather than be handed a confident 'dev'.
//
// Title evidence outranks category evidence, because some categories name two
// fields at once. We Work Remotely files everything under "Sales and Marketing",
// which is not evidence of marketing any more than it is evidence of sales: read
// naively it turns every engineer in that feed into a marketer. So a title that
// names a field wins outright, the tech ladder gets the next say, and the
// category is consulted only when the title said nothing either way.
export const roleTag = (title = '', category = '') => {
  // staff.am and job.am write their categories as slugs ("quality-assurance",
  // "web-design"), so separators are flattened before matching.
  const flat = (s) => s.replace(/[-_/]+/g, ' ');
  const titleOnly = flat(title);
  const value = flat(`${title}\n${category}`);

  // Sales reaches this from the mixed feeds and belongs to neither field, so it
  // gets no tag at all and the caller drops it.
  if (isSalesRole(title)) return '';
  // Marketing is checked before the tech ladder because the overlaps belong to
  // it: a "Product Marketing Manager" is marketing, not product, and a
  // "Marketing Data Analyst" is marketing, not data.
  if (MARKETING_ROLE.test(titleOnly)) return marketingTag(value);
  const tech = techTag(value);
  if (tech) return tech;
  if (MARKETING_ROLE.test(value)) return marketingTag(value);
  return '';
};

// The remote boards gate on isTechnicalRole before this runs, so a role that
// matched nothing above is still a tech job there: 'dev' stays their default.
export const tagForRole = (title = '', category = '') => roleTag(title, category) || 'dev';
