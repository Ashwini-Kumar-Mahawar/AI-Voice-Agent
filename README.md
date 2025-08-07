# 🎙️ 30 Days of AI Voice Agents Challenge – Days 1 to 4

![Python](https://img.shields.io/badge/Python-3.9%2B-blue?logo=python)
![FastAPI](https://img.shields.io/badge/FastAPI-%E2%9C%85-green?logo=fastapi)
![HTML](https://img.shields.io/badge/HTML-%3C%2F%3E-orange?logo=html5)
![CSS](https://img.shields.io/badge/CSS-Gradient%20UI-blueviolet?logo=css3)
![JavaScript](https://img.shields.io/badge/JavaScript-%E2%9C%85-yellow?logo=javascript)
![Bootstrap](https://img.shields.io/badge/Bootstrap-5-purple?logo=bootstrap)
![License](https://img.shields.io/badge/License-MIT-lightgrey)
![Status](https://img.shields.io/badge/Progress-Day%206-blue)

A full-stack voice agent app that takes user input, sends it to Murf.ai’s REST Text-to-Speech API, and plays back the generated audio in the browser. Now includes an Echo Bot!  
Built using FastAPI, HTML/CSS, JavaScript, and Bootstrap.

---

## 📅 Table of Contents

- [Day 1 – Initial Setup](#day-1--initial-setup)
- [Day 2 – FastAPI + TTS Endpoint](#day-2--fastapi--tts-endpoint)
- [Day 3 – UI Playback](#day-3--ui-playback)
- [Day 4 – Echo Bot](#day-4--echo-bot)
- [Day 5 – Speech-to-Text Upload](#day-5--speech-to-text-upload)
- [Day 6 – Transcription using AssemblyAI](#day-6--transcription-using-assemblyai)
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

### New Endpoint:
```bash
POST /transcribe/file
FormData: { "audio_file": Blob (webm or wav) }
Response: { "transcription": "Recognized speech here..." }
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
Visit http://localhost:8000/docs to test the /tts, /stt, and /transcribe/file endpoints.

---

## 🌐 Frontend Setup

- Open `index.html` in your browser.
- Enter your text and hit **Generate Audio**.
- Test out the **Echo Bot** by recording your voice and listening to playback!
- Now supports uploading recorded audio to the backend!
- Use Transcribe Audio to upload a file and see the transcribed text.

---

## 📸 Screenshots

**🎯 Day 6 UI Preview**
- ✅ Gradient UI with TTS, Echo Bot, and STT
- ✅ Upload and transcribe audio with real-time spinner
- ✅ Backend integrated with AssemblyAI

<img width="1915" height="1016" alt="Screenshot 2025-08-07 215131" src="https://github.com/user-attachments/assets/01319282-b57f-487e-98c6-39990638456f" />

---

## 🚀 What's Next?

**📍 Day 7**: Real-time transcription with WebSockets or Streaming API!

---

## 🙌 Challenge

_This repository is part of the Murf AI 30-Day Voice Agent Challenge._  
Follow my journey as I build, learn, and share every single day!

---

**⭐ If you're also doing this challenge, let's connect!**
