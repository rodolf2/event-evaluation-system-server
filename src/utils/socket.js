const { Server } = require("socket.io");

let io;

const init = (server) => {
    io = new Server(server, {
        cors: {
            origin: (process.env.CLIENT_URLS || process.env.CLIENT_URL || "http://localhost:5173").split(",").map(o => o.trim()),
            methods: ["GET", "POST", "PUT", "DELETE"],
            credentials: true
        }
    });

    io.on("connection", (socket) => {
        console.log(`🔌 New client connected: ${socket.id}`);

        // Join a room based on user ID for targeted notifications
        socket.on("join", (userId) => {
            if (userId) {
                socket.join(userId);
                console.log(`👤 Socket ${socket.id} joined room: ${userId}`);
            }
        });

        socket.on("disconnect", () => {
            console.log(`🔌 Client disconnected: ${socket.id}`);
        });
    });

    return io;
};

const getIO = () => {
    if (!io) {
        throw new Error("Socket.io not initialized!");
    }
    return io;
};

// Helper to emit events easily
const emitUpdate = (event, data, room = null) => {
    if (!io) return;
    if (room) {
        io.to(room).emit(event, data);
    } else {
        io.emit(event, data);
    }
};

module.exports = { init, getIO, emitUpdate };
