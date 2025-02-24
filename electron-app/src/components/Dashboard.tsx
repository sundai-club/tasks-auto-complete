import React from 'react';
import { Task } from '../types';

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
                <p className="task-description">{task.description}</p>
              </div>
            </div>
            <div className="task-actions">
              {processing === task.description ? (
                <div className="processing-container">
                  <div className="processing">Processing...</div>
                  {isAssistantActive && (
                    <button
                      className="danger-button"
                      onClick={onStopAssistant}
                    >
                      Stop
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <button 
                    className="primary-button"
                    onClick={async () => {
                      try {
                        setProcessing(task.description);
                        await onTaskAction(task, 'accept');
                      } catch (error) {
                        console.error('Error processing task:', error);
                      } finally {
                        setProcessing(null);
                      }
                    }}
                  >
                    Accept
                  </button>
                  {!isAssistantActive && (
                    <button 
                      className="secondary-button"
                      onClick={() => onTaskAction(task, 'ignore')}
                    >
                      Ignore
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
};