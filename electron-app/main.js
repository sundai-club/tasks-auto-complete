// Modules to control application life and create native browser window
const { app, BrowserWindow, ipcMain, Notification } = require('electron')
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

function createWindow() {
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
    const settingsPath = path.join(app.getPath('userData'), 'settings.json')
    const settings = {
      apiKey: key,
      timestamp: new Date().toISOString()
    }
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2))
    console.log('API key saved to:', settingsPath)
    return { success: true }
  } catch (error) {
    console.error('Error saving API key:', error)
    return { success: false, error: error.message }
  }
})

// Handle getting API key
ipcMain.handle('get-api-key', async () => {
  try {
    const settingsPath = path.join(app.getPath('userData'), 'settings.json')
    if (!fs.existsSync(settingsPath)) {
      return { success: true, apiKey: '' }
    }
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
    return { success: true, apiKey: settings.apiKey || '' }
  } catch (error) {
    console.error('Error getting API key:', error)
    return { success: false, error: error.message }
  }
})

// Handle running the Python assistant
ipcMain.handle('run-assistant', async (event, taskDescription) => {
  try {
    const settingsPath = path.join(app.getPath('userData'), 'settings.json')
    if (!fs.existsSync(settingsPath)) {
      throw new Error('OpenAI API key not found. Please add your API key in the Settings tab.')
    }

    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
    const apiKey = settings.apiKey

    if (!apiKey || !apiKey.startsWith('sk-')) {
      throw new Error('Invalid OpenAI API key format. Please check your API key in the Settings tab.')
    }

    // Path to the Python script and virtual environment
    const agentDir = path.join(__dirname, '..', 'agent')
    const pythonScript = path.join(agentDir, 'assistant.py')
    const venvPython = path.join(agentDir, '.venv', 'bin', 'python')

    // Verify paths exist
    if (!fs.existsSync(pythonScript)) {
      throw new Error('Assistant script not found. Please ensure the agent directory is properly set up.')
    }
    if (!fs.existsSync(venvPython)) {
      throw new Error('Python virtual environment not found. Please run setup instructions from the README.')
    }

    console.log('Running assistant with task:', taskDescription)

    // Escape the task description for command line
    const escapedTask = JSON.stringify(taskDescription)

    const pythonProcess = spawn(venvPython, [
      pythonScript,
      apiKey,
      escapedTask
    ], {
      env: { ...process.env },
      cwd: agentDir  // Set working directory to agent folder
    })

    let output = ''
    let error = ''

    pythonProcess.stdout.on('data', (data) => {
      const text = data.toString()
      output += text
      console.log('Python output:', text)
    })

    pythonProcess.stderr.on('data', (data) => {
      const text = data.toString()
      error += text
      console.error('Python error:', text)
    })

    return new Promise((resolve, reject) => {
      pythonProcess.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true, output })
        } else {
          // Check for specific error types
          if (error.includes('invalid_api_key')) {
            reject(new Error('Invalid OpenAI API key. Please check your API key in the Settings tab.'))
          } else if (error.includes('No module named')) {
            reject(new Error('Missing Python dependencies. Please run: pip install -r requirements.txt in the agent directory.'))
          } else {
            reject(new Error(error || 'Assistant failed to run'))
          }
        }
      })
    })
  } catch (error) {
    console.error('Error running assistant:', error)
    return { success: false, error: error.message }
  }
})

// Parse tasks from screenpipe output
function parseTasksFromOutput(output) {
  const taskRegex = /\[tasks-auto-complete\] TASK:\s*(.*)/g;
  const tasks = [];
  let match;

  while ((match = taskRegex.exec(output)) !== null) {
    const task = match[1].trim();
    tasks.push(task);
    // Show OS notification for new task
    new Notification({
      title: 'New Task Takeover Request',
      body: task
    }).show();
  }

  return tasks;
}

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

    // Check if screenpipe is installed
    try {
      await new Promise((resolve, reject) => {
        const check = spawn('screenpipe', ['--version'], { shell: true })
        check.on('error', reject)
        check.on('close', code => {
          if (code === 0) resolve()
          else reject(new Error('Screenpipe check failed'))
        })
      })
    } catch (error) {
      console.error('Screenpipe installation check failed:', error)
      throw new Error('Screenpipe is not installed or not in PATH.')
    }

    // Ensure recordings directory exists
    if (!fs.existsSync(recordingsPath)) {
      fs.mkdirSync(recordingsPath, { recursive: true })
    }

    console.log('Starting screenpipe process...')

    // Start screenpipe process with minimal options first
    const settingsPath = path.join(app.getPath('userData'), 'settings.json')
    if (!fs.existsSync(settingsPath)) {
      throw new Error('OpenAI API key not found. Please add your API key in the Settings tab.')
    }

    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
    const apiKey = settings.apiKey

    screenpipeProcess = spawn('screenpipe', ['--disable-telemetry'], {
      shell: true,
      env: {
        ...process.env,
        OPENAI_API_KEY: apiKey // Add OpenAI API key to environment
      }
    })

    // Add error handling and logging
    screenpipeProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log('Screenpipe output:', output);

      // Parse and handle tasks
      const tasks = parseTasksFromOutput(output);
      if (tasks.length > 0) {
        tasks.forEach(task => {
          console.log('Found task:', task);
          // Send task to renderer process
          if (mainWindow) {
            mainWindow.webContents.send('new-task', task);
          }
        });
      }
    })

    screenpipeProcess.stderr.on('data', (data) => {
      console.error('Screenpipe error:', data.toString())
    })

    screenpipeProcess.on('error', (error) => {
      console.error('Failed to start screenpipe:', error)
      screenpipeProcess = null
      return { success: false, error: error.message }
    })

    return new Promise((resolve) => {
      screenpipeProcess.on('spawn', () => {
        console.log('Screenpipe process spawned successfully')
        resolve({ success: true })
      })

      // Add a timeout in case the process doesn't start
      setTimeout(() => {
        if (screenpipeProcess) {
          resolve({ success: true })
        } else {
          resolve({ success: false, error: 'Screenpipe process failed to start' })
        }
      }, 5000)
    })

  } catch (error) {
    console.error('Error in start-screenpipe handler:', error)
    return { success: false, error: error.message }
  }
})
