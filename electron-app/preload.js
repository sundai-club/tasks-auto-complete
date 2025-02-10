/**
 * The preload script runs before `index.html` is loaded
 * in the renderer. It has access to web APIs as well as
 * Electron's renderer process modules and some polyfilled
 * Node.js functions.
 *
 * https://www.electronjs.org/docs/latest/tutorial/sandbox
 */
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  saveApiKey: (key) => ipcRenderer.invoke('save-api-key', key),
  getApiKey: () => ipcRenderer.invoke('get-api-key'),
  startScreenpipe: () => ipcRenderer.invoke('start-screenpipe'),
  stopScreenpipe: () => ipcRenderer.invoke('stop-screenpipe'),
  runAssistant: (taskDescription) => ipcRenderer.invoke('run-assistant', taskDescription),
  onNewTask: (callback) => ipcRenderer.on('new-task', (event, task) => callback(task))
})

window.addEventListener('DOMContentLoaded', () => {
  const replaceText = (selector, text) => {
    const element = document.getElementById(selector)
    if (element) element.innerText = text
  }

  for (const type of ['chrome', 'node', 'electron']) {
    replaceText(`${type}-version`, process.versions[type])
  }
})

//start button for screenpipe

//pipe to detect when we can help user 
//accept what agent sugegests 
