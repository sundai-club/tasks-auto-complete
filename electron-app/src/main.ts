import { app, BrowserWindow, ipcMain, Notification, IpcMainInvokeEvent, WebContents } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { spawn, ChildProcess } from 'child_process';

interface Settings {
  apiKey: string;
  timestamp: string;
}

interface Task {
  description: string;
  timestamp: string;
}

let mainWindow: BrowserWindow | null = null;
let screenpipeProcess: ChildProcess | null = null;

// Define recordings directory path
const recordingsPath: string = path.join(__dirname, '..', 'recordings');

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
      timestamp: new Date().toISOString()
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

// Parse tasks from screenpipe output
function parseTasksFromOutput(output: string): Task[] {
  const taskRegex = /\[tasks-auto-complete\] TASK:\s*(.*)/g;
  const tasks: Task[] = [];

  let match: RegExpExecArray | null;
  while ((match = taskRegex.exec(output)) !== null) {
    const task: Task = {
      description: match[1].trim(),
      timestamp: new Date().toISOString()
    };

    tasks.push(task);
    new Notification({
      title: 'New Task Takeover Request',
      body: `${task.description}\nReceived at: ${new Date().toLocaleTimeString()}`,
      urgency: 'critical'
    }).show();
  }

  return tasks;
}

// Function to show notification with actions
function showNotificationWithActions(title: string, body: string): void {
  const notification = new Notification({
    title,
    body,
    actions: [
      { type: 'button', text: 'Accept' },
      { type: 'button', text: 'Ignore' }
    ],
    silent: false
  });

  // @ts-ignore - 'action' event exists but is not in the types
  notification.on('action', (_event: Event, index: number) => {
    const action = index === 0 ? 'accept' : 'ignore';
    if (mainWindow) {
      mainWindow.webContents.send('notification-action', action);
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