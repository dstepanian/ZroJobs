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

export const tagForRole = (title = '', category = '') => {
  const value = `${title}\n${category}`;
  if (/devops|site reliability|\bsre\b|infrastructure|cloud/i.test(value)) return 'devops';
  if (/\bqa\b|quality assurance|test automation|test engineer/i.test(value)) return 'qa';
  if (/designer|design lead|\bux\b|\bui\b/i.test(value)) return 'design';
  if (/product manager|product owner|scrum/i.test(value)) return 'product';
  if (/data|machine learning|\bai\b|analytics/i.test(value)) return 'data';
  return 'dev';
};
