import React from 'react';
import { Task } from '../types';

interface DashboardProps {
  isRecording: boolean;
  tasks: Task[];
  message: { type: 'success' | 'error'; text: string; } | null;
  onToggleRecording: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ 
  isRecording, 
  tasks, 
  message, 
  onToggleRecording 
}) => {
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
              <button className="primary-button">Accept</button>
              <button className="secondary-button">Ignore</button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
};