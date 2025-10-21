// Store API keys in memory
let claudeApiKey = '';
let chatGptApiKey = '';

// Load API keys on startup
chrome.storage.local.get(['claudeApiKey', 'chatGptApiKey'], (result) => {
  claudeApiKey = result.claudeApiKey || '';
  chatGptApiKey = result.chatGptApiKey || '';
  console.log('API keys loaded on startup');
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
    // Return cached keys instead of fetching from storage
    sendResponse({
      claudeApiKey,
      chatGptApiKey
    });
    return true;
  }
});

// Handle streaming connections
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'streaming') {
    console.log('Streaming connection established');
    
    port.onMessage.addListener(async (request) => {
      if (request.action === 'summarizeStream') {
        const { transcript, videoTitle, channelName, service } = request;
        
        console.log('Starting streaming summarization:', service);
        
        try {
          if (service === 'claude') {
            await summarizeWithClaudeStreaming(transcript, videoTitle, channelName, port);
          } else if (service === 'chatgpt') {
            await summarizeWithChatGptStreaming(transcript, videoTitle, channelName, port);
          }
        } catch (error) {
          console.error('Streaming error:', error);
          port.postMessage({ error: error.message });
        }
      }
    });
  }
});

// Function to summarize with Claude API (streaming)
async function summarizeWithClaudeStreaming(transcript, videoTitle, channelName, port) {
  console.log('Starting Claude streaming summarization');
  
  if (!claudeApiKey) {
    throw new Error('Claude API key not set. Please configure it in Settings.');
  }
  

const prompt = `Please provide a thorough, comprehensive summary of this YouTube video transcript.

Video Title: ${videoTitle}
Channel: ${channelName}

Include the following in your summary:
1. Main speaker(s) and their roles/expertise
2. Key points and arguments presented
3. Important quotes (with approximate timestamps if available)
4. Any disagreements or opposing viewpoints discussed
5. Main conclusions or takeaways

Format your response using markdown for better readability:
- Use **bold** for emphasis on key terms
- Use clear paragraph breaks
- Use numbered or bulleted lists where appropriate
- Use headers (##) for major sections
- Use > for important quotes

Here's the transcript:
${transcript}

Respond with a well-structured, detailed summary that would help someone understand the video content without watching it.`;

  console.log('Sending streaming request to Claude API');
  
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
        stream: true,
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
              port.postMessage({ partial: fullText });
            } else if (data.type === 'message_stop') {
              port.postMessage({ complete: true, summary: fullText });
            }
          } catch (e) {
            // Skip malformed JSON
          }
        }
      }
    }
    
    console.log('Claude streaming completed');
  } catch (error) {
    console.error('Claude streaming error:', error);
    throw error;
  }
}

// Function to summarize with ChatGPT API (streaming)
async function summarizeWithChatGptStreaming(transcript, videoTitle, channelName, port) {
  console.log('Starting ChatGPT streaming summarization');
  
  if (!chatGptApiKey) {
    throw new Error('ChatGPT API key not set. Please configure it in Settings.');
  }
  
  // In summarizeWithClaudeStreaming function:
const prompt = `Please provide a thorough, comprehensive summary of this YouTube video transcript.

Video Title: ${videoTitle}
Channel: ${channelName}

Include the following in your summary:
1. Main speaker(s) and their roles/expertise
2. Key points and arguments presented
3. Important quotes (with approximate timestamps if available)
4. Any disagreements or opposing viewpoints discussed
5. Main conclusions or takeaways

Format your response using markdown for better readability:
- Use **bold** for emphasis on key terms
- Use clear paragraph breaks
- Use numbered or bulleted lists where appropriate
- Use headers (##) for major sections
- Use > for important quotes

Here's the transcript:
${transcript}

Respond with a well-structured, detailed summary that would help someone understand the video content without watching it.`;

  console.log('Sending streaming request to ChatGPT API');
  
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
          { role: 'system', content: 'You are a helpful assistant that summarizes YouTube video transcripts.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 4000,
        stream: true
      })
    });

    console.log('ChatGPT API response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('ChatGPT API error response:', errorText);
      throw new Error(`OpenAI API error (${response.status})`);
    }

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
            port.postMessage({ complete: true, summary: fullText });
            break;
          }
          
          try {
            const data = JSON.parse(jsonStr);
            const content = data.choices?.[0]?.delta?.content;
            
            if (content) {
              fullText += content;
              port.postMessage({ partial: fullText });
            }
          } catch (e) {
            // Skip malformed JSON
          }
        }
      }
    }
    
    console.log('ChatGPT streaming completed');
  } catch (error) {
    console.error('ChatGPT streaming error:', error);
    throw error;
  }
}

// Function to summarize with Claude API (non-streaming fallback)
async function summarizeWithClaude(transcript, videoTitle, channelName) {
  console.log('Starting Claude summarization process');
  
  if (!claudeApiKey) {
    throw new Error('Claude API key not set. Please configure it in Settings.');
  }
  
  const prompt = `Please provide a thorough, comprehensive summary of this YouTube video transcript.

Video Title: ${videoTitle}
Channel: ${channelName}

Include the following in your summary:
1. Main speaker(s) and their roles/expertise
2. Key points and arguments presented
3. Important quotes (with approximate timestamps if available)
4. Any disagreements or opposing viewpoints discussed
5. Main conclusions or takeaways

Format your response using markdown for better readability:
- Use **bold** for emphasis on key terms
- Use clear paragraph breaks
- Use numbered or bulleted lists where appropriate
- Use headers (##) for major sections
- Use > for important quotes

Here's the transcript:
${transcript}

Respond with a well-structured, detailed summary that would help someone understand the video content without watching it.`;

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

// Function to summarize with ChatGPT API (non-streaming fallback)
async function summarizeWithChatGpt(transcript, videoTitle, channelName) {
  console.log('Starting ChatGPT summarization process');
  
  if (!chatGptApiKey) {
    throw new Error('ChatGPT API key not set. Please configure it in Settings.');
  }
  
  const prompt = `Please provide a thorough, comprehensive summary of this YouTube video transcript.

Video Title: ${videoTitle}
Channel: ${channelName}

Include the following in your summary:
1. Main speaker(s) and their roles/expertise
2. Key points and arguments presented
3. Important quotes (with approximate timestamps if available)
4. Any disagreements or opposing viewpoints discussed
5. Main conclusions or takeaways

Format your response using markdown for better readability:
- Use **bold** for emphasis on key terms
- Use clear paragraph breaks
- Use numbered or bulleted lists where appropriate
- Use headers (##) for major sections
- Use > for important quotes

Here's the transcript:
${transcript}

Respond with a well-structured, detailed summary that would help someone understand the video content without watching it.`;

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