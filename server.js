const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(path.join(__dirname)));

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/model', (req, res) => {
    res.sendFile(path.join(__dirname, 'model.html'));
});

// WebRTC Signaling Server
const users = {};

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    
    socket.on('register', (userType) => {
        users[socket.id] = { userType, partner: null };
        console.log(`${userType} registered: ${socket.id}`);
        
        // Find a partner
        findPartner(socket.id);
    });
    
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
    
    socket.on('disconnect', () => {
        const user = users[socket.id];
        if (user && user.partner) {
            socket.to(user.partner).emit('partner-disconnected');
            delete users[user.partner];
        }
        delete users[socket.id];
        console.log('User disconnected:', socket.id);
    });
    
    function findPartner(userId) {
        const user = users[userId];
        if (!user || user.partner) return;
        
        // Find available partner of opposite type
        for (const [id, otherUser] of Object.entries(users)) {
            if (id !== userId && 
                !otherUser.partner && 
                otherUser.userType !== user.userType) {
                
                // Connect them
                user.partner = id;
                otherUser.partner = userId;
                
                io.to(userId).emit('partner-found', id);
                io.to(id).emit('partner-found', userId);
                
                console.log(`Connected ${userId} (${user.userType}) with ${id} (${otherUser.userType})`);
                break;
            }
        }
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`✅ WebRTC Server running on port ${PORT}`);
    console.log(`✅ User page: https://your-domain.up.railway.app`);
    console.log(`✅ Model page: https://your-domain.up.railway.app/model`);
});
