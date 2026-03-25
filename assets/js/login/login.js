// Função para mostrar mensagens
function mostrarMensagem(texto, tipo = 'success') {
    const mensagemEl = document.getElementById('mensagem');
    mensagemEl.classList.remove('d-none', 'alert-success', 'alert-error');
    mensagemEl.classList.add('alert', tipo === 'success' ? 'alert-success' : 'alert-error');
    mensagemEl.textContent = texto;
}

function mostrarMensagemReset(texto, tipo = 'success') {
    const mensagemEl = document.getElementById('mensagemReset');
    mensagemEl.classList.remove('d-none', 'alert-success', 'alert-error');
    mensagemEl.classList.add('alert', tipo === 'success' ? 'alert-success' : 'alert-error');
    mensagemEl.textContent = texto;
}

// ==================== LOGIN ====================
document.getElementById('formLogin').addEventListener('submit', async (event) => {
    event.preventDefault();

    const email = document.getElementById('email').value;
    const senha = document.getElementById('senha').value;
    const btnLogin = document.getElementById('btnLogin');
    const btnText = btnLogin.querySelector('.btn-text');
    const spinner = btnLogin.querySelector('.spinner-border');

    if (!email || !senha) {
        mostrarMensagem('Preencha todos os campos!', 'error');
        return;
    }

    // Ativa o estado de carregamento do botão
    btnLogin.disabled = true;
    btnText.textContent = 'Entrando...';
    spinner.classList.remove('d-none');

    const payload = JSON.stringify({ email, senha });

    try {
        const response = await fetch('/api/usuarios/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload
        });

        if (response.ok) {
            const data = await response.json();

            localStorage.setItem('token', data.token);
            localStorage.setItem('usuarioId', data.id);
            localStorage.setItem('usuario', data.usuario);
            localStorage.setItem('email', data.email);
            localStorage.setItem('role', data.role);
            localStorage.setItem('segmentos', JSON.stringify(data.segmentos));

            mostrarMensagem('Login bem-sucedido! Redirecionando...', 'success');

            setTimeout(() => {
                if (data.role === 'DOCUMENTIST') {
                    window.location.href = 'pages/gestaoAprovacoes.html';
                } else {
                    window.location.href = 'index.html';
                }
            }, 1000);

        } else if (response.status === 429) {
            // Rate limiting
            let msg = 'Muitas tentativas de login. Tente novamente em alguns minutos.';
            try {
                const data = await response.json();
                if (data.error) msg = data.error;
            } catch (_) {}
            mostrarMensagem(msg, 'error');
            btnLogin.disabled = false;
            btnText.textContent = 'Entrar';
            spinner.classList.add('d-none');
        } else {
            const erroTexto = await response.text();
            mostrarMensagem(erroTexto || 'E-mail ou senha inválidos!', 'error');
            btnLogin.disabled = false;
            btnText.textContent = 'Entrar';
            spinner.classList.add('d-none');
        }

    } catch (error) {
        console.error("Erro de conexão:", error);
        mostrarMensagem('Erro ao conectar com o servidor.', 'error');
        btnLogin.disabled = false;
        btnText.textContent = 'Entrar';
        spinner.classList.add('d-none');
    }
});

// ==================== ESQUECI MINHA SENHA ====================
const linkEsqueciSenha = document.getElementById('linkEsqueciSenha');
const linkVoltarLogin = document.getElementById('linkVoltarLogin');
const formLogin = document.getElementById('formLogin');
const formEsqueciSenha = document.getElementById('formEsqueciSenha');
const tituloForm = document.querySelector('.form-title');
const subtituloForm = document.querySelector('.form-subtitle');

if (linkEsqueciSenha) {
    linkEsqueciSenha.addEventListener('click', (e) => {
        e.preventDefault();
        formLogin.style.display = 'none';
        formEsqueciSenha.style.display = 'block';
        tituloForm.textContent = 'Esqueci minha senha';
        subtituloForm.textContent = 'Informe seu e-mail para receber o link de recuperação.';
        document.getElementById('mensagem').classList.add('d-none');
        document.getElementById('mensagemReset').classList.add('d-none');
    });
}

if (linkVoltarLogin) {
    linkVoltarLogin.addEventListener('click', (e) => {
        e.preventDefault();
        formEsqueciSenha.style.display = 'none';
        formLogin.style.display = 'block';
        tituloForm.textContent = 'Acesse sua conta';
        subtituloForm.textContent = 'Bem-vindo de volta! Por favor, insira seus dados.';
        document.getElementById('mensagem').classList.add('d-none');
        document.getElementById('mensagemReset').classList.add('d-none');
    });
}

if (formEsqueciSenha) {
    formEsqueciSenha.addEventListener('submit', async (event) => {
        event.preventDefault();

        const emailReset = document.getElementById('emailReset').value.trim();
        const btn = document.getElementById('btnEnviarReset');
        const btnText = btn.querySelector('.btn-text');
        const spinner = btn.querySelector('.spinner-border');

        if (!emailReset) {
            mostrarMensagemReset('Informe seu e-mail.', 'error');
            return;
        }

        btn.disabled = true;
        btnText.textContent = 'Enviando...';
        spinner.classList.remove('d-none');

        try {
            const response = await fetch('/api/auth/esqueci-senha', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: emailReset })
            });

            if (response.ok) {
                mostrarMensagemReset('Se o e-mail estiver cadastrado, você receberá um link de recuperação.', 'success');
            } else {
                mostrarMensagemReset('Erro ao processar a solicitação. Tente novamente.', 'error');
            }
        } catch (error) {
            console.error("Erro:", error);
            mostrarMensagemReset('Erro ao conectar com o servidor.', 'error');
        } finally {
            btn.disabled = false;
            btnText.textContent = 'Enviar link de recuperação';
            spinner.classList.add('d-none');
        }
    });
}
