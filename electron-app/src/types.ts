declare global {
  interface Window {
    electronAPI: {
      saveApiKey: (key: string) => Promise<{ success: boolean; error?: string }>;
      getApiKey: () => Promise<{ success: boolean; apiKey: string; error?: string }>;
      startScreenpipe: () => Promise<{ success: boolean; error?: string }>;
      stopScreenpipe: () => Promise<{ success: boolean; error?: string }>;
      stopAssistant: () => Promise<{ success: boolean; error?: string }>;
      runAssistant: (taskDescription: string) => Promise<{ success: boolean; output?: string; error?: string }>;
      onNewTask: (callback: (task: Task) => void) => () => void;
      onNotificationAction: (callback: (data: NotificationActionData) => void) => () => void;
      getProfile: () => Promise<{ success: boolean; profile: string; error?: string }>;
      saveProfile: (profile: string) => Promise<{ success: boolean; error?: string }>;
      onTaskProcessing: (callback: (task: Task) => void) => () => void;
      onTaskProcessingDone: (callback: (task: Task) => void) => () => void;
    };
  }
}

export interface Task {
  id: string;
  description: string;
  timestamp: string;
}

export interface Message {
  type: 'success' | 'error';
  text: string;
}

export type PageType = 'dashboard' | 'settings';

export interface NotificationActionData {
  task: Task;
  action: 'accept' | 'ignore';
}