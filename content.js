// Global variables
let videoId = '';
let videoTitle = '';
let channelName = '';
let videoDescription = '';
let videoDuration = 0; // in minutes
let transcript = '';

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getVideoInfo') {
    const videoInfo = {
      videoId,
      videoTitle,
      channelName,
      videoDescription,
      videoDuration,
      hasTranscript: transcript !== ''
    };
    sendResponse(videoInfo);
    return true;
  } else if (request.action === 'getTranscript') {
    if (transcript) {
      sendResponse({ transcript });
    } else {
      extractTranscript().then(result => {
        transcript = result;
        sendResponse({ transcript });
      }).catch(err => {
        sendResponse({ error: err.message });
      });
    }
    return true;
  }
});

// Initialize when the content script loads
function initialize() {
  // Get video ID from URL
  const url = new URL(window.location.href);
  videoId = url.searchParams.get('v');
  
  if (!videoId) return; // Not a video page
  
  // Get video title, channel name, description, and duration
  const intervalId = setInterval(() => {
    const titleElement = document.querySelector('h1.ytd-video-primary-info-renderer');
    const channelElement = document.querySelector('ytd-channel-name yt-formatted-string#text a');
    const descriptionElement = document.querySelector('ytd-text-inline-expander#description yt-attributed-string span');
    
    if (titleElement && channelElement) {
      videoTitle = titleElement.textContent.trim();
      channelName = channelElement.textContent.trim();
      
      // Get description if available
      if (descriptionElement) {
        videoDescription = descriptionElement.textContent.trim();
      } else {
        // Try alternative selectors for description
        const altDescElement = document.querySelector('#description-inline-expander yt-attributed-string');
        if (altDescElement) {
          videoDescription = altDescElement.textContent.trim();
        }
      }

      // Get video duration - try multiple methods
      // Method 1: Try video element
      const videoElement = document.querySelector('video.html5-main-video');
      if (videoElement && videoElement.duration && !isNaN(videoElement.duration)) {
        videoDuration = Math.floor(videoElement.duration / 60); // Convert to minutes
      } else {
        // Method 2: Try time display
        const timeElement = document.querySelector('.ytp-time-duration');
        if (timeElement) {
          const timeText = timeElement.textContent.trim();
          videoDuration = parseTimeToMinutes(timeText);
        }
      }
      
      console.log('Video info loaded:', { 
        videoTitle, 
        channelName, 
        descriptionLength: videoDescription.length,
        durationMinutes: videoDuration
      });
      
      clearInterval(intervalId);
    }
  }, 1000);
  
  // Do NOT preload transcript - wait for user to request it
}

// Helper function to parse time string (e.g., "1:23:45" or "15:30") to minutes
function parseTimeToMinutes(timeString) {
  const parts = timeString.split(':').map(Number);
  
  if (parts.length === 3) {
    // Format: HH:MM:SS
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 2) {
    // Format: MM:SS
    return parts[0];
  } else {
    return 0;
  }
}

// Function to extract transcript from YouTube
async function extractTranscript() {
  return new Promise((resolve, reject) => {
    console.log('Attempting to extract transcript...');
    
    // First, try to find the transcript button in the description area
    tryDescriptionTranscriptButton()
      .then(result => resolve(result))
      .catch(error => {
        console.log('Description transcript button method failed, trying alternative methods:', error.message);
        tryMoreActionsMethod()
          .then(result => resolve(result))
          .catch(error => {
            console.log('More actions method failed too:', error.message);
            reject(new Error('Could not extract transcript. This video may not have captions available.'));
          });
      });
    
    // Method 1: Try to find and use the transcript button in the description
    function tryDescriptionTranscriptButton() {
      return new Promise((resolve, reject) => {
        console.log('Looking for transcript button in description area...');
        
        // Look for the transcript button in the description area
        const descriptionArea = document.querySelector('ytd-watch-metadata');
        if (!descriptionArea) {
          return reject(new Error('Description area not found'));
        }
        
        // Find all buttons in the description area
        const buttons = Array.from(descriptionArea.querySelectorAll('button, tp-yt-paper-button, yt-button-renderer'));
        
        // Find the transcript button
        const transcriptButton = buttons.find(button => {
          const text = button.textContent.trim().toLowerCase();
          return text.includes('transcript') || text.includes('show transcript');
        });
        
        if (!transcriptButton) {
          return reject(new Error('Transcript button not found in description area'));
        }
        
        console.log('Found transcript button in description area, clicking it');
        transcriptButton.click();
        
        // Wait for the transcript panel to appear
        setTimeout(() => {
          // Look for the transcript panel that appears on the right
          const transcriptPanel = document.querySelector('ytd-transcript-renderer') || 
                                 document.querySelector('[id*="transcript"]') ||
                                 document.querySelector('[class*="transcript"]');
          
          if (!transcriptPanel) {
            return reject(new Error('Transcript panel not found after clicking button'));
          }
          
          // Find all transcript segments
          const transcriptSegments = transcriptPanel.querySelectorAll('ytd-transcript-segment-renderer') || 
                                    transcriptPanel.querySelectorAll('[class*="segment"]');
          
          if (!transcriptSegments || transcriptSegments.length === 0) {
            return reject(new Error('No transcript segments found in panel'));
          }
          
          console.log(`Found ${transcriptSegments.length} transcript segments`);
          
          // Extract text from each segment
          let fullTranscript = '';
          transcriptSegments.forEach(segment => {
            // Find timestamp and text elements
            const timeElement = segment.querySelector('.segment-timestamp') || 
                              segment.querySelector('[class*="timestamp"]');
            
            const textElement = segment.querySelector('.segment-text') || 
                              segment.querySelector('[class*="text"]');
            
            if (timeElement && textElement) {
              const time = timeElement.textContent.trim();
              const text = textElement.textContent.trim();
              fullTranscript += `[${time}] ${text}\n`;
            }
          });
          
          // Close the transcript panel to clean up
          const closeButton = document.querySelector('[aria-label="Close transcript"]') ||
                            document.querySelector('ytd-engagement-panel-section-list-renderer #dismiss-button') ||
                            document.querySelector('[aria-label="Close"]');
                            
          if (closeButton) {
            closeButton.click();
          }
          
          if (fullTranscript) {
            console.log('Successfully extracted transcript from description button method');
            resolve(fullTranscript);
          } else {
            reject(new Error('Extracted transcript is empty'));
          }
        }, 1500);
      });
    }
    
    // Method 2: Try to use the "..." more actions button method
    function tryMoreActionsMethod() {
      return new Promise((resolve, reject) => {
        console.log('Trying to extract transcript using more actions button...');
        
        // Find the "..." button
        const moreActionsButton = document.querySelector('button.ytp-button[aria-label="More actions"]');
        if (!moreActionsButton) {
          return reject(new Error('More actions button not found'));
        }
        
        console.log('Found more actions button, clicking it');
        moreActionsButton.click();
        
        // Wait for the menu to appear
        setTimeout(() => {
          // Look for the transcript option in the menu
          const menuItems = Array.from(document.querySelectorAll('tp-yt-paper-item'));
          const showTranscriptItem = menuItems.find(item => 
            item.textContent.trim().toLowerCase().includes('transcript')
          );
          
          if (!showTranscriptItem) {
            // Close the menu and reject
            document.body.click();
            return reject(new Error('Transcript option not found in menu'));
          }
          
          console.log('Found transcript option in menu, clicking it');
          showTranscriptItem.click();
          
          // Wait for the transcript panel to load
          setTimeout(() => {
            const transcriptPanel = document.querySelector('ytd-transcript-renderer');
            if (!transcriptPanel) {
              return reject(new Error('Transcript panel not found'));
            }
            
            // Get all transcript entries
            const transcriptEntries = transcriptPanel.querySelectorAll('ytd-transcript-segment-renderer');
            if (transcriptEntries.length === 0) {
              return reject(new Error('No transcript entries found'));
            }
            
            console.log(`Found ${transcriptEntries.length} transcript entries`);
            
            // Extract text from each entry
            let fullTranscript = '';
            transcriptEntries.forEach(entry => {
              const timeElement = entry.querySelector('.segment-timestamp');
              const textElement = entry.querySelector('.segment-text');
              
              if (timeElement && textElement) {
                const time = timeElement.textContent.trim();
                const text = textElement.textContent.trim();
                fullTranscript += `[${time}] ${text}\n`;
              }
            });
            
            // Close transcript panel
            const closeButton = document.querySelector('ytd-engagement-panel-section-list-renderer #dismiss-button');
            if (closeButton) {
              closeButton.click();
            }
            
            if (fullTranscript) {
              console.log('Successfully extracted transcript from more actions method');
              resolve(fullTranscript);
            } else {
              reject(new Error('Extracted transcript is empty'));
            }
          }, 1500);
        }, 800);
      });
    }
  });
}

// Run initialization
initialize();