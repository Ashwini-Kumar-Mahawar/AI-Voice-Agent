// Day 3 – Text to Speech
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
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ text: inputText })
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

// Day 4 – Echo Bot
let mediaRecorder;
let audioChunks = [];

const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const echoAudio = document.getElementById("echoAudio");

startBtn.addEventListener("click", async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);

    audioChunks = [];

    mediaRecorder.ondataavailable = event => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
      const audioURL = URL.createObjectURL(audioBlob);
      echoAudio.src = audioURL;
      echoAudio.style.display = "block";
      echoAudio.play();
    };

    mediaRecorder.start();
    startBtn.disabled = true;
    stopBtn.disabled = false;
  } catch (error) {
    alert("Microphone access denied or error occurred.");
    console.error(error);
  }
});

stopBtn.addEventListener("click", () => {
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
    startBtn.disabled = false;
    stopBtn.disabled = true;
  }
});
