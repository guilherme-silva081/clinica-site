const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: 'clinica-secret',
    resave: false,
    saveUninitialized: true
}));

// Conectar banco SQLite
const db = new sqlite3.Database('./database.sqlite', (err) => {
    if (err) console.error(err.message);
    else console.log('Conectado ao banco SQLite.');
});

// Criar tabelas
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS clientes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        telefone TEXT NOT NULL,
        email TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS servicos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        descricao TEXT,
        duracao INTEGER,
        preco REAL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS agendamentos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cliente_id INTEGER NOT NULL,
        servico_id INTEGER NOT NULL,
        data TEXT NOT NULL,
        horario TEXT NOT NULL,
        status TEXT DEFAULT 'agendado',
        FOREIGN KEY (cliente_id) REFERENCES clientes(id),
        FOREIGN KEY (servico_id) REFERENCES servicos(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        senha TEXT NOT NULL,
        role TEXT DEFAULT 'funcionario'
    )`);
});

// Middleware para verificar admin
function verificarAdmin(req, res, next) {
    if (req.session.user && req.session.user.role === 'admin') next();
    else res.status(403).send('Acesso negado');
}

// --- Cadastro de usuário ---
app.post('/register', (req, res) => {
    const { nome, email, senha, role } = req.body;
    if (!nome || !email || !senha) return res.status(400).send('Campos obrigatórios');

    db.run(`INSERT INTO usuarios (nome, email, senha, role) VALUES (?, ?, ?, ?)`,
        [nome, email, senha, role || 'funcionario'],
        function(err) {
            if (err) return res.status(500).send('Erro ao criar usuário. Email já cadastrado?');
            res.json({ success: true });
        });
});

// --- Login ---
app.post('/login', (req, res) => {
    const { email, senha } = req.body;
    if (!email || !senha) return res.status(400).send('Campos obrigatórios!');

    db.get(`SELECT * FROM usuarios WHERE email = ? AND senha = ?`, [email, senha], (err, user) => {
        if (err) return res.status(500).send('Erro no servidor');
        if (!user) return res.status(401).send('Credenciais inválidas');
        req.session.user = { id: user.id, nome: user.nome, role: user.role };
        res.json({ nome: user.nome, role: user.role });
    });
});

app.post('/logout', (req, res) => {
    req.session.destroy();
    res.sendStatus(200);
});

// --- Agendamentos ---
app.post('/agendar', (req, res) => {
    const { nome, telefone, email, servico_id, data, horario } = req.body;
    if (!nome || !telefone || !servico_id || !data || !horario) return res.status(400).send('Todos os campos obrigatórios!');

    db.get(`SELECT * FROM clientes WHERE telefone = ?`, [telefone], (err, cliente) => {
        if (err) return res.status(500).send('Erro no banco de dados');
        const clienteId = cliente ? cliente.id : null;

        const insertCliente = clienteId
            ? Promise.resolve(clienteId)
            : new Promise((resolve, reject) => {
                db.run(`INSERT INTO clientes (nome, telefone, email) VALUES (?, ?, ?)`,
                    [nome, telefone, email],
                    function(err) {
                        if (err) reject(err);
                        else resolve(this.lastID);
                    });
            });

        insertCliente.then(cid => {
            db.get(`SELECT * FROM agendamentos WHERE data = ? AND horario = ? AND servico_id = ?`,
                [data, horario, servico_id],
                (err, row) => {
                    if (err) return res.status(500).send('Erro no banco de dados');
                    if (row) return res.status(400).send('Horário já reservado!');

                    db.run(`INSERT INTO agendamentos (cliente_id, servico_id, data, horario) VALUES (?, ?, ?, ?)`,
                        [cid, servico_id, data, horario],
                        function(err) {
                            if (err) return res.status(500).send('Erro ao salvar agendamento');
                            res.json({ success: true });
                        });
                });
        }).catch(err => res.status(500).send('Erro ao salvar cliente'));
    });
});

// --- Listagens ---
app.get('/agendamentos', (req, res) => {
    const sql = `
        SELECT a.id, c.nome AS cliente, s.nome AS servico, a.data, a.horario, a.status
        FROM agendamentos a
        JOIN clientes c ON a.cliente_id = c.id
        JOIN servicos s ON a.servico_id = s.id
        ORDER BY a.data, a.horario
    `;
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).send('Erro no banco de dados');
        res.json(rows);
    });
});

// --- Serviços (apenas admin para adicionar/deletar) ---
app.get('/servicos', (req, res) => {
    db.all(`SELECT * FROM servicos`, [], (err, rows) => {
        if (err) return res.status(500).send('Erro ao buscar serviços');
        res.json(rows);
    });
});

app.post('/servicos', verificarAdmin, (req, res) => {
    const { nome, descricao, duracao, preco } = req.body;
    if (!nome || !duracao || !preco) return res.status(400).json({ error: 'Campos obrigatórios!' });

    db.run(`INSERT INTO servicos (nome, descricao, duracao, preco) VALUES (?, ?, ?, ?)`,
        [nome, descricao, duracao, preco],
        function(err) {
            if (err) return res.status(500).json({ error: 'Erro ao adicionar serviço' });
            res.json({ id: this.lastID });
        });
});

app.delete('/servico/:id', verificarAdmin, (req, res) => {
    const id = req.params.id;
    db.run(`DELETE FROM servicos WHERE id = ?`, [id], function(err) {
        if (err) return res.status(500).send('Erro ao deletar serviço');
        res.json({ success: true });
    });
});

// --- Agendamento extra: status e deletar ---
app.put('/agendamento/:id/status', (req, res) => {
    const { status } = req.body;
    const id = req.params.id;
    db.run(`UPDATE agendamentos SET status = ? WHERE id = ?`, [status, id], function(err) {
        if (err) return res.status(500).send('Erro ao atualizar status');
        res.json({ success: true });
    });
});

app.delete('/agendamento/:id', (req, res) => {
    const id = req.params.id;
    db.run(`DELETE FROM agendamentos WHERE id = ?`, [id], function(err) {
        if (err) return res.status(500).send('Erro ao deletar agendamento');
        res.json({ success: true });
    });
});

// --- Registro de cliente ---
app.post('/register', (req, res) => {
    const { nome, telefone, email, senha } = req.body;
    if (!nome || !telefone || !senha) return res.status(400).send('Campos obrigatórios');

    db.run(`INSERT INTO clientes (nome, telefone, email) VALUES (?, ?, ?)`,
        [nome, telefone, email],
        function(err) {
            if (err) return res.status(500).send('Erro ao criar cliente.');
            res.json({ success: true });
        });
});

// --- Login de cliente ---
app.post('/login', (req, res) => {
    const { telefone } = req.body; // login pelo telefone
    if (!telefone) return res.status(400).send('Telefone é obrigatório!');

    db.get(`SELECT * FROM clientes WHERE telefone = ?`, [telefone], (err, cliente) => {
        if (err) return res.status(500).send('Erro no servidor');
        if (!cliente) return res.status(401).send('Cliente não encontrado');
        req.session.cliente = { id: cliente.id, nome: cliente.nome };
        res.json({ nome: cliente.nome });
    });
});

// --- Logout do cliente ---
app.post('/logout', (req, res) => {
    req.session.destroy();
    res.sendStatus(200);
});

app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});
