# 🎙️ 30 Days of AI Voice Agents Challenge – Days 1 to 12

![Python](https://img.shields.io/badge/Python-3.9%2B-blue?logo=python)
![FastAPI](https://img.shields.io/badge/FastAPI-%E2%9C%85-green?logo=fastapi)
![HTML](https://img.shields.io/badge/HTML-%3C%2F%3E-orange?logo=html5)
![CSS](https://img.shields.io/badge/CSS-Gradient%20UI-blueviolet?logo=css3)
![JavaScript](https://img.shields.io/badge/JavaScript-%E2%9C%85-yellow?logo=javascript)
![Bootstrap](https://img.shields.io/badge/Bootstrap-5-purple?logo=bootstrap)
![License](https://img.shields.io/badge/License-MIT-lightgrey)
![Status](https://img.shields.io/badge/Progress-Day%2012-blue)

A full-stack voice agent app that takes user input, sends it to Murf.ai’s REST Text-to-Speech API, and plays back the generated audio in the browser.  
Now includes **Echo Bot v2**, **LLM Integration**, **Full Voice Conversations**, **Chat History**, and **Error Handling**!  
Built using FastAPI, HTML/CSS, JavaScript, and Bootstrap.

---

## 📅 Table of Contents

- [Day 1 – Initial Setup](#day-1--initial-setup)
- [Day 2 – FastAPI + TTS Endpoint](#day-2--fastapi--tts-endpoint)
- [Day 3 – UI Playback](#day-3--ui-playback)
- [Day 4 – Echo Bot](#day-4--echo-bot)
- [Day 5 – Speech-to-Text Upload](#day-5--speech-to-text-upload)
- [Day 6 – Server-Side Transcription](#day-6--server-side-transcription)
- [Day 7 – Echo Bot v2 (TTS + Transcript Display)](#day-7--echo-bot-v2-tts--transcript-display)
- [Day 8 – LLM Query Endpoint](#day-8--llm-query-endpoint)
- [Day 9 – Full Non-Streaming Pipeline](#day-9--full-non-streaming-pipeline)
- [Day 10 – Chat History](#day-10--chat-history)
- [Day 11 – Error Handling](#day-11--error-handling)
- [Day 12 – UI Revamp](#day-12--ui-revamp)
- [🌐 Tech Stack](#-tech-stack)
- [⚙️ Installation & Usage](#️-installation--usage)
- [📸 Screenshots](#-screenshots)

---

## ✅ Day 1 – Initial Setup

- Created basic HTML UI
- Added a textarea and button to accept user input
- Set up a local backend server (initially Flask, later migrated to FastAPI)

---

## ✅ Day 2 – FastAPI + TTS Endpoint

- Switched backend to **FastAPI** for faster development and integrated docs
- Created a `/tts` endpoint that accepts text and calls Murf.ai's REST API
- Returned a downloadable audio URL
- Secured the Murf API key using `.env` file

### Endpoint:
```bash
POST /tts
Body: { "text": "Your message here" }
Response: { "audio_url": "https://..." }
```

---

## ✅ Day 3 – UI Playback

- Built a modern UI with:
  - Gradient background + custom CSS
  - Bootstrap modal for error handling
  - Audio player to play generated speech
- Integrated frontend with backend `/tts` endpoint using JavaScript `fetch()`

---

## ✅ Day 4 – Echo Bot

- Added a new section under the TTS UI titled **Echo Bot**
- Used the **MediaRecorder API** to:
  - Record user's voice via microphone
  - Play it back using an `<audio>` element
- Buttons added:
  - 🎙️ `Start Recording`
  - ⏹️ `Stop Recording`
- Playback happens right after stopping the recording

> No backend logic required for this part — 100% frontend!

---

## ✅ Day 5 – Speech-to-Text Upload
- Implemented backend support to accept audio blob via a new FastAPI endpoint /stt
- Used multipart/form-data to send the recorded audio from frontend to backend
- Converted blob to a file using JavaScript and uploaded it to the server
- Set up backend to receive and save audio files for future processing with Whisper or other ASR models

### Endpoint:
```bash 
POST /stt
FormData: { "audio_file": Blob (webm or wav) }
Response: { "status": "received", "filename": "filename_saved.wav" }
```
---

## ✅ Day 6 – Transcription using AssemblyAI
 - Integrated the AssemblyAI Python SDK to perform transcription on uploaded files
 - Created a new endpoint /transcribe/file that:
   - Accepts an audio file upload
   - Uploads the audio to AssemblyAI
   - Starts and polls the transcription process
   - Returns the transcribed text to frontend
 - Updated frontend to:
   - Display transcribed text below the upload section
   - Show a spinner while transcription is in progress

### Endpoint:
```bash
POST /transcribe/file
FormData: { "audio_file": Blob (webm or wav) }
Response: { "transcription": "Recognized speech here..." }
```

---

## ✅ Day 7 – Echo Bot v2 (TTS + Transcript Display)
  - Upgraded Echo Bot to use Murf's voice instead of replaying the raw recording
  - New flow:
    1. Record audio in browser
    2. Send audio to /tts/echo endpoint
    3. Backend transcribes the audio using AssemblyAI
    4. Sends transcription text to Murf API for TTS generation
    5. Returns both:
        - Murf-generated audio URL
        - Recognized transcription text
  - Frontend now:
    - Plays Murf-generated voice in <audio> player
    - Displays recognized text under the player

### Endpoint:
  ```bash 
  POST /tts/echo
  FormData: { "audio_file": Blob (webm or wav) }
  Response: {
    "transcription": "Recognized speech here...",
    "audio_url": "https://..."
  }
```
---

## ✅ Day 8 – LLM Query Endpoint

- Created a new `/llm/query` endpoint that accepts text input.
- Integrated with **Google's Gemini API** to process natural language queries.
- Returns the LLM's text response to the frontend.
- No UI changes required — tested using FastAPI docs and cURL.

### Endpoint:
```bash
POST /llm/query
Body: { "text": "Your question here" }
Response: { "llm_response": "Generated response from Gemini..." }
```

**Setup:**
- Get a Gemini API key from: https://ai.google.dev/gemini-api/docs/quickstart
- Store it in `.env` as:
```bash
GEMINI_API_KEY=your_gemini_key_here
```

---

## ✅ Day 9 – Full Non-Streaming Pipeline

- Updated `/llm/query` to accept **audio** instead of only text.
- New flow:
  1. User records audio in the browser.
  2. Audio is sent to `/llm/query`.
  3. Backend transcribes the audio (AssemblyAI).
  4. Sends the transcription to Gemini LLM for generating a response.
  5. Sends the LLM's text to Murf for **Text-to-Speech**.
  6. Returns both:
     - `audio_url`: Murf-generated speech
     - `llm_text`: The LLM's generated text
  7. UI plays the Murf audio and displays the text.

- Handled Murf's **3000 character limit** by:
  - Splitting long responses into multiple chunks before sending to TTS.

### Endpoint:
```bash
POST /llm/query
FormData: { "audio_file": Blob (webm or wav) }
Response: {
  "llm_text": "The generated AI response...",
  "audio_url": "https://..."
}
```

---

## ✅ Day 10 – Chat History

**Goal:** Store conversation history in a **SQLite database** so that chats remain available even after server restarts.

**What’s New:**
- Added **SQLite database integration** via `sqlite3` module.
- Created a `chat_history` table with fields:
  - `id` (Primary Key)
  - `session_id`
  - `role` (`user` or `assistant`)
  - `message` (text content)
  - `timestamp`
- Updated `/agent/chat/{session_id}` endpoint to:
  - Save each user message and AI reply in the database.
  - Retrieve entire conversation history from DB for LLM context.
- Implemented **automatic migration** so table is created if missing.

**Benefits:**
- Conversations persist after server restarts.
- Enables analytics and better debugging.
- Future-proof for switching to **PostgreSQL** in production.

**Example DB Row:**
| id | session_id | role       | message                  | timestamp           |
|----|------------|------------|--------------------------|---------------------|
| 1  | abc123     | user       | "Hello!"                 | 2025-08-11 15:30:20 |
| 2  | abc123     | assistant  | "Hi there! How can I..."  | 2025-08-11 15:30:21 |

---

## ✅ Day 11 — Error Handling

Today’s update makes our AI Voice Agent more **robust** by adding **error handling** on both the server and client sides.  
When the STT, LLM, or TTS APIs fail, the system will:
- Catch the error
- Log the details
- Send back a **fallback audio response**: _"I'm having trouble connecting right now."_

---

## ✅ Day 12 – UI Revamp

Today’s update was all about making the **Conversational Agent UI** cleaner, more modern, and more intuitive.  
The aim was to simplify interactions while still keeping **Chat History (Day 10)** and **Error Handling (Day 11)** intact.

**What’s New:**
- Removed **initial Text-to-Speech** and **Echo Bot** sections — now only the conversational agent interface is shown.
- Replaced the separate **Start** / **Stop Recording** buttons with **one smart record button** that:
  - Changes label & icon depending on recording state
  - Shows an animation when active
- Audio now **auto-plays** as soon as it’s loaded — the audio player UI can be hidden for a cleaner look.
- Record button styling updated to be **more prominent** with hover & active effects.

**Benefits:**
- Minimal distractions — only what’s needed for smooth AI conversations is visible.
- More intuitive recording workflow with a single, state-aware button.
- Polished look with animations for better user feedback.


---

## 🌐 Tech Stack

**Frontend:**
- HTML, CSS (with gradients)
- JavaScript
- Bootstrap 5

**Backend:**
- FastAPI
- Python 3.9+
- Uvicorn (ASGI Server)
- Requests (for REST API calls)
- `python-dotenv` for environment variable handling
- assemblyai Python SDK for transcription
- geminiai Python SDK for response
- SQLite (local storage for chat history) or PostgreSQL (for production-ready persistence)
- ERROR Handling

**External API:**
- Murf.ai REST TTS API
- AssemblyAI Speech-to-Text API
- GeminiAI Speech-to-Speech API

---

## ⚙️ Installation & Usage

### 🔧 Backend Setup

```bash
# Clone the repo
git clone https://github.com/your-username/voice-agent-app.git
cd voice-agent-app

# Create virtual environment and activate
python -m venv venv
source venv/bin/activate   # for Windows: venv\Scripts\activate

# Install dependencies
pip install fastapi uvicorn python-dotenv requests

# Create .env file
touch .env
```

### Paste this in your `.env` file:

```bash
MURF_API_KEY=your_actual_api_key_here
ASSEMBLYAI_API_KEY=your_actual_assemblyai_key_here
GEMINI_API_KEY=your_actual_gemini_api_key_here
```

### Run your FastAPI server:

```bash
uvicorn main:app --reload
```
Visit http://localhost:8000/docs to test the /tts, /stt, /transcribe/file, /tts/echo and /llm/query endpoints.

---

## 🌐 Frontend Setup

- Open `index.html` in your browser.
- Enter your text and hit **Generate Audio**.
- Use the **Echo Bot v2**:
    - Record your voice
    - Hear it back in a Murf AI voice
    - See the recognized transcription

---

## ✨ Features
- 🎙 Voice recording from browser
- 📜 Speech-to-text transcription (AssemblyAI)
- 🗣 Text-to-speech (Murf)
- 🤖 LLM response (GeminiAI)
- 💾 **Chat history storage** by session
- ⚠ **Day 11:** Error handling & fallback audio

---

## 📸 Screenshots

**🎯 Day 12 Chat UI Preview**
- ✅ Real-time conversation memory
- ✅ AI voice playback
- ✅ Automatic re-recording after AI speaks
- ✅ ERROR Handling
- ✅ UI Revamp

<img width="1276" height="675" alt="Screenshot 2025-08-13 224555" src="https://github.com/user-attachments/assets/630b6e84-fc6c-4e21-a6c0-4072eb66e86c" />


---

## 🚀 What's Next?
📍 **Day 13**: Pushing towards a smoother, more natural multi-turn conversation.

---

## 🙌 Challenge

_This repository is part of the Murf AI 30-Day Voice Agent Challenge._  
Follow my journey as I build, learn, and share every single day!

---

**⭐ If you're also doing this challenge, let's connect!**
