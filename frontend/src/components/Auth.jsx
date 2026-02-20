import React, { useState } from 'react';
import { useSocket } from '../contexts/SocketContext';
import styles from './Auth.module.css';
import { API_URL } from '../config';

export default function Auth() {
    const [isLogin, setIsLogin] = useState(true);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const { login } = useSocket();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        const endpoint = isLogin ? '/api/login' : '/api/register';

        try {
            const res = await fetch(`${API_URL}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Something went wrong');

            if (isLogin) {
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
                    <h1 className={styles.title}>ChatterBox Workspace</h1>
                    <p className={styles.subtitle}>Connect and collaborate in real-time</p>
                </div>

                <div className={styles.tabs}>
                    <button
                        className={`${styles.tab} ${isLogin ? styles.active : ''}`}
                        onClick={() => { setIsLogin(true); setError(null); }}
                    >
                        Login
                    </button>
                    <button
                        className={`${styles.tab} ${!isLogin ? styles.active : ''}`}
                        onClick={() => { setIsLogin(false); setError(null); }}
                    >
                        Sign Up
                    </button>
                </div>

                {error && <div className={`${styles.error} animate-fade-in`}>{error}</div>}

                <form className={styles.form} onSubmit={handleSubmit}>
                    <div className={styles.inputGroup}>
                        <label className={styles.label}>Username</label>
                        <input
                            type="text"
                            required
                            className={styles.input}
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Enter your username"
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
                    <button type="submit" disabled={loading} className={styles.submitBtn}>
                        {loading ? 'Processing...' : isLogin ? 'Sign In' : 'Create Account'}
                    </button>
                </form>
            </div>
        </div>
    );
}
