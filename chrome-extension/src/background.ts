// Sample user profile - in production, this should be configurable
const userProfile = `
Name: Alexander Ivkin
Email: mit@ivkin.dev
Age: 39
Occupation: Software Engineer
Location: Somerville, MA
`;

console.log('Background script loaded!');

// Request notification permission on startup
async function requestNotificationPermission() {
    return new Promise<void>((resolve) => {
        chrome.notifications.getPermissionLevel((permission) => {
            console.log('Current notification permission:', permission);
            
            if (permission !== 'granted') {
                // Create a test notification to trigger the permission request
                chrome.notifications.create('test', {
                    type: 'basic',
                    iconUrl: chrome.runtime.getURL('dist/icons/icon48.png'),
                    title: 'Form Analysis Assistant',
                    message: 'Notification permissions test'
                }, () => {
                    console.log('Notification permission requested');
                });
            }
            resolve();
        });
    });
}

// Function to show notification
async function showNotification(id: string, options: Partial<chrome.notifications.NotificationOptions>) {
    const baseOptions = {
        type: 'basic' as chrome.notifications.TemplateType,
        iconUrl: chrome.runtime.getURL('dist/icons/icon48.png'),
        title: options.title || 'Form Analysis Assistant',
        message: options.message || '',
        requireInteraction: true,
        silent: false
    };
    try {
        await new Promise<void>((resolve) => {
            chrome.notifications.create(id, baseOptions, () => resolve());
        });
        console.log('Notification created:', id);
    } catch (error) {
        console.error('Error showing notification:', error);
        // Fallback to alert if notifications fail
        alert(options.message);
    }
}

// Request permission when extension loads
requestNotificationPermission();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Received message:', message);
    if (message.type === 'ANALYZE_PAGE') {
        console.log('Analyzing page with text:', message.text);
        analyzePageContent(message.dom, message.text);
    }
    return true; // Keep the message channel open for async response
});

async function analyzePageContent(dom: string, text: string) {
    try {
        console.log('Sending page for analysis...');
        const requestBody = {
            model: 'gpt-4o-mini',
            prompt: `You are a JSON-only API. Your task is to analyze HTML and determine if it contains any empty forms.
            
            Rules:
            1. You MUST respond in valid JSON format only
            2. No explanations or other text outside the JSON
            3. Use the exact response format shown below
            
            HTML to analyze:
            {html}
            ${dom}
            {/html}
            
            Text to analyze:
            {text}
            ${text}
            {/text}
            
            Response format:
            {"hasEmptyForms": boolean}
            `,
            stream: false            
        };

        console.log('Request body:', requestBody);

        const response = await fetch('http://localhost:11435/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
            throw new Error('No reader available');
        }

        let result = '';
        while (true) {
            const {done, value} = await reader.read();
            if (done) break;
            
            const chunk = new TextDecoder().decode(value);
            console.log('Received chunk:', chunk);
            result += chunk;
        }

        console.log('Complete response:', result);

        try {
            const data = JSON.parse(result);
            console.log('Parsed data:', data);

            // Try to parse the response, handling both direct JSON and cleaned markdown
            const hasEmptyForms = result.includes('true');
            console.log('Has empty forms:', hasEmptyForms);

            if (hasEmptyForms) {
                // Show desktop notification
                console.log('Creating notification for form detection...');
                await showNotification('formDetected', {
                    title: 'Form Detected',
                    message: 'Empty form found on the page. Generating filling suggestions...'
                });

                // Generate form-filling plan
                generateFormFillingPlan(dom);
            }
        } catch (parseError) {
            console.error('Error parsing JSON:', parseError);
            console.error('Raw response was:', result);
            throw parseError;
        }
    } catch (error) {
        console.error('Error analyzing page:', error);
    }
};

async function generateFormFillingPlan(dom: string) {
    // Get the current tab's URL
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    const pageUrl = tab?.url || 'unknown';
    try {
        const response = await fetch('http://localhost:11435/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                prompt: `Given this HTML form and user profile, create a step-by-step plan for filling out the form. 
                Consider the context and purpose of the form. Format the response as a numbered list of steps.
                Make sure to include any relevant context from the page URL.

                Page URL: ${pageUrl}

                User Profile:
                ${userProfile}

                HTML:
                ${dom}
                `
            })
        });

        const data = await response.json();
        
        // Show the plan in a new notification
        console.log('Creating notification for form filling plan...');
        await showNotification('formPlan', {
            title: 'Form Filling Plan',
            message: 'Form is ready to be auto-filled'
        });

        // Store the plan in extension's storage for later use
        chrome.storage.local.set({ formFillingPlan: data.response });

        console.log('Sending task to Electron app...');

        // Send task to Electron app
        try {
            const taskResponse = await fetch('http://localhost:3000/new-task', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    description: `Fill out form at ${pageUrl} according to this plan:\n${data.response}\n 
                    For any data not provided for the user think something relevant and come up with creative ways to fill it.
                    Make sure to fill all required fields.
                    `,
                    timestamp: new Date().toISOString()
                })
            });

            console.log('Task response:', taskResponse);

            if (!taskResponse.ok) {
                throw new Error(`Failed to send task to Electron app: ${taskResponse.status}`);
            }

            console.log('Task sent to Electron app');
        } catch (error) {
            console.error('Error executing assistant or sending task:', error);
            await showNotification('assistantError', {
                title: 'Assistant Error',
                message: 'Failed to start the form filling assistant'
            });
        }
    } catch (error) {
        console.error('Error generating form filling plan:', error);
    }
}
