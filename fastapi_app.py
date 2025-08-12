# fastapi_app.py
import os
import re
import requests
import shutil
import traceback
from pathlib import Path
from typing import List, Dict

from fastapi import FastAPI, File, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware

import assemblyai as aai
from google import genai  # Gemini client

# Load environment variables
load_dotenv()
MURF_API_KEY = os.getenv("MURF_API_KEY")
ASSEMBLYAI_API_KEY = os.getenv("ASSEMBLYAI_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# Configure AssemblyAI
aai.settings.api_key = ASSEMBLYAI_API_KEY

# Configure Gemini client (optional — server will still run if missing but endpoints will error nicely)
client = None
if GEMINI_API_KEY:
    client = genai.Client(api_key=GEMINI_API_KEY)

app = FastAPI()

# Allow origins - adjust in production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).parent
UPLOAD_FOLDER = BASE_DIR / "uploads"
UPLOAD_FOLDER.mkdir(parents=True, exist_ok=True)

# Murf character limit per request
MURF_MAX_CHARS = 3000

# In-memory chat history store (prototype)
# { session_id: [ {"role":"user","content":"..."}, {"role":"assistant","content":"..."} ] }
chat_histories: Dict[str, List[Dict[str, str]]] = {}
MAX_HISTORY_MESSAGES = 12

# Fallback text when an API fails
FALLBACK_TEXT = "I'm having trouble connecting right now."

class TextInput(BaseModel):
    text: str

@app.get("/")
def root():
    return {"message": "FastAPI server for TTS + LLM is running!"}


# -----------------------
# Utilities
# -----------------------
def chunk_text_preserve_sentences(text: str, max_chars: int = MURF_MAX_CHARS) -> List[str]:
    sentences = re.split(r'(?<=[.!?])\s+', text.strip())
    chunks = []
    current = ""
    for s in sentences:
        s = s.strip()
        if not s:
            continue
        if current and len(current) + 1 + len(s) <= max_chars:
            current = f"{current} {s}"
        elif not current and len(s) <= max_chars:
            current = s
        else:
            if current:
                chunks.append(current)
            if len(s) <= max_chars:
                current = s
            else:
                for i in range(0, len(s), max_chars):
                    chunks.append(s[i:i+max_chars])
                current = ""
    if current:
        chunks.append(current)
    return chunks

def generate_murf_tts(text: str, voice_id: str = "en-IN-rohan") -> List[str]:
    """
    Send text to Murf TTS. Handles chunking. Returns list of audio URLs.
    May raise exception on failure.
    """
    if not MURF_API_KEY:
        raise RuntimeError("MURF API key not set")

    chunks = chunk_text_preserve_sentences(text, max_chars=MURF_MAX_CHARS)
    murf_api = "https://api.murf.ai/v1/speech/generate"
    murf_headers = {
        "accept": "application/json",
        "content-type": "application/json",
        "api-key": MURF_API_KEY,
    }
    audio_urls = []
    for chunk in chunks:
        payload = {
            "voiceId": voice_id,
            "text": chunk,
            "format": "mp3"
        }
        r = requests.post(murf_api, json=payload, headers=murf_headers, timeout=60)
        if r.status_code != 200:
            raise RuntimeError(f"Murf TTS failed: {r.status_code} {r.text}")
        json_data = r.json()
        url = json_data.get("audioFile")
        if not url:
            raise RuntimeError("Murf returned no audio URL")
        audio_urls.append(url)
    return audio_urls

def generate_fallback_audio_url() -> str:
    """
    Try to produce a fallback audio from Murf using FALLBACK_TEXT.
    If that fails, return None.
    """
    try:
        urls = generate_murf_tts(FALLBACK_TEXT)
        return urls[0] if urls else None
    except Exception:
        # If Murf isn't available, just return None
        print("Warning: fallback audio generation failed", traceback.format_exc())
        return None

# -----------------------
# Public API endpoints
# -----------------------

@app.get("/agent/history/{session_id}")
def get_history(session_id: str):
    history = chat_histories.get(session_id, [])
    return {"session_id": session_id, "history": history}


@app.post("/agent/chat/{session_id}")
async def agent_chat(session_id: str, file: UploadFile = File(...)):
    """
    Accept audio input, transcribe, append to session history, call Gemini with full session history,
    append assistant reply to history, TTS reply via Murf (chunks), and return:
    {
        "transcript": "<user text>",
        "llm_reply": "<assistant text>",
        "audio_urls": [ "...", ... ],
        "error": null | "message"
    }
    """
    try:
        # 1) read audio bytes and transcribe
        audio_data = await file.read()
    except Exception as e:
        print("Failed to read uploaded file:", e)
        fallback = generate_fallback_audio_url()
        return JSONResponse({"transcript": None, "llm_reply": None, "audio_urls": [fallback] if fallback else [], "error": "Failed to read uploaded audio"}, status_code=400)

    # 2) Transcribe with AssemblyAI (protected)
    try:
        transcriber = aai.Transcriber()
        transcript_obj = transcriber.transcribe(audio_data)
        transcript_text = transcript_obj.text if transcript_obj else ""
        if not transcript_text:
            raise RuntimeError("AssemblyAI returned empty transcript")
    except Exception as e:
        print("STT error:", e)
        fallback = generate_fallback_audio_url()
        return JSONResponse({"transcript": None, "llm_reply": None, "audio_urls": [fallback] if fallback else [], "error": "Speech-to-Text failed"}, status_code=502)

    # 3) Ensure session exists and append user message
    history = chat_histories.setdefault(session_id, [])
    history.append({"role": "user", "content": transcript_text})
    # trim
    if len(history) > MAX_HISTORY_MESSAGES:
        history = history[-MAX_HISTORY_MESSAGES:]
        chat_histories[session_id] = history

    # 4) Build prompt for LLM from history
    system_prompt = "You are a helpful assistant. Keep replies concise and context-aware."
    convo_lines = [system_prompt, ""]
    for msg in history:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        if role == "user":
            convo_lines.append(f"User: {content}")
        else:
            convo_lines.append(f"Assistant: {content}")
    convo_lines.append("")
    convo_prompt = "\n".join(convo_lines) + "\nAssistant:"

    # 5) Call Gemini (protected)
    try:
        if client is None:
            raise RuntimeError("Gemini client not configured (GEMINI_API_KEY missing)")
        llm_resp = client.models.generate_content(model="gemini-2.5-flash", contents=convo_prompt)
        llm_text = llm_resp.text.strip() if hasattr(llm_resp, "text") else str(llm_resp)
        if not llm_text:
            raise RuntimeError("Gemini returned empty reply")
    except Exception as e:
        print("LLM error:", traceback.format_exc())
        fallback = generate_fallback_audio_url()
        # append assistant fallback to history
        history.append({"role": "assistant", "content": FALLBACK_TEXT})
        chat_histories[session_id] = history
        return JSONResponse({"transcript": transcript_text, "llm_reply": FALLBACK_TEXT, "audio_urls": [fallback] if fallback else [], "error": "LLM generation failed"}, status_code=502)

    # 6) Append assistant reply to history
    history.append({"role": "assistant", "content": llm_text})
    if len(history) > MAX_HISTORY_MESSAGES:
        history = history[-MAX_HISTORY_MESSAGES:]
    chat_histories[session_id] = history

    # 7) Convert LLM reply to Murf TTS (protected)
    try:
        audio_urls = generate_murf_tts(llm_text)
    except Exception as e:
        print("TTS error:", traceback.format_exc())
        fallback = generate_fallback_audio_url()
        return JSONResponse({"transcript": transcript_text, "llm_reply": llm_text, "audio_urls": [fallback] if fallback else [], "error": "TTS generation failed"}, status_code=502)

    # 8) Success
    return {"transcript": transcript_text, "llm_reply": llm_text, "audio_urls": audio_urls, "error": None}


# Keep backward-compatible endpoints (optional)
@app.post("/tts")
def tts_endpoint(input: TextInput):
    try:
        urls = generate_murf_tts(input.text)
        return {"audio_url": urls[0] if urls else None}
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


# Keep other endpoints you used earlier (upload, transcribe/file, tts/echo, llm/query/file...)
# For brevity in this file I'm focusing on /agent/chat and history endpoints.
# You can copy previous endpoints back here if you need them.

