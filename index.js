document.addEventListener('DOMContentLoaded', function(){
    // ===== Grab DOM elements =====
const chatArea = document.getElementById("chat-area");
const chatForm = document.getElementById("chat-form");
const userInput = document.getElementById("user-input");
const voiceBtn = document.getElementById("voice-btn");
// const API_KEY = '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'

// ===== Store chat messages =====
let messages = []; // { sender: 'user' | 'ai', text: '...' }


// Save messages to localStorage
function saveMessages() {
    localStorage.setItem("chatMessages", JSON.stringify(messages));
}

// Load messages from localStorage
function loadMessages() {
    const stored = localStorage.getItem("chatMessages");
    if (stored) {
        messages = JSON.parse(stored);
        messages.forEach(m => addMessage(m.sender, m.text));
    }
}

// Call on page load
loadMessages();


// ===== Function to render messages =====
function addMessage(sender, text) {
  const messageEl = document.createElement("div");
  messageEl.classList.add("message", sender);

  messageEl.innerHTML = `
    <div class="message-bubble">
      <p>${text}</p>
    </div>
  `;

  chatArea.appendChild(messageEl);
  chatArea.scrollTop = chatArea.scrollHeight; // Auto scroll

  saveMessages();
}


// ===== Handle user sending a message =====
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault(); // Prevent page refresh
  const text = userInput.value.trim();
  if (text === "") return;

  // Add user's message
  messages.push({ sender: "user", text });
  addMessage("user", text);
  userInput.value = "";

  // AI response
  const aiText = await getAIResponse(text);

  // chatArea.lastChild.remove();
  messages.push({ sender: "ai", text: aiText });
  addMessage("ai", aiText);
});
const fileInput = document.getElementById("file-input");

fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (file) {
    // === New integrated file upload handling ===
    const API_KEY = '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';
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result.split(',')[1];
      const contentType = file.type;

      // Show file info in chat
      messages.push({ sender: "user", text: `📎 Uploaded file: ${file.name}` });
      addMessage("user", `📎 Uploaded file: ${file.name}`);

      // Send to OpenRouter with multimodal-style payload
      const payload = {
        model: "mistralai/mistral-7b-instruct:free",
        messages: [
          { role: "system", content: "You are Knowbly." },
          { role: "user", content: "Please analyze the uploaded file." },
          { role: "user", content: { file: `data:${contentType};base64,${base64}` } }
        ]
      };

      try {
        const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        const reply = data.choices?.[0]?.message?.content || "No reply.";
        messages.push({ sender: "ai", text: reply });
        addMessage("ai", reply);
      } catch (err) {
        console.error("File upload error:", err);
        messages.push({ sender: "ai", text: "❌ Failed to process the uploaded file." });
        addMessage("ai", "❌ Failed to process the uploaded file.");
      }
    };
    reader.readAsDataURL(file);

    fileInput.value = ""; // reset so same file can be re-selected
  }
});


let currentModelIndex = 0;

// ===== AI reply function =====
async function getAIResponse(userMessage) {
    const API_KEY = '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'
    const API_URL = "https://openrouter.ai/api/v1/chat/completions";

    const freeModels = [
        "mistralai/mistral-7b-instruct:free",
        "meta-llama/llama-3.1-8b-instruct:free",
        "nousresearch/nous-hermes-2-mistral-7b:free"
      ];
      
  
    const payload = {
      model: "mistralai/mistral-7b-instruct:free",
      messages: [
        { role: "system", content: "You are Knowbly, a friendly AI assistant." },
        { role: "user", content: userMessage }
      ]
    };
  
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (res.status === 402) {
        // Model requires payment, try the next one
        currentModelIndex++;
        if (currentModelIndex < freeModels.length) {
          console.warn(`Model ${payload.model} requires payment, switching to ${freeModels[currentModelIndex]}`);
          return getAIResponse(userMessage);
        } else {
          throw new Error("All free models failed or require payment.");
        }
      }
  
      if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  
      const data = await res.json();
      return data.choices[0].message.content;
    } catch (err) {
      console.error("API Error:", err);
      return "Oops! Something went wrong with the AI service.";
    }
  }


  // Voice input using Web Speech API
voiceBtn.addEventListener("click", () => {
  // Check browser support
  if (!('webkitSpeechRecognition' in window)) {
    alert("Your browser doesn't support speech recognition");
    return;
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();
//   const recognition = new webkitSpeechRecognition();
  recognition.lang = "en-US"; // language to use
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.start();

  recognition.onstart = () => {
    voiceBtn.textContent = "Listening...";
  };

  recognition.onresult = (event) => {
    const speechText = event.results[0][0].transcript;
    userInput.value = speechText; // Put speech into input box
  };

  recognition.onerror = (event) => {
    console.error("Speech recognition error:", event.error);
    alert("Speech recognition error:", event.error);
  };

  recognition.onend = () => {
    // voiceBtn.textContent = `<i class="fas fa-microphone"></i>`
    voiceBtn.innerHTML = `<i class="fas fa-microphone"></i>`
  };
});


//   end of DOMContentLoaded
})
