import config from './config.js';
import { loadCompanies, yerevanWeek, formatSpotlight } from './format.js';
import { postPhoto } from './post.js';

// Weekly "Employer of the week" spotlight. Runs on its own schedule, fully
// independent of the daily digest so neither can break the other.
const run = async () => {
  console.log(`[spotlight] starting${config.dry ? ' (dry run)' : ''}`);

  const companies = loadCompanies();
  if (!companies.length) {
    // No company queued (empty or all expired) is a normal outcome — skip quietly.
    console.log('[spotlight] no company queued — skipping post');
    return;
  }

  // Stateless rotation: this week's slot cycles through the queue by ISO week,
  // so no cursor file to commit and no race with the digest's git writes.
  const company = companies[yerevanWeek() % companies.length];
  const caption = formatSpotlight(company);
  console.log(`[spotlight] this week: ${company.name}`);

  if (config.dry) {
    if (config.print) {
      console.log('\n----- SPOTLIGHT PREVIEW -----\n');
      console.log(`[photo] ${company.logo || '(no logo set)'}`);
      console.log(caption.replace(/<\/?b>|<a [^>]*>|<\/a>/g, ''));
      console.log('\n-----------------------------\n');
    }
    console.log('[spotlight] dry run — not posting');
    return;
  }

  if (!company.logo) throw new Error(`company "${company.name}" has no logo`);
  const result = await postPhoto(company.logo, caption);
  console.log(`[spotlight] posted message ${result.message_id} to ${config.channel}`);
};

run()
  .then(() => process.exit(0)) // fetch keep-alive sockets would otherwise hang the process
  .catch((e) => {
    console.error('[spotlight] fatal:', e);
    process.exit(1);
  });
