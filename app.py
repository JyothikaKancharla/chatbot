from flask import Flask, render_template, request, jsonify
import google.generativeai as genai
from dotenv import load_dotenv
import os
from chat_db import init_db, save_chat, get_all_chats
from flask_cors import CORS
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Load environment variables
load_dotenv()

# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Load Gemini API key
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    logging.error("GEMINI_API_KEY not found in .env file.")
else:
    logging.info("GEMINI_API_KEY loaded successfully.")
    genai.configure(api_key=GEMINI_API_KEY)

# Initialize SQLite database
init_db()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/chat', methods=['POST'])
def chat():
    """Handles chat messages from frontend, calls Gemini API, saves chat to DB."""
    try:
        data = request.get_json(force=True)
        user_message = data.get('message', '').strip()
        logging.info(f"Received message from user: '{user_message}'")
        print(f"DEBUG: User message received: '{user_message}'") # Debug print

        if not user_message:
            print("DEBUG: User message is empty.") # Debug print
            return jsonify({'reply': "Please enter a message."}), 400

        if not GEMINI_API_KEY:
            print("DEBUG: GEMINI_API_KEY not found, returning 503.") # Debug print
            return jsonify({'reply': "AI service not configured properly."}), 503

        # Setup Gemini model
        model = genai.GenerativeModel('models/gemini-2.0-flash')
        logging.info("Gemini model initialized.")
        print("DEBUG: Gemini model initialized.") # Debug print

        safety_settings = [
            {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
            {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
            {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
            {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
        ]

        prompt = f"""
You are a caring AI medical assistant helping users with basic health tips.

Your job:
- Provide helpful, clear responses in 4-5 bullet points for common health issues like fever, cold, headache, migraine, etc.
- Avoid repeating warnings unless necessary.
- If the query is unclear or serious, briefly advise seeing a doctor.

User's message: {user_message}
"""

        logging.info(f"Sending prompt to Gemini API. Prompt: {prompt[:100]}...")
        print(f"DEBUG: Prompt being sent to Gemini: {prompt}") # Debug print

        response = model.generate_content(
            prompt,
            safety_settings=safety_settings,
            generation_config=genai.types.GenerationConfig(
                temperature=0.6,
                max_output_tokens=400
            )
        )
        print(f"DEBUG: Raw response from Gemini: {response}") # Debug print

        # Parse Gemini response
        bot_reply = "The AI did not provide a clear response. Please try again." # Default reply
        if response.candidates:
            if response.candidates[0].content.parts:
                bot_reply = response.candidates[0].content.parts[0].text.strip()
                print(f"DEBUG: Bot reply from candidates: '{bot_reply}'") # Debug print
            else:
                print("DEBUG: Gemini response.candidates found, but no content parts.") # Debug print
        elif response.prompt_feedback and response.prompt_feedback.block_reason:
            block_reason = response.prompt_feedback.block_reason
            bot_reply = f"Your question was blocked due to safety guidelines: {block_reason}"
            print(f"DEBUG: Gemini response blocked: {block_reason}") # Debug print
        else:
            print("DEBUG: No candidates or block reason found in Gemini response.") # Debug print


        # Save chat to database
        try:
            save_chat(user_message, bot_reply)
            print("DEBUG: Chat saved to database.") # Debug print
        except Exception as db_error:
            logging.error("Database error when saving chat:", exc_info=True)
            print(f"DEBUG: Database saving error: {db_error}") # Debug print

        print(f"DEBUG: Sending final JSON response: {{'reply': '{bot_reply}'}}") # Debug print
        return jsonify({'reply': bot_reply})

    except Exception as e:
        logging.error(f"Error in /chat: {e}", exc_info=True)
        print(f"DEBUG: An exception occurred in /chat route: {e}") # Debug print
        return jsonify({'reply': "An internal error occurred. Please try again."}), 500

@app.route('/history', methods=['GET'])
def history():
    """Returns all chat history to the frontend."""
    try:
        chats = get_all_chats()
        formatted = [{"user": chat[0], "bot": chat[1], "timestamp": chat[2]} for chat in chats]
        print(f"DEBUG: Sending history: {formatted[:5]}...") # Debug print for history
        return jsonify({'history': formatted})
    except Exception as e:
        logging.error("Error fetching history:", exc_info=True)
        print(f"DEBUG: Error fetching history: {e}") # Debug print
        return jsonify({'history': [], 'error': "Could not load history"}), 500

@app.route('/delete', methods=['POST'])
def delete_chat():
    """Delete specific or all chat history entries."""
    try:
        data = request.get_json()
        if data and "index" in data:
            from chat_db import delete_chat_by_index
            delete_chat_by_index(data["index"])
            logging.info(f"Deleted chat at index {data['index']}.")
            print(f"DEBUG: Deleted chat at index {data['index']}.") # Debug print
        else:
            from chat_db import clear_all_chats
            clear_all_chats()
            logging.info("Cleared all chat history.")
            print("DEBUG: Cleared all chat history.") # Debug print
        return jsonify({"status": "success"})
    except Exception as e:
        logging.error("Error deleting chat(s):", exc_info=True)
        print(f"DEBUG: Error deleting chat(s): {e}") # Debug print
        return jsonify({"status": "error"}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)

# Run the Flask app
# Note: In production, set debug=False and use a proper WSGI server like Gun