#!/usr/bin/env python3
"""Build a single-file artifact HTML from a ux-design-loop template.

Usage: python build.py <wireframe|workflow|prototype> <data.json> <out.html>
Inlines base.css, <kind>/style.css, <kind>/engine.js and the data JSON into <kind>/template.html.
"""
import json
import sys
from pathlib import Path

root = Path(__file__).resolve().parent


def main():
    if len(sys.argv) != 4 or sys.argv[1] not in ("wireframe", "workflow", "prototype"):
        sys.exit(__doc__)
    kind, data_path, out_path = sys.argv[1], Path(sys.argv[2]), Path(sys.argv[3])
    data = json.loads(data_path.read_text(encoding="utf-8"))
    payload = json.dumps(data, ensure_ascii=False).replace("</", "<\\/")
    html = (root / kind / "template.html").read_text(encoding="utf-8")
    parts = {
        "/*@@BASE_CSS@@*/": (root / "base.css").read_text(encoding="utf-8"),
        "/*@@CSS@@*/": (root / kind / "style.css").read_text(encoding="utf-8"),
        "/*@@DATA@@*/": "window.UXL_DATA = " + payload + ";",
        "/*@@ENGINE@@*/": (root / kind / "engine.js").read_text(encoding="utf-8").replace("</script", "<\\/script"),
    }
    for marker, text in parts.items():
        if marker not in html:
            sys.exit("marker missing in template: " + marker)
        html = html.replace(marker, text)
    title = data.get("title", kind)
    html = html.replace("@@TITLE@@", str(title).replace("<", "&lt;"))
    out_path.write_text(html, encoding="utf-8")
    print(f"wrote {out_path} ({len(html) // 1024} KB)")


if __name__ == "__main__":
    main()
