# ux-design-loop

A Claude Code skill for designing a feature step by step with published Artifacts. You move and decide on blocks in the browser; Claude reads your decisions back, revises, and finally hands the settled wireframe to a separate session that builds a clickable prototype.

This file is for people. Claude reads [`SKILL.md`](SKILL.md) and the files in `references/`.

## What you get

1. **Workflow map** (optional): process stages as columns, features as chips you drag between stages. Edit any text in place.
2. **Wireframe**: one tab per screen, modal, drawer or viewport variant (desktop, tablet, mobile). Every block can be dragged, resized, parked below the screen, and marked **keep**, **later**, **maybe** or **drop**, with a phase and a note.
3. **Revisions**: tell Claude you have decided. It reads your saved state and changes only what you mentioned.
4. **Comments** on the artifact: Claude edits, replies in the thread and leaves it open.
5. **Prototype**: a clickable multi-page artifact built in a separate session from the blocks you kept.
6. **Issues** (optional): drafted from kept and later blocks, grouped by phase and milestone, created only after you confirm.

## Installing

See [Installing a skill](../README.md#installing-a-skill). Short version, from a clone of web-kit:

```sh
mkdir -p ~/.claude/skills && cp -R .claude/skills/ux-design-loop ~/.claude/skills/
```

Start a new Claude Code session afterwards. It needs Python 3 (standard library only) to build the pages, and a Claude Code session that can publish Artifacts.

## Using it

Start with `/ux-design-loop`, or just describe the work: "wireframe this screen", "make a workflow map of this process", "let me rearrange the blocks", "build the prototype from the wireframe".

You can give it anything, none of it required: an idea in words, a process, issues or docs, a screenshot, a sketch. Claude asks only what is missing, then tells you whether it starts with a workflow map (many stages or features) or goes straight to a wireframe (one screen). You can overrule it.

### In the wireframe

| You want to | Do |
| --- | --- |
| Move or resize a block | Drag it; drag the corner to resize. It snaps to a grid. Arrow keys move the selected block (Shift for a bigger step). |
| Decide | Click the badge in the block's header to cycle `? → keep → later → maybe → drop`, or press `k` `l` `m` `x`. |
| Park a block | Drag it below the screen area, or press `p`. Parking only means "not on this screen"; it is independent of the decision. |
| Set the phase | Pick it in the side panel. The phases panel holds each phase's label and tracker milestone. |
| Leave a note | Type in the side panel. |
| Keep a version | Name it and press **Save snapshot**. You can restore it later. |

Decisions, positions, notes and phases save by themselves (the status line says where). Claude can read them from the artifact's database.

What the decisions mean:

- **keep**: build it.
- **later**: reserve the space. The prototype shows an empty hatched placeholder of the same size.
- **maybe**: not decided yet; Claude asks again.
- **drop**: leave it out.

### A typical session

1. You describe the feature. Claude publishes the workflow map or the wireframe and links it.
2. You rearrange and decide, then tell Claude: "I've decided, revise it".
3. Claude summarizes what it read, says how it interpreted anything unclear, and changes only the blocks you named. Repeat as often as you like. Press **Save snapshot** before a big revision.
4. Leave comments on the artifact when it is easier than typing; send the thread to Claude and it answers there.
5. When the wireframe is settled, say so. Claude summarizes keep, later and dropped, asks for your OK, and starts the prototype session with a complete brief.
6. If you want issues, ask. Claude shows the draft list first.

## Language

The artifact follows the language you write in. English and Czech are built in (`"lang": "en"` or `"cs"` in the data file).

## What is inside

| Path | What it is |
| --- | --- |
| `SKILL.md` | The instructions Claude follows. |
| `templates/` | The three ready-made pages (`wireframe`, `workflow`, `prototype`), shared `base.css`, and `build.py`. Content is a JSON file; the page logic is not rewritten each time. |
| `examples/` | Fictional room-booking data for each template. |
| `references/` | Data formats, how saved state is read and written, how the prototype brief and comments are handled. |
| `evals/evals.json` | Three test prompts for checking changes to the skill. |

To try a template by hand:

```sh
python templates/build.py wireframe examples/wireframe.data.json wireframe.html
```

Open `wireframe.html` in a browser to look at it. Saving to the shared database only works once Claude publishes it as an Artifact.

## Changing it

Change a template's `engine.js`, `style.css` or `template.html` once and every later run gets the change. Keep the templates generic: no project names, and the block list stays in data. Update `references/data-schemas.md` when the data format changes, and keep the examples building.
