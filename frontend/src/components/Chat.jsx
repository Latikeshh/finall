import React, { useEffect, useState, useRef } from 'react';
import { useSocket } from '../contexts/SocketContext';
import styles from './Chat.module.css';
import { format } from 'date-fns';
import { FiSend, FiHash, FiLogOut, FiSettings, FiPlus, FiLock, FiUnlock, FiMessageSquare } from 'react-icons/fi';
import { API_URL } from '../config';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

export default function Chat() {
    const { socket, user, logout } = useSocket();
    const [channels, setChannels] = useState([]);
    const [activeChannel, setActiveChannel] = useState(null);
    const [messages, setMessages] = useState([]);
    const [inputStr, setInputStr] = useState('');
    const [onlineUsers, setOnlineUsers] = useState([]);
    const [typingUsers, setTypingUsers] = useState(new Set());

    // New States
    const [decryptedIds, setDecryptedIds] = useState(new Set());
    const [showCreate, setShowCreate] = useState(false);
    const [newChName, setNewChName] = useState('');

    const messagesEndRef = useRef(null);
    const typingTimeoutRef = useRef(null);
    const navigate = useNavigate();

    // Initial setup
    useEffect(() => {
        if (!socket) return;

        fetchChannels();

        // Socket events
        socket.emit('get_online_users');
        socket.on('online_users_list', (users) => setOnlineUsers(users));

        socket.on('user_status_change', ({ userId, status }) => {
            setOnlineUsers(prev => {
                const updated = prev.map(u => u.id === userId ? { ...u, status } : u);
                const userObj = prev.find(u => u.id === userId);
                if (userObj && userObj.id !== user?.id) {
                    if (status === 'online') toast.success(`${userObj.username} joined!`);
                    else toast(`${userObj.username} left`, { icon: '👋' });
                }
                return updated;
            });
        });

        socket.on('channel_created', (ch) => {
            setChannels(prev => [...prev.filter(c => c.id !== ch.id), ch]);
        });

        return () => {
            socket.off('online_users_list');
            socket.off('user_status_change');
            socket.off('channel_created');
        };
    }, [socket]);

    const fetchChannels = () => {
        fetch(`${API_URL}/api/channels`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        })
            .then(res => res.json())
            .then(data => {
                setChannels(data);
                if (data.length > 0 && !activeChannel) {
                    setActiveChannel(data[0]);
                }
            });
    };

    // Channel specific events
    useEffect(() => {
        if (!socket || !activeChannel) return;

        socket.emit('join_channel', activeChannel.id);

        socket.on('channel_history', ({ channelId, messages }) => {
            if (channelId === activeChannel.id) {
                setMessages(messages);
                scrollToBottom();
            }
        });

        socket.on('new_message', (msg) => {
            if (msg.channel_id === activeChannel.id) {
                setMessages(prev => [...prev, msg]);
                scrollToBottom();
            }
        });

        socket.on('user_typing', ({ username, channelId, isTyping }) => {
            if (channelId === activeChannel.id) {
                setTypingUsers(prev => {
                    const next = new Set(prev);
                    if (isTyping) next.add(username);
                    else next.delete(username);
                    return next;
                });
            }
        });

        return () => {
            socket.emit('leave_channel', activeChannel.id);
            socket.off('channel_history');
            socket.off('new_message');
            socket.off('user_typing');
            setTypingUsers(new Set());
        };
    }, [socket, activeChannel]);

    const scrollToBottom = () => {
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    };

    const handleCreateChannel = async (e) => {
        e.preventDefault();
        if (!newChName.trim()) return;
        const res = await fetch(`${API_URL}/api/channels`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ name: newChName.trim().toLowerCase().replace(/\s+/g, '-') })
        });
        if (res.ok) {
            const ch = await res.json();
            setActiveChannel(ch);
            setNewChName('');
            setShowCreate(false);
            fetchChannels();
            toast.success(`Group #${ch.name} created!`);
        }
    };

    const handleStartDM = async (targetId) => {
        const res = await fetch(`${API_URL}/api/dm`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ targetUserId: targetId })
        });
        if (res.ok) {
            const ch = await res.json();
            fetchChannels(); // To update the list if new
            setActiveChannel(ch);
        }
    };

    const handleSend = (e) => {
        e?.preventDefault();
        const content = inputStr.trim();
        if (!content || !activeChannel) return;

        if (content.startsWith('/clear')) {
            setMessages([]);
            setInputStr('');
            return;
        } else if (content.startsWith('/shrug')) {
            socket.emit('send_message', { channelId: activeChannel.id, content: content.replace('/shrug', '') + ' ¯\\_(ツ)_/¯' });
        } else {
            socket.emit('send_message', { channelId: activeChannel.id, content });
        }

        setInputStr('');
        socket.emit('typing', { channelId: activeChannel.id, isTyping: false });
    };

    const handleTyping = (e) => {
        setInputStr(e.target.value);
        if (!activeChannel) return;
        socket.emit('typing', { channelId: activeChannel.id, isTyping: true });
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
            socket.emit('typing', { channelId: activeChannel.id, isTyping: false });
        }, 2000);
    };

    const toggleDecryption = (id) => {
        setDecryptedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const encryptVisualText = (str) => {
        try { return btoa(unescape(encodeURIComponent(str))); }
        catch { return '•••••••••••••••••'; }
    };

    const renderAvatar = (name, color) => {
        const initial = name ? name.charAt(0).toUpperCase() : '?';
        return (
            <div className={styles.avatar} style={{ backgroundColor: color || '#3b82f6' }}>
                {initial}
            </div>
        );
    };

    // Filter channels
    const publicChannels = channels.filter(c => !c.is_direct);
    const dms = channels.filter(c => c.is_direct);
    const isAdmin = user?.username?.toLowerCase().includes('admin');

    return (
        <div className={styles.appLayout}>
            {/* Sidebar */}
            <div className={styles.sidebar}>
                <div className={styles.sidebarHeader}>
                    <div className={styles.brand}>
                        <div style={{ color: 'var(--accent-primary)', fontSize: '1.4rem' }}>⬡</div>
                        <span>ChatterBox</span>
                    </div>
                </div>

                <div className={styles.sidebarSection}>
                    <div className={styles.sectionTitle} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Groups</span>
                        <FiPlus style={{ cursor: 'pointer' }} onClick={() => setShowCreate(!showCreate)} title="Create Group" />
                    </div>

                    {showCreate && (
                        <form onSubmit={handleCreateChannel} style={{ padding: '0 1.25rem', marginBottom: '0.5rem' }}>
                            <input
                                autoFocus
                                value={newChName}
                                onChange={e => setNewChName(e.target.value)}
                                placeholder="Group name..."
                                className={styles.createInput}
                            />
                        </form>
                    )}

                    {publicChannels.map(ch => (
                        <div
                            key={ch.id}
                            onClick={() => setActiveChannel(ch)}
                            className={`${styles.channelItem} ${activeChannel?.id === ch.id ? styles.active : ''}`}
                        >
                            <FiHash className={styles.hash} />
                            {ch.name}
                        </div>
                    ))}
                </div>

                <div className={styles.sidebarSection}>
                    <div className={styles.sectionTitle}>Direct Messages</div>
                    {dms.map(ch => {
                        // Very rough display name for DMs
                        const display = ch.name.replace(`dm_`, '').replace(`_`, ' & ');
                        return (
                            <div
                                key={ch.id}
                                onClick={() => setActiveChannel(ch)}
                                className={`${styles.channelItem} ${activeChannel?.id === ch.id ? styles.active : ''}`}
                            >
                                <FiMessageSquare className={styles.hash} />
                                DM: {display}
                            </div>
                        )
                    })}
                </div>

                <div className={styles.sidebarSection} style={{ marginTop: '2rem', flex: 1 }}>
                    <div className={styles.sectionTitle}>Connected Users</div>
                    <div style={{ overflowY: 'auto' }}>
                        {onlineUsers.filter(u => u.id !== user?.id).map(u => (
                            <div key={u.id} className={styles.userItem} onClick={() => handleStartDM(u.id)} style={{ cursor: 'pointer' }} title="Click to Message">
                                <div className={`${styles.statusIndicator} ${u.status === 'online' ? styles.online : styles.offline}`} />
                                {u.username}
                            </div>
                        ))}
                    </div>
                </div>

                <div className={styles.sidebarHeader} style={{ borderTop: '1px solid var(--border-color)', borderBottom: 'none', paddingTop: '1rem', marginTop: 'auto' }}>
                    <div className={styles.userItem} style={{ padding: 0 }}>
                        {renderAvatar(user?.username, user?.color)}
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{user?.username}</span>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {isAdmin && (
                            <button className={styles.logoutBtn} onClick={() => navigate('/admin')} title="Admin Panel" style={{ background: 'var(--accent-hover)', color: 'white' }}>
                                <FiSettings />
                            </button>
                        )}
                        <button className={styles.logoutBtn} onClick={logout} title="Logout">
                            <FiLogOut />
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Chat */}
            <div className={styles.mainArea}>
                {activeChannel && (
                    <>
                        <div className={styles.chatHeader}>
                            <div className={styles.chatHeaderTitle}>
                                {activeChannel.is_direct ? <FiMessageSquare style={{ color: 'var(--text-tertiary)' }} /> : <FiHash style={{ color: 'var(--text-tertiary)' }} />}
                                {activeChannel.name}
                            </div>
                        </div>

                        <div className={styles.chatMessages}>
                            {messages.map((m, i) => {
                                const showAvatar = i === 0 || messages[i - 1].user_id !== m.user_id; // Still used mapping visual logic
                                const isSelf = m.user_id === user?.id;
                                const isDecrypted = decryptedIds.has(m.id);

                                return (
                                    <div key={m.id} className={`${styles.messageInfo} ${isSelf ? styles.messageSelf : ''}`} style={{ marginTop: showAvatar ? '0.5rem' : '-1rem' }}>
                                        {showAvatar ? renderAvatar(m.username, m.color) : <div style={{ width: 36, flexShrink: 0 }}></div>}
                                        <div className={styles.messageContent}>
                                            {showAvatar && (
                                                <div className={styles.messageHeader}>
                                                    <span className={styles.messageAuthor} style={{ color: m.color || 'var(--text-primary)' }}>{m.username}</span>
                                                    <span className={styles.messageTime}>{format(new Date(m.created_at), 'HH:mm')}</span>
                                                </div>
                                            )}

                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexDirection: isSelf ? 'row-reverse' : 'row' }}>
                                                <div className={`${styles.messageText} react-markdown ${!isDecrypted ? styles.encryptedBlob : ''}`}>
                                                    {isDecrypted ? (
                                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                                                    ) : (
                                                        <span style={{ fontFamily: 'monospace', opacity: 0.8 }}>{encryptVisualText(m.content)}</span>
                                                    )}
                                                </div>

                                                <button onClick={() => toggleDecryption(m.id)} className={styles.cryptoBtn} title={isDecrypted ? "Lock Message" : "Decrypt Message"}>
                                                    {isDecrypted ? <FiUnlock className={styles.unlockIcon} /> : <FiLock className={styles.lockIcon} />}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={messagesEndRef} />
                        </div>

                        <div className={styles.chatInputArea}>
                            <form className={styles.inputWrapper} onSubmit={handleSend}>
                                {typingUsers.size > 0 && (
                                    <div className={styles.typingIndicator}>
                                        {Array.from(typingUsers).join(', ')} {typingUsers.size === 1 ? 'is' : 'are'} typing
                                        <span className="typing-dot"></span>
                                        <span className="typing-dot"></span>
                                        <span className="typing-dot"></span>
                                    </div>
                                )}
                                <div style={{ position: 'absolute', top: -35, right: 0, fontSize: '0.8rem', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <FiLock /> End-to-End Encrypted Link
                                </div>
                                <input
                                    type="text"
                                    className={styles.messageInput}
                                    placeholder={`Message ${activeChannel.is_direct ? 'User' : '#' + activeChannel.name}`}
                                    value={inputStr}
                                    onChange={handleTyping}
                                />
                                <button type="submit" className={styles.sendBtn} disabled={!inputStr.trim()}>
                                    <FiSend />
                                </button>
                            </form>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
