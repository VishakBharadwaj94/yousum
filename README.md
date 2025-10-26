# YouSum : AI Video Summarizer - Chrome Extension

A powerful Chrome extension that extracts transcripts from YouTube videos and generates comprehensive summaries using Claude or ChatGPT APIs with real-time streaming support. Summaries persist across sessions and generation continues even when the popup is closed.

![Extension Version](https://img.shields.io/badge/version-1.2-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## Features

- ✨ **Real-time Streaming**: Watch summaries generate word-by-word as they're created
- 🔄 **Background Generation**: Close the popup and generation continues in the background
- 💾 **Persistent Summaries**: All summaries are saved and reload when you revisit videos
- 🎯 **Dual AI Support**: Choose between Claude (Anthropic) or ChatGPT (OpenAI)
- ⏹️ **Stop Generation**: Cancel generation at any time and save partial results
- 📝 **Rich Formatting**: Summaries rendered with proper markdown (headers, bold, lists, quotes)
- ⚡ **Smart Transcript Extraction**: Automatically extracts YouTube captions with fallback methods
- 🔐 **Secure Storage**: API keys stored locally in your browser
- 🎨 **Clean UI**: Simple, intuitive interface with live progress indicators
- 📊 **Smart Scrolling**: Auto-scroll stops when you scroll up to read earlier content

## Installation

### Step 1: Download the Extension

1. Clone this repository or download as ZIP:
```bash
   git clone https://github.com/vishakbharadwaj94/yousum.git
```
   Or click the green "Code" button and select "Download ZIP", then extract it.

2. Make sure your folder structure looks like this:
```
   yousum/
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
4. Select the `yousum` folder
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
4. Use the **Show/Hide** buttons to verify your keys
5. Click **"Save API Keys"**
6. You should see a green checkmark: "✓ API keys saved successfully!"

**Note**: Your API keys are stored locally in your browser and are never sent anywhere except to the respective AI services when you request a summary.

## Usage

### Summarizing a Video

1. Navigate to any YouTube video (e.g., `https://www.youtube.com/watch?v=VIDEO_ID`)
2. Click the extension icon in your Chrome toolbar
3. The extension will automatically detect the video (even on already-open tabs)
4. Click either:
   - **"Summarize with Claude"** - Uses Anthropic's Claude AI
   - **"Summarize with ChatGPT"** - Uses OpenAI's GPT-4

### What Happens Next

1. **Transcript Extraction** (3-5 seconds): The extension extracts the video's captions
2. **Streaming Summary** (10-30 seconds): The AI generates a summary in real-time
   - You'll see the summary appear word-by-word
   - A timer shows elapsed time
   - You can scroll up to read earlier parts while it continues generating
   - Auto-scroll stops when you manually scroll up

### Background Generation

**Close the popup and generation continues!**
- Start a summary, then close the popup
- Generation continues in the background
- Reopen the popup anytime to see progress
- Partial summaries are automatically saved
- Timer shows total elapsed time, not reset time

### Stop Generation

- Click the **⏹ Stop Generation** button at any time
- Partial summary is saved
- You can restart generation later for a complete summary

### Saved Summaries

- Every summary is automatically saved
- Revisit a video to instantly see its summary
- Partial summaries are marked with a warning
- Generate new summaries anytime to replace old ones

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

**"Video title not available" or "Could not communicate with YouTube"**
- The extension automatically retries 3 times with content script injection
- If it still fails, refresh the YouTube page and try again
- Make sure you're on a video page (not the YouTube homepage)

**"Could not extract transcript"**
- Make sure the video has captions available
- Try clicking the "Show transcript" button on YouTube first to verify
- Some videos may have captions disabled by the creator

**"API key not set"**
- Go to Settings tab and enter your API key
- Make sure you clicked "Save API Keys"
- Check that the key starts with `sk-ant-` (Claude) or `sk-` (OpenAI)

**Summary takes too long**
- Longer videos naturally take more time (20-45+ seconds)
- Check your internet connection
- Verify you haven't exceeded your API rate limits
- Generation continues in the background - close popup and check back later

**Generation stops unexpectedly**
- Check the browser console for errors (F12)
- Verify your API key is valid
- Check if you've hit API rate limits or quota
- Partial summaries are saved - you can see what was generated

**Scrolling fights with auto-scroll during generation**
- This should be fixed in v1.2+
- Scroll up manually and auto-scroll will stop
- Auto-scroll only activates when you're at the bottom

**Timer resets when reopening popup**
- This should be fixed in v1.2+
- Timer now shows total elapsed time from original start
- Close and reopen the popup - timer should continue counting

### API Costs

Both services charge per API usage:
- **Claude (Sonnet 4)**: ~$3 per million input tokens, ~$15 per million output tokens
- **ChatGPT (GPT-4o)**: ~$2.50 per million input tokens, ~$10 per million output tokens

**Typical costs per video:**
- 10-minute video: $0.02 - $0.08
- 30-minute video: $0.05 - $0.20
- 60-minute video: $0.10 - $0.40
- 2-hour video: $0.30 - $1.00

Costs vary based on transcript length and summary detail.

## Privacy & Security

- 🔒 Your API keys are stored **locally** in your browser using Chrome's storage API
- 🔒 Keys are **never sent** to any third-party servers
- 🔒 Only video transcripts are sent to AI services (Claude/OpenAI) for summarization
- 🔒 Summaries are stored locally and never transmitted elsewhere
- 🔒 No tracking, analytics, or data collection
- 🔒 No external servers - everything runs locally in your browser

## Advanced Features

### Persistent Storage
- All summaries are saved indefinitely in Chrome's local storage
- Each video has its own saved summary (keyed by video ID)
- Summaries survive browser restarts
- Clear Chrome extension data to delete all saved summaries

### Background Processing
- Summaries generate in a background service worker
- Close the extension popup without interrupting generation
- Return to any video to see its saved summary instantly
- Multiple videos can be summarized in sequence

### Smart Content Script Injection
- Automatically injects content script on already-open YouTube tabs
- Retries up to 3 times with 1-second delays
- No need to refresh the page manually
- Works on pages opened before extension was installed

## Development

### Project Structure
```
├── manifest.json       # Extension configuration (Manifest V3)
├── background.js       # Service worker handling API calls and storage
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
- **Chrome Storage API** - Local persistent storage
- **Chrome Scripting API** - Dynamic content script injection

### Key Components

**background.js** (Service Worker)
- Handles all API communication
- Manages background summarization
- Stores summaries and tracks ongoing generations
- Survives popup closure

**content.js** (Content Script)
- Extracts video metadata (title, channel, video ID)
- Extracts YouTube transcripts using two methods
- Injected on YouTube video pages

**popup.js** (UI Logic)
- Manages user interface and interactions
- Polls for summary updates every 500ms
- Handles scrolling behavior and user input
- Auto-injects content script if needed

### Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Roadmap

Potential future features:
- [ ] Export summaries to PDF/Markdown files
- [ ] Custom summary templates/prompts
- [ ] Summary comparison (different AI services)
- [ ] Timestamp-linked navigation
- [ ] Batch processing multiple videos
- [ ] Summary sharing/collaboration
- [ ] Browser sync for summaries across devices
- [ ] Support for other video platforms

## Changelog

### Version 1.2 (Current)
- ✨ Added background generation (continues when popup is closed)
- ✨ Added stop generation button
- ✨ Added persistent summary storage
- ✨ Fixed timer reset issue on popup reopen
- ✨ Fixed scrolling issues during generation
- ✨ Auto-inject content script on already-open tabs
- ✨ Smart retry logic for content script injection
- 🐛 Bug fixes and performance improvements

### Version 1.1
- ✨ Added real-time streaming support
- ✨ Added markdown rendering
- ✨ Improved API key management UI
- 🐛 Fixed CORS issues with Claude API

### Version 1.0
- 🎉 Initial release
- Basic summarization with Claude and ChatGPT
- Transcript extraction from YouTube

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Security & Privacy

**API Key Storage:**
- Your API keys are stored locally on your computer using Chrome's storage API
- Keys are encrypted by Chrome using your operating system's encryption (Windows DPAPI, macOS Keychain)
- Keys are never sent to any third-party servers
- Keys are only transmitted directly to Anthropic/OpenAI APIs for summarization
- No tracking, analytics, or data collection

**Recommendations:**
- Use API keys with spending limits
- Monitor your API usage regularly
- If sharing your computer, consider using a separate Chrome profile
- To clear keys: Go to Settings tab and delete them, or uninstall the extension

## Acknowledgments

- [Anthropic](https://www.anthropic.com/) for Claude API
- [OpenAI](https://openai.com/) for ChatGPT API
- [Marked.js](https://marked.js.org/) for markdown parsing
- Chrome Extensions team for excellent documentation

## Support

If you encounter any issues or have questions:
1. Check the [Troubleshooting](#tips--troubleshooting) section
2. Open an issue on GitHub: https://github.com/vishakbharadwaj94/yousum/issues
3. Make sure you're using the latest version of Chrome (120+)

## Repository

GitHub: https://github.com/vishakbharadwaj94/yousum

---

**Disclaimer**: This extension requires valid API keys from Anthropic and/or OpenAI. API usage is subject to their respective terms of service and pricing. This extension is not affiliated with, endorsed by, or connected to YouTube, Google, Anthropic, or OpenAI.



**Made with ❤️ for the AI community**