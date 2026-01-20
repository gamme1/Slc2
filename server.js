const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files
app.use(express.static(path.join(__dirname)));

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/model', (req, res) => {
    res.sendFile(path.join(__dirname, 'model.html'));
});

// WebSocket signaling
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    
    socket.on('signal', (data) => {
        socket.broadcast.emit('signal', data);
    });
    
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`WebRTC Server running on port ${PORT}`);
    console.log(`User page: https://slc.up.railway.app`);
    console.log(`Model page: https://slc.up.railway.app/model`);
});
