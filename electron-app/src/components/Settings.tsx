import React from 'react';

interface SettingsProps {
  apiKey: string;
  isApiKeyVisible: boolean;
  message: { type: 'success' | 'error'; text: string; } | null;
  onApiKeyChange: (key: string) => void;
  onToggleApiKeyVisibility: () => void;
  onSaveApiKey: () => void;
}

export const Settings: React.FC<SettingsProps> = ({
  apiKey,
  isApiKeyVisible,
  message,
  onApiKeyChange,
  onToggleApiKeyVisibility,
  onSaveApiKey
}) => {
  return (
    <div className="card">
      <h2>Settings</h2>
      <div className="form-group">
        <label>OpenAI API Key</label>
        <div className="input-group">
          <input
            type={isApiKeyVisible ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => onApiKeyChange(e.target.value)}
            placeholder="Enter your OpenAI API key"
          />
          <button
            id="toggleApiKey"
            className="secondary-button"
            onClick={onToggleApiKeyVisibility}
          >
            <span className="eye-icon">{isApiKeyVisible ? '👁️' : '👁️‍🗨️'}</span>
          </button>
        </div>
        <button className="primary-button" onClick={onSaveApiKey}>
          Save API Key
        </button>
        {message && (
          <div className={`message ${message.type}`}>
            {message.text}
          </div>
        )}
      </div>
    </div>
  );
};