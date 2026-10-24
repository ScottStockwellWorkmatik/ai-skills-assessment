# Workmatik AI Skills Assessment

A browser-only self-assessment of AI skills across six domains and five proficiency levels, with EU AI Act indicators. Individuals rate themselves and download an XLSX; a manager or peer does the same; a facilitator loads the files into the Team rollup tab to see averages, gaps and calibration flags.

No server, no account, no tracking. Nothing is uploaded or stored.

## Structure

```
index.html            Page shell, including Open Graph and Twitter preview tags
og-image.png          1200 x 630 link-preview image
assets/workmatik-logo-white.svg   Workmatik: wordmark for the navy header (cropped tight to the artwork)
assets/workmatik-logo-black.svg   Workmatik: wordmark for print, where backgrounds are not printed
css/styles.css        Workmatik brand tokens and layout
js/app.js             All behaviour (assessment, XLSX export/import, rollup)
data/framework.json   The framework: domains, levels, indicators, EU AI Act tags
lib/xlsx.full.min.js  SheetJS 0.18.5 (vendored, Apache-2.0, see lib/xlsx-LICENSE.txt)
```

## Change the framework

Edit `data/framework.json` only. No code change is needed to reword an indicator, add or remove an EU AI Act tag (`"eu": true`), or change the version.

- Keep exactly 5 levels per domain and keep each domain `id` unique and stable. Exported files record scores by domain `id`.
- Bump `meta.version` when content changes.
- `meta.verification`: `"pending"` shows a banner saying EU AI Act references are under review. `"verified"` shows a footer note built from `meta.verifiedDate` and `meta.verifiedAgainst`. The last check is recorded in `VERIFICATION-REPORT.md`. Re-check before each client engagement, because the Act was amended in July 2026.

## Run locally

Browsers block `fetch` from `file://`, so serve the folder:

```
python3 -m http.server 8000
```

Then open http://localhost:8000

## Publish on GitHub Pages

1. Create an empty repository (for example `ai-skills-assessment`).
2. Upload or push the contents of this folder to the `main` branch.
3. Settings, Pages, Source: Deploy from a branch, Branch: `main`, folder `/ (root)`.
4. The site appears at `https://<account>.github.io/<repository>/`.
5. The `og:url` and `og:image` tags in `index.html` assume the repository is named `ai-skills-assessment` under `scottstockwellworkmatik`. If the repository name differs, update both before publishing. Link previews need absolute URLs.

## Data handling

Ratings live in the browser tab only. The XLSX file contains the name or initials entered, team, rater type, date and scores, so treat downloaded files as personal data under your client's data-protection policy. Using initials or staff codes is recommended.

## Third-party

SheetJS Community Edition 0.18.5, Apache-2.0.
