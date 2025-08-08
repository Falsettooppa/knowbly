document.addEventListener('DOMContentLoaded', function(){
    // ===== Grab DOM elements =====
const chatArea = document.getElementById("chat-area");
const chatForm = document.getElementById("chat-form");
const userInput = document.getElementById("user-input");
const voiceBtn = document.getElementById("voice-btn");
// const API_KEY = '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'

// ===== Store chat messages =====
let messages = []; // { sender: 'user' | 'ai', text: '...' }

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

  // Remove "Thinking..." message and replace
//   chatArea.lastChild.remove();
  messages.push({ sender: "ai", text: aiText });
  addMessage("ai", aiText);
});



// ===== AI reply function =====
async function getAIResponse(userMessage) {
    const API_KEY = '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'
    const API_URL = "https://openrouter.ai/api/v1/chat/completions";

    const freeModels = [
        "mistralai/mistral-7b-instruct:free",
        "meta-llama/llama-3.1-8b-instruct:free",
        "nousresearch/nous-hermes-2-mistral-7b:free"
      ];
      
    let currentModelIndex = 0;
  
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
})

// TODO: persist message on reload