// Function to get clean DOM without scripts and styles
const getCleanDOM = (): string => {
    const clone = document.cloneNode(true) as Document;
    const scripts = clone.getElementsByTagName('script');
    const styles = clone.getElementsByTagName('style');
    const links = clone.getElementsByTagName('link');
    
    // Remove scripts, styles, and link elements
    while (scripts[0]) scripts[0].parentNode?.removeChild(scripts[0]);
    while (styles[0]) styles[0].parentNode?.removeChild(styles[0]);
    while (links[0]) links[0].parentNode?.removeChild(links[0]);
    
    return clone.documentElement.outerHTML;
};

console.log('Content script loaded!');

// Function to check if page has forms
const analyzeCurrentPage = () => {
    const cleanDOM = getCleanDOM();
    console.log('Preparing to send DOM for analysis...');
    
    // Send the clean DOM to background script for analysis
    chrome.runtime.sendMessage({ 
        type: 'ANALYZE_PAGE', 
        dom: cleanDOM 
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
    analyzeCurrentPage();
});
