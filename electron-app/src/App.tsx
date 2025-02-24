import React, { useState, useEffect } from 'react';
import { Task, Message, PageType } from './types';
import { Dashboard } from './components/Dashboard';
import { Settings } from './components/Settings';

export function App() {
  const [currentPage, setCurrentPage] = useState<PageType>('dashboard');
  const [apiKey, setApiKey] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isAssistantActive, setIsAssistantActive] = useState(false);
  const [processingTask, setProcessingTask] = useState<string | null>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const [isApiKeyVisible, setIsApiKeyVisible] = useState(false);
  const [userProfile, setUserProfile] = useState('');

  useEffect(() => {
    // Load API key and profile on mount
    loadApiKey();
    loadUserProfile();

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

  const loadUserProfile = async () => {
    try {
      const result = await window.electronAPI.getProfile();
      if (result.success) {
        setUserProfile(result.profile);
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to load profile' });
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

  const handleSaveProfile = async () => {
    try {
      const result = await window.electronAPI.saveProfile(userProfile);
      if (result.success) {
        setMessage({ type: 'success', text: 'Profile saved successfully' });
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to save profile' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save profile' });
    }
  };

  const handleStopAssistant = async () => {
    try {
      const result = await window.electronAPI.stopAssistant();
      if (result.success) {
        setMessage({ type: 'success', text: 'Assistant stopped successfully' });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Error stopping assistant:', error);
      setMessage({ 
        type: 'error', 
        text: `Failed to stop assistant: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
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
        // const result = await window.electronAPI.runAssistant(`Automate the form filling process on Airtable. \n\nStep 1: Open the Airtable link provided.\n\nStep 2: Parse the form fields to identify the required information. These fields may include 'Name', 'Email', etc.\n\nStep 3: Fill in the user's details into the respective fields: \n- For the 'Name' field, enter 'Alexander Ivkin'.\n- For the 'Email' field, enter 'mit@ivkin.dev'.\n\nStep 4: For fields that are not mentioned in the user's profile, use intelligent prediction to fill them. For example, if there's a 'Company' field, you might enter a relevant company based on the user's email domain. If there's a 'Role' field, you might enter 'Developer' or 'Engineer' based on the user's email address. If there's a 'Date' field, use the current date.\n\nStep 5: After all fields are filled, submit the form.\n\nStep 6: Confirm the successful submission and notify the user.`);
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
            isAssistantActive={isAssistantActive}
            onToggleRecording={toggleRecording}
            onStopAssistant={handleStopAssistant}
            onTaskAction={async (task, action) => {
              console.log(`Task ${action}:`, task);
              try {
                setProcessingTask(task.description);
                
                if (action === 'accept') {
                  setIsAssistantActive(true);
                  try {
                    const result = await window.electronAPI.runAssistant(task.description);
                    if (result.success) {
                      setMessage({ type: 'success', text: 'Task executed successfully' });
                    } else {
                      throw new Error(result.error || 'Failed to execute task');
                    }
                  } finally {
                    setIsAssistantActive(false);
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
            userProfile={userProfile}
            isApiKeyVisible={isApiKeyVisible}
            message={message}
            onApiKeyChange={setApiKey}
            onProfileChange={setUserProfile}
            onToggleApiKeyVisibility={() => setIsApiKeyVisible(!isApiKeyVisible)}
            onSaveApiKey={handleSaveApiKey}
            onSaveProfile={handleSaveProfile}
          />
        )}
      </div>
    </div>
  );
}