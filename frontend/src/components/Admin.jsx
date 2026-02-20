import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../config';
import styles from './Admin.module.css';
import toast from 'react-hot-toast';

export default function Admin() {
    const [users, setUsers] = useState([]);
    const [channels, setChannels] = useState([]);
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
            fetch(`${API_URL}/api/admin/channels`, { headers: { 'Authorization': `Bearer ${token}` } }).then(res => res.json())
        ])
            .then(([u, c]) => {
                setUsers(u);
                setChannels(c);
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
                <button className={styles.backBtn} onClick={() => navigate('/')}>Back to Workspace</button>
            </div>

            <div className={styles.section}>
                <h2 className={styles.sectionTitle}>Manage Users</h2>
                <div className={styles.list}>
                    {users.map(u => (
                        <div key={u.id} className={styles.item}>
                            <div>
                                <strong>{u.username}</strong>
                                <span style={{ marginLeft: '1rem', color: u.status === 'online' ? '#22c55e' : '#64748b' }}>● {u.status}</span>
                            </div>
                            <button className={styles.deleteBtn} onClick={() => deleteUser(u.id)}>Delete</button>
                        </div>
                    ))}
                </div>
            </div>

            <div className={styles.section}>
                <h2 className={styles.sectionTitle}>Manage Channels</h2>
                <div className={styles.list}>
                    {channels.map(c => (
                        <div key={c.id} className={styles.item}>
                            <div>
                                <strong>{c.name}</strong>
                                <span style={{ marginLeft: '1rem', color: '#64748b', fontSize: '0.85rem' }}>
                                    {c.is_direct ? 'Direct Message' : 'Public Group'}
                                </span>
                            </div>
                            <button className={styles.deleteBtn} onClick={() => deleteChannel(c.id)}>Delete</button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
