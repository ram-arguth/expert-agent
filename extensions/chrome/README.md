# Expert AI Chrome Extension

A browser extension for quick access to Expert AI agents.

## Features

- **Quick Query**: Select text → right-click → "Ask Expert AI"
- **Popup**: Click extension icon for manual queries
- **Agent Selection**: Choose from UX Analyst, Legal Advisor, Finance Planner
- **Session Auth**: Uses existing login session

## Installation (Developer Mode)

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select this `extensions/chrome` directory

## Usage

1. **Via Popup**: Click the extension icon, select an agent, type your question
2. **Via Context Menu**: Select text on any page → right-click → "Ask Expert AI"

## Configuration

Edit `popup.js` to change the API base URL:

```javascript
const API_BASE = "https://ai-dev.oz.ly"; // or https://ai.oz.ly for production
```

## Icons

Place your icons in the `icons/` directory:

- `icon16.png` (16x16)
- `icon48.png` (48x48)
- `icon128.png` (128x128)

## Development

The extension uses Manifest V3 with:

- Service worker (`background.js`) for context menus
- Content script (`content.js`) for page integration
- Popup (`popup.html` + `popup.js`) for UI

## Files

```
extensions/chrome/
├── manifest.json     # Extension manifest
├── popup.html        # Popup UI
├── popup.js          # Popup logic
├── background.js     # Service worker
├── content.js        # Content script
├── icons/            # Extension icons
└── README.md         # This file
```
