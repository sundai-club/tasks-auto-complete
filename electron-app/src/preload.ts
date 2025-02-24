import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import { Task, NotificationActionData } from './types';

// Type definitions for our electron API
type ElectronAPI = {
  saveApiKey: (key: string) => Promise<{ success: boolean; error?: string }>;
  getApiKey: () => Promise<{ success: boolean; apiKey: string; error?: string }>;
  startScreenpipe: () => Promise<{ success: boolean; error?: string }>;
  stopScreenpipe: () => Promise<{ success: boolean; error?: string }>;
  stopAssistant: () => Promise<{ success: boolean; error?: string }>;
  runAssistant: (taskDescription: string) => Promise<{ success: boolean; output?: string; error?: string }>;
  onNewTask: (callback: (task: Task) => void) => () => void;
  onNotificationAction: (callback: (data: NotificationActionData) => void) => () => void;
  onTaskProcessing: (callback: (task: Task) => void) => () => void;
  onTaskProcessingDone: (callback: (task: Task) => void) => () => void;
  getProfile: () => Promise<{ success: boolean; profile: string; error?: string }>;
  saveProfile: (profile: string) => Promise<{ success: boolean; error?: string }>;
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
    stopAssistant: () => ipcRenderer.invoke('stop-assistant'),
    runAssistant: (taskDescription: string) => ipcRenderer.invoke('run-assistant', taskDescription),
    onNewTask: (callback: (task: Task) => void) => {
      const subscription = (_event: IpcRendererEvent, task: Task) => callback(task);
      ipcRenderer.on('new-task', subscription);
      return () => {
        ipcRenderer.removeListener('new-task', subscription);
      };
    },
    onNotificationAction: (callback: (data: NotificationActionData) => void) => {
      const subscription = (_event: IpcRendererEvent, data: NotificationActionData) => callback(data);
      ipcRenderer.on('notification-action', subscription);
      return () => {
        ipcRenderer.removeListener('notification-action', subscription);
      };
    },
    getProfile: () => ipcRenderer.invoke('get-profile'),
    saveProfile: (profile: string) => ipcRenderer.invoke('save-profile', profile),
    onTaskProcessing: (callback: (task: Task) => void) => {
      const subscription = (_event: IpcRendererEvent, task: Task) => callback(task);
      ipcRenderer.on('task-processing', subscription);
      return () => {
        ipcRenderer.removeListener('task-processing', subscription);
      };
    },
    onTaskProcessingDone: (callback: (task: Task) => void) => {
      const subscription = (_event: IpcRendererEvent, task: Task) => callback(task);
      ipcRenderer.on('task-processing-done', subscription);
      return () => {
        ipcRenderer.removeListener('task-processing-done', subscription);
      };
    },
  } as ElectronAPI
);