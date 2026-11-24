#!/usr/bin/env node
/* Checks that every module stands on its own: each top-level folder with JavaScript in it (other than tools/, consumer/, template/ and
   demo/) imports only from inside itself, with relative paths, and has a README.md and a CHANGELOG.md.
   Projects copy one module folder, so anything outside it wouldn't be there.
   Plain Node, no packages:  node tools/check-modules.mjs   (exit code 1 when something is wrong)
   moduleFolders() is also what tools/releases-due.mjs uses to find the modules. */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const NOT_MODULES = new Set(['tools', 'consumer', 'demo', 'template', 'node_modules']);

function files(dir){
  return readdirSync(dir).flatMap(f => { const p = join(dir, f); return statSync(p).isDirectory() ? files(p) : [p]; });
}

// the modules: each top-level folder with JavaScript in it, other than tools/, consumer/, demo/ and template/
export function moduleFolders(root = ROOT){
  return readdirSync(root).sort().filter(name => {
    const dir = join(root, name);
    if (name.startsWith('.') || NOT_MODULES.has(name) || !statSync(dir).isDirectory()) return false;
    return files(dir).some(f => /\.m?js$/.test(f));
  });
}

function check(root){
  const problems = [], modules = moduleFolders(root);
  for (const name of modules){
    const dir = join(root, name);
    const scripts = files(dir).filter(f => /\.m?js$/.test(f));
    for (const doc of ['README.md', 'CHANGELOG.md']) if (!existsSync(join(dir, doc))) problems.push(`${name} has no ${doc}`);
    for (const f of scripts){
      const src = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      const deps = [...src.matchAll(/^\s*import\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/gm), ...src.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)].map(m => m[1]);
      for (const d of deps){
        const where = relative(root, f).split(sep).join('/');
        if (d.startsWith('node:') && /\.test\.m?js$/.test(f)) continue;   // tests run in Node
        if (!d.startsWith('.')) { problems.push(`${where} imports ${d}: only relative imports inside the module`); continue; }
        const target = resolve(dirname(f), d);
        if (!target.startsWith(dir + sep)) problems.push(`${where} imports ${d}, which is outside ${name}/`);
        else if (!existsSync(target)) problems.push(`${where} imports ${d}, which does not exist`);
      }
    }
  }

  console.log(`${modules.length} module(s): ${modules.join(', ') || 'none'}.`);
  if (problems.length){ problems.forEach(p => console.log('PROBLEM ' + p)); process.exit(1); }
  console.log('Every module imports only from itself and has a README and a changelog.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) check(ROOT);
