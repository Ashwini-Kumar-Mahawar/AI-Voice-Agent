import os
import re
import requests
import shutil
from pathlib import Path
from typing import List

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

# Configure Gemini client
if not GEMINI_API_KEY:
    raise ValueError("Missing GEMINI_API_KEY in environment variables")
client = genai.Client(api_key=GEMINI_API_KEY)

app = FastAPI()

# Allow origins - adjust for production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # change to your exact origin(s) in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_FOLDER = "uploads"
Path(UPLOAD_FOLDER).mkdir(parents=True, exist_ok=True)

# Murf character limit per request
MURF_MAX_CHARS = 3000


class TextInput(BaseModel):
    text: str


@app.get("/")
def root():
    return {"message": "FastAPI server for TTS + LLM is running!"}


# =========================
#  TTS endpoint (Murf API)
# =========================
@app.post("/tts")
def tts_endpoint(input: TextInput):
    url = "https://api.murf.ai/v1/speech/generate"
    headers = {
        "accept": "application/json",
        "content-type": "application/json",
        "api-key": MURF_API_KEY,
    }
    payload = {
        "voiceId": "en-IN-rohan",
        "text": input.text,
        "format": "mp3",
    }
    response = requests.post(url, json=payload, headers=headers)
    if response.status_code == 200:
        return {"audio_url": response.json().get("audioFile")}
    return {"error": "Failed to generate speech", "details": response.text}


# =========================
#  File Upload
# =========================
@app.post("/upload")
async def upload_audio(file: UploadFile = File(...)):
    file_path = os.path.join(UPLOAD_FOLDER, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    print(
        f"Uploaded file saved to {file_path}, size: {os.path.getsize(file_path)} bytes"
    )

    return {
        "filename": file.filename,
        "content_type": file.content_type,
        "size": os.path.getsize(file_path),
    }


# =========================
#  File → Transcript
# =========================
@app.post("/transcribe/file")
async def transcribe_audio(file: UploadFile = File(...)):
    try:
        audio_data = await file.read()
        transcriber = aai.Transcriber()
        transcript = transcriber.transcribe(audio_data)
        return {"transcript": transcript.text}
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


# =========================
#  Echo Bot v2 (Audio → TTS)
# =========================
@app.post("/tts/echo")
async def tts_echo(file: UploadFile = File(...)):
    try:
        audio_data = await file.read()

        transcriber = aai.Transcriber()
        transcript_obj = transcriber.transcribe(audio_data)
        transcript_text = transcript_obj.text if transcript_obj else ""

        if not transcript_text:
            return JSONResponse({"error": "Transcription failed or returned empty text."}, status_code=500)

        murf_url = "https://api.murf.ai/v1/speech/generate"
        headers = {
            "accept": "application/json",
            "content-type": "application/json",
            "api-key": MURF_API_KEY,
        }
        payload = {
            "voiceId": "en-IN-rohan",
            "text": transcript_text,
            "format": "mp3",
        }
        murf_response = requests.post(murf_url, json=payload, headers=headers)

        if murf_response.status_code != 200:
            return JSONResponse(
                {"error": "Failed to generate Murf audio", "details": murf_response.text},
                status_code=500,
            )

        murf_audio_url = murf_response.json().get("audioFile")
        if not murf_audio_url:
            return JSONResponse({"error": "Murf returned no audio URL"}, status_code=500)

        return {"transcript": transcript_text, "audio_url": murf_audio_url}

    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


# =========================
#  LLM Query (Text input) - keep existing text-based endpoint for compatibility
# =========================
@app.post("/llm/query")
async def llm_query_text(payload: TextInput):
    try:
        resp = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=payload.text
        )
        return {"reply": resp.text}
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


# =========================
#  LLM Query (Audio input) - Day 9: accept audio file, transcribe -> LLM -> Murf TTS (may be multiple chunks)
# =========================
def chunk_text_preserve_sentences(text: str, max_chars: int = MURF_MAX_CHARS) -> List[str]:
    """
    Basic sentence-aware chunking: split on sentence endings and group until max_chars.
    If a single sentence > max_chars, force split it into pieces.
    """
    sentences = re.split(r'(?<=[.!?])\s+', text.strip())
    chunks = []
    current = ""
    for s in sentences:
        s = s.strip()
        if not s:
            continue
        # if current + s fits, append; else push current and start new
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
                # sentence itself longer than max_chars -> hard split
                for i in range(0, len(s), max_chars):
                    chunks.append(s[i:i+max_chars])
                current = ""
    if current:
        chunks.append(current)
    return chunks


@app.post("/llm/query/file")
async def llm_query_file(file: UploadFile = File(...)):
    """
    Accept audio file -> transcribe (AssemblyAI) -> send transcript to Gemini -> split reply and TTS via Murf.
    Returns:
    {
      "transcript": "<user transcribed text>",
      "llm_reply": "<gemini reply text>",
      "audio_urls": ["https://...mp3", ...]
    }
    """
    try:
        # 1) read audio bytes
        audio_data = await file.read()

        # 2) transcribe with AssemblyAI
        transcriber = aai.Transcriber()
        transcript_obj = transcriber.transcribe(audio_data)
        transcript_text = transcript_obj.text if transcript_obj else ""
        if not transcript_text:
            return JSONResponse({"error": "Transcription returned empty text."}, status_code=500)

        # 3) send transcript to Gemini LLM
        # You can add a brief system prompt to control verbosity
        prompt = f"You are a helpful assistant. Keep the reply concise and clear. User said: \"{transcript_text}\""
        llm_resp = client.models.generate_content(model="gemini-2.5-flash", contents=prompt)
        llm_text = llm_resp.text.strip() if hasattr(llm_resp, "text") else str(llm_resp)

        # 4) chunk llm_text to satisfy Murf max characters
        chunks = chunk_text_preserve_sentences(llm_text, max_chars=MURF_MAX_CHARS)

        # 5) call Murf TTS for each chunk, collect audio URLs
        murf_api = "https://api.murf.ai/v1/speech/generate"
        murf_headers = {
            "accept": "application/json",
            "content-type": "application/json",
            "api-key": MURF_API_KEY,
        }

        audio_urls = []
        for chunk in chunks:
            payload = {
                "voiceId": "en-IN-rohan",
                "text": chunk,
                "format": "mp3"
            }
            r = requests.post(murf_api, json=payload, headers=murf_headers, timeout=60)
            if r.status_code != 200:
                return JSONResponse({"error": "Murf TTS failed for a chunk", "details": r.text}, status_code=500)
            json_data = r.json()
            url = json_data.get("audioFile")
            if not url:
                return JSONResponse({"error": "Murf returned no audio url for a chunk"}, status_code=500)
            audio_urls.append(url)

        # 6) Return transcript, llm reply, and list of audio URLs (in order)
        return {"transcript": transcript_text, "llm_reply": llm_text, "audio_urls": audio_urls}

    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)
