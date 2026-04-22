const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');
const session = require('express-session');
const path = require('path');
const fs = require('fs');

// 🔥 SOCKET
const io = new Server(server);

// 🔥 PUERTO
const PORT = process.env.PORT || 4000;


// =========================
// 🔧 CONFIGURACIÓN
// =========================
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// 🔐 SESIONES
app.use(session({
    secret: 'secreto123',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 1000 * 60 * 60
    }
}));


// =========================
// 📁 CARPETAS
// =========================

// 🔥 PUBLIC
app.use(express.static(path.join(__dirname, 'public')));

// 🔥 CREAR uploads SI NO EXISTE (CLAVE)
const uploadsPath = path.join(__dirname, 'uploads');

if (!fs.existsSync(uploadsPath)) {
    fs.mkdirSync(uploadsPath);
    console.log("📁 carpeta uploads creada");
}

// 🔥 SERVIR ARCHIVOS
app.use('/uploads', express.static(uploadsPath));


// =========================
// 🚀 RUTAS
// =========================
app.use('/', require('./routes/cliente'));
app.use('/empleado', require('./routes/empleado'));


// =========================
// 🌐 SOCKET GLOBAL
// =========================
app.set('io', io);


// =========================
// 🔥 SOCKET.IO
// =========================
io.on("connection", (socket) => {

    console.log("🟢 Cliente conectado");

    // 🔥 TODOS los empleados escuchan esto
    socket.join("global_empleado");

    // 🔥 CHAT INDIVIDUAL (ESTO ERA CLAVE)
    socket.on("joinChat", (chatId) => {
        socket.join("chat_" + chatId);
        console.log("👤 Unido a chat:", chatId);
    });

    socket.on("disconnect", () => {
        console.log("🔴 Cliente desconectado");
    });

});


// =========================
// 🚀 SERVER
// =========================
server.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});