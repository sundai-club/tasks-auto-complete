declare global {
  interface Window {
    electronAPI: {
      saveApiKey: (key: string) => Promise<{ success: boolean; error?: string }>;
      getApiKey: () => Promise<{ success: boolean; apiKey: string; error?: string }>;
      startScreenpipe: () => Promise<{ success: boolean; error?: string }>;
      stopScreenpipe: () => Promise<{ success: boolean; error?: string }>;
      runAssistant: (taskDescription: string) => Promise<{ success: boolean; output?: string; error?: string }>;
      onNewTask: (callback: (task: Task) => void) => () => void;
      onNotificationAction: (callback: (action: 'accept' | 'ignore') => void) => () => void;
      getProfile: () => Promise<{ success: boolean; profile: string; error?: string }>;
      saveProfile: (profile: string) => Promise<{ success: boolean; error?: string }>;
    };
  }
}

export interface Task {
  description: string;
  timestamp: string;
}

export interface Message {
  type: 'success' | 'error';
  text: string;
}

export type PageType = 'dashboard' | 'settings';