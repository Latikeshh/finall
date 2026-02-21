import React, { useEffect, useState, useRef } from 'react';
import { useSocket } from '../contexts/SocketContext';
import styles from './Chat.module.css';
import { format } from 'date-fns';
import { FiSend, FiHash, FiLogOut, FiSettings, FiPlus, FiLock, FiUnlock, FiMessageSquare, FiEdit2, FiTrash2, FiCornerUpLeft, FiX, FiCheck, FiPaperclip, FiSmile, FiDroplet } from 'react-icons/fi';
import { API_URL } from '../config';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import EmojiPicker from 'emoji-picker-react';

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
    const [selectedGroupUsers, setSelectedGroupUsers] = useState(new Set());
    const [replyTo, setReplyTo] = useState(null);
    const [editMsg, setEditMsg] = useState(null);
    const [profileCard, setProfileCard] = useState(null);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [blockedUsers, setBlockedUsers] = useState(new Set());
    const [showThemeModal, setShowThemeModal] = useState(false);
    const [currentTheme, setCurrentTheme] = useState(localStorage.getItem('theme') || 'dark');
    const fileInputRef = useRef(null);

    const messagesEndRef = useRef(null);
    const typingTimeoutRef = useRef(null);
    const navigate = useNavigate();

    const themes = [
        { id: 'dark', name: 'Dark', bg: '#0f111a', accent: '#6366f1' },
        { id: 'light', name: 'Light', bg: '#f8fafc', accent: '#3b82f6' },
        { id: 'cyberpunk', name: 'Cyberpunk', bg: '#000000', accent: '#ff003c' },
        { id: 'ocean', name: 'Ocean', bg: '#020617', accent: '#0ea5e9' },
        { id: 'sunset', name: 'Sunset', bg: '#2e0219', accent: '#e11d48' }
    ];

    const changeTheme = (themeId) => {
        setCurrentTheme(themeId);
        localStorage.setItem('theme', themeId);
        document.documentElement.setAttribute('data-theme', themeId);
        setShowThemeModal(false);
    };

    // Initial setup
    useEffect(() => {
        if (!socket) return;

        fetchChannels();

        // Socket events
        socket.emit('get_online_users');
        socket.on('online_users_list', (users) => setOnlineUsers(users));
        socket.on('blocked_users_list', (blockedIds) => setBlockedUsers(new Set(blockedIds)));

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

        socket.on('message_edited', ({ messageId, content }) => {
            setMessages(prev => prev.map(m => m.id === messageId ? { ...m, content, is_edited: 1 } : m));
        });

        socket.on('message_deleted', ({ messageId, content }) => {
            setMessages(prev => prev.map(m => m.id === messageId ? { ...m, content, is_deleted: 1 } : m));
        });

        return () => {
            socket.emit('leave_channel', activeChannel.id);
            socket.off('channel_history');
            socket.off('new_message');
            socket.off('user_typing');
            socket.off('message_edited');
            socket.off('message_deleted');
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
            body: JSON.stringify({
                name: newChName.trim().toLowerCase().replace(/\s+/g, '-'),
                members: Array.from(selectedGroupUsers)
            })
        });

        if (res.ok) {
            const ch = await res.json();
            setActiveChannel(ch);
            setNewChName('');
            setSelectedGroupUsers(new Set());
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
        }

        if (editMsg) {
            socket.emit('edit_message', { messageId: editMsg.id, channelId: activeChannel.id, content });
            setEditMsg(null);
        } else {
            let finalContent = content;
            if (content.startsWith('/shrug')) {
                finalContent = content.replace('/shrug', '') + ' ¯\\_(ツ)_/¯';
            }
            socket.emit('send_message', { channelId: activeChannel.id, content: finalContent, replyTo: replyTo ? replyTo.id : null });
            setReplyTo(null);
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

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 3 * 1024 * 1024) return toast.error("File size limits to 3MB");

        const reader = new FileReader();
        reader.onload = (ev) => {
            const base64 = ev.target.result;
            const content = `[ATTACHMENT:${file.name}:${base64}]`;
            socket.emit('send_message', { channelId: activeChannel.id, content, replyTo: replyTo ? replyTo.id : null });
            setReplyTo(null);
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    const renderMessageContent = (msgContent) => {
        if (msgContent.startsWith('[ATTACHMENT:')) {
            const match = msgContent.match(/^\[ATTACHMENT:(.+?):(.+)\]$/);
            if (match) {
                const fileName = match[1];
                const dataUrl = match[2];
                const isImg = dataUrl.startsWith('data:image/');
                if (isImg) {
                    return <img src={dataUrl} alt={fileName} style={{ maxWidth: '300px', maxHeight: '300px', borderRadius: '8px', cursor: 'pointer', border: '1px solid var(--border-color)' }} onClick={() => window.open(dataUrl)} />;
                } else {
                    return <a href={dataUrl} download={fileName} style={{ color: 'var(--accent-primary)', textDecoration: 'underline', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><FiPaperclip /> Download {fileName}</a>;
                }
            }
        }
        return <ReactMarkdown remarkPlugins={[remarkGfm]}>{msgContent}</ReactMarkdown>;
    };

    const handleAvatarClick = (e, m) => {
        e.stopPropagation();
        const online = onlineUsers.find(u => u.username === m.username);
        setProfileCard({
            user: { id: m.user_id, username: m.username, color: m.color, avatar: m.avatar },
            status: online ? online.status : 'offline',
            x: e.clientX,
            y: e.clientY
        });
    };

    const renderAvatar = (name, color, avatarStr, msgObj = null) => {
        const display = avatarStr && String(avatarStr).length > 0 && String(avatarStr) !== "1" ? avatarStr : (name ? name.charAt(0).toUpperCase() : '?');
        return (
            <div
                className={`${styles.avatar} ${msgObj ? styles.clickableAvatar : ''}`}
                style={{ backgroundColor: color || '#3b82f6', fontSize: display.match(/\p{Emoji}/u) ? '1.2rem' : '1rem' }}
                onClick={(e) => msgObj && handleAvatarClick(e, msgObj)}
            >
                {display}
            </div>
        );
    };

    // Filter channels
    const publicChannels = channels.filter(c => c.is_direct === 0 || c.is_direct === 2);
    const dms = channels.filter(c => c.is_direct === 1);
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
                        <FiPlus style={{ cursor: 'pointer' }} onClick={() => setShowCreate(true)} title="Create Group" />
                    </div>

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
                        // Extract target user ID from dm_smallID_largeID
                        const ids = ch.name.replace('dm_', '').split('_');
                        const targetId = ids.find(id => id !== String(user?.id));
                        const targetUserObj = Array.from(onlineUsers).find(u => String(u.id) === targetId);
                        const display = targetUserObj ? targetUserObj.username : ch.name.replace('dm_', '').replace('_', ' & ');

                        return (
                            <div
                                key={ch.id}
                                onClick={() => setActiveChannel(ch)}
                                className={`${styles.channelItem} ${activeChannel?.id === ch.id ? styles.active : ''}`}
                            >
                                <FiMessageSquare className={styles.hash} />
                                {display}
                            </div>
                        )
                    })}
                </div>

                <div className={styles.sidebarSection} style={{ marginTop: '2rem', flex: 1 }}>
                    <div className={styles.sectionTitle}>Connected Users</div>
                    <div style={{ overflowY: 'auto' }}>
                        {onlineUsers.filter(u => u.id !== user?.id).map(u => {
                            const isBlocked = blockedUsers.has(u.id);
                            return (
                                <div
                                    key={u.id}
                                    className={styles.userItem}
                                    onClick={(e) => {
                                        setProfileCard({
                                            user: u,
                                            status: u.status,
                                            x: e.clientX,
                                            y: e.clientY
                                        });
                                    }}
                                    style={{ cursor: 'pointer', opacity: isBlocked ? 0.5 : 1 }}
                                    title={isBlocked ? "Blocked - Click to Unblock" : "View Profile"}
                                >
                                    <div className={`${styles.statusIndicator} ${u.status === 'online' ? styles.online : styles.offline}`} />
                                    <span style={{ textDecoration: isBlocked ? 'line-through' : 'none' }}>{u.username}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className={styles.sidebarHeader} style={{ borderTop: '1px solid var(--border-color)', borderBottom: 'none', paddingTop: '1rem', marginTop: 'auto' }}>
                    <div className={styles.userItem} style={{ padding: 0 }}>
                        {renderAvatar(user?.username, user?.color, user?.avatar)}
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{user?.username}</span>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className={styles.logoutBtn} onClick={() => setShowThemeModal(true)} title="Change Theme" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>
                            <FiDroplet />
                        </button>
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
                        {(() => {
                            const dmTargetId = activeChannel.is_direct === 1 ? parseInt(activeChannel.name.replace('dm_', '').split('_').find(id => id !== String(user?.id))) : null;
                            const isCurrentDMBlocked = dmTargetId && blockedUsers.has(dmTargetId);
                            return (
                                <>
                                    <div className={styles.chatHeader}>
                                        <div className={styles.chatHeaderTitle}>
                                            {activeChannel.is_direct ? <FiMessageSquare style={{ color: 'var(--text-tertiary)' }} /> : <FiHash style={{ color: 'var(--text-tertiary)' }} />}
                                            {activeChannel.name}
                                        </div>
                                    </div>

                                    <div className={styles.chatMessages}>
                                        {messages.filter(m => !blockedUsers.has(m.user_id)).map((m, i, arr) => {
                                            const showAvatar = i === 0 || arr[i - 1].user_id !== m.user_id; // Still used mapping visual logic
                                            const isSelf = m.user_id === user?.id;
                                            const isDecrypted = decryptedIds.has(m.id) || m.content.startsWith('[attached_file:');

                                            return (
                                                <div key={m.id} className={`${styles.messageInfo} ${isSelf ? styles.messageSelf : ''}`} style={{ marginTop: showAvatar ? '0.5rem' : '-1rem' }}>
                                                    {showAvatar ? renderAvatar(m.username, m.color, m.avatar, m) : <div style={{ width: 36, flexShrink: 0 }}></div>}
                                                    <div className={styles.messageContent}>
                                                        {showAvatar && (
                                                            <div className={styles.messageHeader}>
                                                                <span className={styles.messageAuthor} onClick={(e) => handleAvatarClick(e, m)} style={{ color: m.color || 'var(--text-primary)', cursor: 'pointer' }}>{m.username}</span>
                                                                <span className={styles.messageTime}>{format(new Date(m.created_at), 'HH:mm')}</span>
                                                            </div>
                                                        )}

                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexDirection: isSelf ? 'row-reverse' : 'row' }}>
                                                            <div className={`${styles.messageText} react-markdown ${!isDecrypted ? styles.encryptedBlob : ''}`}>
                                                                {m.reply_to && isDecrypted && (
                                                                    <div className={styles.replyQuote}>
                                                                        <div className={styles.replyUser}>{m.reply_username}</div>
                                                                        <div className={styles.replyText}>{m.reply_content?.substring(0, 40)}{m.reply_content?.length > 40 ? '...' : ''}</div>
                                                                    </div>
                                                                )}
                                                                {isDecrypted ? (
                                                                    renderMessageContent(m.content)
                                                                ) : (
                                                                    <span style={{ fontFamily: 'monospace', opacity: 0.8 }}>{encryptVisualText(m.content)}</span>
                                                                )}
                                                                {m.is_edited === 1 && <div style={{ fontSize: '0.7rem', opacity: 0.6, marginTop: '2px', textAlign: isSelf ? 'right' : 'left' }}>(edited)</div>}
                                                            </div>

                                                            <div className={styles.msgActions}>
                                                                {!m.content.startsWith('[attached_file:') && (
                                                                    <button onClick={() => toggleDecryption(m.id)} className={styles.actionBtn} title={isDecrypted ? "Lock Message" : "Decrypt Message"}>
                                                                        {isDecrypted ? <FiUnlock className={styles.unlockIcon} /> : <FiLock className={styles.lockIcon} />}
                                                                    </button>
                                                                )}
                                                                {isDecrypted && (
                                                                    <>
                                                                        <button onClick={() => setReplyTo(m)} className={styles.actionBtn} title="Reply"><FiCornerUpLeft /></button>
                                                                        {isSelf && m.is_deleted === 0 && (
                                                                            <>
                                                                                <button onClick={() => { setEditMsg(m); setInputStr(m.content); setReplyTo(null); }} className={styles.actionBtn} title="Edit"><FiEdit2 /></button>
                                                                                <button onClick={() => socket.emit('delete_message', { messageId: m.id, channelId: activeChannel.id })} className={styles.actionBtn} title="Delete"><FiTrash2 /></button>
                                                                            </>
                                                                        )}
                                                                        {isAdmin && !isSelf && m.is_deleted === 0 && (
                                                                            <button onClick={() => socket.emit('delete_message', { messageId: m.id, channelId: activeChannel.id })} className={styles.actionBtn} title="Admin Delete"><FiTrash2 /></button>
                                                                        )}
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        <div ref={messagesEndRef} />
                                    </div>

                                    <div className={styles.chatInputArea}>
                                        {(replyTo || editMsg) && (
                                            <div className={styles.activeActionBanner}>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontWeight: 600, color: 'var(--accent-primary)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                        {replyTo ? <FiCornerUpLeft /> : <FiEdit2 />}
                                                        {replyTo ? `Replying to ${replyTo.username}` : `Editing Message`}
                                                    </div>
                                                    <div style={{ fontSize: '0.8rem', opacity: 0.8, marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        {replyTo ? replyTo.content : editMsg.content}
                                                    </div>
                                                </div>
                                                <button type="button" onClick={() => { setReplyTo(null); setEditMsg(null); setInputStr(''); }} className={styles.closeActionBtn}>
                                                    <FiX />
                                                </button>
                                            </div>
                                        )}
                                        {isCurrentDMBlocked ? (
                                            <div style={{ padding: '1.25rem', textAlign: 'center', background: 'var(--bg-tertiary)', borderRadius: '12px', color: 'var(--text-tertiary)', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.8rem' }}>
                                                <span style={{ fontSize: '1.5rem' }}>🚷</span>
                                                <span>You have blocked this user. Unblock them from their profile card to resume sending messages.</span>
                                            </div>
                                        ) : (
                                            <form className={`${styles.inputWrapper} ${(replyTo || editMsg) ? styles.inputWrapperActive : ''}`} onSubmit={handleSend}>
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
                                                <input
                                                    type="file"
                                                    ref={fileInputRef}
                                                    style={{ display: 'none' }}
                                                    onChange={handleFileChange}
                                                />
                                                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                                    <button type="button" onClick={() => setShowEmojiPicker(!showEmojiPicker)} className={styles.attachBtn} title="Add Emoji">
                                                        <FiSmile />
                                                    </button>
                                                    {showEmojiPicker && (
                                                        <div style={{ position: 'absolute', bottom: '100%', right: 0, marginBottom: '10px', zIndex: 50 }}>
                                                            <EmojiPicker
                                                                onEmojiClick={(e) => {
                                                                    setInputStr(prev => prev + e.emoji);
                                                                    setShowEmojiPicker(false);
                                                                }}
                                                                theme="dark"
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                                <button type="button" onClick={() => fileInputRef.current?.click()} className={styles.attachBtn} title="Attach File">
                                                    <FiPaperclip />
                                                </button>
                                                <button type="submit" className={styles.sendBtn} disabled={!inputStr.trim()}>
                                                    <FiSend />
                                                </button>
                                            </form>
                                        )}
                                    </div>
                                </>
                            );
                        })()}
                    </>
                )}
            </div>

            {profileCard && (
                <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setProfileCard(null)} />
                    <div style={{
                        position: 'fixed',
                        left: Math.min(profileCard.x, window.innerWidth - 220),
                        top: Math.min(profileCard.y, window.innerHeight - 250),
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '12px',
                        padding: '1.5rem',
                        zIndex: 50,
                        boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '1rem',
                        width: '200px'
                    }}>
                        <div style={{ width: 64, height: 64, borderRadius: '50%', background: profileCard.user.color || '#3b82f6', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', fontWeight: 600 }}>
                            {profileCard.user.username.charAt(0).toUpperCase()}
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-primary)' }}>{profileCard.user.username}</div>
                            <div style={{ color: profileCard.status === 'online' ? '#22c55e' : '#64748b', fontSize: '0.85rem', marginTop: '4px' }}>● {profileCard.status}</div>
                        </div>
                        {profileCard.user.id !== user?.id && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
                                {!blockedUsers.has(profileCard.user.id) && (
                                    <button onClick={() => { handleStartDM(profileCard.user.id); setProfileCard(null); }} className={styles.profileDmBtn}>
                                        <FiMessageSquare /> Send Message
                                    </button>
                                )}
                                <button
                                    onClick={() => {
                                        if (blockedUsers.has(profileCard.user.id)) {
                                            socket.emit('unblock_user', profileCard.user.id);
                                        } else {
                                            socket.emit('block_user', profileCard.user.id);
                                        }
                                        setProfileCard(null);
                                    }}
                                    style={{
                                        background: blockedUsers.has(profileCard.user.id) ? 'var(--bg-tertiary)' : 'rgba(239, 68, 68, 0.1)',
                                        color: blockedUsers.has(profileCard.user.id) ? 'var(--text-primary)' : '#ef4444',
                                        border: '1px solid currentColor',
                                        padding: '0.65rem 1rem',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        fontWeight: 600,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '0.5rem',
                                        transition: 'all 0.2s',
                                        width: '100%'
                                    }}
                                >
                                    {blockedUsers.has(profileCard.user.id) ? <>Unblock User</> : <><FiX /> Block User</>}
                                </button>
                            </div>
                        )}
                    </div>
                </>
            )}

            {showCreate && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalBox}>
                        <h3 style={{ marginTop: 0, marginBottom: '1.5rem', color: 'var(--text-primary)' }}>Create New Group</h3>
                        <input
                            autoFocus
                            value={newChName}
                            onChange={e => setNewChName(e.target.value)}
                            placeholder="Group name (e.g. hackathon)"
                            className={styles.createInput}
                        />
                        <div style={{ marginTop: '1.5rem', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase' }}>Add Members</div>
                        <div className={styles.userSelectScroll}>
                            {onlineUsers.filter(u => u.id !== user?.id).map(u => (
                                <label key={u.id} className={styles.userCheckItem}>
                                    <input type="checkbox" checked={selectedGroupUsers.has(u.id)} onChange={(e) => {
                                        const next = new Set(selectedGroupUsers);
                                        if (e.target.checked) next.add(u.id); else next.delete(u.id);
                                        setSelectedGroupUsers(next);
                                    }} className={styles.userCheckbox} />
                                    <span>{u.username}</span>
                                </label>
                            ))}
                            {onlineUsers.length <= 1 && <div style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>No other users online.</div>}
                        </div>
                        <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                            <button className={styles.cancelBtn} onClick={() => { setShowCreate(false); setSelectedGroupUsers(new Set()); setNewChName(''); }}>Cancel</button>
                            <button className={styles.confirmBtn} onClick={handleCreateChannel}>Create Group</button>
                        </div>
                    </div>
                </div>
            )}
            {showThemeModal && (
                <div className={styles.modalOverlay} onClick={() => setShowThemeModal(false)}>
                    <div className={styles.modalBox} onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', width: '90%' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>Choose a Theme</h3>
                            <button onClick={() => setShowThemeModal(false)} style={{ color: 'var(--text-secondary)', fontSize: '1.2rem' }}><FiX /></button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
                            {themes.map(t => (
                                <div
                                    key={t.id}
                                    onClick={() => changeTheme(t.id)}
                                    style={{
                                        margin: 0,
                                        padding: '1rem',
                                        borderRadius: '12px',
                                        background: t.bg,
                                        border: `2px solid ${currentTheme === t.id ? t.accent : 'rgba(255,255,255,0.1)'}`,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        transition: 'all 0.2s',
                                        boxShadow: currentTheme === t.id ? `0 0 15px ${t.accent}40` : 'none',
                                        transform: currentTheme === t.id ? 'scale(1.02)' : 'scale(1)',
                                    }}
                                >
                                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: t.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.id === 'light' ? '#fff' : '#000' }}>
                                        <FiCheck style={{ opacity: currentTheme === t.id ? 1 : 0 }} />
                                    </div>
                                    <span style={{ fontWeight: 600, color: t.id === 'light' ? '#0f172a' : '#fff' }}>{t.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
