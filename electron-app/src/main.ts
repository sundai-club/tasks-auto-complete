import { app, BrowserWindow, ipcMain, Notification, IpcMainInvokeEvent, WebContents } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as http from 'http';
import { spawn, ChildProcess } from 'child_process';
import express from 'express';
import cors from 'cors';

interface Settings {
  apiKey: string;
  timestamp: string;
  userProfile: string;
  profileTimestamp: string;
}

interface Task {
  id: string;
  description: string;
  timestamp: string;
}

let mainWindow: BrowserWindow | null = null;
let screenpipeProcess: ChildProcess | null = null;
let assistantProcess: ChildProcess | null = null;

// Function to kill the assistant process
async function killAssistantProcess() {
  if (assistantProcess) {
    console.log('Killing assistant process...');
    try {
      // Check if process is still running
      try {
        process.kill(assistantProcess.pid!, 0);
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === 'ESRCH') {
          console.log('Process already terminated');
          assistantProcess = null;
          return;
        }
      }

      // Send SIGTERM first for graceful shutdown
      process.kill(assistantProcess.pid!, 'SIGTERM');
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check if process is still running after SIGTERM
      try {
        process.kill(assistantProcess.pid!, 0);
        // If we get here, process is still running, force kill it
        console.log('Force killing assistant process...');
        process.kill(assistantProcess.pid!, 'SIGKILL');
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'ESRCH') {
          throw e;
        }
        // Process not found, which means it's already terminated
        console.log('Process terminated');
      }
    } catch (error) {
      console.error('Error killing assistant process:', error);
      throw error;
    } finally {
      assistantProcess = null;
    }
  }
}

// Define recordings directory path
const recordingsPath: string = path.join(__dirname, '..', 'recordings');

// Create Express app for receiving tasks from Chrome extension
const expressApp = express();
expressApp.use(cors());
expressApp.use(express.json());

// Handle new tasks from Chrome extension
expressApp.post('/new-task', (req, res) => {
  try {
    const { description, timestamp } = req.body;
    console.log('Received new task:', { description, timestamp });

    // Create task object with unique ID
    const task: Task = {
      id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      description,
      timestamp
    };
    
    // Show notification
    showNotificationWithActions(task);

    // Send task to renderer process
    if (mainWindow) {
      mainWindow.webContents.send('new-task', task);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error handling new task:', error);
    const err = error as Error;
    res.status(500).json({ error: err.message });
  }
});

// Start HTTP server
const server = http.createServer(expressApp);
server.listen(3000, () => {
  console.log('Task server listening on port 3000');
});

// Add support for secure restorable state on macOS
if (process.platform === 'darwin') {
  // @ts-ignore - This property exists but is not in the types
  app.applicationSupportsSecureRestorableState = true;
}

function createWindow(): void {
  console.log('Creating window...');
  console.log('App path:', app.getAppPath());
  console.log('Current working directory:', process.cwd());

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: true
    }
  });

  if (process.env.NODE_ENV === 'development') {
    require('electron-reload')(__dirname, {
      electron: path.join(__dirname, '..', 'node_modules', '.bin', 'electron')
    });
  }

  const indexPath = path.join(__dirname, 'index.html');
  console.log('Loading index.html from:', indexPath);
  console.log('File exists:', fs.existsSync(indexPath));
  
  mainWindow.loadFile(indexPath)
    .then(() => {
      console.log('Successfully loaded index.html');
      if (process.env.NODE_ENV === 'development' && mainWindow) {
        mainWindow.webContents.openDevTools();
      }
    })
    .catch((err) => {
      console.error('Failed to load index.html:', err);
    });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Handle saving API key
ipcMain.handle('save-api-key', async (_event: IpcMainInvokeEvent, key: string) => {
  try {
    const settingsPath: string = path.join(app.getPath('userData'), 'settings.json');
    const settings: Settings = {
      apiKey: key,
      timestamp: new Date().toISOString(),
      userProfile: '',
      profileTimestamp: ''
    };
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    console.log('API key saved to:', settingsPath);
    return { success: true };
  } catch (error) {
    console.error('Error saving API key:', error);
    return { success: false, error: (error as Error).message };
  }
});

// Handle getting API key
ipcMain.handle('get-api-key', async () => {
  try {
    const settingsPath: string = path.join(app.getPath('userData'), 'settings.json');
    if (!fs.existsSync(settingsPath)) {
      return { success: true, apiKey: '' };
    }
    const settings: Settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    return { success: true, apiKey: settings.apiKey || '' };
  } catch (error) {
    console.error('Error getting API key:', error);
    return { success: false, error: (error as Error).message };
  }
});

// Handle saving profile
ipcMain.handle('save-profile', async (_event: IpcMainInvokeEvent, profile: string) => {
  try {
    const settingsPath: string = path.join(app.getPath('userData'), 'settings.json');
    let settings = {};
    if (fs.existsSync(settingsPath)) {
      settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    }
    settings = {
      ...settings,
      userProfile: profile,
      profileTimestamp: new Date().toISOString()
    };
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    return { success: true };
  } catch (error) {
    console.error('Error saving profile:', error);
    return { success: false, error: (error as Error).message };
  }
});

// Handle getting profile
ipcMain.handle('get-profile', async () => {
  try {
    const settingsPath: string = path.join(app.getPath('userData'), 'settings.json');
    if (!fs.existsSync(settingsPath)) {
      return { success: true, profile: '' };
    }
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    return { success: true, profile: settings.userProfile || '' };
  } catch (error) {
    console.error('Error getting profile:', error);
    return { success: false, error: (error as Error).message };
  }
});

// Parse tasks from screenpipe output
function parseTasksFromOutput(output: string): Task[] {
  const taskRegex = /\[tasks-auto-complete\] TASK:\s*(.*)/g;
  const tasks: Task[] = [];

  let match: RegExpExecArray | null;
  while ((match = taskRegex.exec(output)) !== null) {
    const task: Task = {
      id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      description: match[1].trim(),
      timestamp: new Date().toISOString()
    };

    tasks.push(task);
    showNotificationWithActions(task);
  }

  return tasks;
}

// Function to show notification with actions
function showNotificationWithActions(task: Task): void {
  const notification = new Notification({
    title: 'New Task Available',
    body: task.description,
    actions: [
      { type: 'button', text: 'Accept' },
      { type: 'button', text: 'Ignore' }
    ],
    silent: false
  });

  // @ts-ignore - 'action' event exists but is not in the types
  notification.on('action', async (_event: Event, index: number) => {
    const action = index === 0 ? 'accept' : 'ignore';
    if (mainWindow) {
      if (action === 'accept') {
        try {
          // Get user profile and API key
          const settingsPath = path.join(app.getPath('userData'), 'settings.json');
          const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
          const userProfile = settings.userProfile || '';

          // Combine user profile with task description
          const fullTaskDescription = userProfile
            ? `User Profile:\n${userProfile}\n\nTask:\n${task.description}`
            : task.description;

          // Update UI state
          mainWindow.webContents.send('task-processing', task);
          mainWindow.webContents.send('assistant-started');

          // Run the assistant
          const result = await runAssistant(fullTaskDescription);
          if (result.success) {
            mainWindow.webContents.send('task-completed', task);
          } else {
            throw new Error(result.error || 'Failed to execute task');
          }
        } catch (error) {
          console.error('Error running task from notification:', error);
          mainWindow.webContents.send('task-error', { 
            task, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
        } finally {
          mainWindow.webContents.send('assistant-stopped');
          mainWindow.webContents.send('task-processing-done', task);
        }
      }
      mainWindow.webContents.send('notification-action', { task, action });
    }
  });

  notification.show();
}

// Handle stopping screenpipe
ipcMain.handle('stop-screenpipe', async () => {
  if (screenpipeProcess) {
    try {
      try {
        process.kill(screenpipeProcess.pid!, 0);
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === 'ESRCH') {
          console.log('Process already terminated');
          screenpipeProcess = null;
          return { success: true };
        }
      }

      process.kill(screenpipeProcess.pid!, 'SIGTERM');
      await new Promise(resolve => setTimeout(resolve, 2000));

      try {
        process.kill(screenpipeProcess.pid!, 0);
        process.kill(screenpipeProcess.pid!, 'SIGKILL');
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'ESRCH') {
          throw e;
        }
      }

      console.log('Screenpipe stopped successfully, data saved to:', recordingsPath);
      screenpipeProcess = null;
      return { success: true };
    } catch (error) {
      console.error('Error stopping screenpipe:', error);
      screenpipeProcess = null;
      return { success: false, error: (error as Error).message };
    }
  }
  return { success: true };
});

// Handle starting screenpipe
ipcMain.handle('start-screenpipe', async () => {
  try {
    if (screenpipeProcess) {
      return { success: false, error: 'Recording already in progress' };
    }

    try {
      await new Promise<void>((resolve, reject) => {
        const check = spawn('screenpipe', ['--version'], { shell: true });
        check.on('error', reject);
        check.on('close', (code: number) => {
          if (code === 0) resolve();
          else reject(new Error('Screenpipe check failed'));
        });
      });
    } catch (error) {
      console.error('Screenpipe installation check failed:', error);
      throw new Error('Screenpipe is not installed or not in PATH.');
    }

    if (!fs.existsSync(recordingsPath)) {
      fs.mkdirSync(recordingsPath, { recursive: true });
    }

    console.log('Starting screenpipe process...');

    const settingsPath: string = path.join(app.getPath('userData'), 'settings.json');
    if (!fs.existsSync(settingsPath)) {
      throw new Error('OpenAI API key not found. Please add your API key in the Settings tab.');
    }

    const settings: Settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    const apiKey = settings.apiKey;

    screenpipeProcess = spawn('screenpipe', ['--disable-telemetry'], {
      shell: true,
      env: {
        ...process.env,
        OPENAI_API_KEY: apiKey
      }
    });

    screenpipeProcess.stdout?.on('data', (data: Buffer) => {
      const output = data.toString();
      console.log('Screenpipe output:', output);

      const tasks = parseTasksFromOutput(output);
      if (tasks.length > 0) {
        tasks.forEach(task => {
          console.log('Found task:', task);
          if (mainWindow) {
            mainWindow.webContents.send('new-task', task);
          }
        });
      }
    });

    screenpipeProcess.stderr?.on('data', (data: Buffer) => {
      console.error('Screenpipe error:', data.toString());
    });

    screenpipeProcess.on('error', (error: Error) => {
      console.error('Failed to start screenpipe:', error);
      screenpipeProcess = null;
      return { success: false, error: error.message };
    });

    return new Promise((resolve) => {
      screenpipeProcess!.on('spawn', () => {
        console.log('Screenpipe process spawned successfully');
        resolve({ success: true });
      });

      setTimeout(() => {
        if (screenpipeProcess) {
          resolve({ success: true });
        } else {
          resolve({ success: false, error: 'Screenpipe process failed to start' });
        }
      }, 5000);
    });

  } catch (error) {
    console.error('Error in start-screenpipe handler:', error);
    return { success: false, error: (error as Error).message };
  }
});

// Handle stopping the assistant
ipcMain.handle('stop-assistant', async () => {
  try {
    await killAssistantProcess();
    if (mainWindow) {
      mainWindow.webContents.send('assistant-stopped');
    }
    return { success: true };
  } catch (error) {
    console.error('Error stopping assistant:', error);
    const err = error as Error;
    return { success: false, error: err.message };
  }
});

// Run assistant with a task
async function runAssistant(taskDescription: string): Promise<{ success: boolean; output?: string; error?: string }> {
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
    const agentDir = path.join(__dirname, '../..', 'agent')
    const pythonScript = path.join(agentDir, 'assistant.py')
    const venvPython = path.join(agentDir, '.venv', 'bin', 'python')

    // Verify paths exist
    if (!fs.existsSync(pythonScript)) {
      throw new Error(`Assistant script not found. Please ensure the agent directory is properly set up. Path: ${pythonScript}`)
    }
    if (!fs.existsSync(venvPython)) {
      throw new Error('Python virtual environment not found. Please run setup instructions from the README.')
    }

    // Get user profile from settings
    const userProfile = settings.userProfile || '';

    // Combine user profile with task description
    const fullTaskDescription = userProfile
      ? `User Profile:\n${userProfile}\n\nTask:\n${taskDescription}`
      : taskDescription;

    console.log('Running assistant with task:', fullTaskDescription)

    // Escape the task description for command line
    const escapedTask = JSON.stringify(fullTaskDescription)

    // Kill any existing assistant process
    killAssistantProcess();

    assistantProcess = spawn(venvPython, [
      pythonScript,
      apiKey,
      escapedTask
    ], {
      env: { ...process.env },
      cwd: agentDir  // Set working directory to agent folder
    })

    let output = ''
    let error = ''

    assistantProcess!.stdout?.on('data', (data: Buffer) => {
      const text = data.toString()
      output += text
      console.log('Python output:', text)
    })

    assistantProcess!.stderr?.on('data', (data: Buffer) => {
      const text = data.toString()
      error += text
      console.error('Python error:', text)
    })

    return await new Promise((resolve, reject) => {
      assistantProcess!.on('close', (code) => {
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
    console.error('Error running assistant:', error);
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: 'An unknown error occurred' };
  }
}

// Handle running the Python assistant
ipcMain.handle('run-assistant', async (event, taskDescription) => {
  return await runAssistant(taskDescription);
});