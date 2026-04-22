const express = require('express');
const router = express.Router();
const db = require('../db');
const multer = require('multer');
router.use(express.json());

// 📁 MULTER
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname)
});

const upload = multer({
    storage,
    limits: { fileSize: 200 * 1024 * 1024 } // 🔥 200MB
});


// 🔹 MOSTRAR CLIENTE
router.get('/', (req, res) => {

    const chat_id = req.query.chat_id;

    if (!chat_id) {
        return res.render('cliente', { mensajes: [], chat_id: null });
    }

    db.query(
        "SELECT * FROM mensajes WHERE chat_id = ? ORDER BY fecha ASC",
        [chat_id],
        (err, resultados) => {

            if (err) return res.send("Error cargando mensajes");

            res.render('cliente', { mensajes: resultados, chat_id });
        }
    );
});


// 🔹 MENSAJES CLIENTE
router.post('/mensaje', (req, res) => {

    const { mensaje, chat_id, depto } = req.body;
    const io = req.app.get('io');

    if (!mensaje) return res.send("Mensaje vacío");

    if (mensaje === "reset") {
        return res.redirect('/');
    }

    let departamento = null;

    if (mensaje === "1") departamento = "servicios";
    if (mensaje === "2") departamento = "soporte";
    if (mensaje === "3") departamento = "gerencia";


    // 🔥 CREAR CHAT
    if (!chat_id) {

        if (mensaje === "1" || mensaje === "2" || mensaje === "3") {
            return res.redirect('/');
        }

        // 🔥 EXTRAER SOLO EL NOMBRE (posición 2)
        let partes = mensaje.split(" - ");
        let nombreCliente = partes[1] || mensaje;

        const nuevoChat = {
            cliente_nombre: nombreCliente,
            telefono: "N/A",
            departamento: depto || "soporte",
            estado: "pendiente"
        };

        db.query("INSERT INTO chats SET ?", nuevoChat, (err, result) => {

            if (err) return res.send("Error creando chat");

            const chatId = result.insertId;
            const codigo = String(chatId).padStart(5, '0');

            const mensajeSistema = mensaje;

            db.query(
                "INSERT INTO mensajes (chat_id, emisor, mensaje) VALUES (?, 'sistema', ?)",
                [chatId, mensajeSistema]
            );

            // 🔥 chat cliente (NO TOCAR)
            io.to("chat_" + chatId).emit("nuevoMensaje", {
                chat_id: chatId,
                emisor: "sistema",
                mensaje: mensajeSistema
            });

            // 🔥 empleados (AGREGADO PARA TIEMPO REAL EN LISTA)
            io.to("global_empleado").emit("nuevoMensaje", {
                chat_id: chatId,
                emisor: "sistema",
                mensaje: mensajeSistema
            });

            return res.json({ chat_id: chatId });
        });

        return;
    }


    // 🔥 CAMBIO DE DEPTO
    if (departamento) {

        db.query(
            "UPDATE chats SET departamento = ? WHERE id = ?",
            [departamento, chat_id],
            (err) => {

                if (err) return res.send("Error actualizando departamento");

                const codigo = String(chat_id).padStart(5, '0');

                const mensajeSistema = mensaje;

                db.query(
                    "INSERT INTO mensajes (chat_id, emisor, mensaje) VALUES (?, 'sistema', ?)",
                    [chat_id, mensajeSistema]
                );

                io.to("chat_" + chat_id).emit("nuevoMensaje", {
                    chat_id,
                    emisor: "sistema",
                    mensaje: mensajeSistema
                });

                // 🔥 empleados también (AGREGADO)
                io.to("global_empleado").emit("nuevoMensaje", {
                    chat_id,
                    emisor: "sistema",
                    mensaje: mensajeSistema
                });

                return res.json({ chat_id: chat_id });
            }
        );

        return;
    }


    // 🔹 MENSAJE NORMAL
    db.query(
        "INSERT INTO mensajes (chat_id, emisor, mensaje, visto) VALUES (?, 'cliente', ?, 0)",
        [chat_id, mensaje],
        (err) => {

            if (err) return res.send("Error guardando mensaje");

            // 🔥 cliente (NO TOCAR)
            io.to("chat_" + chat_id).emit("nuevoMensaje", {
                chat_id,
                emisor: "cliente",
                mensaje
            });

            // 🔥 empleados (YA EXISTÍA)
            io.to("global_empleado").emit("nuevoMensaje", {
                chat_id,
                emisor: "cliente",
                mensaje
            });

            return res.json({ chat_id: chat_id });
        }
    );

});


// 🔹 ARCHIVO (SEPARADO correctamente)
router.post('/archivo', upload.single('archivo'), (req, res) => {

    const { chat_id } = req.body;
    const io = req.app.get('io');

    if (!req.file) return res.sendStatus(400);

    const ruta = '/uploads/' + req.file.filename;

    db.query(
        "INSERT INTO mensajes (chat_id, emisor, mensaje) VALUES (?, 'cliente', ?)",
        [chat_id, ruta],
        () => {

            // 🔥 cliente (chat abierto)
            io.to("chat_" + chat_id).emit("nuevoMensaje", {
                chat_id,
                emisor: "cliente",
                mensaje: ruta
            });

            // 🔥 empleados (IMPORTANTE)
            io.to("global_empleado").emit("nuevoMensaje", {
                chat_id,
                emisor: "cliente",
                mensaje: ruta
            });

            return res.json({ chat_id: chat_id });
        }
    );
});

module.exports = router;