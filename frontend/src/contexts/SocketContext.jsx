import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../config';

const SocketContext = createContext();

export const SocketProvider = ({ children }) => {
    const [socket, setSocket] = useState(null);
    const [user, setUser] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        const token = localStorage.getItem('token');

        if (storedUser && token) {
            setUser(JSON.parse(storedUser));
            connectSocket(token);
        } else {
            navigate('/auth');
        }

        return () => {
            if (socket) socket.disconnect();
        };
    }, []);

    const connectSocket = (token) => {
        const newSocket = io(API_URL, {
            auth: { token }
        });

        newSocket.on('connect_error', (err) => {
            console.error('Socket connection error:', err.message);
            if (err.message.includes('Authentication error')) {
                logout();
            }
        });

        setSocket(newSocket);
    };

    const login = (userData, token) => {
        localStorage.setItem('user', JSON.stringify(userData));
        localStorage.setItem('token', token);
        setUser(userData);
        connectSocket(token);
        navigate('/');
    };

    const logout = () => {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        setUser(null);
        if (socket) socket.disconnect();
        setSocket(null);
        navigate('/auth');
    };

    return (
        <SocketContext.Provider value={{ socket, user, login, logout }}>
            {children}
        </SocketContext.Provider>
    );
};

export const useSocket = () => useContext(SocketContext);
