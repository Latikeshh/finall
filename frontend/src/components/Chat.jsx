import React, { useEffect, useState, useRef } from 'react';
import { useSocket } from '../contexts/SocketContext';
import styles from './Chat.module.css';
import { format } from 'date-fns';
import { FiSend, FiHash, FiLogOut } from 'react-icons/fi';

export default function Chat() {
    const { socket, user, logout } = useSocket();
    const [channels, setChannels] = useState([]);
    const [activeChannel, setActiveChannel] = useState(null);
    const [messages, setMessages] = useState([]);
    const [inputStr, setInputStr] = useState('');
    const [onlineUsers, setOnlineUsers] = useState([]);
    const [typingUsers, setTypingUsers] = useState(new Set());
    const messagesEndRef = useRef(null);
    const typingTimeoutRef = useRef(null);

    // Initial setup
    useEffect(() => {
        if (!socket) return;

        // Fetch channels
        fetch('http://localhost:3001/api/channels', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        })
            .then(res => res.json())
            .then(data => {
                setChannels(data);
                if (data.length > 0) {
                    setActiveChannel(data[0]);
                }
            });

        // Socket events
        socket.emit('get_online_users');

        socket.on('online_users_list', (users) => {
            setOnlineUsers(users);
        });

        socket.on('user_status_change', ({ userId, status }) => {
            setOnlineUsers(prev => prev.map(u => u.id === userId ? { ...u, status } : u));
        });

        return () => {
            socket.off('online_users_list');
            socket.off('user_status_change');
        };
    }, [socket]);

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

    const handleSend = (e) => {
        e?.preventDefault();
        if (!inputStr.trim() || !activeChannel) return;

        socket.emit('send_message', {
            channelId: activeChannel.id,
            content: inputStr,
        });

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

    const renderAvatar = (name, color) => {
        const initial = name ? name.charAt(0).toUpperCase() : '?';
        return (
            <div className={styles.avatar} style={{ backgroundColor: color || '#3b82f6' }}>
                {initial}
            </div>
        );
    };

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
                    <div className={styles.sectionTitle}>Channels</div>
                    {channels.map(ch => (
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

                <div className={styles.sidebarSection} style={{ marginTop: '2rem', flex: 1 }}>
                    <div className={styles.sectionTitle}>Direct Messages / Users</div>
                    <div style={{ overflowY: 'auto' }}>
                        {onlineUsers.filter(u => u.id !== user?.id).map(u => (
                            <div key={u.id} className={styles.userItem}>
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
                    <button className={styles.logoutBtn} onClick={logout} title="Logout">
                        <FiLogOut />
                    </button>
                </div>
            </div>

            {/* Main Chat */}
            <div className={styles.mainArea}>
                {activeChannel && (
                    <>
                        <div className={styles.chatHeader}>
                            <div className={styles.chatHeaderTitle}>
                                <FiHash style={{ color: 'var(--text-tertiary)' }} />
                                {activeChannel.name}
                            </div>
                        </div>

                        <div className={styles.chatMessages}>
                            {messages.map((m, i) => {
                                const showAvatar = i === 0 || messages[i - 1].user_id !== m.user_id;
                                return (
                                    <div key={m.id} className={styles.messageInfo} style={{ marginTop: showAvatar ? '0.5rem' : '-1rem' }}>
                                        {showAvatar ? renderAvatar(m.username, m.color) : <div style={{ width: 36, flexShrink: 0 }}></div>}
                                        <div className={styles.messageContent}>
                                            {showAvatar && (
                                                <div className={styles.messageHeader}>
                                                    <span className={styles.messageAuthor} style={{ color: m.color || 'var(--text-primary)' }}>{m.username}</span>
                                                    <span className={styles.messageTime}>{format(new Date(m.created_at), 'HH:mm')}</span>
                                                </div>
                                            )}
                                            <div className={styles.messageText}>{m.content}</div>
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
                                <input
                                    type="text"
                                    className={styles.messageInput}
                                    placeholder={`Message #${activeChannel.name}`}
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
