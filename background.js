// Import prompts
importScripts('prompts.js');

// Store API keys in memory
let claudeApiKey = '';
let chatGptApiKey = '';

// Store summaries by video ID
let summaries = {};

// Track ongoing summarizations
let ongoingSummarizations = {};

// Load API keys and summaries on startup
chrome.storage.local.get(['claudeApiKey', 'chatGptApiKey', 'summaries'], (result) => {
  claudeApiKey = result.claudeApiKey || '';
  chatGptApiKey = result.chatGptApiKey || '';
  summaries = result.summaries || {};
  console.log('API keys and summaries loaded on startup');
});

// Listen for messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

  if (request.action === 'summarize') {
    console.log('Background script received summarize request:', {
      service: request.service,
      videoTitle: request.videoTitle,
      channelName: request.channelName,
      transcriptLength: request.transcript ? request.transcript.length : 0
    });
    
    const { transcript, videoTitle, channelName, service } = request;
    
    // Check for very long transcripts
    if (transcript.length > 100000) {
      console.warn('Transcript is very long:', transcript.length, 'characters');
      sendResponse({ 
        error: `Transcript is too long (${transcript.length} characters). This might exceed API limits. Try a shorter video.` 
      });
      return true;
    }
    
    if (service === 'claude') {
      console.log('Starting Claude summarization...');
      summarizeWithClaude(transcript, videoTitle, channelName)
        .then(summary => {
          console.log('Claude summarization successful, summary length:', summary.length);
          sendResponse({ summary });
        })
        .catch(error => {
          console.error('Claude summarization failed:', error);
          sendResponse({ error: error.message });
        });
    } else if (service === 'chatgpt') {
      console.log('Starting ChatGPT summarization...');
      summarizeWithChatGpt(transcript, videoTitle, channelName)
        .then(summary => {
          console.log('ChatGPT summarization successful, summary length:', summary.length);
          sendResponse({ summary });
        })
        .catch(error => {
          console.error('ChatGPT summarization failed:', error);
          sendResponse({ error: error.message });
        });
    }
    
    return true;
  } 

  else if (request.action === 'getGenerationStartTime') {
    const { videoId } = request;
    const ongoing = ongoingSummarizations[videoId];
    
    sendResponse({ 
      startTime: ongoing?.startTime || null
    });
    return true;
  }

  else if (request.action === 'saveApiKeys') {
    console.log('Background received saveApiKeys request');
    claudeApiKey = request.claudeApiKey;
    chatGptApiKey = request.chatGptApiKey;
    
    // Save to storage
    chrome.storage.local.set({
      claudeApiKey: request.claudeApiKey,
      chatGptApiKey: request.chatGptApiKey
    }, () => {
      if (chrome.runtime.lastError) {
        console.error('Error saving keys:', chrome.runtime.lastError);
        sendResponse({ 
          success: false,
          error: chrome.runtime.lastError.message 
        });
      } else {
        console.log('Keys saved successfully');
        sendResponse({ success: true });
      }
    });
    
    return true;
  }
  else if (request.action === 'getApiKeys') {
    console.log('Background received getApiKeys request');
    sendResponse({
      claudeApiKey,
      chatGptApiKey
    });
    return true;
  }
  else if (request.action === 'getSummary') {
    // Retrieve summary from storage
    const { videoId } = request;
    const summary = summaries[videoId];
    const ongoing = ongoingSummarizations[videoId];
    
    sendResponse({ 
      summary: summary || null,
      isGenerating: !!ongoing,
      progress: ongoing ? ongoing.progress : null
    });
    return true;
  }
  else if (request.action === 'startBackgroundSummarization') {
    const { transcript, videoTitle, channelName,videoDescription, service, videoId } = request;
    
    // Check if already generating
    if (ongoingSummarizations[videoId]) {
      sendResponse({ 
        success: false, 
        error: 'Already generating summary for this video' 
      });
      return true;
    }
    
    // Start background summarization
    console.log('Starting background summarization:', service, videoId);
    
    ongoingSummarizations[videoId] = {
      service,
      videoTitle,
      channelName,
      startTime: Date.now(),
      progress: 'Starting...'
    };
    
    if (service === 'claude') {
      summarizeWithClaudeBackground(transcript, videoTitle, channelName, videoDescription, videoId);
    } else if (service === 'chatgpt') {
      summarizeWithChatGptBackground(transcript, videoTitle, channelName, videoDescription, videoId);
    }
    
    sendResponse({ success: true });
    return true;
  }
  // Add this message handler in the onMessage.addListener section:

else if (request.action === 'stopGeneration') {
    const { videoId } = request;
    
    if (ongoingSummarizations[videoId]) {
      console.log('Stopping generation for video:', videoId);
      
      // Mark the summary as stopped (partial)
      if (summaries[videoId]) {
        summaries[videoId].isStopped = true;
        summaries[videoId].isPartial = true;
        chrome.storage.local.set({ summaries });
      }
      
      // Remove from ongoing
      delete ongoingSummarizations[videoId];
      
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: 'No generation in progress for this video' });
    }
    
    return true;
  }
});

// Background summarization for Claude (no streaming port needed)
async function summarizeWithClaudeBackground(transcript, videoTitle, channelName, videoDescription, videoId) {
  console.log('Starting Claude background summarization');
  
  if (!claudeApiKey) {
    ongoingSummarizations[videoId].error = 'Claude API key not set';
    delete ongoingSummarizations[videoId];
    return;
  }

  const prompt = PROMPTS.videoSummary(videoTitle, channelName, videoDescription, transcript);

  try {
    ongoingSummarizations[videoId].progress = 'Contacting Claude API...';
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': claudeApiKey,
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        stream: true,
        messages: [
          { role: 'user', content: prompt }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Claude API error response:', errorText);
      ongoingSummarizations[videoId].error = `Claude API error (${response.status})`;
      delete ongoingSummarizations[videoId];
      return;
    }

    ongoingSummarizations[videoId].progress = 'Generating summary...';
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6);
          if (jsonStr.trim() === '[DONE]') continue;
          
          try {
            const data = JSON.parse(jsonStr);
            
            if (data.type === 'content_block_delta' && data.delta?.text) {
              fullText += data.delta.text;
              
              // Save partial summary
              summaries[videoId] = {
                summary: fullText,
                service: 'claude',
                videoTitle,
                channelName,
                timestamp: Date.now(),
                isPartial: true
              };
              chrome.storage.local.set({ summaries });
              
              // Update progress
              ongoingSummarizations[videoId].progress = `Generating... (${fullText.length} chars)`;
              
            } else if (data.type === 'message_stop') {
              // Save final summary
              summaries[videoId] = {
                summary: fullText,
                service: 'claude',
                videoTitle,
                channelName,
                timestamp: Date.now(),
                isPartial: false
              };
              chrome.storage.local.set({ summaries });
              
              console.log('Claude background summarization completed');
              delete ongoingSummarizations[videoId];
            }
          } catch (e) {
            // Skip malformed JSON
          }
        }
      }
    }
    
  } catch (error) {
    console.error('Claude background streaming error:', error);
    ongoingSummarizations[videoId].error = error.message;
    delete ongoingSummarizations[videoId];
  }
}

// Background summarization for ChatGPT (no streaming port needed)
async function summarizeWithChatGptBackground(transcript, videoTitle, channelName, videoDescription, videoId) {
  console.log('Starting ChatGPT background summarization');
  
  if (!chatGptApiKey) {
    ongoingSummarizations[videoId].error = 'ChatGPT API key not set';
    delete ongoingSummarizations[videoId];
    return;
  }

  const prompt = PROMPTS.videoSummary(videoTitle, channelName, videoDescription, transcript);
  try {
    ongoingSummarizations[videoId].progress = 'Contacting OpenAI API...';
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${chatGptApiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'You are a helpful assistant that summarizes YouTube video transcripts.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 4000,
        stream: true
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ChatGPT API error response:', errorText);
      ongoingSummarizations[videoId].error = `OpenAI API error (${response.status})`;
      delete ongoingSummarizations[videoId];
      return;
    }

    ongoingSummarizations[videoId].progress = 'Generating summary...';
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6);
          if (jsonStr.trim() === '[DONE]') {
            // Save final summary
            summaries[videoId] = {
              summary: fullText,
              service: 'chatgpt',
              videoTitle,
              channelName,
              timestamp: Date.now(),
              isPartial: false
            };
            chrome.storage.local.set({ summaries });
            
            console.log('ChatGPT background summarization completed');
            delete ongoingSummarizations[videoId];
            break;
          }
          
          try {
            const data = JSON.parse(jsonStr);
            const content = data.choices?.[0]?.delta?.content;
            
            if (content) {
              fullText += content;
              
              // Save partial summary
              summaries[videoId] = {
                summary: fullText,
                service: 'chatgpt',
                videoTitle,
                channelName,
                timestamp: Date.now(),
                isPartial: true
              };
              chrome.storage.local.set({ summaries });
              
              // Update progress
              ongoingSummarizations[videoId].progress = `Generating... (${fullText.length} chars)`;
            }
          } catch (e) {
            // Skip malformed JSON
          }
        }
      }
    }
    
  } catch (error) {
    console.error('ChatGPT background streaming error:', error);
    ongoingSummarizations[videoId].error = error.message;
    delete ongoingSummarizations[videoId];
  }
}

// Legacy non-streaming functions remain unchanged
async function summarizeWithClaude(transcript, videoTitle, channelName, videoDescription) {
  console.log('Starting Claude summarization process');
  
  if (!claudeApiKey) {
    throw new Error('Claude API key not set. Please configure it in Settings.');
  }

  const prompt = PROMPTS.videoSummary(videoTitle, channelName, videoDescription, transcript);

  console.log('Sending request to Claude API');
  
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': claudeApiKey,
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        messages: [
          { role: 'user', content: prompt }
        ]
      })
    });

    console.log('Claude API response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Claude API error response:', errorText);
      throw new Error(`Claude API error (${response.status})`);
    }

    const data = await response.json();
    console.log('Claude API response received successfully');
    return data.content[0].text;
  } catch (error) {
    console.error('Claude API error details:', error);
    throw error;
  }
}

async function summarizeWithChatGpt(transcript, videoTitle, channelName, videoDescription) {
  console.log('Starting ChatGPT summarization process');
  
  if (!chatGptApiKey) {
    throw new Error('ChatGPT API key not set. Please configure it in Settings.');
  }

  const prompt = PROMPTS.videoSummary(videoTitle, channelName, videoDescription, transcript);

  console.log('Sending request to ChatGPT API');
  
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${chatGptApiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'You are a helpful assistant that summarizes YouTube video transcripts using markdown formatting.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 4000
      })
    });

    console.log('ChatGPT API response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('ChatGPT API error response:', errorText);
      throw new Error(`OpenAI API error (${response.status})`);
    }

    const data = await response.json();
    console.log('ChatGPT API response received successfully');
    return data.choices[0].message.content;
  } catch (error) {
    console.error('ChatGPT API error details:', error);
    throw error;
  }
}