// static/script.js - frontend logic for Day 10 + Day 11 error handling

// Helper: get or create session id (stored in query param)
function getSessionId() {
  const url = new URL(window.location.href);
  let sid = url.searchParams.get("session_id");
  const input = document.getElementById("sessionIdInput");
  if (!sid) {
    sid = "sess-" + Math.random().toString(36).slice(2, 9);
    url.searchParams.set("session_id", sid);
    window.history.replaceState({}, "", url.toString());
  }
  input.value = sid;
  // update url when user edits manually
  input.addEventListener("change", () => {
    const newSid = input.value.trim();
    if (newSid) {
      const u = new URL(window.location.href);
      u.searchParams.set("session_id", newSid);
      window.history.replaceState({}, "", u.toString());
      sid = newSid;
      fetchAndRenderHistory(sid);
    }
  });
  return sid;
}

const sessionId = getSessionId();

// Fetch and render chat history
async function fetchAndRenderHistory(sid) {
  const el = document.getElementById("chatHistory");
  el.innerHTML = "Loading...";
  try {
    const res = await fetch(`http://127.0.0.1:8000/agent/history/${sid}`);
    const data = await res.json();
    el.innerHTML = "";
    const hist = data.history || [];
    if (hist.length === 0) {
      el.innerHTML = "<p class='text-muted'>No messages yet.</p>";
      return;
    }
    hist.forEach(m => {
      const div = document.createElement("div");
      div.className = "chat-message " + (m.role === "user" ? "chat-user" : "chat-assistant");
      div.textContent = (m.role === "user" ? "You: " : "Assistant: ") + m.content;
      el.appendChild(div);
    });
    // scroll to bottom
    el.scrollTop = el.scrollHeight;
  } catch (err) {
    el.innerHTML = "<p class='text-danger'>Failed to load history</p>";
    console.error(err);
  }
}

// initial render
fetchAndRenderHistory(sessionId);

// existing simple TTS generate (unchanged)
async function generateAudio() {
  const inputText = document.getElementById("textInput").value;
  const audioPlayer = document.getElementById("audioPlayer");
  if (!inputText.trim()) { alert("Please enter some text first."); return; }
  try {
    const response = await fetch("http://127.0.0.1:8000/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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


// Voice recording + pipeline
let mediaRecorder;
let audioChunks = [];

const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const uploadStatus = document.getElementById("uploadStatus");
const transcriptionText = document.getElementById("transcriptionText");
const llmOutput = document.getElementById("llmOutput");
const llmAudio = document.getElementById("llmAudio");

startBtn.addEventListener("click", async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) audioChunks.push(event.data);
    };

    mediaRecorder.onstop = async () => {
      const blob = new Blob(audioChunks, { type: "audio/webm" });
      uploadStatus.textContent = "Processing (STT → LLM → TTS)...";
      transcriptionText.textContent = "";
      llmOutput.textContent = "";
      await sendAudioToAgent(blob);
    };

    mediaRecorder.start();
    startBtn.disabled = true;
    stopBtn.disabled = false;
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

// send audio to /agent/chat/{session_id}
async function sendAudioToAgent(blob) {
  const sid = document.getElementById("sessionIdInput").value.trim() || sessionId;
  const formData = new FormData();
  formData.append("file", blob, "recording.webm");

  try {
    const resp = await fetch(`http://127.0.0.1:8000/agent/chat/${encodeURIComponent(sid)}`, {
      method: "POST",
      body: formData
    });

    const data = await resp.json();

    if (!resp.ok) {
      console.error("Agent endpoint error:", data);
      uploadStatus.textContent = "Processing failed.";
      transcriptionText.textContent = data.transcript || "";
      llmOutput.textContent = data.llm_reply || "Error";
      // if audio_urls present, play fallback/returned audio
      if (data.audio_urls && data.audio_urls.length > 0) {
        playAudioUrlsSequentially(data.audio_urls, true /* auto-record when done? false here */);
      }
      // refresh history
      fetchAndRenderHistory(sid);
      return;
    }

    // success path
    transcriptionText.textContent = data.transcript || "";
    llmOutput.textContent = data.llm_reply || "";
    if (data.audio_urls && data.audio_urls.length > 0) {
      // Play sequentially and after playback restart recording automatically
      playAudioUrlsSequentially(data.audio_urls, /*autoRecordOnEnd=*/true);
    } else {
      uploadStatus.textContent = "No audio returned.";
    }
    // refresh history view
    fetchAndRenderHistory(sid);

  } catch (err) {
    console.error("Network error:", err);
    uploadStatus.textContent = "Network error during processing.";
  }
}

function playAudioUrlsSequentially(urls, autoRecordOnEnd = false) {
  llmAudio.style.display = "block";
  let idx = 0;
  llmAudio.onended = function () {
    idx++;
    if (idx < urls.length) {
      llmAudio.src = urls[idx];
      llmAudio.play();
    } else {
      uploadStatus.textContent = "Playback finished.";
      llmAudio.onended = null;
      if (autoRecordOnEnd) {
        // start recording automatically after a short delay
        setTimeout(() => {
          startBtn.click();
        }, 600);
      }
    }
  };
  llmAudio.src = urls[0];
  llmAudio.play();
  uploadStatus.textContent = "Playing reply...";
}

// LLM text query (kept)
async function sendLLMQuery() {
  const query = document.getElementById("llmInput").value;
  const out = document.getElementById("llmOutput");
  if (!query.trim()) { alert("Please enter a question or prompt."); return; }
  out.textContent = "Thinking...";
  try {
    const resp = await fetch("http://127.0.0.1:8000/llm/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: query })
    });
    const data = await resp.json();
    if (resp.ok && data.reply) {
      out.textContent = data.reply;
    } else {
      out.textContent = "Error: " + (data.error || "Unknown error");
    }
  } catch (err) {
    out.textContent = "Network error: " + err.message;
  }
}
