# Inline EN-VI Translator

<div align="center">
  <img src="public/images/icon-1280.png" alt="Inline EN-VI Translator Logo" width="128" height="128">
</div>

A Chrome extension that automatically adds Vietnamese or English translations under each paragraph on web pages. Built with TypeScript and Vite.

## Features

- **Automatic Language Detection**: Identifies whether the text is in English or Vietnamese and translates accordingly
- **Inline Translations**: Displays translations directly under the original text for easy comparison
- **Toggle On/Off**: Quickly enable or disable translations with a keyboard shortcut (Ctrl+B/Command+B)
- **Streaming Translation**: Shows translations as they're being processed in real-time
- **Smart Selection**: Focuses on main content, avoiding UI elements, code blocks, and navigation menus
- **Automatic Updates**: Translates new content as it loads on dynamic pages (like SPAs)
- **Prioritized Translation**: Translates visible content first for better user experience
- **Lazy Loading**: Only translates content as it becomes visible during scrolling
- **TypeScript Support**: Codebase is fully typed for better development experience
- **Vite Build System**: Fast development and optimized production builds

## Installation

### From Chrome Web Store
1. Visit the Chrome Web Store (link coming soon)
2. Click "Add to Chrome"
3. Confirm the installation when prompted

### Manual Installation (Developer Mode)
1. Download this repository as a ZIP file and extract it
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" using the toggle in the top-right corner
4. Click "Load unpacked" and select the extracted folder containing the `manifest.json` file

## Usage

1. Click the extension icon in the toolbar to activate the translator (badge will show "ON")
2. Browse any webpage - paragraphs will automatically be translated
3. English text will be translated to Vietnamese, and Vietnamese text to English
4. Toggle the extension on/off by:
   - Clicking the extension icon
   - Using the keyboard shortcut: Ctrl+B (Windows/Linux) or Command+B (Mac)
5. A progress indicator will appear in the bottom-right corner showing translation status
6. You can cancel translation at any time by clicking the "Cancel" button in the progress indicator

## Requirements

- Chrome version 138 or newer
- Internet connection for initial language model download
- ~100MB storage space for language models (downloaded only once)

## Technical Details

This extension leverages Chrome's built-in Translator API, which:
- Works offline after initial language model download
- Respects user privacy by performing all translations locally
- Provides high-quality translations without sending data to external servers

## Project Structure

```
├── public/               # Static assets and built files
│   ├── images/           # Extension icons
│   ├── scripts/          # Compiled JavaScript files
│   └── manifest.json     # Extension manifest
├── src/                  # Source code
│   ├── background.ts     # Extension background service worker
│   ├── content.ts        # Content script for webpage translation
│   ├── chrome.d.ts       # Chrome API type definitions
│   ├── dom-extensions.d.ts # DOM element type extensions
│   └── types.d.ts        # Translator API type definitions
├── tsconfig.json         # TypeScript configuration
└── vite.config.ts        # Vite build configuration
```

## Development

### Setup Development Environment

1. Clone the repository:
   ```bash
   git clone https://github.com/hiennm11/Inline-EN-VI-Translator.git
   cd Inline-EN-VI-Translator
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run development server:
   ```bash
   npm run dev
   ```

4. Build the extension:
   ```bash
   npm run build
   ```

5. Check for TypeScript errors:
   ```bash
   npm run typecheck
   ```

### Key Components

- **Background Script (`background.ts`)**: Manages extension state and initializes language models
- **Content Script (`content.ts`)**: Handles DOM manipulation and translation logic
- **Type Definitions**: Provides TypeScript type safety for Chrome and Translator APIs

### Performance Optimizations

- **Batched Processing**: Translates content in small batches to maintain page responsiveness
- **Prioritized Visible Content**: Translates what the user can see first
- **Throttled Observers**: Prevents excessive processing on dynamic content changes
- **Lazy Translation**: Uses IntersectionObserver to translate content only when scrolled into view

## Privacy

This extension:
- Does not collect or transmit any user data
- Performs all translations locally on your device
- Does not require an internet connection after initial setup
- Does not track browsing history or page content

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.

## Author

[Hien Tran](https://github.com/hiennm11)

## Acknowledgements

- Chrome's built-in Translator and LanguageDetector APIs
- TypeScript team for the amazing language
- Vite team for the excellent build tool

## Todos
1. Implement Translation Caching
2. Improve User Feedback for Long Operations
3. Create an Options Page
...

