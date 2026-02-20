import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../config';
import styles from './Admin.module.css';
import toast from 'react-hot-toast';
import { FiUsers, FiMessageSquare, FiHash, FiTrash2, FiArrowLeft } from 'react-icons/fi';

export default function Admin() {
    const [users, setUsers] = useState([]);
    const [channels, setChannels] = useState([]);
    const [stats, setStats] = useState({ users: 0, messages: 0, channels: 0 });
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) return navigate('/auth');

        Promise.all([
            fetch(`${API_URL}/api/admin/users`, { headers: { 'Authorization': `Bearer ${token}` } }).then(res => {
                if (!res.ok) throw new Error('Not authorized');
                return res.json();
            }),
            fetch(`${API_URL}/api/admin/channels`, { headers: { 'Authorization': `Bearer ${token}` } }).then(res => res.json()),
            fetch(`${API_URL}/api/admin/stats`, { headers: { 'Authorization': `Bearer ${token}` } }).then(res => res.json())
        ])
            .then(([u, c, s]) => {
                setUsers(u);
                setChannels(c);
                if (s && s.users !== undefined) setStats(s);
                setLoading(false);
            })
            .catch(err => {
                toast.error(err.message);
                navigate('/');
            });
    }, [navigate]);

    const deleteUser = async (id) => {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/api/admin/users/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            setUsers(users.filter(u => u.id !== id));
            toast.success('User deleted');
        }
    };

    const deleteChannel = async (id) => {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/api/admin/channels/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            setChannels(channels.filter(c => c.id !== id));
            toast.success('Channel deleted');
        }
    };

    if (loading) return <div className={styles.container}>Loading Admin Panel...</div>;

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1 className={styles.title}>Admin Control Panel 🛡️</h1>
                <button className={styles.backBtn} onClick={() => navigate('/')}>
                    <FiArrowLeft style={{ marginRight: '0.5rem' }} /> Back to Workspace
                </button>
            </div>

            <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                    <div className={styles.statIcon} style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
                        <FiUsers size={24} />
                    </div>
                    <div>
                        <div className={styles.statValue}>{stats.users}</div>
                        <div className={styles.statLabel}>Total Users</div>
                    </div>
                </div>
                <div className={styles.statCard}>
                    <div className={styles.statIcon} style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
                        <FiHash size={24} />
                    </div>
                    <div>
                        <div className={styles.statValue}>{stats.channels}</div>
                        <div className={styles.statLabel}>Total Channels</div>
                    </div>
                </div>
                <div className={styles.statCard}>
                    <div className={styles.statIcon} style={{ background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6' }}>
                        <FiMessageSquare size={24} />
                    </div>
                    <div>
                        <div className={styles.statValue}>{stats.messages}</div>
                        <div className={styles.statLabel}>Total Messages</div>
                    </div>
                </div>
            </div>

            <div className={styles.section}>
                <h2 className={styles.sectionTitle}>Manage Users</h2>
                <div className={styles.tableWrapper}>
                    <table className={styles.adminTable}>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Username</th>
                                <th>Status</th>
                                <th style={{ textAlign: 'right' }}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(u => (
                                <tr key={u.id}>
                                    <td>#{u.id}</td>
                                    <td><strong>{u.username}</strong></td>
                                    <td>
                                        <span className={styles.statusBadge} style={{
                                            background: u.status === 'online' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(100, 116, 139, 0.1)',
                                            color: u.status === 'online' ? '#22c55e' : '#64748b'
                                        }}>
                                            ● {u.status}
                                        </span>
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                        <button className={styles.deleteBtn} onClick={() => deleteUser(u.id)} title="Delete User">
                                            <FiTrash2 /> Remove
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className={styles.section}>
                <h2 className={styles.sectionTitle}>Manage Channels</h2>
                <div className={styles.tableWrapper}>
                    <table className={styles.adminTable}>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Name</th>
                                <th>Type</th>
                                <th style={{ textAlign: 'right' }}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {channels.map(c => (
                                <tr key={c.id}>
                                    <td>#{c.id}</td>
                                    <td><strong>{c.name}</strong></td>
                                    <td>
                                        <span className={styles.typeBadge}>
                                            {c.is_direct ? 'Direct Message' : 'Public Group'}
                                        </span>
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                        <button className={styles.deleteBtn} onClick={() => deleteChannel(c.id)} title="Delete Channel">
                                            <FiTrash2 /> Delete
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
