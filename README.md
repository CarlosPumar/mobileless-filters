# mobileless-filters

Shared filter scripts (JS/CSS) for the MobileLess apps (Android & iOS).

Each supported app has a folder under `filters/` containing:
- `manifest.json` — metadata: app identifiers, URL, and list of available filters
- `baseline.js` — always-on script (injected on every session regardless of active filters)
- One `.js` and/or `.css` file per filter

## Structure

```
filters/
└── instagram/
    ├── manifest.json
    ├── baseline.js
    ├── ig_stories.js
    ├── ig_reels.js
    ├── ig_reels.css
    ├── ig_explore.css
    └── ig_no_scroll_reels.js
```

## manifest.json schema

```json
{
  "androidPackage": "com.example.app",
  "iosBundleId": "com.example.app",
  "appName": "App Name",
  "url": "https://web.example.com",
  "baselineJs": "baseline.js",
  "filters": [
    {
      "id": "filter_id",
      "nameKey": "localization_key",
      "js": "filter.js",
      "css": "filter.css"
    }
  ]
}
```

Fields `js` and `css` are optional — a filter can have one or both.

## Usage

This repo is included as a **git submodule** in both Android and iOS apps.

- Android: `app/src/main/assets/filters/`
- iOS: `mobileless/filters/`
