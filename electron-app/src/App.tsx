import React, { useState, useEffect } from 'react';
import { Task, Message, PageType } from './types';
import { Dashboard } from './components/Dashboard';
import { Settings } from './components/Settings';

export function App() {
  const [currentPage, setCurrentPage] = useState<PageType>('dashboard');
  const [apiKey, setApiKey] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [processingTask, setProcessingTask] = useState<string | null>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const [isApiKeyVisible, setIsApiKeyVisible] = useState(false);

  useEffect(() => {
    // Load API key on mount
    loadApiKey();

    // Set up task listener with cleanup
    const cleanupTaskListener = window.electronAPI.onNewTask((task) => {
      setTasks(prev => [...prev, task]);
    });

    // Set up notification action listener with cleanup
    const cleanupNotificationListener = window.electronAPI.onNotificationAction((action) => {
      console.log('Notification action received:', action);
    });

    // Cleanup function
    return () => {
      cleanupTaskListener && cleanupTaskListener();
      cleanupNotificationListener && cleanupNotificationListener();
    };
  }, []);

  const loadApiKey = async () => {
    try {
      const result = await window.electronAPI.getApiKey();
      if (result.success) {
        setApiKey(result.apiKey);
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to load API key' });
    }
  };

  const handleSaveApiKey = async () => {
    try {
      const result = await window.electronAPI.saveApiKey(apiKey);
      if (result.success) {
        setMessage({ type: 'success', text: 'API key saved successfully' });
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to save API key' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save API key' });
    }
  };

  const toggleRecording = async () => {
    try {
      if (!isRecording) {
        const result = await window.electronAPI.startScreenpipe();
        if (result.success) {
          setIsRecording(true);
          setMessage({ type: 'success', text: 'Recording started' });
        } else {
          setMessage({ type: 'error', text: result.error || 'Failed to start recording' });
        }
      } else {
        const result = await window.electronAPI.stopScreenpipe();
        if (result.success) {
          setIsRecording(false);
          setMessage({ type: 'success', text: 'Recording stopped' });
        } else {
          setMessage({ type: 'error', text: result.error || 'Failed to stop recording' });
        }
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to toggle recording' });
    }
  };

  return (
    <div>
      <div className="sidebar">
        <div className="logo">AutoTask</div>
        <button 
          className={`nav-button ${currentPage === 'dashboard' ? 'active' : ''}`}
          onClick={() => setCurrentPage('dashboard')}
          disabled={processingTask !== null}
        >
          Dashboard
        </button>
        <button 
          className={`nav-button ${currentPage === 'settings' ? 'active' : ''}`}
          onClick={() => setCurrentPage('settings')}
          disabled={processingTask !== null}
        >
          Settings
        </button>
        {processingTask && (
          <div className="processing-indicator">
            Processing task...
          </div>
        )}
      </div>

      <div className="main-content">
        {currentPage === 'dashboard' && (
          <Dashboard
            isRecording={isRecording}
            tasks={tasks}
            message={message}
            onToggleRecording={toggleRecording}
            onTaskAction={async (task, action) => {
              console.log(`Task ${action}:`, task);
              try {
                setProcessingTask(task.description);
                
                if (action === 'accept') {
                  const result = await window.electronAPI.runAssistant(task.description);
                  if (result.success) {
                    setMessage({ type: 'success', text: 'Task executed successfully' });
                  } else {
                    throw new Error(result.error || 'Failed to execute task');
                  }
                }
                
                // Remove the task from the list
                setTasks(prev => prev.filter(t => t.description !== task.description));
              } catch (error) {
                console.error('Task action error:', error);
                setMessage({ 
                  type: 'error', 
                  text: `Failed to process task: ${error instanceof Error ? error.message : 'Unknown error'}` 
                });
              } finally {
                setProcessingTask(null);
              }
            }}
          />
        )}
        {currentPage === 'settings' && (
          <Settings
            apiKey={apiKey}
            isApiKeyVisible={isApiKeyVisible}
            message={message}
            onApiKeyChange={setApiKey}
            onToggleApiKeyVisibility={() => setIsApiKeyVisible(!isApiKeyVisible)}
            onSaveApiKey={handleSaveApiKey}
          />
        )}
      </div>
    </div>
  );
}