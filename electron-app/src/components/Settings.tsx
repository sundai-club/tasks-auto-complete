import React from 'react';

interface SettingsProps {
  apiKey: string;
  about: string;
  isApiKeyVisible: boolean;
  message: { type: 'success' | 'error'; text: string; } | null;
  onApiKeyChange: (key: string) => void;
  onAboutChange: (about: string) => void;
  onToggleApiKeyVisibility: () => void;
}

export const Settings: React.FC<SettingsProps> = ({
  apiKey,
  about,
  isApiKeyVisible,
  message,
  onApiKeyChange,
  onAboutChange,
  onToggleApiKeyVisibility,
}) => {
  const handleSaveSettings = () => {
    const data = {
      apiKey,
      about,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'settings.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
      </div>
      
      <div className="form-group">
        <label>Tell us more about yourself</label>
        <textarea
          value={about}
          onChange={(e) => onAboutChange(e.target.value)}
          placeholder="Share some details about your interests, background, or anything you'd like us to know..."
        />
      </div>
      
      <button className="primary-button" onClick={handleSaveSettings}>
        Save Settings
      </button>
      
      {message && (
        <div className={`message ${message.type}`}>
          {message.text}
        </div>
      )}
    </div>
  );
};
