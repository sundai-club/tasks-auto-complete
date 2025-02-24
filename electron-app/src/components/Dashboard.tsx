import React from 'react';
import { Task, NotificationActionData } from '../types';
import ReactMarkdown from 'react-markdown';

interface DashboardProps {
  isRecording: boolean;
  tasks: Task[];
  message: { type: 'success' | 'error'; text: string; } | null;
  isAssistantActive: boolean;
  onToggleRecording: () => void;
  onTaskAction: (task: Task, action: 'accept' | 'ignore', editedDescription?: string) => Promise<void>;
  onStopAssistant: () => Promise<void>;
}

export const Dashboard: React.FC<DashboardProps> = ({ 
  isRecording, 
  tasks, 
  message, 
  isAssistantActive,
  onToggleRecording,
  onTaskAction,
  onStopAssistant
}) => {
  const [processingTaskId, setProcessingTaskId] = React.useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = React.useState<string | null>(null);
  const [editedDescription, setEditedDescription] = React.useState<string>('');

  const startProcessing = async (task: Task) => {
    try {
      const description = editingTaskId === task.id ? editedDescription : task.description;
      setProcessingTaskId(task.id);
      await onTaskAction(task, 'accept', description);
      setEditingTaskId(null);
      setEditedDescription('');
    } catch (error) {
      console.error('Error processing task:', error);
    } finally {
      setProcessingTaskId(null);
    }
  };

  const handleEdit = (task: Task) => {
    setEditingTaskId(task.id);
    setEditedDescription(task.description);
  };

  const handleCancelEdit = () => {
    setEditingTaskId(null);
    setEditedDescription('');
  };

  React.useEffect(() => {
    const cleanup = window.electronAPI.onNotificationAction(async (data: NotificationActionData) => {
      if (data.action === 'accept' || data.action === 'ignore') {
        await startProcessing(data.task);
      }
    });

    return () => cleanup && cleanup();
  }, [onTaskAction]);

  return (
    <>
      <div className="card">
        <h2>Task Recording</h2>
        <button
          className={isRecording ? 'danger-button' : 'primary-button'}
          onClick={onToggleRecording}
        >
          {isRecording ? 'Stop Recording' : 'Start Recording'}
        </button>
        {message && (
          <div className={`message ${message.type}`}>
            {message.text}
          </div>
        )}
      </div>

      <div className="card">
        <h2>Recent Tasks</h2>
        {tasks.map((task, index) => (
          <div key={index} className="task-bubble">
            <div className="task-content">
              <div className="task-icon">🎯</div>
              <div>
                <p className="task-timestamp">
                  {new Date(task.timestamp).toLocaleString()}
                </p>
                <div className="task-description" style={{
                  wordBreak: 'break-word',
                  maxWidth: '100%',
                  overflow: 'hidden'
                }}>
                  {editingTaskId === task.id ? (
                    <textarea
                      value={editedDescription}
                      onChange={(e) => setEditedDescription(e.target.value)}
                      style={{
                        width: '100%',
                        minHeight: '100px',
                        padding: '8px',
                        marginBottom: '8px',
                        resize: 'vertical'
                      }}
                    />
                  ) : (
                    <ReactMarkdown>{task.description.trim()}</ReactMarkdown>
                  )}
                </div>
              </div>
            </div>
            <div className="task-actions">
              {processingTaskId === task.id ? (
                <div className="processing-container">
                  <div className="processing">Processing...</div>
                  <button
                    className="danger-button"
                    onClick={onStopAssistant}
                  >
                    Stop
                  </button>
                </div>
              ) : isAssistantActive ? (
                <div className="task-actions-disabled">
                  <button className="primary-button" disabled>
                    Accept
                  </button>
                  <button className="secondary-button" disabled>
                    Ignore
                  </button>
                </div>
              ) : editingTaskId === task.id ? (
                <>
                  <button 
                    className="primary-button"
                    onClick={async () => {
                      startProcessing(task);
                    }}
                  >
                    Save & Accept
                  </button>
                  <button 
                    className="secondary-button"
                    onClick={handleCancelEdit}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button 
                    className="primary-button"
                    onClick={() => handleEdit(task)}
                  >
                    Edit
                  </button>
                  <button 
                    className="secondary-button"
                    onClick={() => onTaskAction(task, 'ignore')}
                  >
                    Ignore
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
};