// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
  // DOM elements
  const videoTitle = document.getElementById('videoTitle');
  const channelName = document.getElementById('channelName');
  const claudeBtn = document.getElementById('claudeBtn');
  const chatgptBtn = document.getElementById('chatgptBtn');
  const summaryContainer = document.getElementById('summaryContainer');
  const loading = document.getElementById('loading');
  const loadingText = document.getElementById('loadingText');
  const error = document.getElementById('error');
  const settingsBtn = document.getElementById('settingsBtn');
  const claudeApiKeyInput = document.getElementById('claudeApiKey');
  const chatgptApiKeyInput = document.getElementById('chatgptApiKey');
  const saveApiKeysBtn = document.getElementById('saveApiKeysBtn');
  const keySaveStatus = document.getElementById('keySaveStatus');
  const keyStatus = document.getElementById('keyStatus');
  const keyStatusText = document.getElementById('keyStatusText');
  const toggleClaudeKeyBtn = document.getElementById('toggleClaudeKey');
  const toggleChatGptKeyBtn = document.getElementById('toggleChatGptKey');
  const tabs = document.querySelectorAll('.tab');
  const summaryTabElement = document.getElementById('summaryTab');
  const settingsTabElement = document.getElementById('settingsTab');
  const summaryTabButton = document.getElementById('summaryTabButton');
  const settingsTabButton = document.getElementById('settingsTabButton');

  // Variables to store data
  let currentVideoId = '';
  let currentVideoTitle = '';
  let currentChannelName = '';
  let transcript = '';
  
  // Cached API keys
  let cachedClaudeKey = '';
  let cachedChatGptKey = '';
  
  // Streaming connection
  let streamingPort = null;

  // Check if we're on a YouTube video page
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    const currentTab = tabs[0];
    if (currentTab && currentTab.url && currentTab.url.includes('youtube.com/watch')) {
      getVideoInfo();
    } else {
      videoTitle.textContent = 'Not a YouTube video page';
      channelName.textContent = 'Navigate to a YouTube video to use this extension';
    }
  });

  // Load API keys on startup
  loadApiKeys();

  // Event listeners
  claudeBtn.addEventListener('click', () => summarizeVideo('claude'));
  chatgptBtn.addEventListener('click', () => summarizeVideo('chatgpt'));
  saveApiKeysBtn.addEventListener('click', saveApiKeys);
  toggleClaudeKeyBtn.addEventListener('click', () => togglePasswordVisibility(claudeApiKeyInput, toggleClaudeKeyBtn));
  toggleChatGptKeyBtn.addEventListener('click', () => togglePasswordVisibility(chatgptApiKeyInput, toggleChatGptKeyBtn));
  
  // Settings button click handler
  settingsBtn.addEventListener('click', function() {
    summaryTabElement.style.display = 'none';
    settingsTabElement.style.display = 'block';
    summaryTabButton.classList.remove('active');
    settingsTabButton.classList.add('active');
  });
  
  // Tab navigation
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabId = tab.getAttribute('data-tab');
      
      // Update active tab
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // Show corresponding content
      if (tabId === 'summary') {
        summaryTabElement.style.display = 'block';
        settingsTabElement.style.display = 'none';
      } else {
        summaryTabElement.style.display = 'none';
        settingsTabElement.style.display = 'block';
      }
    });
  });

  // Functions
  function getVideoInfo() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {action: 'getVideoInfo'}, function(response) {
        if (response) {
          currentVideoId = response.videoId;
          currentVideoTitle = response.videoTitle;
          currentChannelName = response.channelName;
          
          videoTitle.textContent = currentVideoTitle || 'Video title not available';
          channelName.textContent = currentChannelName || 'Channel not available';
          
          // Update button state based on cached keys
          updateButtonState();
        } else {
          showError('Could not communicate with the YouTube page. Please refresh the page and try again.');
        }
      });
    });
  }

  function getTranscript() {
    return new Promise((resolve, reject) => {
      // Show loading state
      loadingText.textContent = 'Extracting transcript...';
      loading.style.display = 'block';
      error.style.display = 'none';
      
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {action: 'getTranscript'}, function(response) {
          if (response && response.transcript) {
            transcript = response.transcript;
            console.log('Transcript extracted successfully, length:', transcript.length);
            resolve(transcript);
          } else if (response && response.error) {
            reject(new Error(`Could not get transcript: ${response.error}`));
          } else {
            reject(new Error('Could not get transcript. Please make sure captions are available for this video.'));
          }
        });
      });
    });
  }

  function summarizeVideo(service) {
    // Disable buttons immediately
    claudeBtn.disabled = true;
    chatgptBtn.disabled = true;
    
    // Clear previous content
    summaryContainer.style.display = 'none';
    summaryContainer.innerHTML = '';
    error.style.display = 'none';
    
    // Check if we have transcript, if not get it first
    if (!transcript) {
      getTranscript()
        .then(() => {
          startSummarization(service);
        })
        .catch(err => {
          loading.style.display = 'none';
          showError(err.message);
          updateButtonState();
        });
    } else {
      startSummarization(service);
    }
  }

  function startSummarization(service) {
    // Show loading state
    loadingText.textContent = 'Starting summarization...';
    loading.style.display = 'block';
    
    console.log(`Starting ${service} summarization with streaming`);
    
    // Create streaming connection
    streamingPort = chrome.runtime.connect({name: 'streaming'});
    
    let startTime = Date.now();
    let updateInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      loadingText.textContent = `Generating summary... (${elapsed}s)`;
    }, 1000);
    
    // Track if user has scrolled up
    let userHasScrolledUp = false;
    
    // Detect user scrolling
    const scrollHandler = function() {
      const isAtBottom = summaryContainer.scrollHeight - summaryContainer.scrollTop <= summaryContainer.clientHeight + 50;
      userHasScrolledUp = !isAtBottom;
    };
    
    summaryContainer.addEventListener('scroll', scrollHandler);
    
    // Listen for streaming updates
    streamingPort.onMessage.addListener((message) => {
      if (message.partial) {
        // Render markdown to HTML
        const htmlContent = marked.parse(message.partial);
        summaryContainer.innerHTML = htmlContent;
        summaryContainer.style.display = 'block';
        loading.style.display = 'none';
        
        // Only auto-scroll if user hasn't scrolled up
        if (!userHasScrolledUp) {
          summaryContainer.scrollTop = summaryContainer.scrollHeight;
        }
      } else if (message.complete) {
        // Summarization complete
        clearInterval(updateInterval);
        loading.style.display = 'none';
        console.log(`${service} summarization completed`);
        
        if (message.summary) {
          // Render final markdown to HTML
          const htmlContent = marked.parse(message.summary);
          summaryContainer.innerHTML = htmlContent;
        }
        
        // Remove scroll listener
        summaryContainer.removeEventListener('scroll', scrollHandler);
        
        // Close connection
        streamingPort.disconnect();
        streamingPort = null;
        
        // Re-enable buttons
        updateButtonState();
      } else if (message.error) {
        // Error occurred
        clearInterval(updateInterval);
        loading.style.display = 'none';
        showError(`Error: ${message.error}`);
        
        // Remove scroll listener
        summaryContainer.removeEventListener('scroll', scrollHandler);
        
        // Close connection
        if (streamingPort) {
          streamingPort.disconnect();
          streamingPort = null;
        }
        
        // Re-enable buttons
        updateButtonState();
      }
    });
    
    // Handle disconnection
    streamingPort.onDisconnect.addListener(() => {
      clearInterval(updateInterval);
      summaryContainer.removeEventListener('scroll', scrollHandler);
      if (loading.style.display === 'block') {
        loading.style.display = 'none';
        if (summaryContainer.innerHTML === '') {
          showError('Connection lost. Please try again.');
        }
        updateButtonState();
      }
    });
    
    // Send summarization request
    streamingPort.postMessage({
      action: 'summarizeStream',
      transcript,
      videoTitle: currentVideoTitle,
      channelName: currentChannelName,
      service
    });
    
    // Timeout after 90 seconds
    setTimeout(() => {
      if (streamingPort) {
        clearInterval(updateInterval);
        loading.style.display = 'none';
        showError('Summarization timed out. The video might be too long, or there may be API issues.');
        summaryContainer.removeEventListener('scroll', scrollHandler);
        streamingPort.disconnect();
        streamingPort = null;
        updateButtonState();
      }
    }, 90000);
  }

  function loadApiKeys() {
    chrome.runtime.sendMessage({action: 'getApiKeys'}, function(response) {
      if (response) {
        cachedClaudeKey = response.claudeApiKey || '';
        cachedChatGptKey = response.chatGptApiKey || '';
        
        // Update input fields
        claudeApiKeyInput.value = cachedClaudeKey;
        chatgptApiKeyInput.value = cachedChatGptKey;
        
        // Update status display
        updateKeyStatus();
        
        // Update button state
        updateButtonState();
      }
    });
  }

  function saveApiKeys() {
    const claudeApiKey = claudeApiKeyInput.value.trim();
    const chatGptApiKey = chatgptApiKeyInput.value.trim();
    
    // Show immediate feedback
    keySaveStatus.textContent = 'Saving keys...';
    keySaveStatus.style.color = 'blue';
    
    console.log('Attempting to save API keys');
    
    chrome.runtime.sendMessage({
      action: 'saveApiKeys',
      claudeApiKey,
      chatGptApiKey
    }, function(response) {
      console.log('Save API keys response:', response);
      
      if (response && response.success) {
        // Update cached keys
        cachedClaudeKey = claudeApiKey;
        cachedChatGptKey = chatGptApiKey;
        
        keySaveStatus.textContent = '✓ API keys saved successfully!';
        keySaveStatus.style.color = 'green';
        
        // Update status display
        updateKeyStatus();
        
        // Update button state
        updateButtonState();
      } else {
        keySaveStatus.textContent = '✗ Failed to save API keys';
        keySaveStatus.style.color = 'red';
        console.error('Failed to save API keys:', response);
      }
      
      // Clear status after 5 seconds
      setTimeout(() => {
        keySaveStatus.textContent = '';
      }, 5000);
    });
  }

  function updateKeyStatus() {
    const hasClaudeKey = cachedClaudeKey !== '';
    const hasChatGptKey = cachedChatGptKey !== '';
    
    if (hasClaudeKey && hasChatGptKey) {
      keyStatusText.textContent = '✓ Both API keys configured';
      keyStatus.classList.remove('missing');
      keyStatus.style.backgroundColor = '#e8f5e9';
    } else if (hasClaudeKey || hasChatGptKey) {
      keyStatusText.textContent = '⚠️ Only one API key configured';
      keyStatus.classList.add('missing');
      keyStatus.style.backgroundColor = '#fff3cd';
    } else {
      keyStatusText.textContent = '⚠️ API keys not configured';
      keyStatus.classList.add('missing');
      keyStatus.style.backgroundColor = '#fff3cd';
    }
  }

  function updateButtonState() {
    // Use cached keys instead of fetching
    const hasClaudeKey = cachedClaudeKey !== '';
    const hasChatGptKey = cachedChatGptKey !== '';
    
    // Enable buttons based on API key availability
    claudeBtn.disabled = !hasClaudeKey;
    chatgptBtn.disabled = !hasChatGptKey;
    
    // Update button text to indicate if keys are missing
    if (!hasClaudeKey) {
      claudeBtn.title = 'Claude API key not configured';
    } else {
      claudeBtn.title = 'Summarize this video with Claude';
    }
    
    if (!hasChatGptKey) {
      chatgptBtn.title = 'ChatGPT API key not configured';
    } else {
      chatgptBtn.title = 'Summarize this video with ChatGPT';
    }
  }

  function togglePasswordVisibility(input, button) {
    if (input.type === 'password') {
      input.type = 'text';
      button.textContent = 'Hide';
    } else {
      input.type = 'password';
      button.textContent = 'Show';
    }
  }

  function showError(message) {
    error.textContent = message;
    error.style.display = 'block';
    console.error('Error:', message);
  }
});