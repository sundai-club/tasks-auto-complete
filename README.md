# Tasks Auto Complete

AI brain that knows everything you're doing on your laptop, and auto completes your routine tasks

# Installation

Clone the repository:
```bash
git clone https://github.com/mediar-ai/tasks-auto-complete
cd tasks-auto-complete
```

## Screenpipe

1. Install screenpipe [https://docs.screenpi.pe/docs/getting-started](https://github.com/mediar-ai/screenpipe)
2. Install and enable our pipe - refer to the [pipe/README.md](pipe/README.md) file.

## AI Agent

The project includes an AI agent that can perform tasks using browser automation. The agent uses the `browser-use` package to interact with web browsers programmatically.

1. Install Python dependencies and playwright:
```bash
cd agent
# virtualenv .venv
# source .venv/bin/activate
pip install -r requirements.txt
playwright install
```

## Electron app

This project is built on Electron, providing a desktop application that integrates with your system.

1. Install dependencies and run the electron app:
```bash
cd electron-app
# Install dependencies
npm install
# Run the app
npm start
```

## Chrome extension

1. Build the extension:
```bash
cd chrome-extension
npm install
npm run build
```
2. Install the extension:
- Open Google Chrome
- Go to `chrome://extensions`
- Click on "Load unpacked"
- Select the `chrome-extension` folder
3. Run the proxy server:
```bash
cd chrome-extension
OPENAI_API_KEY=your_openai_api_key node proxy.js
```
4. Reload the extension:
- Open Google Chrome
- Go to `chrome://extensions`
- Click on the extension
- Click on "Reload"