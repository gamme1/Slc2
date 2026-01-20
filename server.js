const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(express.static(path.join(__dirname)));

// Serve the single page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Store connected users
const users = {};
const waitingUsers = [];
const waitingModels = [];

// Track online users
function getOnlineCount() {
    return Object.keys(users).length;
}

// Broadcast online count to all
function broadcastOnlineCount() {
    const count = getOnlineCount();
    io.emit('online-count', count);
}

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    
    // Add to users list
    users[socket.id] = { role: null, partner: null };
    broadcastOnlineCount();
    
    // Handle role registration
    socket.on('register', (role) => {
        users[socket.id].role = role;
        console.log(`${role} registered: ${socket.id}`);
        
        socket.emit('registered', { role });
    });
    
    // Handle finding a partner
    socket.on('find-partner', (role) => {
        const user = users[socket.id];
        if (!user || user.role !== role) return;
        
        if (role === 'user') {
            // User looking for model
            if (waitingModels.length > 0) {
                const modelId = waitingModels.shift();
                connectUsers(socket.id, modelId);
            } else {
                waitingUsers.push(socket.id);
                socket.emit('waiting', 'Searching for models...');
            }
        } else if (role === 'model') {
            // Model looking for user
            if (waitingUsers.length > 0) {
                const userId = waitingUsers.shift();
                connectUsers(userId, socket.id);
            } else {
                waitingModels.push(socket.id);
                socket.emit('waiting', 'Waiting for users...');
            }
        }
    });
    
    // WebRTC signaling
    socket.on('offer', (data) => {
        socket.to(data.target).emit('offer', {
            offer: data.offer,
            sender: socket.id
        });
    });
    
    socket.on('answer', (data) => {
        socket.to(data.target).emit('answer', {
            answer: data.answer,
            sender: socket.id
        });
    });
    
    socket.on('ice-candidate', (data) => {
        socket.to(data.target).emit('ice-candidate', data.candidate);
    });
    
    // Disconnect handling
    socket.on('disconnect', () => {
        const user = users[socket.id];
        if (user) {
            // Remove from waiting lists
            const userIndex = waitingUsers.indexOf(socket.id);
            if (userIndex > -1) waitingUsers.splice(userIndex, 1);
            
            const modelIndex = waitingModels.indexOf(socket.id);
            if (modelIndex > -1) waitingModels.splice(modelIndex, 1);
            
            // Notify partner if in call
            if (user.partner) {
                socket.to(user.partner).emit('partner-disconnected');
                const partner = users[user.partner];
                if (partner) partner.partner = null;
            }
        }
        
        delete users[socket.id];
        console.log('User disconnected:', socket.id);
        broadcastOnlineCount();
    });
    
    // Connect two users
    function connectUsers(userId, modelId) {
        const user = users[userId];
        const model = users[modelId];
        
        if (!user || !model) return;
        
        user.partner = modelId;
        model.partner = userId;
        
        io.to(userId).emit('partner-found', {
            partnerId: modelId,
            partnerType: 'model'
        });
        
        io.to(modelId).emit('partner-found', {
            partnerId: userId,
            partnerType: 'user'
        });
        
        console.log(`Connected ${userId} (user) with ${modelId} (model)`);
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`✅ SolCam Server running on port ${PORT}`);
    console.log(`✅ Access at: https://your-domain.up.railway.app`);
});
