// prompts.js - Centralized prompt templates

const PROMPTS = {
  videoSummary: (videoTitle, channelName, videoDescription, transcript) => {
    // Build the prompt with optional description
    let prompt = `Please provide a thorough, comprehensive summary of this YouTube video transcript.

Video Title: ${videoTitle}
Channel: ${channelName}`;

    // Add description if available
    if (videoDescription && videoDescription.length > 0) {
      prompt += `
Video Description: ${videoDescription}`;
    }

    prompt += `

Include the following in your summary:
1. Main speaker(s) and their roles/expertise
2. Key points and arguments presented
3. Important quotes (with approximate timestamps if available)
4. Any disagreements or opposing viewpoints discussed
5. Main conclusions or takeaways`;

    // Add note about description if it was included
    if (videoDescription && videoDescription.length > 0) {
      prompt += `
6. Context from the video description (if relevant)`;
    }

    prompt += `

Format your response using markdown for better readability:
- Use **bold** for emphasis on key terms
- Use clear paragraph breaks
- Use numbered or bulleted lists where appropriate
- Use headers (##) for major sections
- Use > for important quotes

Here's the transcript:
${transcript}

Respond with a well-structured, detailed summary that would help someone understand the video content without watching it.`;

    return prompt;
  },

  // System prompts for different services
  systemPrompts: {
    claude: 'You are a helpful assistant that summarizes YouTube video transcripts with detailed analysis.',
    chatgpt: 'You are a helpful assistant that summarizes YouTube video transcripts.'
  }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PROMPTS;
}