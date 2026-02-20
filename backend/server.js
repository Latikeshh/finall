const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { initDB, getDB } = require('./db');
const path = require('path');

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
app.use(express.static(path.join(__dirname, '../frontend/dist')));

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
    const dms = await db.all('SELECT * FROM channels WHERE is_direct = 1 AND (name LIKE ? OR name LIKE ?)', [`dm_${req.user.id}_%`, `dm_%_${req.user.id}`]);
    const privateGroups = await db.all('SELECT c.* FROM channels c JOIN channel_members cm ON c.id = cm.channel_id WHERE c.is_direct = 2 AND cm.user_id = ?', [req.user.id]);
    res.json([...channels, ...dms, ...privateGroups]);
});

app.post('/api/channels', authenticateToken, async (req, res) => {
    const { name, members } = req.body;
    if (!name) return res.status(400).json({ error: 'Channel name required' });
    const db = getDB();
    const isPrivate = members && members.length > 0 ? 2 : 0;
    try {
        const result = await db.run('INSERT INTO channels (name, is_direct) VALUES (?, ?)', [name, isPrivate]);
        const newChannel = { id: result.lastID, name, is_direct: isPrivate };

        if (isPrivate) {
            await db.run('INSERT INTO channel_members (channel_id, user_id) VALUES (?, ?)', [newChannel.id, req.user.id]);
            for (let uid of members) {
                await db.run('INSERT INTO channel_members (channel_id, user_id) VALUES (?, ?)', [newChannel.id, uid]);
            }
            // Emit only to members could be done, but for hackathon just general emit
            io.emit('channel_created', newChannel);
        } else {
            io.emit('channel_created', newChannel);
        }

        res.json(newChannel);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

app.post('/api/dm', authenticateToken, async (req, res) => {
    const { targetUserId } = req.body;
    const db = getDB();
    if (!targetUserId) return res.status(400).json({ error: 'Target user ID required' });

    // Check if DM channel exists
    // DM channel name logic: "dm_smallID_largeID"
    const [u1, u2] = [req.user.id, targetUserId].sort((a, b) => a - b);
    const dmName = `dm_${u1}_${u2}`;

    try {
        let channel = await db.get('SELECT * FROM channels WHERE name = ? AND is_direct = 1', [dmName]);
        if (!channel) {
            const result = await db.run('INSERT INTO channels (name, is_direct) VALUES (?, ?)', [dmName, 1]);
            channel = { id: result.lastID, name: dmName, is_direct: 1 };
        }
        res.json(channel);
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

// Admin Routes
const isAdmin = (req, res, next) => {
    // For simplicity, user ID 1 is admin, or username 'admin'. We will check if username starts with admin
    if (req.user && req.user.username.toLowerCase().includes('admin')) {
        next();
    } else {
        res.status(403).json({ error: 'Admin access required' });
    }
};

app.get('/api/admin/stats', authenticateToken, isAdmin, async (req, res) => {
    const db = getDB();
    const usersCount = await db.get('SELECT COUNT(*) as c FROM users');
    const msgsCount = await db.get('SELECT COUNT(*) as c FROM messages');
    const chCount = await db.get('SELECT COUNT(*) as c FROM channels');
    res.json({ users: usersCount.c, messages: msgsCount.c, channels: chCount.c });
});

app.get('/api/admin/users', authenticateToken, isAdmin, async (req, res) => {
    const db = getDB();
    const users = await db.all('SELECT id, username, color, status FROM users');
    res.json(users);
});

app.delete('/api/admin/users/:id', authenticateToken, isAdmin, async (req, res) => {
    const db = getDB();
    await db.run('DELETE FROM messages WHERE user_id = ?', [req.params.id]);
    await db.run('DELETE FROM users WHERE id = ?', [req.params.id]);
    io.emit('user_deleted', { userId: parseInt(req.params.id) });
    res.json({ success: true });
});

app.get('/api/admin/channels', authenticateToken, isAdmin, async (req, res) => {
    const db = getDB();
    const channels = await db.all('SELECT * FROM channels');
    res.json(channels);
});

app.delete('/api/admin/channels/:id', authenticateToken, isAdmin, async (req, res) => {
    const db = getDB();
    await db.run('DELETE FROM messages WHERE channel_id = ?', [req.params.id]);
    await db.run('DELETE FROM channels WHERE id = ?', [req.params.id]);
    io.emit('channel_deleted', { channelId: parseInt(req.params.id) });
    res.json({ success: true });
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
        // Fetch history with replies
        const messages = await db.all(`
            SELECT m.*, u.username, u.color,
                   r.content AS reply_content, ru.username AS reply_username
            FROM messages m 
            JOIN users u ON m.user_id = u.id 
            LEFT JOIN messages r ON m.reply_to = r.id
            LEFT JOIN users ru ON r.user_id = ru.id
            WHERE m.channel_id = ? 
            ORDER BY m.created_at ASC 
            LIMIT 100
        `, [channelId]);

        socket.emit('channel_history', { channelId, messages });
    });

    socket.on('leave_channel', (channelId) => {
        socket.leave(`channel_${channelId}`);
    });

    socket.on('send_message', async ({ channelId, content, replyTo }) => {
        if (!content || !content.trim()) return;

        const result = await db.run(
            'INSERT INTO messages (channel_id, user_id, content, reply_to) VALUES (?, ?, ?, ?)',
            [channelId, user.id, content, replyTo || null]
        );

        const newMsg = await db.get(`
            SELECT m.*, u.username, u.color,
                   r.content AS reply_content, ru.username AS reply_username
            FROM messages m 
            JOIN users u ON m.user_id = u.id 
            LEFT JOIN messages r ON m.reply_to = r.id
            LEFT JOIN users ru ON r.user_id = ru.id
            WHERE m.id = ?
        `, [result.lastID]);

        io.to(`channel_${channelId}`).emit('new_message', newMsg);
    });

    socket.on('edit_message', async ({ messageId, channelId, content }) => {
        if (!content || !content.trim()) return;
        await db.run('UPDATE messages SET content = ?, is_edited = 1 WHERE id = ? AND user_id = ?', [content, messageId, user.id]);
        io.to(`channel_${channelId}`).emit('message_edited', { messageId, content });
    });

    socket.on('delete_message', async ({ messageId, channelId }) => {
        // Soft delete text
        await db.run('UPDATE messages SET content = ?, is_deleted = 1 WHERE id = ?', ["🚫 This message was deleted", messageId]);
        io.to(`channel_${channelId}`).emit('message_deleted', { messageId, content: "🚫 This message was deleted" });
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

// Fallback for React Router
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

initDB().then(() => {
    const PORT = process.env.PORT || 3001;
    server.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}).catch(err => {
    console.error('Failed to initialize local DB:', err);
});
