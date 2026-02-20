import React, { useState } from 'react';
import { useSocket } from '../contexts/SocketContext';
import styles from './Auth.module.css';
import { FiShield } from 'react-icons/fi';
import { API_URL } from '../config';

export default function Auth() {
    const [authMode, setAuthMode] = useState('login'); // 'login', 'register', 'admin'
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const { login } = useSocket();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        if (authMode === 'admin' && !username.toLowerCase().includes('admin')) {
            setError("Admin usernames must contain the word 'admin'. If you don't have an admin account, register one first!");
            setLoading(false);
            return;
        }

        const endpoint = authMode === 'register' ? '/api/register' : '/api/login';

        try {
            const res = await fetch(`${API_URL}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Something went wrong');

            if (authMode !== 'register') {
                login(data.user, data.token);
            } else {
                // Auto login after register
                const loginRes = await fetch(`${API_URL}/api/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password }),
                });
                const loginData = await loginRes.json();
                login(loginData.user, loginData.token);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.container}>
            <div className={`glass-panel ${styles.authCard}`}>
                <div className={styles.header}>
                    <h1 className={styles.title}>
                        {authMode === 'admin' ? <><FiShield style={{ marginRight: '8px', color: '#ef4444' }} /> Admin Portal</> : 'ChatterBox Workspace'}
                    </h1>
                    <p className={styles.subtitle}>
                        {authMode === 'admin' ? 'Authorized personnel login' : 'Connect and collaborate in real-time'}
                    </p>
                </div>

                <div className={styles.tabs}>
                    <button
                        className={`${styles.tab} ${authMode === 'login' ? styles.active : ''}`}
                        onClick={() => { setAuthMode('login'); setError(null); }}
                    >
                        Login
                    </button>
                    <button
                        className={`${styles.tab} ${authMode === 'register' ? styles.active : ''}`}
                        onClick={() => { setAuthMode('register'); setError(null); }}
                    >
                        Sign Up
                    </button>
                    <button
                        className={`${styles.tab} ${authMode === 'admin' ? styles.activeAdmin : ''}`}
                        onClick={() => { setAuthMode('admin'); setError(null); }}
                    >
                        Admin
                    </button>
                </div>

                {error && <div className={`${styles.error} animate-fade-in`}>{error}</div>}

                <form className={styles.form} onSubmit={handleSubmit}>
                    <div className={styles.inputGroup}>
                        <label className={styles.label}>{authMode === 'admin' ? 'Admin Username' : 'Username'}</label>
                        <input
                            type="text"
                            required
                            className={styles.input}
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder={authMode === 'admin' ? "e.g. superadmin" : "Enter your username"}
                        />
                    </div>
                    <div className={styles.inputGroup}>
                        <label className={styles.label}>Password</label>
                        <input
                            type="password"
                            required
                            className={styles.input}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className={`${styles.submitBtn} ${authMode === 'admin' ? styles.adminSubmit : ''}`}
                    >
                        {loading ? 'Processing...' : (authMode === 'register' ? 'Create Account' : (authMode === 'admin' ? 'Secure Login' : 'Sign In'))}
                    </button>
                </form>
            </div>
        </div>
    );
}
