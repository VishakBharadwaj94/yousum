# AI Video Summarizer - Chrome Extension

A powerful Chrome extension that extracts transcripts from YouTube videos and generates comprehensive summaries using Claude or ChatGPT APIs with real-time streaming support.

![Extension Demo](demo.gif) <!-- Optional: Add a demo GIF -->

## Features

- ✨ **Real-time Streaming**: Watch summaries generate word-by-word as they're created
- 🎯 **Dual AI Support**: Choose between Claude (Anthropic) or ChatGPT (OpenAI)
- 📝 **Rich Formatting**: Summaries rendered with proper markdown formatting (headers, bold, lists, quotes)
- ⚡ **Smart Transcript Extraction**: Automatically extracts YouTube captions/subtitles
- 💾 **Secure Storage**: API keys stored locally in your browser
- 🎨 **Clean UI**: Simple, intuitive interface with live progress indicators

## Installation

### Step 1: Download the Extension

1. Clone this repository or download as ZIP:
```bash
   git clone https://github.com/VishakBharadwaj94/ai-video-summarizer.git
```
   Or click the green "Code" button and select "Download ZIP", then extract it.

2. Make sure your folder structure looks like this:
```
   ai-video-summarizer/
   ├── README.md
   ├── background.js
   ├── content.js
   ├── manifest.json
   ├── popup.html
   ├── popup.js
   ├── marked.min.js
   └── icons/
       ├── icon16.png
       └── icon48.png
```

### Step 2: Download marked.min.js

The extension needs the Marked.js library for markdown rendering:

1. Download `marked.min.js` from: https://cdn.jsdelivr.net/npm/marked/marked.min.js
2. Save it in the root folder of the extension (same level as `manifest.json`)

### Step 3: Create Icons (Optional)

If you want custom icons, create two PNG files:
- `icons/icon16.png` (16x16 pixels)
- `icons/icon48.png` (48x48 pixels)

You can use any icon generator or create simple placeholder icons. If you skip this step, Chrome will use a default icon.

### Step 4: Load Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **"Load unpacked"**
4. Select the `ai-video-summarizer` folder
5. The extension should now appear in your extensions list

## Configuration

### Get Your API Keys

You'll need API keys from one or both AI services:

#### For Claude (Anthropic):
1. Go to https://console.anthropic.com/
2. Sign up or log in
3. Navigate to API Keys section
4. Create a new API key
5. Copy the key (starts with `sk-ant-...`)

#### For ChatGPT (OpenAI):
1. Go to https://platform.openai.com/
2. Sign up or log in
3. Navigate to API Keys section
4. Create a new API key
5. Copy the key (starts with `sk-...`)

### Configure the Extension

1. Click the extension icon in your Chrome toolbar
2. Click the **Settings** tab
3. Paste your API key(s) into the appropriate fields
4. Click **"Save API Keys"**
5. You should see a green checkmark: "✓ API keys saved successfully!"

**Note**: Your API keys are stored locally in your browser and are never sent anywhere except to the respective AI services when you request a summary.

## Usage

### Summarizing a Video

1. Navigate to any YouTube video (e.g., `https://www.youtube.com/watch?v=VIDEO_ID`)
2. Click the extension icon in your Chrome toolbar
3. Wait for the video information to load
4. Click either:
   - **"Summarize with Claude"** - Uses Anthropic's Claude AI
   - **"Summarize with ChatGPT"** - Uses OpenAI's GPT-4

### What Happens Next

1. **Transcript Extraction** (3-5 seconds): The extension extracts the video's captions
2. **Streaming Summary** (10-30 seconds): The AI generates a summary in real-time
   - You'll see the summary appear word-by-word
   - You can scroll up to read earlier parts while it continues generating
   - A timer shows elapsed time

### Summary Contents

Each summary includes:
- 👤 **Main speakers** and their expertise
- 🎯 **Key points** and arguments
- 💬 **Important quotes** with timestamps
- ⚖️ **Disagreements** or opposing viewpoints
- ✅ **Main conclusions** and takeaways

## Tips & Troubleshooting

### Video Requirements
- ✅ Video must have captions/subtitles enabled
- ✅ Works with auto-generated or manual captions
- ⚠️ Very long videos (2+ hours) may take longer to process

### Common Issues

**"Could not extract transcript"**
- Make sure the video has captions available
- Try clicking the transcript button on YouTube first to verify
- Refresh the page and try again

**"API key not set"**
- Go to Settings tab and enter your API key
- Make sure you clicked "Save API Keys"
- Check that the key starts with `sk-ant-` (Claude) or `sk-` (OpenAI)

**Summary takes too long**
- Longer videos naturally take more time (20-30+ seconds)
- Check your internet connection
- Verify you haven't exceeded your API rate limits

**Formatting looks wrong**
- Make sure `marked.min.js` is in the extension folder
- Try reloading the extension in `chrome://extensions/`

### API Costs

Both services charge per API usage:
- **Claude**: ~$3 per million input tokens, ~$15 per million output tokens
- **ChatGPT (GPT-4)**: ~$2.50 per million input tokens, ~$10 per million output tokens

A typical 30-minute video summary costs **$0.05 - $0.20** depending on the service and video length.

## Privacy & Security

- 🔒 Your API keys are stored **locally** in your browser using Chrome's storage API
- 🔒 Keys are **never sent** to any third-party servers
- 🔒 Only video transcripts are sent to AI services (Claude/OpenAI) for summarization
- 🔒 No tracking, analytics, or data collection

## Development

### Project Structure
```
├── manifest.json       # Extension configuration
├── background.js       # Service worker handling API calls
├── content.js          # Script injected into YouTube pages
├── popup.html          # Extension popup UI
├── popup.js            # Popup logic and event handlers
├── marked.min.js       # Markdown parser library
└── icons/              # Extension icons
```

### Tech Stack

- **Manifest V3** - Latest Chrome extension format
- **Vanilla JavaScript** - No frameworks, lightweight and fast
- **Streaming APIs** - Real-time response streaming from Claude/ChatGPT
- **Marked.js** - Markdown to HTML rendering

### Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Anthropic](https://www.anthropic.com/) for Claude API
- [OpenAI](https://openai.com/) for ChatGPT API
- [Marked.js](https://marked.js.org/) for markdown parsing

## Support

If you encounter any issues or have questions:
1. Check the [Troubleshooting](#tips--troubleshooting) section
2. Open an issue on GitHub
3. Make sure you're using the latest version of Chrome

---

**Disclaimer**: This extension requires valid API keys from Anthropic and/or OpenAI. API usage is subject to their respective terms of service and pricing.
```

### Additional Files to Create:

**LICENSE** (MIT License example):
```
MIT License

Copyright (c) 2025 [Vishak Bharadwaj S]

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

**.gitignore**:
```
# API Keys (if someone accidentally commits them)
config.json
*.key

# OS files
.DS_Store
Thumbs.db

# Editor files
.vscode/
.idea/
*.swp
*.swo
*~

# Test files
test/
*.test.js