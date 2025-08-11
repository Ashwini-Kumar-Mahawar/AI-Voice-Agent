// ----------------------
// Utilities: session id
// ----------------------
// Ensure session ID is in URL (create if missing)
const urlParams = new URLSearchParams(window.location.search);
let sessionId = urlParams.get("session_id");
if (!sessionId) {
  // generate a session id (modern browsers)
  if (window.crypto && crypto.randomUUID) {
    sessionId = crypto.randomUUID();
  } else {
    sessionId = "sess-" + Date.now();
  }
  urlParams.set("session_id", sessionId);
  const newUrl = window.location.pathname + "?" + urlParams.toString();
  history.replaceState(null, "", newUrl);
}

// ----------------------
// TTS generate (existing)
// ----------------------
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

// ----------------------
// Echo Bot v2 — record, send to /tts/echo, play Murf audio and show transcript
// ----------------------
let mediaRecorder;
let audioChunks = [];
let currentStream = null;

const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const echoAudio = document.getElementById("echoAudio");
const uploadStatus = document.getElementById("uploadStatus");
const transcriptDisplay = document.getElementById("transcriptionText");
const llmOutput = document.getElementById("llmOutput");
const llmAudio = document.getElementById("llmAudio");

// helper: start recording (used by button and auto-restart after agent audio ends)
async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    currentStream = stream;
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
      llmOutput.textContent = "";

      // Keep existing echo behavior (preserve functionality)
      sendToEchoEndpoint(audioBlob);

      // NEW: send to agent chat endpoint (session-based)
      sendAudioToAgent(audioBlob);
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
}

// helper: stop recording
function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
  }
  if (currentStream) {
    currentStream.getTracks().forEach((t) => t.stop());
    currentStream = null;
  }
  startBtn.disabled = false;
  stopBtn.disabled = true;
}

// wire buttons to helpers
startBtn.addEventListener("click", startRecording);
stopBtn.addEventListener("click", stopRecording);

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
//  NEW Day 10: send recorded audio to /agent/chat/{sessionId}
//  This adds memory to the conversation.
// ===============================
async function sendAudioToAgent(blob) {
  const formData = new FormData();
  formData.append("file", blob, "recording.webm");

  uploadStatus.textContent = "Processing conversation (transcribing, LLM, TTS)...";
  llmOutput.textContent = "Thinking...";

  try {
    const resp = await fetch(`http://127.0.0.1:8000/agent/chat/${sessionId}`, {
      method: "POST",
      body: formData
    });

    const data = await resp.json();

    if (!resp.ok) {
      uploadStatus.textContent = "Agent processing failed.";
      llmOutput.textContent = "Error: " + (data.error || JSON.stringify(data));
      console.error("Agent endpoint error:", data);
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
      uploadStatus.textContent = "No audio returned from agent pipeline.";
      return;
    }

    // Setup player to auto-restart recording after playback ends
    llmAudio.style.display = "block";
    let idx = 0;
    llmAudio.onended = function () {
      idx++;
      if (idx < audioUrls.length) {
        llmAudio.src = audioUrls[idx];
        llmAudio.play();
      } else {
        uploadStatus.textContent = "Agent reply playback finished. Auto-recording next turn...";
        // Auto-start next recording (user gesture already given earlier)
        startRecording();
      }
    };

    // start first
    llmAudio.src = audioUrls[0];
    llmAudio.play();
    uploadStatus.textContent = "Playing agent reply...";

  } catch (err) {
    uploadStatus.textContent = "Network error during agent processing.";
    llmOutput.textContent = "";
    console.error(err);
  }
}

// ===============================
//  Existing Day 9 LLM audio function (kept for compatibility)
// ===============================
async function sendAudioToLLM(blob) {
  // unchanged - kept if you want to call /llm/query/file directly
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
    } else {
      llmOutput.textContent = "Error: " + (data.error || "Unknown error");
    }
  } catch (err) {
    llmOutput.textContent = "Network error: " + err.message;
  }
}

// Grab your existing audio element
const audioElement = document.getElementById("response-audio");

// This function starts recording again
function autoStartRecording() {
    console.log("Starting next recording...");
    startRecording(); // Assuming you already have a startRecording() function
}

// Attach listener to auto-start when Murf finishes speaking
audioElement.addEventListener("ended", () => {
    console.log("Murf audio finished. Restarting recording...");
    autoStartRecording();
});
