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
  button.addEventListener('click', () => {
    const targetPage = button.dataset.page

    // Update active states
    navButtons.forEach(btn => btn.classList.remove('active'))
    pages.forEach(page => page.classList.remove('active'))

    button.classList.add('active')
    document.getElementById(`${targetPage}-page`).classList.add('active')
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
      settingsForm.reset()
    } else {
      throw new Error(result.error || 'Failed to save API key')
    }
  } catch (error) {
    settingsMessage.textContent = `Error: ${error.message}`
    settingsMessage.className = 'message error'
  }
})
