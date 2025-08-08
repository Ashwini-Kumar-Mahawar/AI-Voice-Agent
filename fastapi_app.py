import os
import requests
import shutil
from pathlib import Path

from fastapi import FastAPI, File, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware

import assemblyai as aai

# Load environment variables
load_dotenv()
MURF_API_KEY = os.getenv("MURF_API_KEY")
ASSEMBLYAI_API_KEY = os.getenv("ASSEMBLYAI_API_KEY")

# Configure AssemblyAI
aai.settings.api_key = ASSEMBLYAI_API_KEY

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


class TextInput(BaseModel):
    text: str


@app.get("/")
def root():
    return {"message": "FastAPI server for TTS is running!"}


# Text → Speech (existing TTS endpoint)
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


# Save uploaded file (kept for debugging / history)
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


# File → Transcript (separate endpoint - still useful)
@app.post("/transcribe/file")
async def transcribe_audio(file: UploadFile = File(...)):
    try:
        audio_data = await file.read()
        transcriber = aai.Transcriber()
        transcript = transcriber.transcribe(audio_data)
        return {"transcript": transcript.text}
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


# NEW: Echo Bot v2 - accepts audio file, transcribes with AssemblyAI, sends transcript to Murf,
# and returns both the transcript and the Murf audio URL.
@app.post("/tts/echo")
async def tts_echo(file: UploadFile = File(...)):
    try:
        # 1) Read audio bytes
        audio_data = await file.read()

        # 2) Transcribe using AssemblyAI (synchronous helper)
        transcriber = aai.Transcriber()
        transcript_obj = transcriber.transcribe(audio_data)
        transcript_text = transcript_obj.text if transcript_obj else ""

        if not transcript_text:
            return JSONResponse({"error": "Transcription failed or returned empty text."}, status_code=500)

        # 3) Send transcription text to Murf TTS
        murf_url = "https://api.murf.ai/v1/speech/generate"
        headers = {
            "accept": "application/json",
            "content-type": "application/json",
            "api-key": MURF_API_KEY,
        }
        payload = {
            "voiceId": "en-IN-rohan",  # change to preferred murf voice ID
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

        # 4) Return both transcript and audio URL to client
        return {"transcript": transcript_text, "audio_url": murf_audio_url}

    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)
