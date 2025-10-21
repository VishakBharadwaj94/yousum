// prompts.js - Centralized prompt templates

const PROMPTS = {
  videoSummary: (videoTitle, channelName, videoDescription, transcript, videoDuration) => {
    // Estimate video length from transcript if duration not provided
    // Rough estimate: 150 words per minute of speech
    const estimatedDuration = videoDuration || Math.floor(transcript.split(' ').length / 150);
    
    // Determine summary style based on video length
    let summaryStyle = '';
    let targetLength = '';
    let chapterGuidance = '';
    
    if (estimatedDuration < 10) {
      // Short videos (< 10 minutes): Concise summary
      summaryStyle = 'concise';
      targetLength = '2-3 paragraphs (~300-500 words)';
      chapterGuidance = '';
    } else if (estimatedDuration < 30) {
      // Medium videos (10-30 minutes): Standard summary
      summaryStyle = 'standard';
      targetLength = '4-6 paragraphs (~600-1000 words)';
      chapterGuidance = 'If the video has distinct sections or topics, use headers to separate them.';
    } else if (estimatedDuration < 60) {
      // Long videos (30-60 minutes): Detailed summary with chapters
      summaryStyle = 'detailed';
      targetLength = '8-12 paragraphs (~1200-1600 words)';
      chapterGuidance = `
## IMPORTANT: Structure with Chronological Chapters
Break down the summary into clear chronological chapters that follow the flow of the conversation. Use time-based headers like:
- ## Opening / Introduction (0:00-5:00)
- ## Main Topic 1 (5:00-15:00)
- ## Discussion Point / Segment Name (15:00-30:00)
- etc.

Each chapter should capture what was discussed during that time period in the video.`;
    } else {
      // Very long videos (60+ minutes): Comprehensive summary with detailed chapters
      summaryStyle = 'comprehensive';
      targetLength = '15-20 paragraphs (~2500-3000 words)';
      chapterGuidance = `
## CRITICAL: Structure with Detailed Chronological Chapters
This is a long video, so provide a comprehensive breakdown with clear chronological chapters:
- Use time-based headers for each major segment (e.g., ## Opening Remarks (0:00-10:00))
- Include 8-12 chapters minimum, following the natural flow of the video
- Each chapter should be 2-4 paragraphs covering that time period
- Capture the progression of ideas and how topics evolved
- Note any shifts in discussion or introduction of new themes

Think of this as creating a detailed "table of contents" that someone could use to navigate the video.`;
    }

    // Build the prompt
    let prompt = `Please provide a ${summaryStyle} summary of this YouTube video transcript.

Video Title: ${videoTitle}
Channel: ${channelName}
Estimated Duration: ~${estimatedDuration} minutes`;

    // Add description if available
    if (videoDescription && videoDescription.length > 0) {
      prompt += `
Video Description: ${videoDescription}`;
    }

    prompt += `

TARGET LENGTH: ${targetLength}

${chapterGuidance}

Include the following in your summary:
1. **Main speaker(s)** and their roles/expertise
2. **Key points and arguments** presented throughout the video
3. **Important quotes** with approximate timestamps (e.g., [15:30])
4. **Any disagreements or opposing viewpoints** discussed
5. **Main conclusions or takeaways**`;

    if (videoDescription && videoDescription.length > 0) {
      prompt += `
6. **Context from the video description** (if relevant)`;
    }

    prompt += `

## Formatting Guidelines:
- Use **bold** for emphasis on key terms and names
- Use clear paragraph breaks for readability
- Use numbered or bulleted lists for multiple related points
- Use headers (##) for major sections/chapters
- Use > for important direct quotes
- Include approximate timestamps throughout to help viewers navigate`;

    if (estimatedDuration >= 30) {
      prompt += `
- Since this is a longer video, be more detailed and comprehensive
- Preserve the chronological flow of the discussion
- Help readers understand how ideas developed over time`;
    }

    prompt += `

Here's the transcript:
${transcript}

Respond with a well-structured, ${summaryStyle} summary that would help someone understand the video content without watching it. Make sure the length and detail level is appropriate for a ${estimatedDuration}-minute video.`;

    return prompt;
  },

  // System prompts for different services
  systemPrompts: {
    claude: 'You are a helpful assistant that summarizes YouTube video transcripts with detailed analysis. You adapt your summary length and structure based on the video duration.',
    chatgpt: 'You are a helpful assistant that summarizes YouTube video transcripts. You provide appropriately detailed summaries based on video length.'
  }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PROMPTS;
}