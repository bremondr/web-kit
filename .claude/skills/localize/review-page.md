# The review page

A claude.ai Artifact where the owner goes through the translations on the iPad or a computer and decides each one. feedback-kit's two rounds (PR #38) used this design; the owner reviewed 56 texts in one sitting.

**Before writing it, load the `artifact-design` and `artifact-capabilities` skills.** They give the page contract (title, theming, allowed libraries, phone width) and the current database and user APIs; follow them where they differ from the sketches below. The page declares the `db` and `user` capabilities.

## The page

- **Header** (sticky on wider screens): a title ("feedback-kit: Czech texts"), a line with the PR, version and number of texts, filter chips with counts (All, Not reviewed, OK, Rejected, Edited), and a **Done** button that shows how many are left.
- **A short intro**: what OK, Reject and Edit do, that every choice is saved at once, that blue `{names}` are filled in by the code and must stay.
- **Groups of rows** by where the texts show (panel heading and buttons, status messages, the written issue, …). Each row:
  - the key (monospace), where it shows ("Button under the picture", "Screen readers only"), and its state;
  - source and translation side by side (stacked on a phone), with `{placeholders}` highlighted;
  - **filled-in examples** for templates and for the values that go into them, built from the current texts (with the owner's edits): the sentence with each provider, each pen label, a screen row for a real iPad size, an upper-cased heading as it shows;
  - **a length warning** when the filled-in translation is much longer than the source: for buttons and headings at 1.35× and at least 5 more characters ("check it fits its space"), for other texts at 1.5× and 25 more characters;
  - buttons **OK**, **Reject…**, **Edit**, and **Clear decision** once decided. Touch targets at least 44–48 px high.
- **Edit** opens a text box with the current text and an optional note. As the owner types, it checks the placeholders against the source (missing, unknown, used twice, a stray `{` or `}`), refreshes the examples and the length warning, and keeps **Save edit** disabled while something is wrong, the text is empty or unchanged.
- **Reject…** asks for a note (what's wrong, or what to use instead).
- A status banner: loading, saved, read-only, or cannot reach the database (with the page still readable).
- The texts are embedded as JSON in a `<script type="application/json">`: `[{id, title, rows: [{key, where, kind, en, cs}]}]`, where `kind` (`button`, `title`, `aria`, `status`, `note`, `heading`, `row`, `name`, `file`) drives the length warning.

## The data

Two kinds of documents, written as the owner decides:

| Document | Content |
|---|---|
| `decisions/<key>` | `{key, decision: 'ok' \| 'rejected' \| 'edited', text: <the edited text or null>, note, english: <source>, czechBefore: <translation shown>, at}` |
| `review/state` | `{done: true \| false, at}`, set by Done; the banner then offers "Reopen review" |

Saving the source and the shown translation with each decision means the decisions still make sense if the texts change before they are read.

The page listens to both (snapshots) so that two devices stay in step, updates the row at once, and puts it back with a message if a write fails.

## Reading the decisions back

When the owner says they are done (or `review/state` has `done: true`), read them with the `ArtifactData` tool: `list` (or `query`) on the `decisions` collection of the artifact's URL, and `get` on `review/state`. Then, for each key:

- `ok`: keep the translation;
- `edited`: use `text`, after fixing plain typos and grammar (say which in round 2);
- `rejected`: write a new proposal from the note, for round 2;
- no decision: ask, or carry it to round 2.

Check that `czechBefore` matches what is in the branch; if it doesn't, the texts changed after publishing, and that row needs another look.

Apply them, run the tests (the pinned translated examples change with the wording) and the browser check, and take screenshots.

## Round 2

A second page with the same code and its own database (so round 1's decisions stay as they are), holding only the rows that changed or were unclear. Each row adds:

- `context`: one or two sentences on why it is back ("Your edit, with the case corrected: after 'do' it is 'do snímku obrazovky'", "It sits next to 'save', which uses a different word");
- `img`: screenshots of the translated UI with the text marked, at iPad landscape (light) and phone (dark), published with the page through the Artifact tool's `files` and shown side by side with captions.

Read and apply round 2 the same way. Record both pages' links in the PR description.
