// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
  // DOM elements
  const videoTitle = document.getElementById('videoTitle');
  const channelName = document.getElementById('channelName');
  const claudeBtn = document.getElementById('claudeBtn');
  const chatgptBtn = document.getElementById('chatgptBtn');
  const stopBtn = document.getElementById('stopBtn');
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
  const generationStatus = document.getElementById('generationStatus');
  const generationProgress = document.getElementById('generationProgress');
  const summaryStyleSelect = document.getElementById('summaryStyle');
  const styleDescription = document.getElementById('styleDescription');
  const videoInfo = document.getElementById('videoInfo');
  const styleDescriptions = {
    skim: 'Ultra-brief overview - just the core message',
    summary: 'Concise summary hitting the key points',
    balanced: 'Balanced detail with good coverage of key points',
    comprehensive: 'Thorough coverage with extensive detail',
    exhaustive: 'Complete in-depth analysis of everything'
  };

  // Auto-collapse video info when scrolling in summary
  let lastScrollTop = 0;
  summaryContainer.addEventListener('scroll', function() {
    const scrollTop = summaryContainer.scrollTop;
    
    if (scrollTop > 50 && scrollTop > lastScrollTop) {
      // Scrolling down and past 50px
      videoInfo.classList.add('collapsed');
      summaryContainer.classList.add('expanded');
    } else if (scrollTop < 10) {
      // Back at the top
      videoInfo.classList.remove('collapsed');
      summaryContainer.classList.remove('expanded');
    }
    
    lastScrollTop = scrollTop;
  });
  
  // Load saved style preference
  chrome.storage.local.get(['summaryStyle'], function(result) {
    if (result.summaryStyle) {
      selectedSummaryStyle = result.summaryStyle;
      summaryStyleSelect.value = result.summaryStyle;
      styleDescription.textContent = styleDescriptions[result.summaryStyle];
    }
  });

  summaryStyleSelect.addEventListener('change', function() {
    selectedSummaryStyle = this.value;
    styleDescription.textContent = styleDescriptions[this.value];
    
    // Save preference
    chrome.storage.local.set({ summaryStyle: this.value });
    console.log('Summary style changed to:', this.value);
  });

  // Variables to store data
  let currentVideoId = '';
  let currentVideoTitle = '';
  let currentChannelName = '';
  let currentVideoDescription = '';
  let currentVideoDuration = 0;
  let transcript = '';
  let selectedSummaryStyle = 'balanced';
  
  // Cached API keys
  let cachedClaudeKey = '';
  let cachedChatGptKey = '';
  
  // Polling interval ID
  let pollIntervalId = null;
  
  // Flag to track if we've loaded the summary
  let summaryLoaded = false;

  // Check if we're on a YouTube video page
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    const currentTab = tabs[0];
    if (currentTab && currentTab.url && currentTab.url.includes('youtube.com/watch')) {
      initializeExtension(currentTab);
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
  stopBtn.addEventListener('click', stopGeneration);
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
  async function initializeExtension(tab) {
    let retryCount = 0;
    const maxRetries = 3;
    
    async function attemptInitialization() {
      try {
        // Try to communicate with content script
        chrome.tabs.sendMessage(tab.id, {action: 'getVideoInfo'}, async function(response) {
          if (chrome.runtime.lastError || !response) {
            // Content script not responding, try to inject it
            if (retryCount < maxRetries) {
              console.log(`Attempt ${retryCount + 1}: Injecting content script...`);
              
              try {
                await chrome.scripting.executeScript({
                  target: { tabId: tab.id },
                  files: ['content.js']
                });
                
                retryCount++;
                // Wait a bit and retry
                setTimeout(attemptInitialization, 1000);
              } catch (injectionError) {
                console.error('Failed to inject content script:', injectionError);
                if (retryCount < maxRetries) {
                  retryCount++;
                  setTimeout(attemptInitialization, 1000);
                } else {
                  showError('Could not communicate with YouTube. Please refresh the page and try again.');
                }
              }
            } else {
              showError('Could not initialize extension. Please refresh the page and try again.');
            }
          } else {
            // Successfully got video info
            handleVideoInfo(response);
          }
        });
      } catch (e) {
        console.error('Initialization error:', e);
        if (retryCount < maxRetries) {
          retryCount++;
          setTimeout(attemptInitialization, 1000);
        }
      }
    }
    
    attemptInitialization();
  }

  function handleVideoInfo(response) {
    currentVideoId = response.videoId;
    currentVideoTitle = response.videoTitle;
    currentChannelName = response.channelName;
    currentVideoDescription = response.videoDescription || '';
    currentVideoDuration = response.videoDuration || 0;
    
    videoTitle.textContent = currentVideoTitle || 'Video title not available';
    channelName.textContent = currentChannelName || 'Channel not available';
    
    // Show duration if available
    if (currentVideoDuration > 0) {
      const hours = Math.floor(currentVideoDuration / 60);
      const mins = currentVideoDuration % 60;
      const durationText = hours > 0 
        ? `${hours}h ${mins}m` 
        : `${mins}m`;
      channelName.textContent += ` • ${durationText}`;
    }
    
    // Load summary with retry logic
    loadSummaryWithRetry();
    
    // Update button state
    updateButtonState();
  }

  function loadSummaryWithRetry(retryCount = 0) {
    const maxRetries = 3;
    const retryDelay = 300; // ms
    
    // Check if we have a saved summary or ongoing generation for this video
    chrome.runtime.sendMessage({action: 'getSummary', videoId: currentVideoId}, function(result) {
      if (!result && retryCount < maxRetries) {
        // No result yet, retry after a short delay
        console.log(`Retry ${retryCount + 1}: Loading summary...`);
        setTimeout(() => loadSummaryWithRetry(retryCount + 1), retryDelay);
        return;
      }
      
      if (result && result.isGenerating) {
        // Generation is ongoing!
        console.log('Generation in progress for this video');
        summaryLoaded = true;
        showGenerationInProgress(result);
        
        // Start polling to show live updates
        startPolling(result.summary?.service || 'claude');
        
      } else if (result && result.summary) {
        console.log('Found existing summary for this video');
        summaryLoaded = true;
        displaySavedSummary(result.summary);
      } else {
        // No summary found after all retries
        console.log('No summary found for this video');
        summaryLoaded = true;
      }
    });
  }

  function showGenerationInProgress(result) {
    generationStatus.style.display = 'block';
    stopBtn.style.display = 'block';
    claudeBtn.style.display = 'none';
    chatgptBtn.style.display = 'none';
    
    if (result.progress) {
      generationProgress.textContent = result.progress;
    }
    
    // Show partial summary if available
    if (result.summary && result.summary.summary) {
      const htmlContent = marked.parse(result.summary.summary);
      summaryContainer.innerHTML = htmlContent;
      summaryContainer.style.display = 'block';
    }
  }

  function displaySavedSummary(savedSummary) {
    const htmlContent = marked.parse(savedSummary.summary);
    summaryContainer.innerHTML = htmlContent;
    summaryContainer.style.display = 'block';
    
    // Show a note if partial, stopped, or has error
    if (savedSummary.hasError) {
      const note = document.createElement('div');
      note.style.cssText = 'background: #fff5f5; padding: 10px; border-radius: 4px; margin-bottom: 10px; font-size: 13px; border: 1px solid #feb2b2;';
      note.innerHTML = '<strong>❌ Error occurred during generation</strong>';
      summaryContainer.insertBefore(note, summaryContainer.firstChild);
    } else if (savedSummary.isPartial || savedSummary.isStopped) {
      const note = document.createElement('div');
      note.style.cssText = 'background: #fff3cd; padding: 10px; border-radius: 4px; margin-bottom: 10px; font-size: 13px;';
      note.textContent = savedSummary.isStopped 
        ? '⏹ Generation was stopped. You can generate a new complete summary.'
        : '⚠️ This summary generation was interrupted. You can generate a new complete summary.';
      summaryContainer.insertBefore(note, summaryContainer.firstChild);
    }
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
            // Don't treat "no captions" as an error - it's just informational
            console.info('Could not get transcript:', response.error);
            reject(new Error(`Could not get transcript: ${response.error}`));
          } else {
            console.info('No transcript available for this video');
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
    generationStatus.style.display = 'none';
    
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
  
  // Hide summarize buttons, show stop button
  claudeBtn.style.display = 'none';
  chatgptBtn.style.display = 'none';
  stopBtn.style.display = 'block';
  generationStatus.style.display = 'block';
  
  console.log(`Starting ${service} background summarization with style: ${selectedSummaryStyle}`);
  
  const startTime = Date.now();
  
  // Start background summarization
  chrome.runtime.sendMessage({
    action: 'startBackgroundSummarization',
    transcript,
    videoTitle: currentVideoTitle,
    channelName: currentChannelName,
    videoDescription: currentVideoDescription,
    videoDuration: currentVideoDuration,
    summaryStyle: selectedSummaryStyle, // Add this line
    service,
    videoId: currentVideoId
  }, function(response) {
    if (response && response.success) {
      console.log('Background summarization started');
      
      // Start polling for updates with the actual start time
      startPolling(service, startTime);
    } else {
      loading.style.display = 'none';
      showError(response?.error || 'Failed to start summarization');
      resetToSummarizeButtons();
    }
  });
}

  function startPolling(service, startTime) {
    if (!startTime) {
      // Try to get the actual start time from background
      chrome.runtime.sendMessage({action: 'getGenerationStartTime', videoId: currentVideoId}, function(response) {
        const actualStartTime = response?.startTime || Date.now();
        startPollingWithTime(service, actualStartTime);
      });
    } else {
      startPollingWithTime(service, startTime);
    }
  }

  function startPollingWithTime(service, startTime) {
    let lastScrollHeight = 0;
    let userHasScrolledUp = false;
    
    // Detect user scrolling
    const scrollHandler = function() {
      const isAtBottom = summaryContainer.scrollHeight - summaryContainer.scrollTop <= summaryContainer.clientHeight + 50;
      userHasScrolledUp = !isAtBottom;
    };
    
    summaryContainer.addEventListener('scroll', scrollHandler);
    
    // Clear any existing poll interval
    if (pollIntervalId) {
      clearInterval(pollIntervalId);
    }
    
    pollIntervalId = setInterval(() => {
      // Check for summary updates
      chrome.runtime.sendMessage({action: 'getSummary', videoId: currentVideoId}, function(result) {
        if (!result) return;
        
        // Calculate elapsed time from actual start time
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        
        if (result.isGenerating) {
          // Still generating
          loadingText.textContent = `Generating summary... (${elapsed}s)`;
          loading.style.display = 'block';
          generationProgress.textContent = result.progress || `Generating... (${elapsed}s)`;
          
          // Show partial summary if available
          if (result.summary && result.summary.summary) {
            const htmlContent = marked.parse(result.summary.summary);
            summaryContainer.innerHTML = htmlContent;
            summaryContainer.style.display = 'block';
            
            // Only auto-scroll if user hasn't scrolled up AND content grew
            if (!userHasScrolledUp && summaryContainer.scrollHeight > lastScrollHeight) {
              summaryContainer.scrollTop = summaryContainer.scrollHeight;
              lastScrollHeight = summaryContainer.scrollHeight;
            }
          }
        } else if (result.summary) {
          // Generation complete
          clearInterval(pollIntervalId);
          pollIntervalId = null;
          
          // Remove scroll listener
          summaryContainer.removeEventListener('scroll', scrollHandler);
          
          loading.style.display = 'none';
          generationStatus.style.display = 'none';
          
          const htmlContent = marked.parse(result.summary.summary);
          summaryContainer.innerHTML = htmlContent;
          summaryContainer.style.display = 'block';
          
          // Show error/partial notes if needed
          displaySavedSummary(result.summary);
          
          console.log(`${service} summarization completed in ${elapsed}s`);
          resetToSummarizeButtons();
        }
      });
    }, 500); // Poll every 500ms for live updates
    
    // Timeout after 90 seconds
    setTimeout(() => {
      if (pollIntervalId) {
        clearInterval(pollIntervalId);
        pollIntervalId = null;
        summaryContainer.removeEventListener('scroll', scrollHandler);
        loading.style.display = 'none';
        showError('Polling timed out. Generation may still be running in the background.');
        resetToSummarizeButtons();
      }
    }, 180000);
  }

  function stopGeneration() {
    console.log('Stopping generation...');
    
    chrome.runtime.sendMessage({
      action: 'stopGeneration',
      videoId: currentVideoId
    }, function(response) {
      if (response && response.success) {
        console.log('Generation stopped');
        
        // Clear polling
        if (pollIntervalId) {
          clearInterval(pollIntervalId);
          pollIntervalId = null;
        }
        
        loading.style.display = 'none';
        generationStatus.style.display = 'none';
        
        // Show message
        const note = document.createElement('div');
        note.style.cssText = 'background: #fff3cd; padding: 10px; border-radius: 4px; margin: 10px 0; font-size: 13px;';
        note.textContent = '⏹ Generation stopped. Partial summary saved.';
        
        if (summaryContainer.firstChild) {
          summaryContainer.insertBefore(note, summaryContainer.firstChild);
        } else {
          summaryContainer.appendChild(note);
          summaryContainer.style.display = 'block';
        }
        
        resetToSummarizeButtons();
      } else {
        showError('Failed to stop generation: ' + (response?.error || 'Unknown error'));
      }
    });
  }

  function resetToSummarizeButtons() {
    stopBtn.style.display = 'none';
    claudeBtn.style.display = 'inline-block';
    chatgptBtn.style.display = 'inline-block';
    updateButtonState();
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
    // Use cached keys
    const hasClaudeKey = cachedClaudeKey !== '';
    const hasChatGptKey = cachedChatGptKey !== '';
    
    // Enable buttons based on API key availability
    claudeBtn.disabled = !hasClaudeKey;
    chatgptBtn.disabled = !hasChatGptKey;
    
    // Update button tooltips
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