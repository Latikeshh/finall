import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Auth from './components/Auth';
import Chat from './components/Chat';
import Admin from './components/Admin';
import { Toaster } from 'react-hot-toast';

function App() {
  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1f2334',
            color: '#f8fafc',
            border: '1px solid rgba(255,255,255,0.1)',
            backdropFilter: 'blur(8px)',
          },
        }}
      />
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="/" element={<Chat />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="*" element={<Auth />} />
      </Routes>
    </>
  );
}

export default App;
