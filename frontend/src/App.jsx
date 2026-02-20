import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Auth from './components/Auth';
import Chat from './components/Chat';

function App() {
  return (
    <Routes>
      <Route path="/auth" element={<Auth />} />
      <Route path="/" element={<Chat />} />
      <Route path="*" element={<Auth />} />
    </Routes>
  );
}

export default App;
