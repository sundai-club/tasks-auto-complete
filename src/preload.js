const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

// Add this to your existing contextBridge.exposeInMainWorld call
contextBridge.exposeInMainWorld('electronAPI', {
  // ... existing exposed functions ...
  
  queryScreenpipe: async (criteria) => {
    const dbPath = path.join(process.env.HOME, '.screenpipe', 'screenpipe.db');
    
    const db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });

    let query = `SELECT timestamp, app, text FROM entries WHERE 1=1`;
    const params = [];

    if (criteria.dateFrom) {
      query += ` AND timestamp >= ?`;
      params.push(criteria.dateFrom);
    }

    if (criteria.dateTo) {
      query += ` AND timestamp <= ?`;
      params.push(criteria.dateTo);
    }

    if (criteria.app) {
      query += ` AND app = ?`;
      params.push(criteria.app);
    }

    if (criteria.keyword) {
      query += ` AND text LIKE ?`;
      params.push(`%${criteria.keyword}%`);
    }

    query += ` ORDER BY timestamp DESC`;

    try {
      const results = await db.all(query, params);
      await db.close();
      return results;
    } catch (error) {
      console.error('Database query error:', error);
      await db.close();
      throw error;
    }
  }
}); 