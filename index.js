document.addEventListener('DOMContentLoaded', () => {
  // ===== Grab DOM elements =====
  const chatArea = document.getElementById("chat-area");
  const chatForm = document.getElementById("chat-form");
  const userInput = document.getElementById("user-input");
  const voiceBtn = document.getElementById("voice-btn");
  const fileInput = document.getElementById("file-input");
  const historyList = document.getElementById("history-list");
  const newChatBtn = document.getElementById("new-chat-btn");
  const sidebarToggleBtn = document.getElementById("sidebar-toggle-btn");
  const sidebar = document.querySelector(".sidebar");
  const overlay = document.getElementById("overlay");

  // ===== Store chat messages and sessions =====
  let messages = [];
  let chatSessions = JSON.parse(localStorage.getItem('chatSessions') || '[]');
  let currentSessionId = Date.now();

  // ===== Save messages and sessions =====
  function saveMessages() {
    localStorage.setItem("chatMessages", JSON.stringify(messages));

    try {
      const idx = chatSessions.findIndex(s => s.id === currentSessionId);
      if (idx !== -1) {
        chatSessions[idx].messages = messages;
        if (!chatSessions[idx].title && messages.length) {
          const firstUser = messages.find(m => m.sender === 'user');
          if (firstUser && firstUser.text) {
            chatSessions[idx].title = firstUser.text.slice(0, 30) + (firstUser.text.length > 30 ? '...' : '');
          }
        }
      } else {
        chatSessions.push({
          id: currentSessionId,
          title: messages[0] && messages[0].text ? messages[0].text.slice(0, 30) : 'New Chat',
          messages: messages
        });
      }
      localStorage.setItem('chatSessions', JSON.stringify(chatSessions));
    } catch (err) {
      console.warn("session save error", err);
    }
  }

  // ===== Load messages from localStorage =====
  function loadMessages() {
    const stored = localStorage.getItem("chatMessages");
    if (stored) {
      messages = JSON.parse(stored);
      if (!localStorage.getItem('chatSessions')) {
        messages.forEach(m => addMessage(m.sender, m.text));
      }
    }
  }

  loadMessages();

  // ===== Render messages =====
  function addMessage(sender, text) {
    if (!chatArea) return;
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
  if (chatForm && userInput) {
    chatForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const text = userInput.value.trim();
      if (text === "") return;

      messages.push({ sender: "user", text });
      addMessage("user", text);
      userInput.value = "";

      const aiText = await getAIResponse(text);

      messages.push({ sender: "ai", text: aiText });
      addMessage("ai", aiText);
    });
  }

  // ===== File upload handling =====
  if (fileInput) {
    fileInput.addEventListener("change", () => {
      const file = fileInput.files[0];
      if (file) {
        const API_KEY = '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';
        const reader = new FileReader();
        reader.onload = async () => {
          const base64 = reader.result.split(',')[1];
          const contentType = file.type;

          messages.push({ sender: "user", text: `📎 Uploaded file: ${file.name}` });
          addMessage("user", `📎 Uploaded file: ${file.name}`);

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
        fileInput.value = "";
      }
    });
  }

  // ===== AI reply function =====
  let currentModelIndex = 0;
  async function getAIResponse(userMessage) {
    const API_KEY = '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';
    const API_URL = "https://openrouter.ai/api/v1/chat/completions";

    const freeModels = [
      "mistralai/mistral-7b-instruct:free",
      "meta-llama/llama-3.1-8b-instruct:free",
      "nousresearch/nous-hermes-2-mistral-7b:free"
    ];

    const payload = {
      model: freeModels[currentModelIndex],
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

  // ===== Voice input =====
  if (voiceBtn && userInput) {
    voiceBtn.addEventListener("click", () => {
      if (!('webkitSpeechRecognition' in window)) {
        alert("Your browser doesn't support speech recognition");
        return;
      }

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.lang = "en-US";
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.start();

      recognition.onstart = () => {
        voiceBtn.textContent = "Listening...";
      };

      recognition.onresult = (event) => {
        const speechText = event.results[0][0].transcript;
        userInput.value = speechText;
      };

      recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        alert("Speech recognition error: " + event.error);
      };

      recognition.onend = () => {
        voiceBtn.innerHTML = `<i class="fas fa-microphone"></i>`;
      };
    });
  }

  // ===== Session management =====
  function saveSessions() {
    localStorage.setItem('chatSessions', JSON.stringify(chatSessions));
  }

  function loadChatHistory() {
    if (!historyList) return;
    historyList.innerHTML = "";

    chatSessions.forEach(chat => {
      const li = document.createElement("li");
      li.className = "history-item";

      // Title span
      const titleSpan = document.createElement("span");
      titleSpan.className = "chat-title";
      titleSpan.textContent = chat.title;
      titleSpan.addEventListener("click", () => loadSession(chat.id));

      // Menu button
      const menuBtn = document.createElement("button");
      menuBtn.className = "menu-btn";
      menuBtn.innerHTML = "&#x22EE;";

      // Dropdown menu
      const menuDropdown = document.createElement("div");
      menuDropdown.className = "menu-dropdown";

      // Rename option
      const renameOption = document.createElement("div");
      renameOption.textContent = "Rename";
      renameOption.className = "rename";
      renameOption.addEventListener("click", (e) => {
        e.stopPropagation();
        menuDropdown.classList.remove("show");
        menuDropdown.style.display = "";
        menuDropdown.style.left = "";
        menuDropdown.style.top = "";

        const input = document.createElement("input");
        input.type = "text";
        input.value = chat.title;
        input.className = "rename-input";
        li.replaceChild(input, titleSpan);
        input.focus();

        const saveRename = () => {
          chat.title = input.value.trim() || chat.title;
          saveSessions();
          loadChatHistory();
        };
        input.addEventListener("blur", saveRename);
        input.addEventListener("keydown", e => {
          if (e.key === "Enter") input.blur();
        });
      });

      // Delete option
      const deleteOption = document.createElement("div");
      deleteOption.textContent = "Delete";
      deleteOption.className = "delete";
      deleteOption.addEventListener("click", () => {
        menuDropdown.classList.remove("show");
        menuDropdown.style.display = "";
        menuDropdown.style.left = "";
        menuDropdown.style.top = "";

        if (confirm(`Delete chat "${chat.title}"? This cannot be undone.`)) {
          chatSessions = chatSessions.filter(c => c.id !== chat.id);
          saveSessions();
          loadChatHistory();
        //   loadMessages()
        }
      });

      menuDropdown.appendChild(renameOption);
      menuDropdown.appendChild(deleteOption);

      // Toggle menu
      menuBtn.addEventListener("click", e => {
        e.stopPropagation();

        if (menuDropdown.parentElement !== document.body) {
          document.body.appendChild(menuDropdown);
        }

        menuDropdown.style.position = "absolute";
        menuDropdown.style.display = "flex";
        menuDropdown.style.visibility = "hidden";

        requestAnimationFrame(() => {
          const btnRect = menuBtn.getBoundingClientRect();
          const ddRect = menuDropdown.getBoundingClientRect();

          let left = btnRect.left + btnRect.width - ddRect.width;
          left = Math.max(8, Math.min(left, window.innerWidth - ddRect.width - 8));

          const top = btnRect.bottom + window.scrollY + 6;

          menuDropdown.style.left = `${left}px`;
          menuDropdown.style.top = `${top}px`;
          menuDropdown.style.visibility = "";
          menuDropdown.classList.add("show");
        });

        menuDropdown.addEventListener("click", evt => evt.stopPropagation());

        const outsideHandler = (evt) => {
          if (!menuDropdown.contains(evt.target) && evt.target !== menuBtn) {
            menuDropdown.classList.remove("show");
            menuDropdown.style.display = "";
            menuDropdown.style.left = "";
            menuDropdown.style.top = "";
            document.removeEventListener("click", outsideHandler);
          }
        };

        document.addEventListener("click", outsideHandler);
      });

      li.appendChild(titleSpan);
      li.appendChild(menuBtn);
      historyList.appendChild(li);
    });
  }

  function loadSession(id) {
    const sess = chatSessions.find(s => s.id === id);
    if (!sess) return;
    currentSessionId = sess.id;
    messages = sess.messages || [];
    if (!chatArea) return;
    chatArea.innerHTML = "";
    messages.forEach(m => addMessage(m.sender, m.text));
  }

  function createNewSession() {
    currentSessionId = Date.now();
    const newSess = { id: currentSessionId, title: "New Chat", messages: [] };
    chatSessions.push(newSess);
    saveSessions();
    loadChatHistory();
    loadSession(currentSessionId);
  }

  // ===== Reconcile legacy chatMessages with chatSessions =====
  (function reconcileSessionsAfterLoad(){
    try {
      chatSessions = JSON.parse(localStorage.getItem('chatSessions') || '[]');

      if (chatSessions.length === 0) {
        currentSessionId = Date.now();
        chatSessions.push({
          id: currentSessionId,
          title: messages.find(m => m.sender === 'user')?.text?.slice(0,30) || 'New Chat',
          messages: messages
        });
        saveSessions();
      } else {
        const last = chatSessions[chatSessions.length - 1];
        currentSessionId = last.id;
        messages = last.messages || [];
        if (chatArea) {
          chatArea.innerHTML = "";
          messages.forEach(m => addMessage(m.sender, m.text));
        }
      }
      loadChatHistory();
    } catch (e) {
      console.warn("reconcileSessionsAfterLoad error", e);
      loadChatHistory();
    }
  })();

  // ===== Hook up New Chat button =====
  if (newChatBtn) {
    newChatBtn.addEventListener('click', createNewSession);
  }

  // ===== Sidebar toggle and overlay handling =====
  sidebarToggleBtn.addEventListener('click', () => {
    sidebar.classList.toggle('show');
    overlay.classList.toggle('show');
    document.body.classList.toggle('sidebar-open');
  });

  overlay.addEventListener('click', () => {
    sidebar.classList.remove('show');
    overlay.classList.remove('show');
    document.body.classList.remove('sidebar-open');
  });

  /* DOMContent loaded end */
});

