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
      // Show processing state
      uploadStatus.textContent = "Processing (transcribing & generating Murf)...";
      transcriptDisplay.textContent = "";

      await sendToEchoEndpoint(audioBlob);
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
