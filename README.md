# Inline EN-VI Translator

![Icon](images/icon-48.png)

A Chrome extension that automatically adds Vietnamese or English translations under each paragraph on web pages.

## Features

- **Automatic Language Detection**: Identifies whether the text is in English or Vietnamese and translates accordingly
- **Inline Translations**: Displays translations directly under the original text for easy comparison
- **Toggle On/Off**: Quickly enable or disable translations with a keyboard shortcut (Ctrl+B/Command+B)
- **Streaming Translation**: Shows translations as they're being processed
- **Smart Selection**: Focuses on main content, avoiding UI elements, code blocks, and navigation menus
- **Automatic Updates**: Translates new content as it loads on dynamic pages (like SPAs)

## Installation

### From Chrome Web Store
1. Visit the Chrome Web Store (link coming soon)
2. Click "Add to Chrome"
3. Confirm the installation when prompted

### Manual Installation (Developer Mode)
1. Download this repository as a ZIP file and extract it
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" using the toggle in the top-right corner
4. Click "Load unpacked" and select the extracted folder

## Usage

1. Click the extension icon in the toolbar to activate the translator (badge will show "ON")
2. Browse any webpage - paragraphs will automatically be translated
3. English text will be translated to Vietnamese, and Vietnamese text to English
4. Toggle the extension on/off by:
   - Clicking the extension icon
   - Using the keyboard shortcut: Ctrl+B (Windows/Linux) or Command+B (Mac)

## Requirements

- Chrome version 138 or newer
- Internet connection for translation

## Technical Details

This extension leverages Chrome's built-in Translator API, which:
- Works offline after initial language model download
- Respects user privacy by performing all translations locally
- Provides high-quality translations without sending data to external servers

## Development

### Project Structure
- `manifest.json`: Extension configuration
- `background.js`: Handles extension initialization and state management
- `content.js`: Processes webpage content and manages translations
- `images/`: Contains extension icons

### Key Functions
- `detectLanguage()`: Determines the source language of text
- `translate()`: Handles the translation process with streaming updates
- `translateElement()`: Creates and manages translation elements
- `translateAll()`: Processes all translatable elements on a page

## License

[License information to be added]

## Author

[Author information to be added]