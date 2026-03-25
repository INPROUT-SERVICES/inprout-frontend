// ==========================================================
// ADMIN - Gerenciamento de Usuários, Logs de Login e Ações
// ==========================================================

let usuarioSelecionadoId = null;
let todosSegmentos = [];
let todosUsuarios = [];

// ==========================================================
// INICIALIZAÇÃO
// ==========================================================

async function init() {
    const role = localStorage.getItem('role');
    if (role !== 'ADMIN') {
        window.location.href = '/index.html';
        return;
    }

    // Carregar dados iniciais
    await Promise.all([
        carregarUsuarios(),
        carregarSegmentos()
    ]);

    // Listeners das tabs — carregar dados ao clicar
    document.querySelectorAll('button[data-bs-toggle="tab"]').forEach(tab => {
        tab.addEventListener('shown.bs.tab', (e) => {
            const target = e.target.getAttribute('data-bs-target');
            if (target === '#tab-log-login') {
                carregarLogLogin(0);
            } else if (target === '#tab-log-acoes') {
                carregarLogAcoes(0);
            }
        });
    });

    // Listener do filtro de usuários
    const inputFiltro = document.getElementById('filtroUsuarios');
    if (inputFiltro) {
        inputFiltro.addEventListener('input', filtrarUsuarios);
    }
}

// ==========================================================
// USUÁRIOS
// ==========================================================

async function carregarUsuarios() {
    try {
        toggleLoader(true);
        const response = await fetchComAuth('/api/admin/usuarios');

        if (!response.ok) {
            const erro = await response.json().catch(() => null);
            throw new Error(erro?.message || 'Erro ao carregar usuários');
        }

        todosUsuarios = await response.json();
        renderizarTabelaUsuarios(todosUsuarios);
    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: 'Erro',
            text: error.message,
            confirmButtonColor: '#198754'
        });
    } finally {
        toggleLoader(false);
    }
}

function renderizarTabelaUsuarios(usuarios) {
    const tbody = document.getElementById('tabelaUsuariosBody');
    if (!tbody) return;

    if (!usuarios || usuarios.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center text-muted py-4">
                    Nenhum usuário encontrado
                </td>
            </tr>`;
        return;
    }

    tbody.innerHTML = usuarios.map(u => {
        const segmentosTexto = u.segmentos && u.segmentos.length > 0
            ? u.segmentos.map(s => s.nome).join(', ')
            : '<span class="text-muted">Nenhum</span>';

        const statusBadge = u.ativo
            ? '<span class="badge bg-success">Ativo</span>'
            : '<span class="badge bg-danger">Inativo</span>';

        const dataCriacao = formatarDataHora(u.dataCriacao);

        const statusBtnText = u.ativo ? 'Desativar' : 'Ativar';
        const statusBtnClass = u.ativo ? 'btn-outline-danger' : 'btn-outline-success';
        const statusBtnIcon = u.ativo ? 'bi-person-x' : 'bi-person-check';

        return `
            <tr>
                <td>${escapeHtml(u.nome)}</td>
                <td>${escapeHtml(u.email)}</td>
                <td><span class="badge bg-secondary">${escapeHtml(u.role)}</span></td>
                <td>${segmentosTexto}</td>
                <td>${statusBadge}</td>
                <td>${dataCriacao}</td>
                <td>
                    <div class="d-flex gap-1 flex-wrap">
                        <button class="btn btn-outline-primary btn-sm" title="Alterar Role"
                            onclick="abrirModalAlterarRole(${u.id}, '${escapeHtmlAttr(u.nome)}', '${escapeHtmlAttr(u.role)}')">
                            <i class="bi bi-shield-lock"></i>
                        </button>
                        <button class="btn btn-outline-info btn-sm" title="Alterar Segmentos"
                            onclick="abrirModalAlterarSegmentos(${u.id}, '${escapeHtmlAttr(u.nome)}', ${escapeHtmlAttr(JSON.stringify(u.segmentos || []))})">
                            <i class="bi bi-diagram-3"></i>
                        </button>
                        <button class="btn btn-outline-warning btn-sm" title="Resetar Senha"
                            onclick="abrirModalResetarSenha(${u.id}, '${escapeHtmlAttr(u.nome)}')">
                            <i class="bi bi-key"></i>
                        </button>
                        <button class="btn ${statusBtnClass} btn-sm" title="${statusBtnText}"
                            onclick="abrirModalConfirmarStatus(${u.id}, '${escapeHtmlAttr(u.nome)}', ${u.ativo})">
                            <i class="bi ${statusBtnIcon}"></i>
                        </button>
                    </div>
                </td>
            </tr>`;
    }).join('');
}

function filtrarUsuarios() {
    const filtro = document.getElementById('filtroUsuarios')?.value.toLowerCase().trim() || '';

    if (!filtro) {
        renderizarTabelaUsuarios(todosUsuarios);
        return;
    }

    const filtrados = todosUsuarios.filter(u =>
        u.nome.toLowerCase().includes(filtro) ||
        u.email.toLowerCase().includes(filtro)
    );

    renderizarTabelaUsuarios(filtrados);
}

// ==========================================================
// SEGMENTOS
// ==========================================================

async function carregarSegmentos() {
    try {
        const response = await fetchComAuth('/api/segmentos');

        if (!response.ok) {
            throw new Error('Erro ao carregar segmentos');
        }

        todosSegmentos = await response.json();
    } catch (error) {
        console.error('Erro ao carregar segmentos:', error);
    }
}

function renderizarCheckboxesSegmentos(containerId, segmentosSelecionados = []) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const idsSelecionados = segmentosSelecionados.map(s => s.id);

    container.innerHTML = todosSegmentos.map(seg => {
        const checked = idsSelecionados.includes(seg.id) ? 'checked' : '';
        return `
            <div class="form-check">
                <input class="form-check-input" type="checkbox" value="${seg.id}"
                    id="${containerId}_seg_${seg.id}" ${checked}>
                <label class="form-check-label" for="${containerId}_seg_${seg.id}">
                    ${escapeHtml(seg.nome)}
                </label>
            </div>`;
    }).join('');
}

function obterSegmentosSelecionados(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return [];

    return Array.from(container.querySelectorAll('input[type="checkbox"]:checked'))
        .map(cb => parseInt(cb.value));
}

// ==========================================================
// MODAL — NOVO USUÁRIO
// ==========================================================

function abrirModalNovoUsuario() {
    usuarioSelecionadoId = null;

    document.getElementById('novoUsuarioNome').value = '';
    document.getElementById('novoUsuarioEmail').value = '';
    document.getElementById('novoUsuarioSenha').value = '';
    document.getElementById('novoUsuarioRole').value = 'USER';
    document.getElementById('novoUsuarioSenhaAdmin').value = '';

    renderizarCheckboxesSegmentos('novoUsuarioSegmentos', []);

    const modal = new bootstrap.Modal(document.getElementById('modalNovoUsuario'));
    modal.show();
}

async function criarUsuario() {
    const nome = document.getElementById('novoUsuarioNome').value.trim();
    const email = document.getElementById('novoUsuarioEmail').value.trim();
    const senha = document.getElementById('novoUsuarioSenha').value;
    const role = document.getElementById('novoUsuarioRole').value;
    const senhaAdmin = document.getElementById('novoUsuarioSenhaAdmin').value;
    const segmentoIds = obterSegmentosSelecionados('novoUsuarioSegmentos');

    if (!nome || !email || !senha || !senhaAdmin) {
        Swal.fire({
            icon: 'error',
            title: 'Erro',
            text: 'Preencha todos os campos obrigatórios',
            confirmButtonColor: '#198754'
        });
        return;
    }

    if (senha.length < 8) {
        Swal.fire({
            icon: 'error',
            title: 'Erro',
            text: 'A senha deve ter no mínimo 8 caracteres',
            confirmButtonColor: '#198754'
        });
        return;
    }

    try {
        toggleLoader(true);
        const response = await fetchComAuth('/api/admin/usuarios', {
            method: 'POST',
            body: JSON.stringify({ nome, email, senha, role, segmentoIds, senhaAdmin })
        });

        if (response.status === 403) {
            Swal.fire({
                icon: 'error',
                title: 'Erro',
                text: 'Senha de administrador incorreta',
                confirmButtonColor: '#198754'
            });
            return;
        }

        if (!response.ok) {
            const erro = await response.json().catch(() => null);
            throw new Error(erro?.message || 'Erro ao criar usuário');
        }

        bootstrap.Modal.getInstance(document.getElementById('modalNovoUsuario'))?.hide();

        Swal.fire({
            icon: 'success',
            title: 'Usuário criado com sucesso',
            confirmButtonColor: '#198754'
        });

        await carregarUsuarios();
    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: 'Erro',
            text: error.message,
            confirmButtonColor: '#198754'
        });
    } finally {
        toggleLoader(false);
    }
}

// ==========================================================
// MODAL — ALTERAR ROLE
// ==========================================================

function abrirModalAlterarRole(id, nomeUsuario, roleAtual) {
    usuarioSelecionadoId = id;

    document.getElementById('alterarRoleNomeUsuario').textContent = nomeUsuario;
    document.getElementById('alterarRoleSelect').value = roleAtual;
    document.getElementById('alterarRoleSenhaAdmin').value = '';

    const modal = new bootstrap.Modal(document.getElementById('modalAlterarRole'));
    modal.show();
}

async function alterarRole() {
    const role = document.getElementById('alterarRoleSelect').value;
    const senhaAdmin = document.getElementById('alterarRoleSenhaAdmin').value;

    if (!senhaAdmin) {
        Swal.fire({
            icon: 'error',
            title: 'Erro',
            text: 'Informe a senha de administrador',
            confirmButtonColor: '#198754'
        });
        return;
    }

    try {
        toggleLoader(true);
        const response = await fetchComAuth(`/api/admin/usuarios/${usuarioSelecionadoId}/role`, {
            method: 'PUT',
            body: JSON.stringify({ role, senhaAdmin })
        });

        if (response.status === 403) {
            Swal.fire({
                icon: 'error',
                title: 'Erro',
                text: 'Senha de administrador incorreta',
                confirmButtonColor: '#198754'
            });
            return;
        }

        if (!response.ok) {
            const erro = await response.json().catch(() => null);
            throw new Error(erro?.message || 'Erro ao alterar role');
        }

        bootstrap.Modal.getInstance(document.getElementById('modalAlterarRole'))?.hide();

        Swal.fire({
            icon: 'success',
            title: 'Role alterada com sucesso',
            confirmButtonColor: '#198754'
        });

        await carregarUsuarios();
    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: 'Erro',
            text: error.message,
            confirmButtonColor: '#198754'
        });
    } finally {
        toggleLoader(false);
    }
}

// ==========================================================
// MODAL — ALTERAR SEGMENTOS
// ==========================================================

function abrirModalAlterarSegmentos(id, nomeUsuario, segmentosAtuais) {
    usuarioSelecionadoId = id;

    document.getElementById('alterarSegmentosNomeUsuario').textContent = nomeUsuario;
    document.getElementById('alterarSegmentosSenhaAdmin').value = '';

    renderizarCheckboxesSegmentos('alterarSegmentosCheckboxes', segmentosAtuais);

    const modal = new bootstrap.Modal(document.getElementById('modalAlterarSegmentos'));
    modal.show();
}

async function alterarSegmentos() {
    const segmentoIds = obterSegmentosSelecionados('alterarSegmentosCheckboxes');
    const senhaAdmin = document.getElementById('alterarSegmentosSenhaAdmin').value;

    if (!senhaAdmin) {
        Swal.fire({
            icon: 'error',
            title: 'Erro',
            text: 'Informe a senha de administrador',
            confirmButtonColor: '#198754'
        });
        return;
    }

    try {
        toggleLoader(true);
        const response = await fetchComAuth(`/api/admin/usuarios/${usuarioSelecionadoId}/segmentos`, {
            method: 'PUT',
            body: JSON.stringify({ segmentoIds, senhaAdmin })
        });

        if (response.status === 403) {
            Swal.fire({
                icon: 'error',
                title: 'Erro',
                text: 'Senha de administrador incorreta',
                confirmButtonColor: '#198754'
            });
            return;
        }

        if (!response.ok) {
            const erro = await response.json().catch(() => null);
            throw new Error(erro?.message || 'Erro ao alterar segmentos');
        }

        bootstrap.Modal.getInstance(document.getElementById('modalAlterarSegmentos'))?.hide();

        Swal.fire({
            icon: 'success',
            title: 'Segmentos alterados com sucesso',
            confirmButtonColor: '#198754'
        });

        await carregarUsuarios();
    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: 'Erro',
            text: error.message,
            confirmButtonColor: '#198754'
        });
    } finally {
        toggleLoader(false);
    }
}

// ==========================================================
// MODAL — RESETAR SENHA
// ==========================================================

function abrirModalResetarSenha(id, nomeUsuario) {
    usuarioSelecionadoId = id;

    document.getElementById('resetarSenhaNomeUsuario').textContent = nomeUsuario;
    document.getElementById('resetarSenhaNovaSenha').value = '';
    document.getElementById('resetarSenhaSenhaAdmin').value = '';

    const modal = new bootstrap.Modal(document.getElementById('modalResetarSenha'));
    modal.show();
}

async function resetarSenha() {
    const novaSenha = document.getElementById('resetarSenhaNovaSenha').value;
    const senhaAdmin = document.getElementById('resetarSenhaSenhaAdmin').value;

    if (!novaSenha || !senhaAdmin) {
        Swal.fire({
            icon: 'error',
            title: 'Erro',
            text: 'Preencha todos os campos',
            confirmButtonColor: '#198754'
        });
        return;
    }

    if (novaSenha.length < 8) {
        Swal.fire({
            icon: 'error',
            title: 'Erro',
            text: 'A nova senha deve ter no mínimo 8 caracteres',
            confirmButtonColor: '#198754'
        });
        return;
    }

    try {
        toggleLoader(true);
        const response = await fetchComAuth(`/api/admin/usuarios/${usuarioSelecionadoId}/resetar-senha`, {
            method: 'PUT',
            body: JSON.stringify({ novaSenha, senhaAdmin })
        });

        if (response.status === 403) {
            Swal.fire({
                icon: 'error',
                title: 'Erro',
                text: 'Senha de administrador incorreta',
                confirmButtonColor: '#198754'
            });
            return;
        }

        if (!response.ok) {
            const erro = await response.json().catch(() => null);
            throw new Error(erro?.message || 'Erro ao resetar senha');
        }

        bootstrap.Modal.getInstance(document.getElementById('modalResetarSenha'))?.hide();

        Swal.fire({
            icon: 'success',
            title: 'Senha resetada com sucesso',
            confirmButtonColor: '#198754'
        });
    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: 'Erro',
            text: error.message,
            confirmButtonColor: '#198754'
        });
    } finally {
        toggleLoader(false);
    }
}

// ==========================================================
// MODAL — ALTERAR STATUS (ATIVAR/DESATIVAR)
// ==========================================================

function abrirModalConfirmarStatus(id, nomeUsuario, ativoAtual) {
    usuarioSelecionadoId = id;

    const acao = ativoAtual ? 'desativar' : 'ativar';
    document.getElementById('confirmarStatusTexto').textContent =
        `Deseja ${acao} o usuário "${nomeUsuario}"?`;
    document.getElementById('confirmarStatusAtivoAtual').value = ativoAtual;
    document.getElementById('confirmarStatusSenhaAdmin').value = '';

    const modal = new bootstrap.Modal(document.getElementById('modalConfirmarStatus'));
    modal.show();
}

async function alterarStatus() {
    const ativoAtual = document.getElementById('confirmarStatusAtivoAtual').value === 'true';
    const senhaAdmin = document.getElementById('confirmarStatusSenhaAdmin').value;

    if (!senhaAdmin) {
        Swal.fire({
            icon: 'error',
            title: 'Erro',
            text: 'Informe a senha de administrador',
            confirmButtonColor: '#198754'
        });
        return;
    }

    try {
        toggleLoader(true);
        const response = await fetchComAuth(`/api/admin/usuarios/${usuarioSelecionadoId}/status`, {
            method: 'PUT',
            body: JSON.stringify({ ativo: !ativoAtual, senhaAdmin })
        });

        if (response.status === 403) {
            Swal.fire({
                icon: 'error',
                title: 'Erro',
                text: 'Senha de administrador incorreta',
                confirmButtonColor: '#198754'
            });
            return;
        }

        if (!response.ok) {
            const erro = await response.json().catch(() => null);
            throw new Error(erro?.message || 'Erro ao alterar status');
        }

        bootstrap.Modal.getInstance(document.getElementById('modalConfirmarStatus'))?.hide();

        const novoStatus = !ativoAtual ? 'ativado' : 'desativado';
        Swal.fire({
            icon: 'success',
            title: `Usuário ${novoStatus} com sucesso`,
            confirmButtonColor: '#198754'
        });

        await carregarUsuarios();
    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: 'Erro',
            text: error.message,
            confirmButtonColor: '#198754'
        });
    } finally {
        toggleLoader(false);
    }
}

// ==========================================================
// LOG DE LOGIN
// ==========================================================

async function carregarLogLogin(page = 0) {
    try {
        toggleLoader(true);

        const filtroEmail = document.getElementById('filtroLogLoginEmail')?.value.trim() || '';
        let url = `/api/admin/audit/login?page=${page}&size=20`;
        if (filtroEmail) {
            url += `&email=${encodeURIComponent(filtroEmail)}`;
        }

        const response = await fetchComAuth(url);

        if (!response.ok) {
            throw new Error('Erro ao carregar log de login');
        }

        const data = await response.json();
        renderizarTabelaLogLogin(data.content);
        renderizarPaginacao('paginacaoLogLogin', data.number, data.totalPages, carregarLogLogin);
    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: 'Erro',
            text: error.message,
            confirmButtonColor: '#198754'
        });
    } finally {
        toggleLoader(false);
    }
}

function renderizarTabelaLogLogin(registros) {
    const tbody = document.getElementById('tabelaLogLoginBody');
    if (!tbody) return;

    if (!registros || registros.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center text-muted py-4">
                    Nenhum registro encontrado
                </td>
            </tr>`;
        return;
    }

    tbody.innerHTML = registros.map(r => {
        const sucessoBadge = r.sucesso
            ? '<span class="badge bg-success">Sim</span>'
            : '<span class="badge bg-danger">Não</span>';

        return `
            <tr>
                <td>${formatarDataHora(r.dataHora)}</td>
                <td>${escapeHtml(r.email || '')}</td>
                <td>${escapeHtml(r.ip || '')}</td>
                <td>${sucessoBadge}</td>
                <td>${escapeHtml(r.mensagem || '')}</td>
            </tr>`;
    }).join('');
}

// ==========================================================
// LOG DE AÇÕES
// ==========================================================

async function carregarLogAcoes(page = 0) {
    try {
        toggleLoader(true);

        const url = `/api/admin/audit/acoes?page=${page}&size=20`;
        const response = await fetchComAuth(url);

        if (!response.ok) {
            throw new Error('Erro ao carregar log de ações');
        }

        const data = await response.json();
        renderizarTabelaLogAcoes(data.content);
        renderizarPaginacao('paginacaoLogAcoes', data.number, data.totalPages, carregarLogAcoes);
    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: 'Erro',
            text: error.message,
            confirmButtonColor: '#198754'
        });
    } finally {
        toggleLoader(false);
    }
}

function renderizarTabelaLogAcoes(registros) {
    const tbody = document.getElementById('tabelaLogAcoesBody');
    if (!tbody) return;

    if (!registros || registros.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center text-muted py-4">
                    Nenhum registro encontrado
                </td>
            </tr>`;
        return;
    }

    tbody.innerHTML = registros.map(r => `
        <tr>
            <td>${formatarDataHora(r.dataHora)}</td>
            <td>${escapeHtml(r.usuario || '')}</td>
            <td>${escapeHtml(r.acao || '')}</td>
            <td>${escapeHtml(r.entidade || '')}</td>
            <td>${escapeHtml(r.detalhes || '')}</td>
        </tr>`
    ).join('');
}

// ==========================================================
// PAGINAÇÃO
// ==========================================================

function renderizarPaginacao(containerId, paginaAtual, totalPaginas, callback) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (totalPaginas <= 1) {
        container.innerHTML = '';
        return;
    }

    let html = '<nav><ul class="pagination pagination-sm justify-content-center mb-0">';

    // Botão anterior
    html += `
        <li class="page-item ${paginaAtual === 0 ? 'disabled' : ''}">
            <a class="page-link" href="#" onclick="event.preventDefault(); ${callback.name}(${paginaAtual - 1})">
                &laquo;
            </a>
        </li>`;

    // Páginas
    const inicio = Math.max(0, paginaAtual - 2);
    const fim = Math.min(totalPaginas - 1, paginaAtual + 2);

    if (inicio > 0) {
        html += `
            <li class="page-item">
                <a class="page-link" href="#" onclick="event.preventDefault(); ${callback.name}(0)">1</a>
            </li>`;
        if (inicio > 1) {
            html += '<li class="page-item disabled"><span class="page-link">...</span></li>';
        }
    }

    for (let i = inicio; i <= fim; i++) {
        html += `
            <li class="page-item ${i === paginaAtual ? 'active' : ''}">
                <a class="page-link" href="#" onclick="event.preventDefault(); ${callback.name}(${i})">${i + 1}</a>
            </li>`;
    }

    if (fim < totalPaginas - 1) {
        if (fim < totalPaginas - 2) {
            html += '<li class="page-item disabled"><span class="page-link">...</span></li>';
        }
        html += `
            <li class="page-item">
                <a class="page-link" href="#" onclick="event.preventDefault(); ${callback.name}(${totalPaginas - 1})">${totalPaginas}</a>
            </li>`;
    }

    // Botão próximo
    html += `
        <li class="page-item ${paginaAtual === totalPaginas - 1 ? 'disabled' : ''}">
            <a class="page-link" href="#" onclick="event.preventDefault(); ${callback.name}(${paginaAtual + 1})">
                &raquo;
            </a>
        </li>`;

    html += '</ul></nav>';
    container.innerHTML = html;
}

// ==========================================================
// UTILITÁRIOS
// ==========================================================

function formatarDataHora(dateString) {
    if (!dateString) return '';

    const data = new Date(dateString);
    if (isNaN(data.getTime())) return dateString;

    const dia = String(data.getDate()).padStart(2, '0');
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const ano = data.getFullYear();
    const hora = String(data.getHours()).padStart(2, '0');
    const min = String(data.getMinutes()).padStart(2, '0');
    const seg = String(data.getSeconds()).padStart(2, '0');

    return `${dia}/${mes}/${ano} ${hora}:${min}:${seg}`;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function escapeHtmlAttr(text) {
    if (text === null || text === undefined) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/'/g, '&#39;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

// ==========================================================
// INICIALIZAR
// ==========================================================

document.addEventListener('DOMContentLoaded', init);
