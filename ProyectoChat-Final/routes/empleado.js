console.log("🔥 CARGÓ empleado.js");
const express = require('express');
const router = express.Router();
const db = require('../db');
const multer = require('multer');
// 🔐 MIDDLEWARE SESIÓN
function verificarSesion(req, res, next) {
    if (!req.session.usuario) {
        return res.redirect('/empleado/login');
    }
    next();
}

// 🔐 MIDDLEWARE ADMIN
function soloAdmin(req, res, next) {

    const admins = ['delmy', 'elias', 'juanpablo'];
    const usuario = (req.session.usuario || '').toLowerCase().trim();

    console.log("VALIDANDO ADMIN:", usuario);

    if (!admins.includes(usuario)) {
        console.log("❌ NO ES ADMIN");
        return res.redirect('/empleado/login?error=Acceso denegado');
    }

    console.log("✅ ES ADMIN");
    next();
}

// 📁 ARCHIVOS
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname)
});

const upload = multer({
    storage,
    limits: { fileSize: 200 * 1024 * 1024 } // 🔥 200MB
});

// 🔐 MOSTRAR LOGIN (OBLIGATORIO)
router.get('/login', (req, res) => {
    res.render('login', { error: req.query.error || null });
});


// 🔐 LOGIN
// 🔐 LOGIN ÚNICO (CORRECTO)
router.post('/login', (req, res) => {

    let { username, password, deptoSeleccionado } = req.body;

    // normalizar
    username = username.toLowerCase().trim();

    if (!username || !password) {
        return res.redirect('/empleado/login?error=Todos los campos son obligatorios');
    }

    if (!/^[a-zA-Z0-9]+$/.test(username)) {
        return res.redirect('/empleado/login?error=Usuario inválido');
    }

    if (!/^[0-9]{4}$/.test(password)) {
        return res.redirect('/empleado/login?error=La contraseña debe ser de 4 dígitos');
    }

    db.query(
        "SELECT * FROM usuarios WHERE LOWER(username) = ? AND password = ?",
        [username, password],
        (err, result) => {

            if (err) {
                console.log(err);
                return res.redirect('/empleado/login?error=Error del servidor');
            }

            if (result.length === 0) {
                return res.redirect('/empleado/login?error=Credenciales incorrectas');
            }

            const user = result[0];

            // 🔥 GUARDAR SESIÓN
            req.session.usuario = user.username.toLowerCase().trim();

            // 🔥 DEPARTAMENTO FINAL
            const deptoFinal = deptoSeleccionado || user.departamento;

            // 🔥 REDIRECCIÓN CORRECTA (AQUÍ ESTABA TU ERROR)
            return res.redirect(`/empleado/chat/0?depto=${deptoFinal}&rol=empleado`);
        }
    );
});


// 💬 VER CHAT
router.get('/chat/:id', (req, res) => {

    const chatId = req.params.id;
    const depto = req.query.depto;
    const rol = req.query.rol;

    if(chatId != 0){
        db.query(
            "UPDATE mensajes SET visto = 1 WHERE chat_id = ? AND emisor = 'cliente'",
            [chatId]
        );
    }

    let query = `
    SELECT chats.*, 
    (
        SELECT COUNT(*) 
        FROM mensajes 
        WHERE mensajes.chat_id = chats.id 
        AND mensajes.visto = 0 
        AND mensajes.emisor = 'cliente'
    ) as no_leidos
    FROM chats
    WHERE estado != 'atendido'
    `;

    let params = [];

    if (depto) {
        query += " AND departamento = ?";
        params.push(depto);
    }

    query += " ORDER BY id DESC";

    db.query(query, params, (err, chats) => {

        if (err) return res.send("Error chats");

        if (chatId == 0) {
            return res.render('chat_empleado', {
                chats,
                mensajes: [],
                chatId,
                depto,
                rol
            });
        }

        db.query(
            "SELECT * FROM mensajes WHERE chat_id = ? ORDER BY fecha ASC",
            [chatId],
            (err2, mensajes) => {

                if (err2) return res.send("Error mensajes");

                const codigo = String(chatId).padStart(5, '0');

                res.render('chat_empleado', {
                    chats,
                    mensajes,
                    chatId,
                    depto,
                    rol,
                    codigo
                });
            }
        );
    });
});


// ✉️ RESPONDER
router.post('/responder', (req, res) => {

    const { chat_id, mensaje } = req.body;
    const io = req.app.get('io');

    if (!chat_id || !mensaje) return res.sendStatus(400);

    db.query(
        "INSERT INTO mensajes (chat_id, emisor, mensaje) VALUES (?, 'empleado', ?)",
        [chat_id, mensaje],
        (err) => {

            if (err) return res.sendStatus(500);

            db.query(
                "UPDATE chats SET estado = 'pendiente' WHERE id = ?",
                [chat_id]
            );

           // 🔥 enviar al chat abierto
           // 🔥 enviar al chat abierto
io.to("chat_" + chat_id).emit("nuevoMensaje", {
    chat_id,
    emisor: "empleado",
    mensaje
});

// 🔥 enviar a TODOS los empleados (lista en vivo)
// 🔥 SOLO GLOBAL (SIN DUPLICAR)
io.to("global_empleado").emit("nuevoMensaje", {
    chat_id,
    emisor: "empleado",
    mensaje
});

            res.sendStatus(200);
        }
    );
});


// 📎 ARCHIVO
router.post('/archivo', upload.single('archivo'), (req, res) => {

    const { chat_id } = req.body;
    const io = req.app.get('io');

    if (!req.file) return res.sendStatus(400);

    const ruta = "/uploads/" + req.file.filename;

    db.query(
        "INSERT INTO mensajes (chat_id, emisor, mensaje) VALUES (?, 'empleado', ?)",
        [chat_id, ruta],
        (err) => {

            if (err) return res.sendStatus(500);

            // 🔥 enviar al chat abierto
            // 🔥 enviar al chat abierto
io.to("chat_" + chat_id).emit("nuevoMensaje", {
    chat_id,
    emisor: "empleado",
    mensaje: ruta
});

// 🔥 enviar a todos los empleados
io.to("global_empleado").emit("nuevoMensaje", {
    chat_id,
    emisor: "empleado",
    mensaje: ruta
});
            res.sendStatus(200);
        }
    );
});

// FINALIZAR
router.post('/finalizar', (req, res) => {

    const { chat_id, depto, rol } = req.body;

    db.query(
        "UPDATE chats SET estado = 'atendido' WHERE id = ?",
        [chat_id],
        () => {
            res.redirect(`/empleado/chat/0?depto=${depto}&rol=${rol}`);
        }
    );
});

router.post('/editar-nombre', (req, res) => {

    const { chat_id, nombre } = req.body;

    db.query(
        "UPDATE chats SET cliente_nombre = ? WHERE id = ?",
        [nombre, chat_id],
        (err) => {
            if (err) return res.sendStatus(500);
            res.sendStatus(200);
        }
    );
});

// LOGOUT
router.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/empleado/login');
    });
});
router.post('/eliminar', (req, res) => {

    const { id } = req.body;

    db.query(
        "UPDATE chats SET estado = 'atendido' WHERE id = ?",
        [id],
        (err) => {
            if (err) {
                console.log(err);
                return res.sendStatus(500);
            }
            res.sendStatus(200);
        }
    );
});


// 🔥 CREAR USUARIO (✅ VALIDADO)
router.post('/usuarios/guardar', (req, res) => {

    const { username, password, departamento } = req.body;

    if (!username || !password || !departamento) {
        return res.render('nuevo_usuario', { mensaje: "Todos los campos son obligatorios" });
    }

    if (!/^[a-zA-Z0-9]+$/.test(username)) {
        return res.render('nuevo_usuario', { mensaje: "Usuario inválido" });
    }

    if (!/^[0-9]{4}$/.test(password)) {
        return res.render('nuevo_usuario', { mensaje: "La contraseña debe ser de 4 números" });
    }
    if (username.length < 3) {
    return res.render('nuevo_usuario', { mensaje: "Usuario muy corto" });
}

if (password === "0000" || password === "1234") {
    return res.render('nuevo_usuario', { mensaje: "Contraseña muy débil" });
}

    db.query(
        "INSERT INTO usuarios (username, password, departamento, rol) VALUES (?, ?, ?, 'empleado')",
        [username, password, departamento],
        (err) => {

            if (err) {
                console.log(err);
                return res.render('nuevo_usuario', { mensaje: "Error al crear usuario" });
            }

            return res.redirect('/empleado/usuarios/nuevo?msg=creado');
        }
    );
});


// 🔥 ELIMINAR USUARIO
router.post('/usuarios/eliminar', (req, res) => {

    const { username } = req.body;

    db.query(
        "DELETE FROM usuarios WHERE username = ?",
        [username],
        (err) => {

            if (err) {
                console.log(err);
                return res.render('nuevo_usuario', { mensaje: "Error al eliminar" });
            }

            return res.redirect('/empleado/usuarios/nuevo?msg=eliminado');
        }
    );
});

router.get('/usuarios/nuevo', verificarSesion, (req, res) => {

    const usuario = (req.session.usuario || '').toLowerCase().trim();
    console.log("USUARIO EN SESION:", usuario);

    let mensaje = null;

    if (req.query.msg === 'creado') mensaje = "Usuario creado correctamente";
    if (req.query.msg === 'eliminado') mensaje = "Usuario eliminado correctamente";

    res.render('nuevo_usuario', { mensaje });
});
router.get('/usuarios/nuevo2', (req, res) => {
    res.render('nuevo_usuario', { mensaje: null });
});
router.get('/test', (req, res) => {
    res.send("TEST OK");
});

module.exports = router;