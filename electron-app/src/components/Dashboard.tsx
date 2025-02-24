import React from 'react';
import { Task, NotificationActionData } from '../types';
import ReactMarkdown from 'react-markdown';

interface DashboardProps {
  isRecording: boolean;
  tasks: Task[];
  message: { type: 'success' | 'error'; text: string; } | null;
  isAssistantActive: boolean;
  onToggleRecording: () => void;
  onTaskAction: (task: Task, action: 'accept' | 'ignore') => Promise<void>;
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
  const [processing, setProcessing] = React.useState<string | null>(null);

  const startProcessing = async (task: Task) => {
    try {
      setProcessing(task.description);
      await onTaskAction(task, 'accept');
    } catch (error) {
      console.error('Error processing task:', error);
    } finally {
      setProcessing(null);
    }
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
                  <ReactMarkdown>{task.description.trim()}</ReactMarkdown>
                </div>
              </div>
            </div>
            <div className="task-actions">
              {processing === task.description ? (
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
              ) : (
                <>
                  <button 
                    className="primary-button"
                    onClick={async () => {
                      startProcessing(task);
                    }}
                  >
                    Accept
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