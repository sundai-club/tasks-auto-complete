import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import { Task } from './types';

// Type definitions for our electron API
type ElectronAPI = {
  saveApiKey: (key: string) => Promise<{ success: boolean; error?: string }>;
  getApiKey: () => Promise<{ success: boolean; apiKey: string; error?: string }>;
  startScreenpipe: () => Promise<{ success: boolean; error?: string }>;
  stopScreenpipe: () => Promise<{ success: boolean; error?: string }>;
  runAssistant: (taskDescription: string) => Promise<{ success: boolean; output?: string; error?: string }>;
  onNewTask: (callback: (task: Task) => void) => () => void;
  onNotificationAction: (callback: (action: 'accept' | 'ignore') => void) => () => void;
};

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'electronAPI',
  {
    saveApiKey: (key: string) => ipcRenderer.invoke('save-api-key', key),
    getApiKey: () => ipcRenderer.invoke('get-api-key'),
    startScreenpipe: () => ipcRenderer.invoke('start-screenpipe'),
    stopScreenpipe: () => ipcRenderer.invoke('stop-screenpipe'),
    runAssistant: (taskDescription: string) => ipcRenderer.invoke('run-assistant', taskDescription),
    onNewTask: (callback: (task: Task) => void) => {
      const subscription = (_event: IpcRendererEvent, task: Task) => callback(task);
      ipcRenderer.on('new-task', subscription);
      return () => {
        ipcRenderer.removeListener('new-task', subscription);
      };
    },
    onNotificationAction: (callback: (action: 'accept' | 'ignore') => void) => {
      const subscription = (_event: IpcRendererEvent, action: 'accept' | 'ignore') => callback(action);
      ipcRenderer.on('notification-action', subscription);
      return () => {
        ipcRenderer.removeListener('notification-action', subscription);
      };
    }
  } as ElectronAPI
);