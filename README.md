# 🎙️ 30 Days of AI Voice Agents Challenge – Days 1 to 3

![Python](https://img.shields.io/badge/Python-3.9%2B-blue?logo=python)
![FastAPI](https://img.shields.io/badge/FastAPI-%E2%9C%85-green?logo=fastapi)
![HTML](https://img.shields.io/badge/HTML-%3C%2F%3E-orange?logo=html5)
![CSS](https://img.shields.io/badge/CSS-Gradient%20UI-blueviolet?logo=css3)
![JavaScript](https://img.shields.io/badge/JavaScript-%E2%9C%85-yellow?logo=javascript)
![Bootstrap](https://img.shields.io/badge/Bootstrap-5-purple?logo=bootstrap)
![License](https://img.shields.io/badge/License-MIT-lightgrey)
![Status](https://img.shields.io/badge/Progress-Day%203-blue)


A full-stack voice agent app that takes user input, sends it to Murf.ai’s REST Text-to-Speech API, and plays back the generated audio in the browser. Built using FastAPI, HTML/CSS, JavaScript, and Bootstrap.


## 📅 Table of Contents

- [Day 1 – Initial Setup](#day-1--initial-setup)
- [Day 2 – FastAPI + TTS Endpoint](#day-2--fastapi--tts-endpoint)
- [Day 3 – UI Playback](#day-3--ui-playback)
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

**External API:**
- Murf.ai REST TTS API

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

### Paste this in your .env file:

```bash
MURF_API_KEY=your_actual_api_key_here
```

### Run your FastAPI server:

```bash
uvicorn main:app --reload
```
Visit http://localhost:8000/docs to test the /tts endpoint.

---

### 🌐 Frontend Setup
- Open index.html in a browser.
- Enter your text and hit "Generate Audio".
- The audio will play once ready.

---

### 📸 Screenshots

**🎯 Day 3 UI Preview**
- ✅ Gradient background
- ✅ Bootstrap modal on errors
- ✅ Audio playback with <audio> tag
  
  <img width="1264" height="678" alt="Screenshot 2025-08-04 222201" src="https://github.com/user-attachments/assets/eeea6383-3f88-4f04-9a96-5919072be9e6" />

---

### 🚀 What's Next?
**📍 Day 4: Record audio from the browser and stream to the backend for speech-to-text conversion.**

---

### 🙌 Challenge

*This repository is part of the Murf AI 30-Day Voice Agent Challenge.
Follow my journey as I build, learn, and share every single day!*

---

### ⭐ If you're also doing this challenge, let's connect!
