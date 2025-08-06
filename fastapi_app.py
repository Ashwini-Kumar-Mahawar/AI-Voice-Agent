import os
import requests
from fastapi import FastAPI, File, UploadFile
from pydantic import BaseModel
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import shutil
from pathlib import Path

# Load environment variables
load_dotenv()
MURF_API_KEY = os.getenv("MURF_API_KEY")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5000"],  # Frontend origin
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

@app.post("/tts")
def tts_endpoint(input: TextInput):
    url = "https://api.murf.ai/v1/speech/generate"
    headers = {
        "accept": "application/json",
        "content-type": "application/json",
        "api-key": MURF_API_KEY
    }
    payload = {
        "voiceId": "en-IN-rohan",
        "text": input.text,
        "format": "mp3"
    }
    response = requests.post(url, json=payload, headers=headers)
    if response.status_code == 200:
        data = response.json()
        return {"audio_url": data.get("audioFile")}
    else:
        return {
            "error": "Failed to generate speech",
            "status_code": response.status_code,
            "details": response.text
        }

@app.post("/upload")
async def upload_audio(file: UploadFile = File(...)):
    file_path = os.path.join(UPLOAD_FOLDER, file.filename)

    # ✅ FIX: Use shutil directly without await file.read()
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    print(f"Uploaded file saved to {file_path}, size: {os.path.getsize(file_path)} bytes")

    return {
        "filename": file.filename,
        "content_type": file.content_type,
        "size": os.path.getsize(file_path)
    }
