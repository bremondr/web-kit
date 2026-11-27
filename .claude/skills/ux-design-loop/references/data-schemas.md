# Data schemas

All three templates take one JSON file. Common: `title`, `subtitle`, `lang` (`en`|`cs`), `storage.doc` (db doc path, default below).

## Wireframe (`templates/wireframe`, doc `wireframe/main`, snapshots `wireframe/snapshots`)

```json
{
  "title": "", "subtitle": "", "lang": "en",
  "stage": { "w": 1200, "h": 780, "grid": 10, "minW": 100, "minH": 40, "park": 900 },
  "phases": [ { "id": "mvp", "label": "MVP", "milestone": "Milestone 1", "color": "c7" } ],
  "tabs": [ {
    "id": "list", "label": "Bookings",
    "kind": "page|modal|drawer|state", "variant": "desktop|tablet|mobile",
    "trigger": "what opens this modal/drawer",
    "viewport": { "w": 1200, "h": 780 },
    "context": [ { "k": "Today", "v": "..." } ],
    "blocks": [ { "id": "list_filters", "title": "", "tag": "", "phase": "mvp",
                  "desc": "", "q": "decision question", "html": "<div class=\"row\">…</div>",
                  "g": [20, 10, 600, 50] } ]
  } ]
}
```
Colors `c1`..`c8` (theme-aware). Parking area = `park` px below each tab's viewport height.

Saved state (doc `wireframe/main`): `{ v: 2, tab, els: { <blockId>: { x, y, w, h, d, n, p?, pr? } }, phases: { <id>: { label, milestone } } }`
- `d`: `u` undecided, `k` keep, `l` later, `m` maybe, `x` drop; `n`: note; `p`: phase id override (absent = block's own `phase`); `pr`: `[x,y,w,h]` position before parking.
- Parked = `y + h/2 >= tab viewport height`.

Snapshots doc `wireframe/snapshots`: `{ v: 1, list: [ { name, at, els, phases } ] }` (max 20).

## Workflow (`templates/workflow`, doc `workflow/main`)

```json
{
  "issueBase": "https://tracker.example.com/project/-/issues/",
  "flagLabel": "Needs approval",
  "scores": ["Value", "Effort", "Risk"],
  "phases": [ { "id": "mvp", "label": "MVP", "color": "c7" } ],
  "rows": [ { "key": "who", "label": "Who", "kind": "text", "placeholder": "", "cls": "" },
            { "key": "pain", "label": "Pain", "kind": "level", "levels": ["none","low","medium","high"] },
            { "kind": "features", "label": "Features" } ],
  "stages": [ { "t": "Stage name", "vals": { "who": "", "pain": 2 }, "f": ["f1"] } ],
  "features": [ { "id": "f1", "ref": "#10", "ph": "mvp", "t": "", "d": "", "n": "", "flag": false, "sc": [5,3,1] } ]
}
```
Omit `issueBase`, `flagLabel`, `scores` to hide those controls.
Saved state: `{ v: 1, stages: [ { id, t, vals, f: [featureKey] } ], feats: { <key>: { k, ref, ph, t, d, n, flag, sc } }, nextId }`.

## Prototype (`templates/prototype`, no saved state)

```json
{
  "start": "list",
  "pages": [ {
    "id": "list", "label": "Bookings", "kind": "page|modal|drawer", "variant": "desktop", "group": "list",
    "viewport": { "w": 1200, "h": 780 },
    "blocks": [ { "id": "list_filters", "x": 20, "y": 10, "w": 1160, "h": 50, "title": "",
                  "html": "…interactive html…", "later": false, "phase": "Next release" } ]
  } ]
}
```
- Pages sharing `group` but with different `variant` are the same page in another viewport (the switch keeps you on it).
- Interactions in `html`: `data-goto="pageId"`, `data-open="modalId"`, `data-close`, `data-toggle="elementId"` (toggles `hidden`), `data-toast="text"`.
- `later: true` blocks render a hatched placeholder with the title and phase, no inner UI.
- Dropped and parked blocks are not in the data at all.
- **Prototype-only controls.** Everything that is not part of the app design (back, screen switch, viewport switch, versions, "show clickable areas", reset) is rendered by the template in one dashed amber hatched bar tagged "Prototype only", above the stage; the stage is the app. In block `html` use `<span class="ptag">Mock</span>` and `<span class="proto-note">…</span>` for any prototype-only note or mock rule, never plain app styling. Do not put prototype controls (screen tabs, theme switch, reset) inside the app chrome of a block.
- **Versions** compare alternatives of the same prototype: `"versions": [ { "id": "mine", "label": "My bookings", "default": "block", "options": [ { "id": "block", "label": "block" }, { "id": "modal", "label": "modal" } ] } ]`. A page or a block with `"when": { "mine": "modal" }` is shown only in that version. Switching in the bar, or `data-version-set="mine=modal"` on an element, changes it. The reset button restores defaults.
