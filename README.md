# ChatterBox - Real-Time Chat Application 🚀

This project was built to solve the following problem statement for the hackathon:

> **Real-Time Chat Application**
> *Design and develop a real-time chat web application using WebSockets that allows users to join multiple channels or groups, exchange messages instantly, and view live updates. The system should support user authentication, message persistence, and seamless real-time communication.*

## How we solved the problem statement:

✅ **Real-time WebSockets:** Powered by `Socket.io` and Node.js for zero-latency communication.
✅ **Multiple Channels & Groups:** Users can dynamically create custom public groups (e.g., `#hackathon`) or initiate 1-on-1 Direct Messages.
✅ **Live Updates:** Features instant delivery, live typing indicators (`user is typing...`), and real-time online/offline presence status.
✅ **User Authentication:** Built with secure JWT Tokens (JSON Web Tokens) and Bcrypt hashed passwords stored safely.
✅ **Message Persistence:** Powered by an `SQLite3` database engine storing all users, messages, and channel data permanently.

### 🔥 Hackathon "Big Company" Bonus Features:
* **End-to-End Encryption Mode (Simulation):** Messages are visually obfuscated upon sending, requiring a decryption click (lock/unlock) to read securely!
* **Admin Dashboard Control:** Users with `admin` in their name gain access to a dedicated `/admin` control panel to view, manage, and delete system channels and users!
* **Slash Commands & Markdown:** Support for Slack-like commands (e.g., `/shrug`, `/clear`) and full React-Markdown parsing for formatted code-blocks and bold texts.
* **Premium Glassmorphism UI:** Built using modern CSS variables, blur filters, independent component modules, and React Hot Toasts.

***

### Setup Guide

**1. Run the Backend (`server.js`):**
Navigate to the `backend` folder, install packages, and start the Node server:
\`\`\`bash
cd backend
npm install
node server.js
\`\`\`
*(This will run the socket app on `http://localhost:3001` and create the `chat.db` SQLite file).*

**2. Run the Frontend (React Vite):**
Open a new terminal, navigate to the `frontend` folder, install packages, and start Vite:
\`\`\`bash
cd frontend
npm install
npm run dev
\`\`\`
*(This will serve the frontend UI on your local network, usually `http://localhost:5173` or `http://localhost:5174`).*

---
Good luck with the Hackathon! 🏆
