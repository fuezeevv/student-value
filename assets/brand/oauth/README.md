# Student Value OAuth emblem — approval candidate

Separate OAuth branding asset; the website's logo is unchanged.

- `student-value-oauth-emblem.svg`: vector master, 1200-unit square. All lettering is outlined, with no font or network dependency.
- `student-value-oauth-preview-1024.png`: large transparent-corner preview.
- `student-value-oauth-120.png`: final 120 × 120 RGBA PNG for upload.

Literal text: **STUDENT VALUE 1.984** / **KNOW WHAT’S NEXT** (U+2019 apostrophe).
Lettering follows circular arcs. Navy disk: `#0b1222`; original mark colors and paths are taken unchanged from `src/components/ui/Logo.tsx`, `BrandMark`. The SVG includes the source checksum. Two restrained blue separators; no outer seal lines or extra symbols.

`build-emblem.py` regenerates the master using fonttools and a locally installed Arial Bold. It does not redistribute the font. The PNGs are rasterized from the master using the project's existing sharp library, rendered at higher resolution and antialiased for the target size.

From the repository root: `python assets/brand/oauth/build-emblem.py` (in a Python environment with fonttools), then `node assets/brand/oauth/export-emblem.mjs` (Node 24). The small-size composition uses bold capitals around 8 px high, open counters, two separators and a large original mark. It was inspected at the actual 120 px size, not only as a large preview.

This asset strengthens the visible connection to the app name; Google makes the verification decision. No approval is implied.
