# Claude Code skills

Skills that web-kit's sessions and projects share. A skill is a folder with a `SKILL.md` (and sometimes templates, scripts or references next to it). Claude Code loads it when a task matches its `description`, or when you type `/<skill name>`.

| Skill | What it does |
| --- | --- |
| [`localize`](localize/SKILL.md) | Translates a static web app or a module (Czech first), with a review of every text by the owner. |
| [`ux-design-loop`](ux-design-loop/README.md) | Designs a feature with published Artifacts: workflow map, draggable wireframes, prototype brief. |

Skills are not modules. The site build doesn't publish them, and `tools/check-modules.mjs` ignores them.

## Installing a skill

Copy the skill's whole folder. A skill is found by its folder name, so keep the folder as it is and don't rename it. Start a new Claude Code session afterwards; skills are read at session start.

Run the commands from a clone of web-kit. Replace `ux-design-loop` with the skill you want.

### In one project

The skill is then available in that project only, and can be committed with it.

PowerShell:

```powershell
New-Item -ItemType Directory -Force .claude\skills | Out-Null
Copy-Item -Recurse -Force ..\web-kit\.claude\skills\ux-design-loop .claude\skills\
```

sh:

```sh
mkdir -p .claude/skills && cp -R ../web-kit/.claude/skills/ux-design-loop .claude/skills/
```

### For you, in every project

The skill is then available everywhere you use Claude Code and is not committed to any project.

PowerShell:

```powershell
New-Item -ItemType Directory -Force "$HOME\.claude\skills" | Out-Null
Copy-Item -Recurse -Force .claude\skills\ux-design-loop "$HOME\.claude\skills\"
```

sh:

```sh
mkdir -p ~/.claude/skills && cp -R .claude/skills/ux-design-loop ~/.claude/skills/
```

If a project and your user folder both have a skill with the same name, check which one runs before relying on it.

### Checking that it works

Open a new Claude Code session in the project and type `/` followed by the skill's name. It should be in the list. Or describe the task the skill's `description` names and see whether Claude says it is using the skill.

If it isn't there: check that `SKILL.md` sits directly inside the skill folder (not one folder deeper), and that you started a new session.

### Updating

A copy doesn't update itself. When web-kit's skill changes, copy it again with the same command (`-Force` and `cp -R` overwrite). Files you deleted from the skill in web-kit stay in your copy; remove the old folder first if you want an exact copy.

To keep your user-level copy in step without copying again, link it to your clone instead. On Windows a junction needs no administrator rights:

```powershell
cmd /c mklink /J "$HOME\.claude\skills\ux-design-loop" "C:\path\to\web-kit\.claude\skills\ux-design-loop"
```

On macOS and Linux: `ln -s /path/to/web-kit/.claude/skills/ux-design-loop ~/.claude/skills/ux-design-loop`.

### New projects

`tools/new-project.mjs` copies the skills listed in `SKILL_DIRS` into a new project (today only `localize`). A skill that isn't listed there is copied by hand, as above.

## Adding a skill to web-kit

Put it in `.claude/skills/<name>/` with a `SKILL.md` whose frontmatter has `name` and `description`, and add a row to the table above. Write everything in English, with nothing specific to one project. Add it to `SKILL_DIRS` in `tools/new-project.mjs` only if every new project should start with it.

## Changing a skill

The repository is the source; copies in projects and in `~/.claude/skills/` are made from it. Change the skill here: one issue and one pull request per change, as in the repository's `CLAUDE.md`. Tell Claude what you want in plain words, or edit the files yourself; a skill's own README says which file does what (for example [`ux-design-loop`](ux-design-loop/README.md#changing-it)). Merging a skill change releases nothing. Afterwards copy the skill again wherever you use it (see [Updating](#updating)). Don't edit a copy in a project or in your user folder and leave it there: the next copy from web-kit overwrites it.
