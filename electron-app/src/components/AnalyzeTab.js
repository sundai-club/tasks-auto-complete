import React, { useState, useEffect } from 'react';
import { DataGrid } from '@mui/x-data-grid';
import { TextField, Box, Checkbox } from '@mui/material';
const { ipcRenderer } = window.require('electron');

const columns = [
  { 
    field: 'text', 
    headerName: 'Content', 
    width: 400,
    flex: 1 
  },
  { 
    field: 'app_name',
    headerName: 'Application', 
    width: 150 
  },
  { 
    field: 'window_name', 
    headerName: 'Window Name', 
    width: 200 
  },
  {
    field: 'focused',
    headerName: 'Focused',
    width: 100,
    renderCell: (params) => (
      <Checkbox
        checked={Boolean(params.value)}
        disabled
      />
    )
  },
  { 
    field: 'timestamp', 
    headerName: 'Time', 
    width: 200,
    valueFormatter: (params) => {
      return new Date(params.value).toLocaleString();
    }
  }
];

function AnalyzeTab() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dateFrom, setDateFrom] = useState(
    new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [dateTo, setDateTo] = useState(
    new Date().toISOString().split('T')[0]
  );

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const result = await ipcRenderer.invoke('query-screenpipe', {
          dateFrom,
          dateTo,
        });
        
        if (result.success) {
          const rowsWithId = result.data.map((row, index) => ({
            ...row,
            id: index,
          }));
          setRows(rowsWithId);
        } else {
          setError(result.error);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [dateFrom, dateTo]);

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <Box sx={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 2, display: 'flex', gap: 2 }}>
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
      </Box>
      
      <Box sx={{ flexGrow: 1, height: 'calc(100vh - 200px)' }}>
        <DataGrid
          rows={rows}
          columns={columns}
          loading={loading}
          density="compact"
          disableSelectionOnClick
          initialState={{
            pagination: {
              pageSize: 25,
            },
          }}
        />
      </Box>
    </Box>
  );
}

export default AnalyzeTab; 