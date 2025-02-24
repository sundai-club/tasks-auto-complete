const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const app = express();

// OpenAI API endpoint
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

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

// Handle both OpenAI and Ollama requests
app.post('/api/generate', async (req, res) => {
    console.log('Received request:', {
        method: req.method,
        headers: req.headers,
        body: req.body
    });

    try {
        if (req.body.model.startsWith('gpt-4')) {
            // Call OpenAI API
            console.log('Sending to OpenAI:', req.body);
            const response = await fetch(OPENAI_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
                },
                body: JSON.stringify({
                    model: req.body.model,
                    messages: [{
                        role: 'system',
                        content: 'You are a JSON-only API. You must respond with valid JSON only.'
                    }, {
                        role: 'user',
                        content: req.body.prompt
                    }],
                    temperature: 0
                })
            });

            if (!response.ok) {
                const error = await response.text();
                console.error('OpenAI error:', error);
                throw new Error(`OpenAI API error: ${response.status}`);
            }

            const data = await response.json();
            console.log('Response from OpenAI:', data);
            
            // Clean the response from markdown code blocks
            let content = data.choices[0].message.content;
            content = content.replace(/```json\\n/g, '').replace(/\\n```/g, '');
            console.log('Cleaned OpenAI response:', content);
            
            res.json({ response: content });
        } else {
            // Call Ollama API
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
        }
    } catch (error) {
        console.error('Proxy error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Handle running the Python assistant
app.post('/run-assistant', async (req, res) => {
    try {
        console.log('Running assistant with task:', req.body.taskDescription);

        const agentDir = path.join(__dirname, '..', 'agent');
        const pythonScript = path.join(agentDir, 'assistant.py');
        const venvPython = path.join(agentDir, '.venv', 'bin', 'python');

        // Verify paths exist
        if (!fs.existsSync(pythonScript)) {
            throw new Error(`Assistant script not found at ${pythonScript}`);
        }
        if (!fs.existsSync(venvPython)) {
            throw new Error('Python virtual environment not found');
        }

        // Escape the task description for command line
        const escapedTask = JSON.stringify(req.body.taskDescription);

        const pythonProcess = spawn(venvPython, [
            pythonScript,
            process.env.OPENAI_API_KEY,
            escapedTask
        ], {
            env: { ...process.env },
            cwd: agentDir
        });

        let output = '';
        let error = '';

        pythonProcess.stdout.on('data', (data) => {
            const text = data.toString();
            output += text;
            console.log('Python output:', text);
        });

        pythonProcess.stderr.on('data', (data) => {
            const text = data.toString();
            error += text;
            console.error('Python error:', text);
        });

        pythonProcess.on('close', (code) => {
            if (code === 0) {
                res.json({ success: true, output });
            } else {
                // Check for specific error types
                if (error.includes('invalid_api_key')) {
                    res.status(500).json({ error: 'Invalid OpenAI API key' });
                } else if (error.includes('No module named')) {
                    res.status(500).json({ error: 'Missing Python dependencies' });
                } else {
                    res.status(500).json({ error: error || 'Assistant failed to run' });
                }
            }
        });
    } catch (error) {
        console.error('Error running assistant:', error);
        res.status(500).json({ error: error.message });
    }
});

const PORT = 11435;
app.listen(PORT, () => {
    console.log(`Proxy server running on port ${PORT}`);
});

