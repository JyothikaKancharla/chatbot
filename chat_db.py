import sqlite3
import datetime

DATABASE = 'chat_history.db'

def init_db():
    """Initializes the SQLite database, creating the chats table if it doesn't exist."""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS chats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_message TEXT NOT NULL,
            bot_reply TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()
    print("Database initialized successfully.")

def save_chat(user_message, bot_reply):
    """Saves a user message and bot reply to the database."""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    cursor.execute("INSERT INTO chats (user_message, bot_reply) VALUES (?, ?)",
                   (user_message, bot_reply))
    conn.commit()
    conn.close()
    print(f"Chat saved: User='{user_message[:30]}...', Bot='{bot_reply[:30]}...'")

def get_all_chats():
    """Retrieves all chat entries from the database, ordered by timestamp."""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    cursor.execute("SELECT user_message, bot_reply, timestamp FROM chats ORDER BY timestamp ASC")
    chats = cursor.fetchall()
    conn.close()
    print("All chats retrieved.")
    return chats

def delete_chat_by_index(index):
    """Deletes a single chat entry based on its index in the sorted list (not DB ID)."""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM chats ORDER BY timestamp ASC")
    ids = cursor.fetchall()

    if index < 0 or index >= len(ids):
        conn.close()
        raise IndexError("Invalid chat index")

    chat_id = ids[index][0]
    cursor.execute("DELETE FROM chats WHERE id = ?", (chat_id,))
    conn.commit()
    conn.close()
    print(f"Deleted chat at index {index} (id={chat_id}).")

def clear_all_chats():
    """Deletes all chat records from the database."""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM chats")
    conn.commit()
    conn.close()
    print("All chat history cleared.")

if __name__ == '__main__':
    init_db()
    # save_chat("Test question?", "Test answer.")
    # print(get_all_chats())
    # delete_chat_by_index(0)
    # clear_all_chats()
    # init_db()  # Uncomment to initialize the database
    # init_db()  # Uncomment to reinitialize the database