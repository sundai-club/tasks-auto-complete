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
            model: 'llama3.2',  // Use the correct model name
            prompt: `Analyze this HTML and determine if it contains any empty forms (forms without filled input fields). 
            Only respond with "true" if there are empty forms, or "false" if there are no empty forms or no forms at all:\n\n${dom}

            Only respond with "true" if there are empty forms, or "false" if there are no empty forms or no forms at all.
            Only respond with "true" if there are empty forms, or "false" if there are no empty forms or no forms at all.
            You response format is one word only: true or false.
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

            const hasEmptyForms = data.response?.trim().toLowerCase() === 'true';
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
                model: 'llama3.2',
                prompt: `Given this HTML form and user profile, create a step-by-step plan for filling out the form. Consider the context and purpose of the form. Format the response as a numbered list of steps.

User Profile:
${userProfile}

HTML:
${dom}`
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
        chrome.storage.local.set({ formFillingPlan: data.response });
    } catch (error) {
        console.error('Error generating form filling plan:', error);
    }
}
