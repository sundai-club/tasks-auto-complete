# Form Analysis Assistant Chrome Extension

This Chrome extension analyzes web pages for empty forms and provides automated form-filling suggestions using locally running Deepseek models.

## Prerequisites

1. Node.js and npm installed
2. Ollama installed with Deepseek models
3. Chrome browser

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Build the extension:
   ```bash
   npm run build
   ```

3. Make sure Ollama is running locally with the required models:
   ```bash
   ollama run deepseek-coder:6.7b
   ```

4. Load the extension in Chrome:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `chrome-extension` directory

## Usage

1. The extension will automatically analyze any web page you visit
2. When an empty form is detected, you'll receive a desktop notification
3. The extension will generate a step-by-step plan for filling out the form based on your user profile

## Configuration

Edit the user profile in `src/background.ts` to customize the form-filling suggestions according to your information.
