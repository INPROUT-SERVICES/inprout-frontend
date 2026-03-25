function mostrarMensagem(texto, tipo = 'success') {
    const mensagemEl = document.getElementById('mensagem');
    mensagemEl.classList.remove('d-none', 'alert-success', 'alert-error');
    mensagemEl.classList.add('alert', tipo === 'success' ? 'alert-success' : 'alert-error');
    mensagemEl.textContent = texto;
}

document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (!token) {
        mostrarMensagem('Link inválido ou expirado.', 'error');
        document.getElementById('formRedefinirSenha').style.display = 'none';
        return;
    }

    document.getElementById('formRedefinirSenha').addEventListener('submit', async (event) => {
        event.preventDefault();

        const novaSenha = document.getElementById('novaSenha').value;
        const confirmarSenha = document.getElementById('confirmarSenha').value;
        const btnRedefinir = document.getElementById('btnRedefinir');
        const btnText = btnRedefinir.querySelector('.btn-text');
        const spinner = btnRedefinir.querySelector('.spinner-border');

        if (!novaSenha || !confirmarSenha) {
            mostrarMensagem('Preencha todos os campos!', 'error');
            return;
        }

        if (novaSenha.length < 8) {
            mostrarMensagem('A senha deve ter no mínimo 8 caracteres.', 'error');
            return;
        }

        if (novaSenha !== confirmarSenha) {
            mostrarMensagem('As senhas não coincidem.', 'error');
            return;
        }

        // Ativa o estado de carregamento do botão
        btnRedefinir.disabled = true;
        btnText.textContent = 'Redefinindo...';
        spinner.classList.remove('d-none');

        try {
            const response = await fetch('/api/auth/redefinir-senha', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, novaSenha })
            });

            if (response.ok) {
                mostrarMensagem('Senha redefinida com sucesso!', 'success');
                document.getElementById('formRedefinirSenha').querySelector('button[type="submit"]').style.display = 'none';

                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 2000);
            } else {
                const erroTexto = await response.text();
                mostrarMensagem(erroTexto || 'Token inválido ou expirado.', 'error');
                btnRedefinir.disabled = false;
                btnText.textContent = 'Redefinir Senha';
                spinner.classList.add('d-none');
            }
        } catch (error) {
            console.error('Erro de conexão:', error);
            mostrarMensagem('Erro ao conectar com o servidor.', 'error');
            btnRedefinir.disabled = false;
            btnText.textContent = 'Redefinir Senha';
            spinner.classList.add('d-none');
        }
    });
});