/**
 * This file is loaded via the <script> tag in the index.html file and will
 * be executed in the renderer process for that window. No Node.js APIs are
 * available in this process because `nodeIntegration` is turned off and
 * `contextIsolation` is turned on. Use the contextBridge API in `preload.js`
 * to expose Node.js functionality from the main process.
 */

// Navigation
const navButtons = document.querySelectorAll('.nav-button')
const pages = document.querySelectorAll('.page')

navButtons.forEach(button => {
  button.addEventListener('click', async () => {
    const targetPage = button.dataset.page

    // Update active states
    navButtons.forEach(btn => btn.classList.remove('active'))
    pages.forEach(page => page.classList.remove('active'))

    button.classList.add('active')
    document.getElementById(`${targetPage}-page`).classList.add('active')

    // Load API key when settings page is opened
    if (targetPage === 'settings') {
      try {
        const result = await window.electronAPI.getApiKey()
        if (result.success) {
          document.getElementById('apiKey').value = result.apiKey
        } else {
          throw new Error(result.error || 'Failed to load API key')
        }
      } catch (error) {
        const settingsMessage = document.getElementById('settingsMessage')
        settingsMessage.textContent = `Error: ${error.message}`
        settingsMessage.className = 'message error'
      }
    }
  })
})

// Recording functionality
const startButton = document.getElementById('startRecording')
const stopButton = document.getElementById('stopRecording')
const statusText = document.querySelector('.status')

startButton.addEventListener('click', async () => {
  try {
    const result = await window.electronAPI.startScreenpipe()
    if (result.success) {
      startButton.style.display = 'none'
      stopButton.style.display = 'inline-block'
      statusText.textContent = 'Recording in progress...'
    } else {
      throw new Error(result.error || 'Failed to start recording')
    }
  } catch (error) {
    statusText.textContent = `Error: ${error.message}`
  }
})

stopButton.addEventListener('click', async () => {
  try {
    const result = await window.electronAPI.stopScreenpipe()
    if (result.success) {
      statusText.textContent = 'Recording saved successfully'
    } else {
      throw new Error(result.error || 'Failed to stop recording')
    }
  } catch (error) {
    statusText.textContent = `Error: ${error.message}`
  }

  stopButton.style.display = 'none'
  startButton.style.display = 'inline-block'
})

// Settings functionality
const settingsForm = document.getElementById('settingsForm')
const settingsMessage = document.getElementById('settingsMessage')

settingsForm.addEventListener('submit', async (e) => {
  e.preventDefault()
  const apiKey = document.getElementById('apiKey').value.trim()

  if (!apiKey) {
    settingsMessage.textContent = 'Please enter an API key'
    settingsMessage.className = 'message error'
    return
  }

  try {
    const result = await window.electronAPI.saveApiKey(apiKey)
    if (result.success) {
      settingsMessage.textContent = 'API key saved successfully'
      settingsMessage.className = 'message success'
    } else {
      throw new Error(result.error || 'Failed to save API key')
    }
  } catch (error) {
    settingsMessage.textContent = `Error: ${error.message}`
    settingsMessage.className = 'message error'
  }
})

// API Key visibility toggle
const toggleApiKey = document.getElementById('toggleApiKey')
const apiKeyInput = document.getElementById('apiKey')

toggleApiKey.addEventListener('click', () => {
  const type = apiKeyInput.type
  apiKeyInput.type = type === 'password' ? 'text' : 'password'
  toggleApiKey.querySelector('.eye-icon').textContent = type === 'password' ? '🔒' : '👁️'
})

// Task handling
function initializeTaskButtons() {
  const acceptTaskButton = document.getElementById('acceptTask')
  const denyTaskButton = document.getElementById('denyTask')
  const taskBubble = document.querySelector('.task-bubble')
  const taskDescription = document.querySelector('.task-description')

  if (acceptTaskButton) {
    acceptTaskButton.addEventListener('click', async () => {
      try {
        const task = taskDescription.textContent
        acceptTaskButton.disabled = true
        denyTaskButton.disabled = true
        acceptTaskButton.textContent = 'Running...'

        const result = await window.electronAPI.runAssistant(task)
        if (result.success) {
          taskBubble.innerHTML = `
            <h3>Task Complete</h3>
            <div class="task-content">
              <div class="task-icon">✅</div>
              <p class="task-description">${result.output || 'Task completed successfully!'}</p>
            </div>
          `
        } else {
          throw new Error(result.error || 'Failed to run task')
        }
      } catch (error) {
        console.error('Task error:', error)
        taskBubble.innerHTML = `
          <h3>Task Failed</h3>
          <div class="task-content">
            <div class="task-icon">❌</div>
            <p class="task-description">Error: ${error.message}</p>
          </div>
          <div class="task-actions">
            <button id="acceptTask" class="primary-button">Try Again</button>
            <button id="denyTask" class="secondary-button">Dismiss</button>
          </div>
        `
        // Re-attach event listeners since we replaced the buttons
        document.getElementById('acceptTask').addEventListener('click', arguments.callee)
        document.getElementById('denyTask').addEventListener('click', () => {
          taskBubble.style.display = 'none'
        })
      }
    })
  }

  if (denyTaskButton) {
    denyTaskButton.addEventListener('click', () => {
      taskBubble.style.display = 'none'
    })
  }
}

initializeTaskButtons()

// Store tasks in memory
let tasks = [];

// Configure marked options globally
marked.setOptions({
  breaks: true,  // Enable line breaks
  gfm: true,     // Enable GitHub Flavored Markdown
  headerIds: false,
  mangle: false,
  smartLists: true,
  smartypants: true
});

// Function to safely render markdown
function renderMarkdown(text) {
  try {
    if (!text) return '';
    // Ensure text is a string
    const markdownText = String(text);
    // Render the markdown
    return marked.parse(markdownText);
  } catch (error) {
    console.error('Error rendering markdown:', error);
    return text || '';
  }
}

// Listen for new tasks from screenpipe
window.electronAPI.onNewTask((task) => {
  console.log('Received new task:', task);

  // Add task to tasks array
  tasks.unshift(task); // Add new task to beginning of array

  const taskContainer = document.getElementById('task-container');
  if (taskContainer) {
    const taskBubble = document.createElement('div');
    taskBubble.className = 'card task-bubble';

    // Format timestamp
    const timestamp = new Date(task.timestamp);
    const formattedTime = timestamp.toLocaleTimeString();

    // Render markdown for task description
    const renderedDescription = renderMarkdown(task.description);

    taskBubble.innerHTML = `
      <h3>Task Takeover Request</h3>
      <div class="task-content">
        <div class="task-icon">🧑‍💻</div>
        <div class="task-description markdown-content">${renderedDescription}</div>
        <p class="task-timestamp">Received at: ${formattedTime}</p>
      </div>
      <div class="task-actions">
        <button class="accept-task">Accept</button>
        <button class="deny-task">Ignore</button>
      </div>
    `;

    // Insert new task at the top
    taskContainer.insertBefore(taskBubble, taskContainer.firstChild);

    // Add event listeners to the new task's buttons
    const acceptButton = taskBubble.querySelector('.accept-task');
    const denyButton = taskBubble.querySelector('.deny-task');

    acceptButton.addEventListener('click', async () => {
      try {
        acceptButton.disabled = true;
        denyButton.disabled = true;
        acceptButton.textContent = 'Running...';

        const result = await window.electronAPI.runAssistant(task.description);
        if (result.success) {
          // Render markdown for result output
          const renderedOutput = renderMarkdown(result.output || 'Task completed successfully!');
          
          taskBubble.innerHTML = `
            <h3>Task Complete</h3>
            <div class="task-content">
              <div class="task-icon">✅</div>
              <div class="task-description markdown-content">${renderedOutput}</div>
            </div>
          `;
        } else {
          throw new Error(result.error || 'Failed to run task');
        }
      } catch (error) {
        console.error('Task error:', error);
        taskBubble.innerHTML = `
          <h3>Task Failed</h3>
          <div class="task-content">
            <div class="task-icon">❌</div>
            <div class="task-description">${error.message}</div>
          </div>
        `;
      }
    });

    denyButton.addEventListener('click', () => {
      taskBubble.remove();
      // Remove task from tasks array
      tasks = tasks.filter(t => t !== task);
    });
  }
});

// Handle notification actions
window.electronAPI.onNotificationAction((action) => {
  console.log('Notification action:', action)
  if (action === 'accept') {
    // Handle accept action
    statusText.textContent = 'Task accepted'
  } else if (action === 'ignore') {
    // Handle ignore action
    statusText.textContent = 'Task ignored'
  }
})
