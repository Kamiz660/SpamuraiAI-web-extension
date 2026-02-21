# SpamuraiAI

**Real-time YouTube comment spam filter powered by on-device Gemini Nano** <br>
SpamuraiAI scans, flags, and highlights scam or spam comments directly on YouTube. <br> By using the Web AI Prompt API, no data ever leaves your machine, keeping your browsing private and secure.

Click below image to watch the video

[![Watch the video](https://img.youtube.com/vi/jvlPI-W4gU0/0.jpg)](https://youtu.be/jvlPI-W4gU0)


<img width="378" height="665" alt="Screenshot_5" src="https://github.com/user-attachments/assets/66234d1e-7114-4db5-add6-a67e1c188a55" />

<!-- ------------------------------ -->

## Working Example

Below are examples of how it shows up on youtube comments for spam comments
most comments appear in crypto, trading and book recommendations

<img width="965" height="603" alt="example" src="https://github.com/user-attachments/assets/e6e87abf-256b-49c2-9c66-04a4f4dac312" />

<br>

## ⚙️ Overview

SpamuraiAI runs specifically on YouTube (as defined in the `manifest.json`). It observes the DOM for new comments as you scroll and applies classification in two tiers:
1. **Tier 1 (Instant)**: High-speed keyword matching for known scam patterns.
2. **Tier 2 (AI)**: Suspicious comments are refined using **Gemini Nano** to reduce false positives.
<br>

## 💻 Hardware Requirements

- Chrome latest version
- Operating system: Windows 10 or 11; macOS 13+ (Ventura and onwards); Linux; or ChromeOS (from Platform 16389.0.0 and onwards) on Chromebook Plus devices. Chrome for Android, iOS, and ChromeOS on non-Chromebook Plus devices are not yet supported by the APIs which use Gemini Nano.
- Storage: At least 22 GB of free space on the volume that contains your Chrome profile. (it is small in size but won't install if not enough free space)
  
<br>

## 🚀 How to use Spamurai
### 1️⃣ Load the extension
1. Pull the main branch of the Spamurai repo.
2. Go to chrome://extensions/, enable Developer Mode, then click Load unpacked and select the Spamurai-AI-web-extension folder.

### 2️⃣ Downloading Gemini Nano
1. Open a new tab and go to: chrome://flags → Enable Prompt API for Gemini Nano → click relaunch Chrome popup
2. Open the developer console(Ctrl+Shift+J) and paste the following to download the AI model:
```javascript
const session = await LanguageModel.create({
monitor(m) {
m.addEventListener('downloadprogress', (e) => {
const percent = Math.round((e.loaded * 100) / 10) * 10;
console.log(`Downloaded ${percent}%`);
});
},
});
```

 *(If Chrome blocks pasting, type allow pasting and try again)*

SpamuraiAI will automatically begin scanning and highlighting spam comments once the model is ready


## 🧩 Troubleshooting

If Spamurai AI isn’t working properly, follow these steps:

1. Open a new tab and go to: chrome://flags
2. Set "Enables optimization guide on device" to "Enabled BypassPerfRequirement"
   - It’s a support flag Google uses to let the local AI service run even on systems that don’t meet performance checks.
3. Click relaunch Chrome popup


## 🔍 How the Scraper Works

1. Navigate to a YouTube video page.  
2. The console will log the video title, and the observer will be waiting.  
3. Whenever you scroll down, the observer detects the first 20 comments (or however many load) and outputs them as a logged array.
4. 
## 🛠️ For Developers

Spamurai includes a suite of unit tests using Jest.
```bash
# Install dependencies
npm install

# Run all tests
npm test

# Run specific tests
npm run test:classification
```

🧠 Powered by

- Gemini Nano Prompt API (on-device AI)
- YouTube DOM MutationObserver
- keyword detection database of known scammer data
    
