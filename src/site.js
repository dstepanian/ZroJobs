import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import config from './config.js';
import { isLive, loadArchive } from './archive.js';
import {
  aboutPath, jobPath, renderAbout, renderIndex, renderJobPage, renderLlms,
  renderRobots, renderSitemap,
} from './render.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'site');

// Build the public site from the archive. Static HTML, no client-side anything —
// the whole point is that a crawler sees the vacancy without running JavaScript.
const run = () => {
  const jobs = loadArchive().filter((job) => isLive(job));

  // Publishing an empty site would deindex every page we have. If the archive
  // didn't survive, that's a state problem to fix, not a site to deploy.
  if (!jobs.length) {
    console.error('[site] archive is empty — refusing to build an empty site');
    process.exit(1);
  }

  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(path.join(OUT, 'jobs'), { recursive: true });
  fs.mkdirSync(path.join(OUT, 'about'), { recursive: true });

  for (const job of jobs) {
    fs.writeFileSync(path.join(OUT, jobPath(job)), renderJobPage(job));
  }
  fs.writeFileSync(path.join(OUT, 'index.html'), renderIndex(jobs));
  fs.writeFileSync(path.join(OUT, 'sitemap.xml'), renderSitemap(jobs));
  fs.writeFileSync(path.join(OUT, aboutPath), renderAbout());
  fs.writeFileSync(path.join(OUT, 'robots.txt'), renderRobots());
  // llmstxt.org: the plain-text description of the site, for a model reading it
  // directly instead of through a search index.
  fs.writeFileSync(path.join(OUT, 'llms.txt'), renderLlms(jobs));
  // A custom domain lives in the deployed artifact, not just in repo settings.
  // Skipped on a github.io host, where a CNAME file would break the deploy.
  if (config.siteHost && !config.siteHost.endsWith('github.io')) {
    fs.writeFileSync(path.join(OUT, 'CNAME'), `${config.siteHost}\n`);
  }

  // Published so the next build can recover the archive from the live site when
  // the Actions cache has been evicted.
  fs.copyFileSync(path.join(ROOT, 'jobs.json'), path.join(OUT, 'jobs.json'));

  console.log(`[site] built ${jobs.length} job page(s) into site/ for ${config.siteBaseUrl}`);
};

run();
