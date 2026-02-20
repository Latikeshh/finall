const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { initDB, getDB } = require('./db');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*', // For dev, allow all
        methods: ['GET', 'POST']
    }
});

app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_123';

const COLORS = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e', '#0ea5e9', '#3b82f6', '#6366f1', '#a855f7', '#d946ef', '#f43f5e'];

// Get user data from JWT
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// -- HTTP ROUTES --
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

    try {
        const db = getDB();
        const hashedPassword = await bcrypt.hash(password, 10);
        const color = COLORS[Math.floor(Math.random() * COLORS.length)];

        const result = await db.run(
            'INSERT INTO users (username, password, color) VALUES (?, ?, ?)',
            [username, hashedPassword, color]
        );
        res.json({ success: true, userId: result.lastID });
    } catch (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'Username already taken' });
        }
        res.status(500).json({ error: 'Database error' });
    }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const db = getDB();

    try {
        const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);
        if (!user) return res.status(400).json({ error: 'Invalid credentials' });

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return res.status(400).json({ error: 'Invalid credentials' });

        const token = jwt.sign({ id: user.id, username: user.username, color: user.color }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ token, user: { id: user.id, username: user.username, color: user.color } });
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

app.get('/api/channels', authenticateToken, async (req, res) => {
    const db = getDB();
    const channels = await db.all('SELECT * FROM channels WHERE is_direct = 0');
    res.json(channels);
});

// Socket auth middleware
io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication error'));

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return next(new Error('Authentication error'));
        socket.user = decoded;
        next();
    });
});

const onlineUsers = new Map(); // socket.id -> user info

io.on('connection', (socket) => {
    const user = socket.user;
    const db = getDB();

    onlineUsers.set(socket.id, user);

    // Update user status
    db.run('UPDATE users SET status = ? WHERE id = ?', ['online', user.id]).then(() => {
        io.emit('user_status_change', { userId: user.id, status: 'online' });
    });

    // Notify others
    socket.on('join_channel', async (channelId) => {
        socket.join(`channel_${channelId}`);
        // Fetch history
        const messages = await db.all(`
            SELECT m.*, u.username, u.color 
            FROM messages m 
            JOIN users u ON m.user_id = u.id 
            WHERE m.channel_id = ? 
            ORDER BY m.created_at ASC 
            LIMIT 50
        `, [channelId]);

        socket.emit('channel_history', { channelId, messages });
    });

    socket.on('leave_channel', (channelId) => {
        socket.leave(`channel_${channelId}`);
    });

    socket.on('send_message', async ({ channelId, content }) => {
        if (!content || !content.trim()) return;

        const result = await db.run(
            'INSERT INTO messages (channel_id, user_id, content) VALUES (?, ?, ?)',
            [channelId, user.id, content]
        );

        const newMsg = await db.get(`
            SELECT m.*, u.username, u.color 
            FROM messages m 
            JOIN users u ON m.user_id = u.id 
            WHERE m.id = ?
        `, [result.lastID]);

        io.to(`channel_${channelId}`).emit('new_message', newMsg);
    });

    socket.on('typing', ({ channelId, isTyping }) => {
        socket.to(`channel_${channelId}`).emit('user_typing', {
            userId: user.id,
            username: user.username,
            channelId,
            isTyping
        });
    });

    socket.on('disconnect', async () => {
        onlineUsers.delete(socket.id);

        // Check if user has other active sockets
        let isStillOnline = false;
        for (let [, u] of onlineUsers) {
            if (u.id === user.id) {
                isStillOnline = true;
                break;
            }
        }

        if (!isStillOnline) {
            await db.run('UPDATE users SET status = ? WHERE id = ?', ['offline', user.id]);
            io.emit('user_status_change', { userId: user.id, status: 'offline' });
        }
    });

    // Request active users
    socket.on('get_online_users', async () => {
        const users = await db.all('SELECT id, username, color, status FROM users');
        socket.emit('online_users_list', users);
    });
});

initDB().then(() => {
    const PORT = process.env.PORT || 3001;
    server.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}).catch(err => {
    console.error('Failed to initialize local DB:', err);
});
