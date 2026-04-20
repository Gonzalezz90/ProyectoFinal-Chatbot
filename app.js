const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');
const session = require('express-session');

const io = new Server(server);

const path = require('path');

// 🔥 PUERTO CORRECTO PARA DEPLOY
const PORT = process.env.PORT || 4000;

// configuración
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'secreto123',
    resave: false,
    saveUninitialized: false,   // 🔥 no crear sesiones vacías
    cookie: {
        secure: false,          // 🔥 en desarrollo, debe ser false
        httpOnly: true,
        maxAge: 1000 * 60 * 60  // 🔥 1 hora de duración
    }
}));


app.use(express.static('public'));

// carpeta uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// rutas
app.use('/', require('./routes/cliente'));
app.use('/empleado', require('./routes/empleado'));

// hacer io global
app.set('io', io);

// 🔥 SOCKETS
io.on("connection", (socket) => {

    console.log("🟢 Cliente conectado");

    // 🔥 SIEMPRE unir automáticamente
    socket.join("global_empleado");

});

// 🔥 SERVIDOR
server.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
});