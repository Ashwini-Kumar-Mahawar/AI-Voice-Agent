# 🎙️ 30 Days of AI Voice Agents Challenge – Days 1 to 4

![Python](https://img.shields.io/badge/Python-3.9%2B-blue?logo=python)
![FastAPI](https://img.shields.io/badge/FastAPI-%E2%9C%85-green?logo=fastapi)
![HTML](https://img.shields.io/badge/HTML-%3C%2F%3E-orange?logo=html5)
![CSS](https://img.shields.io/badge/CSS-Gradient%20UI-blueviolet?logo=css3)
![JavaScript](https://img.shields.io/badge/JavaScript-%E2%9C%85-yellow?logo=javascript)
![Bootstrap](https://img.shields.io/badge/Bootstrap-5-purple?logo=bootstrap)
![License](https://img.shields.io/badge/License-MIT-lightgrey)
![Status](https://img.shields.io/badge/Progress-Day%207-blue)

A full-stack voice agent app that takes user input, sends it to Murf.ai’s REST Text-to-Speech API, and plays back the generated audio in the browser. Now includes **Echo Bot v2** with real-time transcription + Murf voice playback!  
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

### New Endpoint:
  ```bash 
  POST /tts/echo
  FormData: { "audio_file": Blob (webm or wav) }
  Response: {
    "transcription": "Recognized speech here...",
    "audio_url": "https://..."
  }
```

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

**External API:**
- Murf.ai REST TTS API
- AssemblyAI Speech-to-Text API

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
```

### Run your FastAPI server:

```bash
uvicorn main:app --reload
```
Visit http://localhost:8000/docs to test the /tts, /stt, /transcribe/file, and /tts/echo endpoints.

---

## 🌐 Frontend Setup

- Open `index.html` in your browser.
- Enter your text and hit **Generate Audio**.
- Use the **Echo Bot v2**:
    - Record your voice
    - Hear it back in a Murf AI voice
    - See the recognized transcription

---

## 📸 Screenshots

**🎯 Day 7 UI Preview**
- ✅ Gradient UI with TTS, Echo Bot v2, and STT
- ✅ Murf AI voice playback
- ✅ Upload and transcribe audio with real-time spinner
- ✅ Backend integrated with AssemblyAI

<img width="1914" height="1017" alt="Screenshot 2025-08-05 163834" src="https://github.com/user-attachments/assets/9596ff28-3992-44c5-a0e3-d8d1aaad71c8" />

---

## 🚀 What's Next?

📍 **Day 8**: Real-time streaming transcription and TTS responses with WebSockets.

---

## 🙌 Challenge

_This repository is part of the Murf AI 30-Day Voice Agent Challenge._  
Follow my journey as I build, learn, and share every single day!

---

**⭐ If you're also doing this challenge, let's connect!**
