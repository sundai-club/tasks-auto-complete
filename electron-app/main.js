// Modules to control application life and create native browser window
const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')
const { spawn } = require('child_process')

let mainWindow
let screenpipeProcess = null

// Define recordings directory path
const recordingsPath = path.join(__dirname, '..', 'recordings')

// Add support for secure restorable state on macOS
if (process.platform === 'darwin') {
  app.applicationSupportsSecureRestorableState = true
}

function createWindow () {
  console.log('Creating window...')
  console.log('Current directory:', __dirname)
  
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  })

  // and load the index.html of the app.
  const indexPath = path.join(__dirname, 'index.html')
  console.log('Loading index.html from:', indexPath)
  console.log('File exists:', fs.existsSync(indexPath))
  
  mainWindow.loadFile(indexPath)
  
  // Log any loading errors
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorCode, errorDescription)
  })

  // Open the DevTools.
  mainWindow.webContents.openDevTools()
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

// Handle saving API key
ipcMain.handle('save-api-key', async (event, key) => {
  try {
    const settingsPath = path.join(__dirname, 'settings.json')
    const settings = {
      apiKey: key,
      timestamp: new Date().toISOString()
    }
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2))
    return { success: true }
  } catch (error) {
    console.error('Error saving API key:', error)
    return { success: false, error: error.message }
  }
})

// Handle stopping screenpipe
ipcMain.handle('stop-screenpipe', async () => {
  if (screenpipeProcess) {
    try {
      // Check if process is still running
      try {
        process.kill(screenpipeProcess.pid, 0) // Test if process exists
      } catch (e) {
        if (e.code === 'ESRCH') {
          console.log('Process already terminated')
          screenpipeProcess = null
          return { success: true }
        }
      }

      // Process exists, try to terminate it gracefully
      process.kill(screenpipeProcess.pid, 'SIGTERM')
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Check if it's still running after SIGTERM
      try {
        process.kill(screenpipeProcess.pid, 0)
        // If we get here, process is still running, force kill it
        process.kill(screenpipeProcess.pid, 'SIGKILL')
      } catch (e) {
        if (e.code !== 'ESRCH') {
          throw e // Only throw if it's not a "no such process" error
        }
      }
      
      console.log('Screenpipe stopped successfully, data saved to:', recordingsPath)
      screenpipeProcess = null
      return { success: true }
    } catch (error) {
      console.error('Error stopping screenpipe:', error)
      screenpipeProcess = null // Reset the process reference
      return { success: false, error: error.message }
    }
  }
  return { success: true }
})

// Handle starting screenpipe
ipcMain.handle('start-screenpipe', async () => {
  try {
    if (screenpipeProcess) {
      return { success: false, error: 'Recording already in progress' }
    }

    // Ensure recordings directory exists
    if (!fs.existsSync(recordingsPath)) {
      fs.mkdirSync(recordingsPath, { recursive: true })
    }

    // Use full path to screenpipe
    const screenpipePath = '/Users/georgina/.local/bin/screenpipe'

    // Start screenpipe process with correct options
    screenpipeProcess = spawn(screenpipePath, [
      '--data-dir', recordingsPath,
      '--fps', '1',
      '--enable-frame-cache',
      '--use-all-monitors'
    ], {
      env: { ...process.env, PATH: process.env.PATH + ':/Users/georgina/.local/bin' }
    })

    let startupError = ''

    screenpipeProcess.stdout.on('data', (data) => {
      const output = data.toString()
      console.log('screenpipe stdout:', output)
      if (output.includes('error')) {
        startupError += output
      }
    })

    screenpipeProcess.stderr.on('data', (data) => {
      const error = data.toString()
      console.error('screenpipe stderr:', error)
      startupError += error
    })

    screenpipeProcess.on('error', (error) => {
      console.error('Failed to start screenpipe:', error)
      screenpipeProcess = null
      startupError += error.message
    })

    // Wait a bit to ensure process started successfully
    await new Promise(resolve => setTimeout(resolve, 2000))

    if (screenpipeProcess && screenpipeProcess.exitCode === null) {
      if (startupError) {
        throw new Error(startupError)
      }
      console.log('Screenpipe started successfully')
      return { success: true }
    } else {
      throw new Error(startupError || 'Screenpipe failed to start')
    }
  } catch (error) {
    console.error('Error starting screenpipe:', error)
    return { success: false, error: error.message }
  }
})
