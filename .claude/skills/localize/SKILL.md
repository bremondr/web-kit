---
name: localize
description: Translate a static web app or a web-kit module into another language (Czech first), the way feedback-kit 2.2.0 was done - a keyed strings module with the current language pinned as the default, a language option, tests that nothing is missing or left untranslated, overflow checks at iPad and phone sizes, and a review of every text by the owner on a claude.ai Artifact with OK / Reject / Edit. Use it whenever someone asks to translate, localize, internationalize (i18n) or "make it Czech", to add a language or a `language` option, to change translated wording, or to have the owner review translations, in web-kit, Ultimate Playbook, Protogames or any project started from web-kit's template, even when it is only a few texts.
---

# Localizing a static web app or module

How feedback-kit got its Czech texts (web-kit PR #38, issue #35), in general terms. The owner is a native Czech speaker and the final judge of every word: you prepare the texts, the structure and the checks so that the review is quick, and the owner decides the wording.

Work in the repository's usual way (its `CLAUDE.md`): an issue, one branch and one pull request, the checks, screenshots. In a project, translate the project's own texts there. A vendored web-kit module is translated in web-kit and released, and the project then passes its language to the module's `language` option; never edit a vendored copy.

## 1. Inventory: every text, shown or written

List every text a person can see or hear, and every text the code writes out. Grep the source for string literals, then go through it by hand; the easy ones to miss:

- `aria-label`, `title`, `alt`, `placeholder`, and labels of groups (`role="group"`) that only a screen reader says;
- status and error messages, including those that show only on failure or in one browser;
- text the code writes out: issue or e-mail bodies, headings and table rows in them, file names of saved files, clipboard text, `document.title`;
- values built from parts: units (`px`), orientation and theme words, decimal marks, dates, plurals;
- defaults of options that projects may already pass (a heading, a label): the default should follow the language, and a given value should still win.

Keep the inventory as the list of keys: one key per text, grouped by where it shows. Write down where each one shows; the review needs it.

## 2. Structure: one strings module, the old output unchanged

- **One file of texts** per module or app (`strings.js`): `STRINGS = {en: {...}, cs: {...}}`, keyed by short names (`openIssue`, `penRed`, `rowScreen`), with comments grouping them by where they show. No DOM, so Node tests can import it. In a web-kit module it lives in the module's folder and nothing imports from outside it.
- **The current language stays the default, byte for byte.** Copy today's texts into `en` exactly (curly apostrophes, ellipsis characters and all). Without the option, every page, file and issue must be exactly as before; that is what makes it a minor release.
- **Options:** `language` (`'en'` default, or `'cs'`) and `strings` (`{key: text}` merged over the chosen language, to change single texts or to give a whole other language, with English filling the gaps). One function picks them, for example `texts(language, strings)`, and it throws at once for an unknown language without `strings`, an unknown key, or a value that isn't text, so a typo fails when the app starts rather than showing a blank.
- **Templates, never concatenation.** A text with a value in it has named placeholders: `'Write the issue on {provider}'`, `'{pen} pen'`. One `format(template, values)` fills them and leaves unknown names as they are. Word order differs between languages, so the translator moves `{provider}`, never the code.
- **Words that change with grammar get their own keys per language.** A name put into a sentence may need a case (Czech: "na GitHubu" after "na"), and adjectives agree with nouns. Give such values their own entries (`provider.github`) rather than inserting a raw name, and rephrase when agreement gets awkward ("{pen} barva pera" instead of a gendered adjective). Plurals: one key per form (`items.one`, `items.few`, `items.many`, `items.other`) chosen with `Intl.PluralRules`; Czech has 1 / 2–4 / 5+.
- **Numbers and dates:** Czech uses a decimal comma and a no-break space between thousands. A `decimal` key, or `Intl.NumberFormat` with the language, both work; the English default must still match the old output exactly, so pin it in a test.
- **The page knows its language:** set `lang` on the root element of what you render (the panel, the page), so screen readers and hyphenation use the right language. Upper-case with `toLocaleUpperCase(language)`.
- **File names** stay plain ASCII without accents (`zpetna-vazba.png`).
- **Keep one word for one thing.** Agree on the main terms with the owner early (in feedback-kit, "snímek obrazovky" or "obrázek" for the picture), and make sure two controls never get the same name in one place (a group and a button inside it).

In the code, replace each literal with `t.key` or `format(t.key, {...})`. Functions that produce text take the texts as an argument with English as the default, so existing callers don't change.

## 3. Tests (plain Node, `node --test`)

See [tests.md](tests.md) for a skeleton. They should check:

1. **Every language has every key**, as non-empty text, with the same `{names}` as English.
2. **The default is pinned**: the old texts, and whole outputs (an issue URL, a file's content) string-equal to what the last release produced, both with no `language` and with `language: 'en'`.
3. **Nothing of the source language is left in a translated output**: build the full output in the new language with the app's own values also in that language, strip what is legitimately English (the user agent, URLs), then assert that no English text of the module and no English word from its texts (minus words both languages share, like `px` or `PNG`) remains.
4. **Grammar and examples**: the filled-in sentences for each provider, pen, plural form and number, as the owner approved them.
5. **`strings` overrides** single texts (also in written output), and another language code with `strings` falls back to English.
6. **Errors**: an unknown language, an unknown key, a non-text value and a malformed language code all throw with a clear message.

## 4. UI checks: a language switch and room for longer words

- **A language switch** in the demo page (web-kit: `demo/<module>.html`) or in the app's settings, so both languages can be tried on the iPad. In the demo, translate the demo's own texts too when the language changes, so the page reads as one language.
- **Extend the browser check** (web-kit: `tools/check-demo.mjs`; a project: its own Playwright check, if any). After switching: the root has `lang="cs"`; key texts read as approved; no English text or word anywhere in the rendered component, hidden elements, `aria-label`s and `title`s included; no button or paragraph is wider than its box (`scrollWidth > clientWidth`) or sticks out of its container. Run it at iPad (1180 × 820, 820 × 1180) and phone (390 × 844) sizes, light and dark. Czech runs 20–50 % longer than English, and buttons that sat side by side may need to wrap.
- **Screenshots** of the translated UI at those sizes (`--screenshots <dir>` in web-kit). Look at them yourself before the owner does: a cut-off or awkwardly wrapped label is a layout fix, not a wording question.

## 5. Review with the owner

The owner reads every text and decides. Don't ask for that in chat or in a PR comment: publish a review page as a claude.ai Artifact and let the decisions go into its database. The page, its data and how to read the decisions back are in [review-page.md](review-page.md). In short:

1. **Round 1, every text.** One row per key: where it shows, the source text, the translation, filled-in examples for templates (each provider, each pen, a real screen size), and a warning when the translation is much longer than the source in a tight place. OK / Reject / Edit, with placeholder checks on edits, every choice saved at once, and a Done button.
2. **Read the decisions back** with `ArtifactData` once the owner says it's done (or `review/state` says `done`). Apply edits as written, but fix plain typos and grammar (a missing comma, a wrong case) and say so in round 2. Rejected texts get a new proposal from the note.
3. **Round 2, only what changed or was unclear**, with screenshots of the translated UI at iPad and phone sizes and the text in question marked, and a sentence of context per row (why it is back, what it sits next to). Include rows where your correction changed the owner's edit, and texts the owner asked to see in place.
4. **Not wording?** What the review turns up that needs a change in behaviour or accessibility (a message that should say more, a group and a button with the same name) becomes a separate issue, linked from the PR, rather than growing this one.

Push the reviewed texts with a commit that says so ("Czech texts as the owner reviewed them"), and keep the review page links in the PR.

## 6. The pull request and the release

- **PR description:** the options and the new file; the tests and checks; a table of every key with the source and the translation, the keys changed in the review marked ✎; what the screenshots show; possible follow-ups.
- **What projects must change:** a new file in the module means a service worker's list of files must include it, or the module fails offline. Say so in the CHANGELOG's "What to change" and the README's setup section. Also tell projects to drop options that only translated the old defaults.
- **Changelog:** a minor version (backwards compatible), its heading `## X.Y.0 (unreleased)` until the owner has approved the wording. Date it only when the owner asks to release.
- Update the module's README (the options, the file list) and, if setup changed, `docs/setup-project.md`.

## Checklist

- [ ] Inventory covers visible text, screen-reader text, status and error messages, and everything written out (bodies, file names, units, decimal marks)
- [ ] `strings.js`: the default language copied byte for byte; `language` and `strings` options; unknown language, key or value throws
- [ ] Templates with named placeholders; per-language keys for names that change with grammar; plurals and numbers per language
- [ ] `lang` set on the rendered root; file names in ASCII; one term per thing, no duplicate names in one group
- [ ] Tests: every key in every language, same placeholders, default output pinned, no source-language text in translated output, overrides, errors
- [ ] Language switch in the demo or app; overflow and no-English checks at 1180 × 820, 820 × 1180 and 390 × 844, light and dark
- [ ] Review page round 1 published; decisions read back with ArtifactData and applied; round 2 with screenshots for what changed
- [ ] Non-wording findings filed as separate issues
- [ ] PR: key table with ✎, screenshots, what projects change (service worker file list); changelog "(unreleased)" until the owner approves
