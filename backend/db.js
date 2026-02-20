const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');

let db;

async function initDB() {
    db = await open({
        filename: path.join(__dirname, 'chat.db'),
        driver: sqlite3.Database
    });

    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            password TEXT,
            color TEXT,
            status TEXT DEFAULT 'offline'
        );

        CREATE TABLE IF NOT EXISTS channels (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            is_direct BOOLEAN DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS channel_members (
            channel_id INTEGER,
            user_id INTEGER,
            last_read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (channel_id, user_id),
            FOREIGN KEY (channel_id) REFERENCES channels (id),
            FOREIGN KEY (user_id) REFERENCES users (id)
        );

        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            channel_id INTEGER,
            user_id INTEGER,
            content TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (channel_id) REFERENCES channels (id),
            FOREIGN KEY (user_id) REFERENCES users (id)
        );
    `);

    // Ensure there's a default general channel
    const general = await db.get('SELECT * FROM channels WHERE name = ?', ['general']);
    if (!general) {
        await db.run('INSERT INTO channels (name, is_direct) VALUES (?, ?)', ['general', 0]);
    }

    return db;
}

function getDB() {
    return db;
}

module.exports = { initDB, getDB };
