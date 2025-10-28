// prompts.js - Centralized prompt templates

const PROMPTS = {
  videoSummary: (videoTitle, channelName, videoDescription, transcript, videoDuration, summaryStyle = 'balanced') => {
    // Estimate video length from transcript if duration not provided
    const estimatedDuration = videoDuration || Math.floor(transcript.split(' ').length / 150);
    
    // Define style configurations
    const styleConfigs = {
      skim: {
        name: 'skim',
        targetLength: '150-300 words',
        description: 'ultra-concise',
        detail: 'Keep it extremely brief. Focus only on the absolute core message and main takeaway.',
        chapters: false
      },
      summary: {
        name: 'summary',
        targetLength: estimatedDuration < 30 ? '400-600 words' : '600-1000 words',
        description: 'concise',
        detail: 'Provide a clear, efficient summary hitting the key points.',
        chapters: estimatedDuration >= 30
      },
      balanced: {
        name: 'balanced',
        targetLength: estimatedDuration < 30 ? '800-1200 words' : '1200-2000 words',
        description: 'balanced and detailed',
        detail: 'Provide a comprehensive summary with good detail on key points and supporting information.',
        chapters: estimatedDuration >= 20
      },
      comprehensive: {
        name: 'comprehensive',
        targetLength: estimatedDuration < 30 ? '1500-2500 words' : '2500-3500 words',
        description: 'comprehensive and thorough',
        detail: 'Provide an extensive, detailed summary covering all major points, examples, and nuances.',
        chapters: estimatedDuration >= 15
      },
      exhaustive: {
        name: 'exhaustive',
        targetLength: '3500-4500 words',
        description: 'exhaustive and highly detailed',
        detail: 'Provide a complete, in-depth analysis covering every significant point, example, argument, and detail. Leave nothing important out.',
        chapters: true
      }
    };
    
    const config = styleConfigs[summaryStyle] || styleConfigs.balanced;
    
    // Build chapter guidance
    let chapterGuidance = '';
    if (config.chapters) {
      if (estimatedDuration >= 60) {
        chapterGuidance = `
## CRITICAL: Structure with Detailed Chronological Chapters
This is a long video, so provide a comprehensive breakdown with clear chronological chapters:
- Use time-based headers for each major segment (e.g., ## Opening Remarks (0:00-10:00))
- Include 8-12 chapters minimum, following the natural flow of the video
- Each chapter should be 2-4 paragraphs covering that time period
- Capture the progression of ideas and how topics evolved
- Note any shifts in discussion or introduction of new themes`;
      } else if (estimatedDuration >= 30) {
        chapterGuidance = `
## IMPORTANT: Structure with Chronological Chapters
Break down the summary into clear chronological chapters that follow the flow of the conversation:
- Use time-based headers like: ## Main Topic (5:00-15:00)
- Include 4-8 chapters following the video's structure
- Each chapter should capture what was discussed during that time period`;
      } else {
        chapterGuidance = `
If the video has distinct sections or topics, use headers to separate them with approximate timestamps.`;
      }
    }

    // Build the prompt
    let prompt = `Please provide a ${config.description} summary of this YouTube video transcript.

Video Title: ${videoTitle}
Channel: ${channelName}
Estimated Duration: ~${estimatedDuration} minutes`;

    // Add description if available
    if (videoDescription && videoDescription.length > 0) {
      prompt += `
Video Description: ${videoDescription}`;
    }

    prompt += `

SUMMARY STYLE: ${config.name.toUpperCase()}
TARGET LENGTH: ${config.targetLength}
${config.detail}

${chapterGuidance}

Include the following in your summary:
1. **Main speaker(s)** and their roles/expertise
2. **Key points and arguments** presented throughout the video
3. **Important quotes** with approximate timestamps (e.g., [15:30])`;

    // Add optional elements based on style
    if (summaryStyle !== 'skim') {
      prompt += `
4. **Any disagreements or opposing viewpoints** discussed`;
    }
    
    prompt += `
${summaryStyle === 'skim' ? '4' : '5'}. **Main conclusions or takeaways**`;

    if (videoDescription && videoDescription.length > 0 && summaryStyle !== 'skim') {
      prompt += `
${summaryStyle === 'skim' ? '5' : '6'}. **Context from the video description** (if relevant)`;
    }

    prompt += `

## Formatting Guidelines:
- Use **bold** for emphasis on key terms and names
- Use clear paragraph breaks for readability`;

    if (summaryStyle !== 'skim') {
      prompt += `
- Use numbered or bulleted lists for multiple related points
- Use headers (##) for major sections/chapters
- Use > for important direct quotes
- Include approximate timestamps throughout to help viewers navigate`;
    }

    if (config.chapters && estimatedDuration >= 30) {
      prompt += `
- Since this is a longer video, preserve the chronological flow of the discussion
- Help readers understand how ideas developed over time`;
    }

    prompt += `

Here's the transcript:
${transcript}

Respond with a well-structured, ${config.description} summary that would help someone understand the video content without watching it.`;

    return prompt;
  },

  // System prompts for different services
  systemPrompts: {
    claude: 'You are a helpful assistant that summarizes YouTube video transcripts with detailed analysis. You adapt your summary length and structure based on the video duration and user preferences.',
    chatgpt: 'You are a helpful assistant that summarizes YouTube video transcripts. You provide appropriately detailed summaries based on video length and user preferences.'
  }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PROMPTS;
}