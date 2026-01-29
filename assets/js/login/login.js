// Função para mostrar mensagens (já existe, mantenha como está)
function mostrarMensagem(texto, tipo = 'success') {
    const mensagemEl = document.getElementById('mensagem');
    mensagemEl.classList.remove('d-none', 'alert-success', 'alert-error');
    mensagemEl.classList.add('alert', tipo === 'success' ? 'alert-success' : 'alert-error');
    mensagemEl.textContent = texto;
}

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
        // ==========================================================
        // ===== CORREÇÃO PRINCIPAL AQUI =====
        // Trocamos fetchComAuth pelo fetch PADRÃO, pois esta é a única
        // requisição que não precisa (e não pode) enviar um token.
        // ==========================================================
        const response = await fetch('https://www.inproutservices.com.br/api/usuarios/login', {
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
                // ----------------------
            }, 1000);

        } else {
            const erroTexto = await response.text(); // Pega a mensagem de erro do backend
            mostrarMensagem(erroTexto || 'E-mail ou senha inválidos!', 'error');
            // Restaura o botão em caso de erro
            btnLogin.disabled = false;
            btnText.textContent = 'Entrar';
            spinner.classList.add('d-none');
        }

    } catch (error) {
        console.error("Erro de conexão:", error); // Adiciona um log para ver o erro no console
        mostrarMensagem('Erro ao conectar com o servidor.', 'error');
        // Restaura o botão em caso de erro de conexão
        btnLogin.disabled = false;
        btnText.textContent = 'Entrar';
        spinner.classList.add('d-none');
    }
});