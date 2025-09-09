let userRole = null; // Armazena o papel do usuário logado (admin/funcionario)

// ================= Login =================
const loginForm = document.getElementById('login-form');
const loginMsg = document.getElementById('login-msg');
const servicoSection = document.getElementById('servico-section');

loginForm.addEventListener('submit', e => {
    e.preventDefault();
    // Requisição login
    fetch('/login', {
        method: 'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
            email: document.getElementById('email-login').value,
            senha: document.getElementById('senha-login').value
        })
    })
    .then(res => res.ok ? res.json() : Promise.reject(res))
    .then(data => {
        userRole = data.role;
        loginMsg.textContent = `Bem-vindo, ${data.nome}`;
        loginForm.style.display = 'none';
        // Só admin vê serviços
        if(userRole==='admin') servicoSection.style.display = 'block';
        carregarServicos();  // Atualiza lista de serviços
    })
    .catch(() => loginMsg.textContent = 'Login inválido');
});

// ================= Registro =================
const registerForm = document.getElementById('register-form');
const registerMsg = document.getElementById('register-msg');

registerForm.addEventListener('submit', e => {
    e.preventDefault();
    // Requisição registro
    fetch('/register', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({
            nome: document.getElementById('nome-register').value,
            email: document.getElementById('email-register').value,
            senha: document.getElementById('senha-register').value,
            role: document.getElementById('role-register').value
        })
    })
    .then(res => {
        if(res.ok){
            registerMsg.textContent = 'Conta criada com sucesso!';
            registerForm.reset();
        } else res.text().then(txt => registerMsg.textContent = txt);
    });
});

// ================= Serviços (Admin) =================
const addServicoForm = document.getElementById('add-servico-form');

addServicoForm.addEventListener('submit', e => {
    e.preventDefault();
    fetch('/servicos', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
            nome: document.getElementById('nome-servico').value,
            descricao: document.getElementById('descricao-servico').value,
            duracao: parseInt(document.getElementById('duracao-servico').value),
            preco: parseFloat(document.getElementById('preco-servico').value)
        })
    }).then(res => res.ok ? carregarServicos() : alert('Erro ao adicionar serviço'));
});

// Carrega todos os serviços e popula tabela
function carregarServicos(){
    fetch('/servicos')
    .then(res => res.json())
    .then(data => {
        const tbody = document.querySelector('#tabela-servicos tbody');
        tbody.innerHTML = '';
        const selectServico = document.getElementById('servico-agendamento');
        selectServico.innerHTML = '<option value="">Selecione</option>';

        data.forEach(s => {
            // Popula tabela
            tbody.innerHTML += `<tr>
                <td>${s.nome}</td>
                <td>${s.descricao || ''}</td>
                <td>${s.duracao}</td>
                <td>${s.preco.toFixed(2)}</td>
                <td><button onclick="deletarServico(${s.id})">X</button></td>
            </tr>`;
            // Popula select de agendamento
            selectServico.innerHTML += `<option value="${s.id}">${s.nome}</option>`;
        });
    });
}

// Deleta serviço (admin)
function deletarServico(id){
    fetch(`/servico/${id}`, {method:'DELETE'})
    .then(() => carregarServicos());
}

// ================= Agendamentos =================
const agendarForm = document.getElementById('agendar-form');

agendarForm.addEventListener('submit', e => {
    e.preventDefault();
    fetch('/agendar', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
            nome: document.getElementById('nome-cliente').value,
            telefone: document.getElementById('telefone-cliente').value,
            email: document.getElementById('email-cliente').value,
            servico_id: document.getElementById('servico-agendamento').value,
            data: document.getElementById('data-agendamento').value,
            horario: document.getElementById('horario-agendamento').value
        })
    }).then(res => res.ok ? carregarAgendamentos() : alert('Erro ao agendar'));
});

// Carrega todos os agendamentos
function carregarAgendamentos(){
    fetch('/agendamentos')
    .then(res => res.json())
    .then(data => {
        const tbody = document.querySelector('#tabela-agendamentos tbody');
        tbody.innerHTML = '';
        data.forEach(a => {
            tbody.innerHTML += `<tr>
                <td>${a.cliente}</td>
                <td>${a.servico}</td>
                <td>${a.data}</td>
                <td>${a.horario}</td>
                <td>
                    <select onchange="alterarStatus(${a.id}, this.value)">
                        <option ${a.status==='agendado'?'selected':''}>agendado</option>
                        <option ${a.status==='concluido'?'selected':''}>concluido</option>
                        <option ${a.status==='cancelado'?'selected':''}>cancelado</option>
                    </select>
                </td>
                <td><button onclick="deletarAgendamento(${a.id})">X</button></td>
            </tr>`;
        });
    });
}

// Alterar status do agendamento
function alterarStatus(id, status){
    fetch(`/agendamento/${id}/status`, {
        method:'PUT',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({status})
    }).then(() => carregarAgendamentos());
}

// Deletar agendamento
function deletarAgendamento(id){
    fetch(`/agendamento/${id}`, {method:'DELETE'})
    .then(() => carregarAgendamentos());
}

// Login cliente
loginForm.addEventListener('submit', e => {
    e.preventDefault();
    fetch('/login', {
        method: 'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
            telefone: document.getElementById('telefone-login').value
        })
    })
    .then(res => res.ok ? res.json() : Promise.reject(res))
    .then(data => {
        loginMsg.textContent = `Bem-vindo, ${data.nome}`;
        loginForm.style.display = 'none';
        // Carregar serviços apenas para seleção de agendamento
        carregarServicos();
    })
    .catch(() => loginMsg.textContent = 'Telefone não cadastrado');
});

// Registro cliente
registerForm.addEventListener('submit', e => {
    e.preventDefault();
    fetch('/register', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
            nome: document.getElementById('nome-register').value,
            telefone: document.getElementById('telefone-register').value,
            email: document.getElementById('email-register').value
        })
    }).then(res => {
        if(res.ok){
            registerMsg.textContent = 'Conta criada com sucesso!';
            registerForm.reset();
        } else res.text().then(txt => registerMsg.textContent = txt);
    });
});


// Inicializa dados
carregarServicos();
carregarAgendamentos();
