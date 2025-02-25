// Function to truncate string to a maximum length while keeping it valid
const truncateString = (str: string, maxLength: number): string => {
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength);
};

// Function to get clean DOM, focusing on forms if present
const getCleanDOM = (): string => {
    // Check if there are any forms in the document
    const forms = document.getElementsByTagName('form');
    
    if (forms.length > 0) {
        // If forms exist, only clone the first form and its contents
        const formClone = forms[0].cloneNode(true) as HTMLElement;
        return formClone.outerHTML;
    } else {
        // If no forms, clone the whole document
        const clone = document.cloneNode(true) as Document;
        const scripts = clone.getElementsByTagName('script');
        const styles = clone.getElementsByTagName('style');
        const links = clone.getElementsByTagName('link');
        
        while (scripts[0]) scripts[0].parentNode?.removeChild(scripts[0]);
        while (styles[0]) styles[0].parentNode?.removeChild(styles[0]);
        while (links[0]) links[0].parentNode?.removeChild(links[0]);
        
        return clone.documentElement.outerHTML;
    }
};

console.log('Content script loaded!');

// Function to check if page has forms
const analyzeCurrentPage = () => {
    // Get text content, prioritizing form content if present
    let text = '';
    const forms = document.getElementsByTagName('form');
    if (forms.length > 0) {
        text = forms[0].innerText;
    } else {
        text = document.documentElement.innerText;
    }

    const cleanDOM = getCleanDOM();
    console.log('Preparing to send DOM for analysis...');
    
    // Truncate both DOM and text to 1K characters
    const truncatedDOM = truncateString(cleanDOM, 1000);
    const truncatedText = truncateString(text, 1000);
    
    console.log(`Truncated text length: ${truncatedText.length}`);
    console.log(`Truncated DOM length: ${truncatedDOM.length}`);
    
    // Send the truncated content to background script for analysis
    chrome.runtime.sendMessage({ 
        type: 'ANALYZE_PAGE', 
        dom: truncatedDOM,
        text: truncatedText
    }, (response) => {
        console.log('Response:', response);
        if (chrome.runtime.lastError) {
            console.error('Error sending message:', chrome.runtime.lastError);
            return;
        }
        console.log('Message sent successfully');
    });
};

// Run analysis when page loads
window.addEventListener('load', () => {
    setTimeout(() => {
        analyzeCurrentPage();
    }, 1000);
});
