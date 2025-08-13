// Day 12 UI (with Day 10 history + Day 11 error handling)
// Backend base URL
const API = "http://127.0.0.1:8000";

// DOM refs
const chatEl = document.getElementById("chat");
const recordBtn = document.getElementById("recordBtn");
const statusText = document.getElementById("statusText");
const errorBar = document.getElementById("errorBar");
const audioEl = document.getElementById("replyAudio");
const sessionIdInput = document.getElementById("sessionIdInput");
const sessionIdShort = document.getElementById("sessionIdShort");

// Utilities
function shortId(id){
  if (!id) return "—";
  if (id.length <= 8) return id;
  return `${id.slice(0,4)}…${id.slice(-4)}`;
}

function getOrCreateSessionId(){
  const url = new URL(window.location.href);
  let sid = url.searchParams.get("session_id");
  if (!sid){
    sid = "sess-" + Math.random().toString(36).slice(2, 10);
    url.searchParams.set("session_id", sid);
    window.history.replaceState({}, "", url.toString());
  }
  sessionIdInput.value = sid;
  sessionIdShort.textContent = shortId(sid);

  sessionIdInput.addEventListener("change", ()=>{
    const v = sessionIdInput.value.trim();
    if (!v) return;
    const u = new URL(window.location.href);
    u.searchParams.set("session_id", v);
    window.history.replaceState({}, "", u.toString());
    sessionIdShort.textContent = shortId(v);
    fetchAndRenderHistory(v);
  });

  return sid;
}

const SESSION_ID = getOrCreateSessionId();

// Render helpers
function addBubble(role, text){
  const div = document.createElement("div");
  div.className = `bubble ${role === "user" ? "bubble--user" : "bubble--ai"}`;

  const roleEl = document.createElement("div");
  roleEl.className = "bubble__role";
  roleEl.textContent = role === "user" ? "You:" : "AI:";

  const txt = document.createElement("div");
  txt.className = "bubble__text";
  txt.textContent = text;

  div.appendChild(roleEl);
  div.appendChild(txt);
  chatEl.appendChild(div);
  chatEl.scrollTop = chatEl.scrollHeight;
}

function showError(msg){
  errorBar.textContent = msg;
  errorBar.hidden = false;
  setTimeout(()=>{ errorBar.hidden = true; }, 4000);
}

// Fetch history on load
async function fetchAndRenderHistory(sid){
  try{
    const r = await fetch(`${API}/agent/history/${encodeURIComponent(sid)}`);
    const data = await r.json();
    chatEl.innerHTML = "";
    const hist = data.history || [];
    if (hist.length === 0){
      addBubble("ai", "Hi there! Click the mic to start our conversation.");
      return;
    }
    hist.forEach(m => addBubble(m.role, m.content));
  }catch(e){
    showError("Failed to load history");
    console.error(e);
  }
}
fetchAndRenderHistory(SESSION_ID);

// Recording logic (single toggle)
let mediaRecorder = null;
let chunks = [];
let isRecording = false;

recordBtn.addEventListener("click", async ()=>{
  if (!isRecording){
    // start recording
    try{
      const stream = await navigator.mediaDevices.getUserMedia({ audio:true });
      mediaRecorder = new MediaRecorder(stream);
      chunks = [];

      mediaRecorder.ondataavailable = (e)=>{
        if (e.data.size > 0) chunks.push(e.data);
      };
      mediaRecorder.onstop = async ()=>{
        const blob = new Blob(chunks, { type: "audio/webm" });
        await sendToAgent(blob);
      };

      mediaRecorder.start();
      isRecording = true;
      recordBtn.classList.add("is-recording");
      statusText.textContent = "Listening… Tap to stop.";
    }catch(err){
      console.error(err);
      showError("Microphone permission denied or not available.");
    }
  }else{
    // stop recording
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }
    isRecording = false;
    recordBtn.classList.remove("is-recording");
    statusText.textContent = "Processing response…";
  }
});

// Core: send audio to backend agent and handle response + errors
async function sendToAgent(blob){
  const sid = sessionIdInput.value.trim() || SESSION_ID;
  const form = new FormData();
  form.append("file", blob, "recording.webm");

  try{
    const resp = await fetch(`${API}/agent/chat/${encodeURIComponent(sid)}`, {
      method:"POST",
      body: form
    });
    const data = await resp.json();

    // Always show user message if we got a transcript
    if (data.transcript){
      addBubble("user", data.transcript);
    }

    if (!resp.ok){
      if (data.llm_reply) addBubble("ai", data.llm_reply);
      showError(data.error || "Failed to process your request.");
      // play any fallback audio if present
      if (Array.isArray(data.audio_urls) && data.audio_urls.length){
        await playSequential(data.audio_urls, false);
      }
      // refresh history
      fetchAndRenderHistory(sid);
      statusText.textContent = "Tap the mic to try again.";
      return;
    }

    // Success: render AI text + play audio
    if (data.llm_reply) addBubble("ai", data.llm_reply);

    if (Array.isArray(data.audio_urls) && data.audio_urls.length){
      await playSequential(data.audio_urls, true); // auto restart listening after playback
    }else{
      statusText.textContent = "No audio returned.";
    }

    // Refresh history list (server may have trimmed)
    fetchAndRenderHistory(sid);

  }catch(e){
    console.error(e);
    showError("Network error while contacting the server.");
    statusText.textContent = "Tap the mic to try again.";
  }
}

// Play a list of URLs back-to-back; optionally auto-start recording after
function playSequential(urls, autoRecordAfter){
  return new Promise(resolve=>{
    let i = 0;
    audioEl.onended = async ()=>{
      i++;
      if (i < urls.length){
        audioEl.src = urls[i];
        audioEl.play();
      }else{
        audioEl.onended = null;
        statusText.textContent = "Your turn. Tap the mic to speak.";
        if (autoRecordAfter){
          // give a tiny pause then start listening again
          setTimeout(()=>recordBtn.click(), 800);
        }
        resolve();
      }
    };
    audioEl.src = urls[0];
    audioEl.play();
    statusText.textContent = "Playing response…";
  });
}
