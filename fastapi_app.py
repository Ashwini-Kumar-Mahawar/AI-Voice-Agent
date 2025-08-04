import os
import requests
from fastapi import FastAPI
from pydantic import BaseModel
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware

# Load environment variables
load_dotenv()

MURF_API_KEY = os.getenv("MURF_API_KEY")

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5000"],  # Flask origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request body model
class TextInput(BaseModel):
    text: str

@app.get("/")
def root():
    return {"message": "FastAPI server for TTS is running!"}

@app.post("/tts")
def tts_endpoint(input: TextInput):
    """
    Accepts text and sends it to Murf API for TTS.
    Returns the audio file URL.
    """
    url = "https://api.murf.ai/v1/speech/generate"

    headers = {
        "accept": "application/json",
        "content-type": "application/json",
        "api-key": MURF_API_KEY
    }


    payload = {
        "voiceId": "en-IN-rohan",  # example voice
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
