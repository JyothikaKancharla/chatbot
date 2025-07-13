document.addEventListener('DOMContentLoaded', () => {
    // Get references to DOM elements
    const chatMessages = document.getElementById('chat-messages');
    const userInput = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    const historyList = document.getElementById('history-list');
    const newChatBtn = document.getElementById('new-chat-btn');
    const clearHistoryBtn = document.getElementById('clear-history-btn');
    const exportChatBtn = document.getElementById('export-chat-btn');
    // Removed: const shareLink = document.getElementById('share-link');
    const uploadBtn = document.getElementById('upload-btn'); // NEW: Reference to the upload button

    // Theme switcher elements
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const body = document.body;

    // Initialize chat history and current chat ID from localStorage
    let chatHistory = JSON.parse(localStorage.getItem('careBloomChatHistory')) || [];
    let currentChatId = localStorage.getItem('careBloomCurrentChatId') || null;
    let currentTheme = localStorage.getItem('careBloomTheme') || 'light';


    // --- Helper Functions ---

    /**
     * Saves the current chat history and active chat ID to localStorage.
     */
    const saveChatHistory = () => {
        try {
            localStorage.setItem('careBloomChatHistory', JSON.stringify(chatHistory));
            localStorage.setItem('careBloomCurrentChatId', currentChatId);
            // console.log('Chat history and current ID saved successfully.');
        } catch (e) {
            console.error('Error saving to localStorage:', e);
            alert('Unable to save chat history. Your browser might be in private mode or storage is full.');
        }
    };

    /**
     * Renders messages for a given chat session into the chat display area.
     * @param {Array} messages - An array of message objects ({sender: 'user'|'bot', text: '...'}).
     */
    const renderChatMessages = (messages) => {
        chatMessages.innerHTML = ''; // Clear existing messages
        messages.forEach(msg => {
            const messageElement = document.createElement('div');
            messageElement.classList.add('message', msg.sender === 'user' ? 'user-message' : 'bot-message', 'animated-message');
            messageElement.innerHTML = `<p>${msg.text}</p>`;
            chatMessages.appendChild(messageElement);
        });
        chatMessages.scrollTop = chatMessages.scrollHeight; // Scroll to the bottom
    };

    /**
     * Adds a new message (user or bot) to the current chat session and updates the display.
     * Also updates the chat title if it's the first user message of a new chat.
     * @param {string} sender - 'user' or 'bot'.
     * @param {string} text - The message content.
     */
    const addMessage = (sender, text) => {
        if (!currentChatId) {
            startNewChat(); // Ensure a chat session exists if somehow it's null
        }

        const currentSession = chatHistory.find(chat => chat.id === currentChatId);

        if (currentSession) {
            const messageObj = { sender, text, timestamp: new Date().toISOString() };
            currentSession.messages.push(messageObj);

            // Crucial: Update the chat title ONLY if it's the very first user message in this session
            // and the title is currently empty or a placeholder like "New Chat".
            const hasUserMessages = currentSession.messages.some(m => m.sender === 'user');
            if (sender === 'user' && !currentSession.title && hasUserMessages) {
                // Truncate the message for the title, adding "..." if it's too long
                const maxLength = 25; // Define maximum length for the title
                currentSession.title = text.substring(0, maxLength) + (text.length > maxLength ? '...' : '');
                renderHistoryList(); // Re-render history to show updated title
            }

            renderChatMessages(currentSession.messages);
            saveChatHistory();
        } else {
            console.error('No active chat session found to add message.');
        }
    };

    /**
     * Fetches bot response from the Flask backend.
     */
    const getBotResponse = async (userMessage) => {
        try {
            const response = await fetch('/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message: userMessage }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Backend error:', errorData.reply);
                return `Error from server: ${errorData.reply || response.statusText}`;
            }

            const data = await response.json();
            return data.reply;

        } catch (error) {
            console.error('Network or fetch error:', error);
            return "Oops! I'm having trouble connecting right now. Please try again later.";
        }
    };


    /**
     * Handles sending a message from the user.
     */
    const sendMessage = async () => {
        const messageText = userInput.value.trim();
        if (messageText === '') return;

        // If it's a brand new chat session (no messages yet in the session history),
        // add the initial bot greeting message *before* the user's message.
        const currentSession = chatHistory.find(chat => chat.id === currentChatId);
        if (currentSession && currentSession.messages.length === 0) {
            addMessage('bot', "Hello! Welcome to a new conversation. How can I assist you today? 😊");
        }

        // Add user message
        addMessage('user', messageText);
        userInput.value = '';
        userInput.style.height = 'auto'; // Reset textarea height

        // Get bot response from backend
        const botResponse = await getBotResponse(messageText);
        addMessage('bot', botResponse);
    };

    // Event listeners for sending messages
    sendBtn.addEventListener('click', sendMessage);
    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { // Send on Enter, allow Shift+Enter for new line
            e.preventDefault(); // Prevent default Enter behavior (new line)
            sendMessage();
        }
    });

    // Auto-resize textarea as user types
    userInput.addEventListener('input', () => {
        userInput.style.height = 'auto'; // Reset height
        userInput.style.height = (userInput.scrollHeight) + 'px'; // Set to scroll height
    });

    /**
     * Renders the list of chat sessions in the sidebar history.
     */
    const renderHistoryList = () => {
        historyList.innerHTML = ''; // Clear existing history items
        chatHistory.forEach(chat => {
            const listItem = document.createElement('li');
            listItem.dataset.chatId = chat.id; // Store chat ID for easy lookup

            // Determine display title: use chat.title if present, otherwise "New Chat"
            const displayTitle = chat.title || 'New Chat';
            listItem.innerHTML = `<i class="fas fa-comment-dots"></i> <span>${displayTitle}</span>`; // Span for text to allow flex grow

            // Add delete button
            const deleteBtn = document.createElement('button');
            deleteBtn.classList.add('delete-chat-btn');
            deleteBtn.innerHTML = '<i class="fas fa-times"></i>'; // Close icon
            deleteBtn.title = 'Delete Chat';
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent loading chat when deleting
                deleteChatSession(chat.id);
            });
            listItem.appendChild(deleteBtn);

            if (chat.id === currentChatId) {
                listItem.classList.add('active'); // Highlight active chat
            }
            listItem.addEventListener('click', () => loadChatSession(chat.id));
            historyList.appendChild(listItem);
        });
    };

    /**
     * Loads and displays a specific chat session from history.
     * @param {string} chatId - The ID of the chat session to load.
     */
    const loadChatSession = (chatId) => {
        currentChatId = chatId; // Set the current active chat
        saveChatHistory(); // Save the new active chat ID
        const session = chatHistory.find(chat => chat.id === chatId);
        if (session) {
            renderChatMessages(session.messages); // Display messages of the loaded session
            // Update active state in history list
            document.querySelectorAll('#history-list li').forEach(li => {
                li.classList.remove('active');
                if (li.dataset.chatId === chatId) {
                    li.classList.add('active');
                }
            });
        } else {
            console.error('Chat session not found:', chatId);
            // Fallback: If session not found (e.g., deleted by another window), start a new chat
            startNewChat();
        }
    };

    /**
     * Starts a new chat session.
     * Creates a new empty chat, adds it to history, and makes it the current chat.
     * The title will be initially empty and will be updated by the first user message.
     */
    const startNewChat = () => {
        const newChatSession = {
            id: Date.now().toString(), // Simple unique ID based on timestamp
            title: '', // Title is initially empty, will be set by first user message
            messages: [] // Start with an empty message array
        };
        chatHistory.unshift(newChatSession); // Add new chat to the beginning of the history list
        currentChatId = newChatSession.id;
        saveChatHistory(); // Save the new history and current chat ID
        renderHistoryList(); // Update the sidebar to show "New Chat" temporarily
        renderChatMessages([]); // Clear chat display for the new session
        // Add a friendly welcome message to the display area without saving it to history yet
        chatMessages.innerHTML = `
            <div class="message bot-message animated-message">
                <p>Hello! Welcome to a new conversation. How can I assist you today? 😊</p>
            </div>
        `;
        chatMessages.scrollTop = chatMessages.scrollHeight; // Scroll to bottom
    };

    newChatBtn.addEventListener('click', startNewChat);

    /**
     * Deletes a specific chat session from history.
     * @param {string} chatIdToDelete - The ID of the chat session to delete.
     */
    const deleteChatSession = (chatIdToDelete) => {
        if (confirm('Are you sure you want to delete this chat?')) {
            // Filter out the chat to be deleted
            chatHistory = chatHistory.filter(chat => chat.id !== chatIdToDelete);

            // If the deleted chat was the current active one, load the most recent remaining chat
            // or start a new chat if no other chats exist.
            if (currentChatId === chatIdToDelete) {
                if (chatHistory.length > 0) {
                    currentChatId = chatHistory[0].id; // Load the first chat remaining
                    loadChatSession(currentChatId); // This will also call saveChatHistory and renderChatMessages
                } else {
                    currentChatId = null; // No chats left
                    startNewChat(); // Start a brand new chat (will also save and render)
                }
            } else {
                saveChatHistory(); // Save if a different chat was deleted
            }
            renderHistoryList(); // Re-render history list after deletion
            alert('Chat deleted successfully.');
        }
    };


    /**
     * Clears all chat history after user confirmation.
     */
    const clearHistory = () => {
        if (confirm('Are you sure you want to clear ALL chat history? This action cannot be undone.')) {
            chatHistory = []; // Empty the history array
            currentChatId = null; // No active chat
            saveChatHistory(); // Save the empty history
            renderHistoryList(); // Clear the sidebar
            renderChatMessages([]); // Clear the main chat display
            chatMessages.innerHTML = `
                <div class="message bot-message animated-message">
                    <p>Welcome! Starting a fresh conversation. How can I help? 😊</p>
                </div>
            `;
            chatMessages.scrollTop = chatMessages.scrollHeight; // Scroll to bottom
            alert('All chat history has been cleared.');
        }
    };

    clearHistoryBtn.addEventListener('click', clearHistory);

    /**
     * Exports the current chat session's messages as a plain text file.
     */
    const exportChat = () => {
        if (!currentChatId) {
            alert('No chat session active to export.');
            return;
        }

        const session = chatHistory.find(chat => chat.id === currentChatId);
        if (!session || session.messages.length === 0) {
            alert('Current chat session is empty. Nothing to export.');
            return;
        }

        let exportContent = `--- CareBloom Chat Session: ${session.title || 'Untitled Chat'} ---\n\n`;
        session.messages.forEach(msg => {
            const date = new Date(msg.timestamp).toLocaleString();
            exportContent += `${date} - ${msg.sender.toUpperCase()}: ${msg.text}\n\n`;
        });
        exportContent += `--- End of Chat Session ---`;

        // Create a Blob and download it as a text file
        const blob = new Blob([exportContent], { type: 'text/plain;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `carebloom_chat_${(session.title || 'untitled').replace(/\s/g, '_').toLowerCase()}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        alert('Chat exported successfully!');
    };

    exportChatBtn.addEventListener('click', exportChat);

    // Removed: generateShareLink function and shareLink event listener

    // --- NEW: Upload Functionality ---
    uploadBtn.addEventListener('click', () => {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*, .pdf, .doc, .docx, .txt'; // Accept common image and document types
        fileInput.multiple = true; // Allow multiple file selection

        fileInput.addEventListener('change', (event) => {
            const files = event.target.files;
            if (files.length > 0) {
                let fileNames = Array.from(files).map(file => file.name).join(', ');
                alert(`Selected files: ${fileNames}. \n\nNote: File upload processing will be implemented in a later step.`);
                // Here, you would typically read the files (e.g., with FileReader)
                // and then send them to your backend (e.g., via FormData and fetch API).
                // This is a placeholder for that complex logic.
            }
        });

        fileInput.click(); // Programmatically click the hidden file input to open the file dialog
    });


    // --- Theme Switching Logic ---
    const applyTheme = (themeName) => {
        body.classList.remove('light-theme', 'dark-theme');
        body.classList.add(`${themeName}-theme`);
        localStorage.setItem('careBloomTheme', themeName);
        currentTheme = themeName;

        const icon = themeToggleBtn.querySelector('i');
        if (currentTheme === 'dark') {
            icon.classList.remove('fa-moon');
            icon.classList.add('fa-sun');
        } else {
            icon.classList.remove('fa-sun');
            icon.classList.add('fa-moon');
        }
    };

    themeToggleBtn.addEventListener('click', () => {
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        applyTheme(newTheme);
    });


    // --- Initial Application Load ---
    applyTheme(currentTheme);
    startNewChat();
});