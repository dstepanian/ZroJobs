import { STAFFAM_CATEGORIES } from '../sources.js';

// staff.am has no RSS, but it's a Next.js app: the listing page embeds the full
// job list as JSON in the __NEXT_DATA__ script tag, so we parse that instead of
// the (heavily inlined-style) HTML. One request with repeated ?category= params
// covers every tech category at once.
const LISTING_URL = 'https://staff.am/en/jobs?' +
  STAFFAM_CATEGORIES.map((id) => `category=${id}`).join('&');

const UA = 'Mozilla/5.0 (compatible; zrojobs/1.0; +https://t.me/zrojobs)';

export const fetchStaffAm = async () => {
  const res = await fetch(LISTING_URL, {
    headers: { 'user-agent': UA },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`staff.am ${res.status}`);
  const html = await res.text();

  const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s);
  if (!m) throw new Error('staff.am: __NEXT_DATA__ not found (page layout changed?)');

  const jobs = JSON.parse(m[1])?.props?.pageProps?.jobs || [];
  return jobs
    // The list interleaves ads/injected items that have no category or slug.
    .filter((j) => j?.id && j?.category?.code && j?.slug?.en)
    .map((j) => ({
      id: `staffam:${j.id}`,
      title: (j.title?.en || j.title?.am_en || '').trim(),
      company: (j.companiesStruct?.title?.en || '').trim(),
      location: (j.job_city?.title?.en || '').trim(),
      remote: !!j.is_remote,
      url: `https://staff.am/en/jobs/${j.category.code}/${j.slug.en}`,
      source: 'staff.am',
      // "2026-07-01 20:56:49" — precision beyond the day doesn't matter here.
      postedAt: Date.parse(j.activated_at?.staffam || '') || Date.now(),
      category: j.category.code,
    }))
    .filter((j) => j.title);
};
