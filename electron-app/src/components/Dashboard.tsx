import React from 'react';
import { Task } from '../types';

interface DashboardProps {
  isRecording: boolean;
  tasks: Task[];
  message: { type: 'success' | 'error'; text: string; } | null;
  onToggleRecording: () => void;
  onTaskAction: (task: Task, action: 'accept' | 'ignore') => Promise<void>;
}

export const Dashboard: React.FC<DashboardProps> = ({ 
  isRecording, 
  tasks, 
  message, 
  onToggleRecording,
  onTaskAction
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
              <button 
                className="primary-button"
                disabled={processing === task.description}
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
                {processing === task.description ? 'Processing...' : 'Accept'}
              </button>
              <button 
                className="secondary-button"
                disabled={processing === task.description}
                onClick={() => onTaskAction(task, 'ignore')}
              >
                Ignore
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
};