# fastapi_app.py — Day 12 UI backend with Day 10 history + Day 11 robust error handling
import os
import re
import requests
import traceback
from pathlib import Path
from typing import List, Dict

from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from dotenv import load_dotenv

import assemblyai as aai
from google import genai  # Gemini client

# ---------- Config & Clients ----------
load_dotenv()

MURF_API_KEY = os.getenv("MURF_API_KEY")
ASSEMBLYAI_API_KEY = os.getenv("ASSEMBLYAI_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

aai.settings.api_key = ASSEMBLYAI_API_KEY

gemini_client = None
if GEMINI_API_KEY:
    gemini_client = genai.Client(api_key=GEMINI_API_KEY)

app = FastAPI(title="My Assistant AI")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).parent
UPLOADS = BASE_DIR / "uploads"
UPLOADS.mkdir(exist_ok=True)

MURF_MAX_CHARS = 3000
FALLBACK_TEXT = "I'm having trouble connecting right now. Please try again in a moment."

# Day 10: simple in-memory history
# { session_id: [{"role":"user","content":"..."}, {"role":"assistant","content":"..."}] }
history_store: Dict[str, List[Dict[str, str]]] = {}
MAX_HISTORY = 12

# ---------- Models ----------
class TextIn(BaseModel):
    text: str

# ---------- Helpers ----------
def chunk_text(text: str, limit: int = MURF_MAX_CHARS) -> List[str]:
    sentences = re.split(r'(?<=[.!?])\s+', text.strip())
    chunks, cur = [], ""
    for s in sentences:
        if not s:
            continue
        if cur and len(cur) + 1 + len(s) <= limit:
            cur = f"{cur} {s}"
        elif not cur and len(s) <= limit:
            cur = s
        else:
            if cur:
                chunks.append(cur)
            if len(s) <= limit:
                cur = s
            else:
                for i in range(0, len(s), limit):
                    chunks.append(s[i:i+limit])
                cur = ""
    if cur:
        chunks.append(cur)
    return chunks

def murf_tts(text: str, voice_id: str = "en-IN-rohan") -> List[str]:
    if not MURF_API_KEY:
        raise RuntimeError("MURF_API_KEY not configured")
    api = "https://api.murf.ai/v1/speech/generate"
    headers = {"accept":"application/json","content-type":"application/json","api-key":MURF_API_KEY}
    urls = []
    for chunk in chunk_text(text):
        r = requests.post(api, json={"voiceId":voice_id,"text":chunk,"format":"mp3"}, headers=headers, timeout=60)
        if r.status_code != 200:
            raise RuntimeError(f"Murf error {r.status_code}: {r.text}")
        url = r.json().get("audioFile")
        if not url:
            raise RuntimeError("Murf returned no audioFile")
        urls.append(url)
    return urls

def fallback_audio_url() -> str | None:
    try:
        urls = murf_tts(FALLBACK_TEXT)
        return urls[0] if urls else None
    except Exception:
        print("Fallback audio failed:\n", traceback.format_exc())
        return None

# ---------- Routes ----------
@app.get("/")
def root():
    return {"ok":True, "service":"My Assistant AI"}

@app.get("/agent/history/{session_id}")
def get_history(session_id: str):
    return {"session_id": session_id, "history": history_store.get(session_id, [])}

@app.post("/agent/chat/{session_id}")
async def agent_chat(session_id: str, file: UploadFile = File(...)):
    """
    Audio -> STT (AssemblyAI) -> LLM (Gemini, with history) -> TTS (Murf)
    Robust error handling with spoken fallback.
    """
    # 1) Read uploaded audio
    try:
        audio_bytes = await file.read()
        if not audio_bytes:
            raise RuntimeError("Empty audio upload")
    except Exception as e:
        fb = fallback_audio_url()
        return JSONResponse(
            {"transcript": None, "llm_reply": None, "audio_urls": [fb] if fb else [], "error": "Failed to read uploaded audio"},
            status_code=400
        )

    # 2) STT
    try:
        transcriber = aai.Transcriber()
        t = transcriber.transcribe(audio_bytes)
        user_text = (t.text or "").strip()
        if not user_text:
            raise RuntimeError("Empty transcript from STT")
    except Exception as e:
        print("STT error:", traceback.format_exc())
        fb = fallback_audio_url()
        return JSONResponse(
            {"transcript": None, "llm_reply": None, "audio_urls": [fb] if fb else [], "error": "Speech-to-Text failed"},
            status_code=502
        )

    # 3) Append to history
    hist = history_store.setdefault(session_id, [])
    hist.append({"role":"user","content":user_text})
    if len(hist) > MAX_HISTORY:
        history_store[session_id] = hist[-MAX_HISTORY:]
        hist = history_store[session_id]

    # 4) Build LLM prompt with history
    sys_prompt = "You are a helpful assistant. Keep replies concise, friendly, and context-aware."
    lines = [sys_prompt, ""]
    for m in hist:
        if m["role"] == "user":
            lines.append(f"User: {m['content']}")
        else:
            lines.append(f"Assistant: {m['content']}")
    lines.append("")
    lines.append("Assistant:")
    prompt = "\n".join(lines)

    # 5) LLM
    try:
        if not gemini_client:
            raise RuntimeError("GEMINI_API_KEY not configured")
        resp = gemini_client.models.generate_content(model="gemini-2.5-flash", contents=prompt)
        ai_text = (getattr(resp, "text", None) or "").strip()
        if not ai_text:
            raise RuntimeError("Empty LLM reply")
    except Exception as e:
        print("LLM error:", traceback.format_exc())
        hist.append({"role":"assistant","content":FALLBACK_TEXT})
        history_store[session_id] = hist
        fb = fallback_audio_url()
        return JSONResponse(
            {"transcript": user_text, "llm_reply": FALLBACK_TEXT, "audio_urls": [fb] if fb else [], "error": "LLM generation failed"},
            status_code=502
        )

    # 6) Append AI msg
    hist.append({"role":"assistant","content":ai_text})
    if len(hist) > MAX_HISTORY:
        history_store[session_id] = hist[-MAX_HISTORY:]

    # 7) TTS
    try:
        urls = murf_tts(ai_text)
    except Exception as e:
        print("TTS error:", traceback.format_exc())
        fb = fallback_audio_url()
        return JSONResponse(
            {"transcript": user_text, "llm_reply": ai_text, "audio_urls": [fb] if fb else [], "error": "TTS generation failed"},
            status_code=502
        )

    # 8) Done
    return {"transcript": user_text, "llm_reply": ai_text, "audio_urls": urls, "error": None}

# Optional: simple TTS text endpoint for testing
class TTSIn(BaseModel):
    text: str

@app.post("/tts")
def tts_text(payload: TTSIn):
    try:
        urls = murf_tts(payload.text)
        return {"audio_url": urls[0] if urls else None}
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)
