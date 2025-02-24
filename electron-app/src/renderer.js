import React from 'react';
import { createRoot } from 'react-dom/client';
import AnalyzeTab from './components/AnalyzeTab';

// Keep track of the root to prevent multiple instances
let analyzeRoot = null;

// Add this for handling tab switching
document.querySelectorAll('.nav-button').forEach(button => {
    button.addEventListener('click', () => {
        // Remove active class from all buttons and pages
        document.querySelectorAll('.nav-button').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        
        // Add active class to clicked button and corresponding page
        button.classList.add('active');
        const pageId = `${button.dataset.page}-page`;
        document.getElementById(pageId).classList.add('active');

        // If switching to analyze tab, render the React component
        if (button.dataset.page === 'analyze') {
            const container = document.getElementById('analyze-root');
            if (!analyzeRoot) {
                analyzeRoot = createRoot(container);
            }
            analyzeRoot.render(
                <React.StrictMode>
                    <AnalyzeTab />
                </React.StrictMode>
            );
        }
    });
});

// Initial render of AnalyzeTab if we're on the analyze page
if (document.querySelector('.nav-button[data-page="analyze"]').classList.contains('active')) {
    const container = document.getElementById('analyze-root');
    if (!analyzeRoot) {
        analyzeRoot = createRoot(container);
    }
    analyzeRoot.render(
        <React.StrictMode>
            <AnalyzeTab />
        </React.StrictMode>
    );
} 