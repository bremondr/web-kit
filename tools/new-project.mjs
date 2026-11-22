#!/usr/bin/env node
/* Starts a new project: a folder with web-kit's starter template (template/) and the consumer files projects copy
   (consumer/), so it has previews, vendored modules and its checks from the first commit. The template keeps no
   copies of the consumer files: they are taken from consumer/ here, so they never drift apart.
   Plain Node 18+, no packages. From a clone of web-kit:

     node tools/new-project.mjs <folder> --repo <owner>/<name> [--title "The App's Name"]

   The folder must not exist yet, or be empty. {{TITLE}}, {{REPO}}, {{OWNER}}, {{NAME}} and {{PAGES_URL}} in the
   template's files are filled in. See docs/new-project.md for the rest (the repository, Pages, the token). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Where each consumer file goes in a project. */
export const CONSUMER_FILES = {
  'consumer/update-vendor.mjs': 'tools/update-vendor.mjs',
  'consumer/update-vendor.yml': '.github/workflows/update-vendor.yml',
  'consumer/build-site.mjs': 'tools/build-site.mjs',
  'consumer/preview-runtime.js': 'tools/preview-runtime.js',
  'consumer/pages.yml': '.github/workflows/pages.yml'
};

const TEXT = /\.(?:html|css|js|mjs|md|json|yml|txt|webmanifest)$/i;

/** The values for the template's placeholders. */
export function placeholders(repo, title) {
  const m = /^([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+)$/.exec(repo || '');
  if (!m) throw new Error('Give the repository as --repo owner/name.');
  const [, owner, name] = m;
  const pagesUrl = name.toLowerCase() === `${owner.toLowerCase()}.github.io`
    ? `https://${owner.toLowerCase()}.github.io/`
    : `https://${owner.toLowerCase()}.github.io/${name}/`;
  return {TITLE: title || name, REPO: `${owner}/${name}`, OWNER: owner, NAME: name, PAGES_URL: pagesUrl};
}

export const fill = (text, values) => text.replace(/\{\{([A-Z_]+)\}\}/g, (whole, key) => key in values ? values[key] : whole);

function filesIn(dir, base = dir) {
  return fs.readdirSync(dir, {withFileTypes: true}).flatMap(e => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? filesIn(p, base) : [path.relative(base, p).split(path.sep).join('/')];
  });
}

/** Writes a new project into `target`; returns the files written, relative to it. */
export function assemble({ target, repo, title, source = ROOT }) {
  const values = placeholders(repo, title);
  if (fs.existsSync(target) && fs.readdirSync(target).length) throw new Error(`${target} isn't empty.`);
  const written = [];
  const write = (file, data) => {
    const to = path.join(target, file);
    fs.mkdirSync(path.dirname(to), {recursive: true});
    fs.writeFileSync(to, data);
    written.push(file);
  };
  const templateDir = path.join(source, 'template');
  for (const file of filesIn(templateDir)) {
    const data = fs.readFileSync(path.join(templateDir, file));
    write(file, TEXT.test(file) ? fill(data.toString('utf8'), values) : data);
  }
  for (const [from, to] of Object.entries(CONSUMER_FILES)) write(to, fs.readFileSync(path.join(source, from)));
  return written.sort();
}

function cli(argv) {
  let target = null, repo = null, title = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--repo') repo = argv[++i];
    else if (argv[i] === '--title') title = argv[++i];
    else if (argv[i].startsWith('--')) throw new Error(`Unknown option ${argv[i]}`);
    else target = argv[i];
  }
  if (!target) throw new Error('Usage: node tools/new-project.mjs <folder> --repo <owner>/<name> [--title "The App\'s Name"]');
  const files = assemble({target: path.resolve(target), repo, title});
  const values = placeholders(repo, title);
  console.log(`Wrote ${files.length} files to ${target}:\n  ${files.join('\n  ')}`);
  console.log(`\nNext (docs/new-project.md in web-kit):
  cd ${target}
  git init -b main && git add -A && git commit -m "Start from web-kit's template"
  gh repo create ${values.REPO} --public --source . --push
  gh api repos/${values.REPO}/pages -X POST -f build_type=workflow
Then add the VENDOR_PR_TOKEN secret and the feedback label. The site will be at ${values.PAGES_URL}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { cli(process.argv.slice(2)); } catch (error) { console.error(error.message); process.exit(1); }
}
