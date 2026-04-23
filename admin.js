const express = require('express');
const app = express();
const path = require('path');

const db = require('./db_admin');

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// 👉 abre TU login.ejs tal cual
app.get('/', (req, res) => {
    res.render('login', { error: null });
});

// 👉 MISMA RUTA que ya tienes en el form (NO CAMBIAR)
app.post('/empleado/login', (req, res) => {
    const { username, password, deptoSeleccionado } = req.body;

    const sql = "SELECT * FROM empleados WHERE username = ? AND password = ? AND departamento = ?";

    db.query(sql, [username, password, deptoSeleccionado], (err, results) => {
        if (err) return res.send("Error en servidor");

        if (results.length > 0) {
            res.redirect('/dashboard');
        } else {
            res.render('login', { error: 'Datos incorrectos' });
        }
    });
});

// 👉 solo para que no truene si entras después
app.get('/dashboard', (req, res) => {
    res.send("Bienvenido empleado");
});

// 👉 esta ruta ya la usas en el botón "Nuevo Usuario"
app.get('/empleado/usuarios/nuevo2', (req, res) => {
    res.send("Nuevo usuario");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Admin corriendo"));