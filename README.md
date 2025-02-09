# Tasks Auto Complete

AI brain that knows everything you're doing on your laptop, and auto completes your routine tasks

# Installation

## Screenpipe

1. Install screenpipe https://docs.screenpi.pe/docs/getting-started (https://github.com/mediar-ai/screenpipe)
2. Install and enable our pipe
```
screenpipe pipe download https://github.com/sundai-club/tasks-auto-complete/tree/main/pipe/tasks-auto-complete
screenpipe pipe enable tasks-auto-complete
```

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