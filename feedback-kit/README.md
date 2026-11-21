# Feedback kit

"Send feedback" for a static web app: a GitHub issue, already filled in, plus a picture to draw on. Plain ES modules and one stylesheet, with no dependencies, no build step, no server and no token. The person signs in to GitHub and taps Submit there.

It began in [Ultimate Playbook](https://github.com/bremondr/ultimate-playbook) but knows nothing about it. Nothing in this folder imports from outside it (`tools/check-modules.mjs` checks that). Changes are listed in `CHANGELOG.md`.

## What the person sees

1. They tap your "Send feedback" button. A panel fills most of the screen with a picture of the page, or of one part of it, taken at the moment of the tap.
2. They can draw on the picture to point at the problem: four pen colours, Undo (also Ctrl/Cmd+Z), Clear. A finger, the Apple Pencil or the mouse all work.
3. The picture is on the clipboard: copied when the panel opens and again after every stroke. **Share…** (where the browser can share files, as on the iPad) and **Save picture** are there too.
4. **Write the issue on GitHub** opens a new issue with the title, labels and body filled in. They paste the picture, say what's wrong and tap Submit.

## Files

| File | What it does |
|---|---|
| `kit.js` | `createFeedback(options)`: the panel, the clipboard, Share and Save, the device's rows in the issue |
| `picture.js` | `svgPicture(svg, options)`: a PNG-ready canvas of an SVG as it looks now. `embedFonts(...)`: web fonts inlined for it |
| `sketch.js` | `createSketch(canvas)`: drawing on a picture |
| `issue.js` | `issueUrl(issue)`: the new-issue address, kept under GitHub's length limit. No DOM, so it runs in Node |
| `feedback-kit.css` | the panel; themed with `--fk-*` custom properties |

## Using it

```html
<link rel="stylesheet" href="js/feedback-kit/feedback-kit.css">
```

```js
import { createFeedback } from './feedback-kit/kit.js';
import { embedFonts, svgPicture } from './feedback-kit/picture.js';

const feedback = createFeedback({
  repo: 'owner/name',
  labels: ['feedback'],                  // the label must exist in the repository
  footer: 'Sent with Send feedback in the app.',
  // a promise of a canvas. It's called in the tap, so take the copy at once: svgPicture does
  picture: () => svgPicture(document.querySelector('#chart'), {
    fonts: embedFonts({stylesheet: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;700', family: 'Inter'})
  }),
  // what was on screen, also called in the tap
  describe: () => ({
    subtitle: 'Sales chart, March',      // under the panel's heading
    fileName: 'feedback-sales.png',
    issue: {                             // or a promise of it, for parts that take a moment (a link to pack)
      title: 'Feedback: sales chart',
      sections: [{heading: 'Reopen', text: '[Open it again](https://…)', fallback: '_Link too long._'}],
      rows: [['View', 'Sales chart, March']]
    }
  })
});
document.querySelector('#feedback').addEventListener('click', feedback.open);
```

The issue body has these parts, in order:
- "What's wrong, and what should happen", left empty for the person;
- "Picture", where they paste it;
- your `sections`;
- an "On screen" table: your `rows`, then the screen, theme, browser and page.

If the address would be longer than GitHub accepts (about 8 KB), sections give way to their `fallback` text, the longest first, until it fits.

For a picture that isn't an SVG, give `picture` any function that returns a promise of a canvas.

### Theming

Set these on `:root` or `.fk`; the defaults are neutral greys and green:

`--fk-surface` `--fk-ink` `--fk-muted` `--fk-rule` `--fk-accent` `--fk-on-accent` `--fk-warn` `--fk-stage` `--fk-font` `--fk-display` `--fk-z`

### Offline

If the app has a service worker that caches fonts, it must not answer a CORS request with an opaque copy cached from a stylesheet `<link>`. `embedFonts` reads the stylesheet with CORS and can't use such a copy. See `staleWhileRevalidate` in [Ultimate Playbook's `sw.js`](https://github.com/bremondr/ultimate-playbook/blob/main/sw.js).

## Limits

- **Only what the page can draw.** A page can't take a screenshot of itself on iPad Safari, so the picture is the SVG (or canvas) you give it, not the whole screen.
- **Clipboard.** Safari allows writing to the clipboard only during a tap, so the kit copies when the panel opens and after each stroke. Where copying is refused, Save and Share still work.
- **Sign-in.** The person needs a GitHub account. Labels are applied only if they may label issues in the repository; the owner always can.
