import React, { useState } from 'react';
import { Tabs, Tab, Box } from '@mui/material';
import SettingsTab from './components/SettingsTab';
import RecordingTab from './components/RecordingTab';
import AnalyzeTab from './components/AnalyzeTab';
// ... other imports ...

function App() {
  const [currentTab, setCurrentTab] = useState(0);

  const handleTabChange = (event, newValue) => {
    setCurrentTab(newValue);
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={currentTab} onChange={handleTabChange}>
          <Tab label="Recording" />
          <Tab label="Settings" />
          <Tab label="Analyze" />
        </Tabs>
      </Box>
      
      {currentTab === 0 && <RecordingTab />}
      {currentTab === 1 && <SettingsTab />}
      {currentTab === 2 && <AnalyzeTab />}
    </Box>
  );
}

export default App; 