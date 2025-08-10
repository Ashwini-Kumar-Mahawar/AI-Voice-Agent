// TTS generate (existing)
async function generateAudio() {
  const inputText = document.getElementById("textInput").value;
  const audioPlayer = document.getElementById("audioPlayer");

  if (!inputText.trim()) {
    alert("Please enter some text first.");
    return;
  }

  try {
    const response = await fetch("http://127.0.0.1:8000/tts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: inputText }),
    });

    const data = await response.json();

    if (data.audio_url) {
      audioPlayer.src = data.audio_url;
      audioPlayer.style.display = "block";
      audioPlayer.play();
    } else {
      alert("Failed to generate audio. Try again.");
      console.error(data);
    }
  } catch (error) {
    alert("An error occurred: " + error.message);
  }
}

// Echo Bot v2 — record, send to /tts/echo, play Murf audio and show transcript
let mediaRecorder;
let audioChunks = [];

const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const echoAudio = document.getElementById("echoAudio");
const uploadStatus = document.getElementById("uploadStatus");
const transcriptDisplay = document.getElementById("transcriptionText");

startBtn.addEventListener("click", async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) audioChunks.push(event.data);
    };

    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunks, { type: "audio/webm" });

      // Show processing state for echo flow
      uploadStatus.textContent = "Processing (transcribing & generating Murf for echo)...";
      transcriptDisplay.textContent = "";

      // Keep existing echo behavior (preserve functionality)
      sendToEchoEndpoint(audioBlob);

      // ALSO send to LLM pipeline (Day 9)
      // This will display transcript + LLM reply and play LLM Murf audio
      sendAudioToLLM(audioBlob);
    };

    mediaRecorder.start();
    startBtn.disabled = true;
    stopBtn.disabled = false;
    uploadStatus.textContent = "";
    transcriptDisplay.textContent = "";
  } catch (err) {
    alert("Microphone access denied or error occurred.");
    console.error(err);
  }
});

stopBtn.addEventListener("click", () => {
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
    startBtn.disabled = false;
    stopBtn.disabled = true;
  }
});

async function sendToEchoEndpoint(blob) {
  const formData = new FormData();
  formData.append("file", blob, "recording.webm");

  try {
    const resp = await fetch("http://127.0.0.1:8000/tts/echo", {
      method: "POST",
      body: formData,
    });

    const data = await resp.json();

    if (resp.ok && data.audio_url) {
      // Display transcript (if returned)
      if (data.transcript) {
        transcriptDisplay.textContent = data.transcript;
      } else {
        transcriptDisplay.textContent = "(No transcript returned)";
      }

      // Play Murf audio
      echoAudio.src = data.audio_url;
      echoAudio.style.display = "block";
      echoAudio.play();
      uploadStatus.textContent = "Done — playing Murf audio.";
    } else {
      uploadStatus.textContent = "Processing failed.";
      console.error("Echo endpoint error:", data);
      if (data && data.error) {
        transcriptDisplay.textContent = "Error: " + data.error;
      }
    }
  } catch (err) {
    uploadStatus.textContent = "Network error during processing.";
    transcriptDisplay.textContent = "";
    console.error(err);
  }
}

// ===============================
//  NEW: send recorded audio to /llm/query/file and play returned Murf audio(s)
// ===============================
async function sendAudioToLLM(blob) {
  const formData = new FormData();
  formData.append("file", blob, "recording.webm");

  const llmOutput = document.getElementById("llmOutput");
  const llmAudio = document.getElementById("llmAudio");

  llmOutput.textContent = "Transcribing and asking LLM...";
  uploadStatus.textContent = "Processing LLM pipeline...";

  try {
    const resp = await fetch("http://127.0.0.1:8000/llm/query/file", {
      method: "POST",
      body: formData
    });

    const data = await resp.json();

    if (!resp.ok) {
      uploadStatus.textContent = "LLM processing failed.";
      llmOutput.textContent = "Error: " + (data.error || JSON.stringify(data));
      console.error("LLM file endpoint error:", data);
      return;
    }

    // Show transcript and LLM reply
    if (data.transcript) {
      document.getElementById("transcriptionText").textContent = data.transcript;
    }
    if (data.llm_reply) {
      llmOutput.textContent = data.llm_reply;
    } else {
      llmOutput.textContent = "(No LLM reply)";
    }

    // Play returned audio URLs (may be one or many) sequentially
    const audioUrls = data.audio_urls || [];
    if (audioUrls.length === 0) {
      uploadStatus.textContent = "No audio returned from LLM pipeline.";
      return;
    }

    // Setup player
    llmAudio.style.display = "block";
    let idx = 0;
    llmAudio.onended = function () {
      idx++;
      if (idx < audioUrls.length) {
        llmAudio.src = audioUrls[idx];
        llmAudio.play();
      } else {
        uploadStatus.textContent = "LLM reply playback finished.";
      }
    };

    // start first
    llmAudio.src = audioUrls[0];
    llmAudio.play();
    uploadStatus.textContent = "Playing LLM reply...";

  } catch (err) {
    uploadStatus.textContent = "Network error during LLM processing.";
    llmOutput.textContent = "";
    console.error(err);
  }
}

// ===============================
//  Existing LLM text query (kept)
// ===============================
async function sendLLMQuery() {
  const query = document.getElementById("llmInput").value;
  const llmOutput = document.getElementById("llmOutput");
  const llmAudio = document.getElementById("llmAudio");

  if (!query.trim()) {
    alert("Please enter a question or prompt.");
    return;
  }

  llmOutput.textContent = "Thinking...";
  llmAudio.style.display = "none";
  llmAudio.src = "";

  try {
    const resp = await fetch("http://127.0.0.1:8000/llm/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: query })
    });

    const data = await resp.json();
    if (resp.ok && data.reply) {
      llmOutput.textContent = data.reply;
      // Optionally call Murf TTS for text-based query and play (not implemented here to preserve existing behavior).
      // If you'd like the text-box query to also play via Murf, I can wire it up similarly.
    } else {
      llmOutput.textContent = "Error: " + (data.error || "Unknown error");
    }
  } catch (err) {
    llmOutput.textContent = "Network error: " + err.message;
  }
}
