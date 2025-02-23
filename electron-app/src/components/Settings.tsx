import React from 'react';

interface SettingsProps {
  apiKey: string;
  firstName: string;
  lastName: string;
  email: string;
  hobbies: string;
  isApiKeyVisible: boolean;
  message: { type: 'success' | 'error'; text: string; } | null;
  onApiKeyChange: (key: string) => void;
  onFirstNameChange: (firstName: string) => void;
  onLastNameChange: (lastName: string) => void;
  onEmailChange: (email: string) => void;
  onHobbiesChange: (hobbies: string) => void;
  onToggleApiKeyVisibility: () => void;
}

export const Settings: React.FC<SettingsProps> = ({
  apiKey,
  firstName,
  lastName,
  email,
  hobbies,
  isApiKeyVisible,
  message,
  onApiKeyChange,
  onFirstNameChange,
  onLastNameChange,
  onEmailChange,
  onHobbiesChange,
  onToggleApiKeyVisibility,
}) => {
  const handleSaveSettings = () => {
    const data = {
      apiKey,
      firstName,
      lastName,
      email,
      hobbies,
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
        <label>First Name</label>
        <input
          type="text"
          value={firstName}
          onChange={(e) => onFirstNameChange(e.target.value)}
          placeholder="Enter your first name"
        />
      </div>
      
      <div className="form-group">
        <label>Last Name</label>
        <input
          type="text"
          value={lastName}
          onChange={(e) => onLastNameChange(e.target.value)}
          placeholder="Enter your last name"
        />
      </div>
      
      <div className="form-group">
        <label>Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          placeholder="Enter your email"
        />
      </div>
      
      <div className="form-group">
        <label>Hobbies</label>
        <input
          type="text"
          value={hobbies}
          onChange={(e) => onHobbiesChange(e.target.value)}
          placeholder="Enter your hobbies"
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
