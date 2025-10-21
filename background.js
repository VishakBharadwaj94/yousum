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

// Helper function to estimate tokens (rough approximation: 1 token ≈ 4 characters)
function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

// Helper function to truncate transcript if needed
function truncateTranscript(transcript, maxTokens) {
  const estimatedTokens = estimateTokens(transcript);
  
  if (estimatedTokens <= maxTokens) {
    return transcript;
  }
  
  console.log(`Transcript too long (${estimatedTokens} tokens), truncating to ${maxTokens} tokens`);
  
  // Calculate how much to keep (with buffer)
  const keepRatio = (maxTokens * 0.9) / estimatedTokens; // 90% to leave room for prompt
  const keepChars = Math.floor(transcript.length * keepRatio);
  
  const truncated = transcript.substring(0, keepChars);
  return truncated + '\n\n[Transcript truncated due to length. Summary covers the first portion of the video.]';
}

// Listen for messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'saveApiKeys') {
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
    const { transcript, videoTitle, channelName, videoDescription, videoDuration, service, videoId } = request;
    
    // Check if already generating
    if (ongoingSummarizations[videoId]) {
      sendResponse({ 
        success: false, 
        error: 'Already generating summary for this video' 
      });
      return true;
    }
    
    // Check transcript length and warn if very long
    const transcriptTokens = estimateTokens(transcript);
    console.log('Transcript size:', transcriptTokens, 'tokens');
    
    if (transcriptTokens > 100000) {
      sendResponse({ 
        success: false, 
        error: `Transcript is extremely long (${transcriptTokens} tokens). This video may be too long to summarize. Try a shorter video.` 
      });
      return true;
    }
    
    // Start background summarization
    console.log('Starting background summarization:', service, videoId, `${videoDuration} mins`);
    
    ongoingSummarizations[videoId] = {
      service,
      videoTitle,
      channelName,
      startTime: Date.now(),
      progress: 'Starting...'
    };
    
    if (service === 'claude') {
      summarizeWithClaudeBackground(transcript, videoTitle, channelName, videoDescription, videoDuration, videoId);
    } else if (service === 'chatgpt') {
      summarizeWithChatGptBackground(transcript, videoTitle, channelName, videoDescription, videoDuration, videoId);
    }
    
    sendResponse({ success: true });
    return true;
  }
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
  else if (request.action === 'getGenerationStartTime') {
    const { videoId } = request;
    const ongoing = ongoingSummarizations[videoId];
    
    sendResponse({ 
      startTime: ongoing?.startTime || null
    });
    return true;
  }
});

// Background summarization for Claude (streaming)
async function summarizeWithClaudeBackground(transcript, videoTitle, channelName, videoDescription, videoDuration, videoId) {
  console.log('Starting Claude background summarization');
  
  if (!claudeApiKey) {
    ongoingSummarizations[videoId].error = 'Claude API key not set';
    delete ongoingSummarizations[videoId];
    return;
  }
  
  // Claude has higher limits (200k tokens context), but still truncate if needed
  const maxTranscriptTokens = 180000; // Leave room for prompt and response
  const processedTranscript = truncateTranscript(transcript, maxTranscriptTokens);
  
  const prompt = PROMPTS.videoSummary(videoTitle, channelName, videoDescription, processedTranscript, videoDuration);

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
        max_tokens: 4096,
        stream: true,
        messages: [
          { role: 'user', content: prompt }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Claude API error response:', errorText);
      
      // Parse error for better user message
      let errorMessage = `Claude API error (${response.status})`;
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.error?.message) {
          errorMessage = errorData.error.message;
        }
      } catch (e) {
        // Keep default error message
      }
      
      ongoingSummarizations[videoId].error = errorMessage;
      
      // Save error to summaries so user can see it
      summaries[videoId] = {
        summary: `Error: ${errorMessage}`,
        service: 'claude',
        videoTitle,
        channelName,
        timestamp: Date.now(),
        isPartial: false,
        hasError: true
      };
      chrome.storage.local.set({ summaries });
      
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
    
    // Save error to summaries
    summaries[videoId] = {
      summary: `Error: ${error.message}`,
      service: 'claude',
      videoTitle,
      channelName,
      timestamp: Date.now(),
      isPartial: false,
      hasError: true
    };
    chrome.storage.local.set({ summaries });
    
    delete ongoingSummarizations[videoId];
  }
}

// Background summarization for ChatGPT (streaming)
async function summarizeWithChatGptBackground(transcript, videoTitle, channelName, videoDescription, videoDuration, videoId) {
  console.log('Starting ChatGPT background summarization');
  
  if (!chatGptApiKey) {
    ongoingSummarizations[videoId].error = 'ChatGPT API key not set';
    delete ongoingSummarizations[videoId];
    return;
  }
  
  // ChatGPT has 128k context for gpt-4o, but effective is lower due to rate limits
  // Truncate to ~20k tokens to stay well within rate limits (30k TPM)
  const maxTranscriptTokens = 20000;
  const processedTranscript = truncateTranscript(transcript, maxTranscriptTokens);
  
  const prompt = PROMPTS.videoSummary(videoTitle, channelName, videoDescription, processedTranscript, videoDuration);

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
          { role: 'system', content: PROMPTS.systemPrompts.chatgpt },
          { role: 'user', content: prompt }
        ],
        max_tokens: 4096,
        stream: true
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ChatGPT API error response:', errorText);
      
      // Parse error for better user message
      let errorMessage = `OpenAI API error (${response.status})`;
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.error?.message) {
          errorMessage = errorData.error.message;
          
          // Add helpful message for rate limits
          if (errorData.error.code === 'rate_limit_exceeded') {
            errorMessage += '\n\nTip: This video may be too long for your current rate limits. Try using Claude instead, or wait a minute and try again.';
          }
        }
      } catch (e) {
        // Keep default error message
      }
      
      ongoingSummarizations[videoId].error = errorMessage;
      
      // Save error to summaries so user can see it
      summaries[videoId] = {
        summary: `Error: ${errorMessage}`,
        service: 'chatgpt',
        videoTitle,
        channelName,
        timestamp: Date.now(),
        isPartial: false,
        hasError: true
      };
      chrome.storage.local.set({ summaries });
      
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
    
    // Save error to summaries
    summaries[videoId] = {
      summary: `Error: ${error.message}`,
      service: 'chatgpt',
      videoTitle,
      channelName,
      timestamp: Date.now(),
      isPartial: false,
      hasError: true
    };
    chrome.storage.local.set({ summaries });
    
    delete ongoingSummarizations[videoId];
  }
}