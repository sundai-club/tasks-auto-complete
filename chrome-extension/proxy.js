const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();

// Enable CORS for all routes with specific options
app.use(cors({
    origin: '*',
    methods: ['POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
}));

// Add JSON parsing middleware
app.use(express.json());

// Handle OPTIONS requests explicitly
app.options('*', cors());

// Forward POST requests to Ollama
app.post('/api/generate', async (req, res) => {
    console.log('Received request:', {
        method: req.method,
        headers: req.headers,
        body: req.body
    });

    try {
        // Make sure we're sending the correct model name
        const requestBody = {
            ...req.body,
            stream: false  // Disable streaming for simpler handling
        };

        console.log('Sending to Ollama:', requestBody);

        const response = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            console.error('Ollama error:', {
                status: response.status,
                statusText: response.statusText,
                url: response.url
            });

            // Get the error message if possible
            try {
                const errorText = await response.text();
                console.error('Error response:', errorText);
            } catch (e) {
                console.error('Could not read error response');
            }

            res.status(response.status).json({
                error: `Ollama returned ${response.status}: ${response.statusText}`
            });
            return;
        }

        const text = await response.text();
        console.log('Raw Ollama response:', text);

        try {
            const data = JSON.parse(text);
            console.log('Parsed Ollama response:', data);
            res.json(data);
        } catch (parseError) {
            console.error('Error parsing Ollama response:', parseError);
            res.status(500).json({ error: 'Invalid JSON response from Ollama' });
        }
    } catch (error) {
        console.error('Proxy error:', error);
        res.status(500).json({ error: error.message });
    }
});

const PORT = 11435;
app.listen(PORT, () => {
    console.log(`Proxy server running on port ${PORT}`);
});

