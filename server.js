const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Rotas HTML estáticas já servidas do /public

// Formulário de contato
app.post('/contato', async (req, res) => {
  const { nome, email, mensagem } = req.body;

  if (!process.env.MAIL_HOST) {
    console.log('Contato recebido (modo DEV):', { nome, email, mensagem });
    return res.send('<h1>Mensagem recebida (DEV)</h1><a href="/">Voltar</a>');
  }

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST,
      port: Number(process.env.MAIL_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS
      }
    });

    await transporter.sendMail({
      from: email,
      to: process.env.MAIL_TO,
      subject: 'Novo contato do site',
      text: mensagem
    });

    res.send('<h1>Mensagem enviada com sucesso!</h1><a href="/">Voltar</a>');
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao enviar mensagem');
  }
});

app.listen(PORT, () => console.log(`Servidor rodando em http://localhost:${PORT}`));