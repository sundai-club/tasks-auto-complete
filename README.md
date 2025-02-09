# Tasks Auto Complete

AI brain that knows everything you're doing on your laptop, and auto completes your routine tasks

This project is built on Electron, providing a desktop application that integrates with your system.

# Installation

1. Install screenpipe https://github.com/mediar-ai/screenpipe
2. Install dependencies and run the electron app:
```bash
# Install dependencies
npm install
# Run the app
npm start
```
3. ???
4. PROFIT

## Development

This application is based on Electron and includes the following key files:

- `package.json` - Points to the app's main file and lists its details and dependencies.
- `main.js` - Starts the app and creates a browser window to render HTML. This is the app's **main process**.
- `index.html` - A web page to render. This is the app's **renderer process**.
- `preload.js` - A content script that runs before the renderer process loads.

## Resources

- [electronjs.org/docs](https://electronjs.org/docs) - Electron documentation
- [Electron Fiddle](https://electronjs.org/fiddle) - Test small Electron experiments
