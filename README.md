# Marketing AI Journey Map

A browser-only web page by Workmatik. It shows the 35 activities of the AI readiness framework for marketing as two flows, one for the marketing leader and one for the marketer, across five phases. Selecting an activity highlights what must come first and what it unlocks.

Live site (once GitHub Pages is on): https://scottstockwellworkmatik.github.io/marketing-ai-journey-map/

## Files

```
index.html            Page shell, including Open Graph and Twitter preview tags
og-image.png          2400 x 1260 link-preview image (the same size and 2:1 ratio as the Skills Map) (LinkedIn, Facebook, X)
css/styles.css        Workmatik brand tokens and layout (journey styles at the end)
js/app.js             Builds the map from the data file and draws the dependency arrows
data/journey.json     All content: phases, flows, 35 activities, dependencies
assets/               Logo files (see below)
favicon.*, apple-touch-icon.png, web-app-manifest-*.png, site.webmanifest   Icon set
.nojekyll             Tells GitHub Pages to serve the files as they are
```

## Logo

The header uses `assets/logo-black.svg` (it sits on the orange header, as on the AI Skills Assessment). `assets/logo-white.svg` is included for use on dark backgrounds. If the black file is missing, the page shows a text wordmark instead, so nothing breaks. 

## Changing the content

Edit `data/journey.json`. Each activity has an `id`, `lane` (`L` leader or `M` marketer), `phase` (0 to 4), `needs` (the IDs that must come first) and `critical`. The order of boxes in each phase is set in `lanes.L.order` and `lanes.M.order`. Allocation, phases and dependencies are the author's judgement and have no published source.

## Publishing on GitHub Pages

1. Create the repository `marketing-ai-journey-map` under the `ScottStockwellWorkmatik` account (public).
2. Upload the contents of this folder, not the folder itself, so `index.html` sits at the top level.
3. Settings, Pages, Source: Deploy from a branch, branch `main`, folder `/ (root)`, then Save.
4. The `og:url` and `og:image` tags in `index.html` assume that repository name. Change both if you use a different name, because link previews need absolute URLs.
5. Test the preview in LinkedIn's Post Inspector. LinkedIn caches previews, so re-scrape after any change to the image or tags, and raise the `?v=` number on the `og:image` tag when you replace the image.

## Testing locally

Open the folder through a local web server (for example `python3 -m http.server`), because browsers block `fetch` of the data file when you open `index.html` directly from disk.
