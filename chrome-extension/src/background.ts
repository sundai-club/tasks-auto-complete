// Sample user profile - in production, this should be configurable
const userProfile = `
Name: Alexander Ivkin
Email: mit@ivkin.dev
Age: 39
Occupation: Software Engineer
Location: Somerville, MA
`;

console.log('Background script loaded!');

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Received message:', message);
    if (message.type === 'ANALYZE_PAGE') {
        analyzePageContent(message.dom);
    }
    return true; // Keep the message channel open for async response
});

async function analyzePageContent(dom: string) {
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
                chrome.notifications.create('formDetected', {
                    type: 'basic',
                    iconUrl: chrome.runtime.getURL('dist/icons/icon48.png'),
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
    try {
        const response = await fetch('http://localhost:11435/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'deepseek-r1:1.5b',
                prompt: `Given this HTML form and user profile, create a step-by-step plan for filling out the form. 
                Consider the context and purpose of the form. Format the response as a numbered list of steps.

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
        chrome.notifications.create('formPlan', {
            type: 'basic',
            iconUrl: 'icons/icon48.png',
            title: 'Form Filling Plan',
            message: 'Click to view the suggested form filling plan',
            priority: 2
        });

        // Store the plan in extension's storage for later use
                    const parsedPlan = JSON.parse(data.response?.trim() || '{}');
            chrome.storage.local.set({ formFillingPlan: parsedPlan.plan });
    } catch (error) {
        console.error('Error generating form filling plan:', error);
    }
}
