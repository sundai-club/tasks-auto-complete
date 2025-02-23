import React from 'react';

interface SettingsProps {
  apiKey: string;
  userProfile: string;
  isApiKeyVisible: boolean;
  message: { type: 'success' | 'error'; text: string; } | null;
  onApiKeyChange: (key: string) => void;
  onProfileChange: (profile: string) => void;
  onToggleApiKeyVisibility: () => void;
  onSaveApiKey: () => void;
  onSaveProfile: () => void;
}

export const Settings: React.FC<SettingsProps> = ({
  apiKey,
  userProfile,
  isApiKeyVisible,
  message,
  onApiKeyChange,
  onProfileChange,
  onToggleApiKeyVisibility,
  onSaveApiKey,
  onSaveProfile
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
      </div>

      <div className="form-group">
        <label>Your Profile</label>
        <textarea
          value={userProfile}
          onChange={(e) => onProfileChange(e.target.value)}
          placeholder="Tell us about yourself, your role, and interests. This helps provide better context to AI responses."
          rows={4}
          className="profile-input"
        />
        <button className="primary-button" onClick={onSaveProfile}>
          Save Profile
        </button>
      </div>

      {message && (
        <div className={`message ${message.type}`}>
          {message.text}
        </div>
      )}
    </div>
  );
};