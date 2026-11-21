#!/usr/bin/env node
/* The release notes for a tag, from the module's CHANGELOG.md, written to standard output:
     node tools/release-notes.mjs feedback-kit-v1.2.0
   Fails when the tag isn't <module>-v<major>.<minor>.<patch>, the module has no folder, or its changelog has no
   section for that version, so a release can't go out without its notes. Used by .github/workflows/release.yml. */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { changesBetween, parseTag } from '../consumer/update-vendor.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tag = process.argv[2] || '';
const t = parseTag(tag);
const fail = msg => { console.error(msg); process.exit(1); };
if (!t) fail(`${tag || '(no tag)'} is not a release tag like feedback-kit-v1.2.0.`);
const changelog = join(root, t.module, 'CHANGELOG.md');
if (!existsSync(changelog)) fail(`${t.module}/CHANGELOG.md does not exist.`);
const notes = changesBetween(readFileSync(changelog, 'utf8'), null, t.version).split(/\n(?=## )/)[0];
if (!notes.startsWith(`## ${t.version}`)) fail(`${t.module}/CHANGELOG.md has no section "## ${t.version}".`);
console.log(notes.replace(/^## .*\n+/, '').trim());
console.log(`\nTake it into a project with \`node tools/update-vendor.mjs ${t.module}@${t.version}\` (see the README).`);
