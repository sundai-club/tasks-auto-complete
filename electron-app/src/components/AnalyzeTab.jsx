import React, { useState } from 'react';
import { TextField, Button, Select, MenuItem, FormControl, InputLabel, Box, Paper, Typography } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';

const AnalyzeTab = () => {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedApp, setSelectedApp] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [results, setResults] = useState([]);

  const columns = [
    { field: 'timestamp', headerName: 'Timestamp', width: 200 },
    { field: 'app', headerName: 'Application', width: 150 },
    { field: 'text', headerName: 'Content', flex: 1 },
  ];

  const handleSearch = async () => {
    try {
      const response = await window.electronAPI.queryScreenpipe({
        dateFrom,
        dateTo,
        app: selectedApp,
        keyword: searchKeyword,
      });
      setResults(response.map((row, index) => ({ ...row, id: index })));
    } catch (error) {
      console.error('Error querying database:', error);
    }
  };

  return (
    <Box p={2}>
      <Paper elevation={3} sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" gutterBottom>Search Criteria</Typography>
        <Box display="flex" gap={2} flexWrap="wrap">
          <TextField
            label="From Date"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="To Date"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>Application</InputLabel>
            <Select
              value={selectedApp}
              onChange={(e) => setSelectedApp(e.target.value)}
              label="Application"
            >
              <MenuItem value="">All Applications</MenuItem>
              <MenuItem value="chrome">Chrome</MenuItem>
              <MenuItem value="vscode">VS Code</MenuItem>
            </Select>
          </FormControl>
          <TextField
            label="Keyword Search"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
          />
          <Button variant="contained" onClick={handleSearch}>
            Search
          </Button>
        </Box>
      </Paper>

      <div style={{ height: 400, width: '100%' }}>
        <DataGrid
          rows={results}
          columns={columns}
          pageSize={10}
          rowsPerPageOptions={[10]}
          disableSelectionOnClick
        />
      </div>
    </Box>
  );
};

export default AnalyzeTab; 