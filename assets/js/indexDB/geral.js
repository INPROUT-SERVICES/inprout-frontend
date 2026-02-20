const API_GERAL_URL = '/api/tipos-documentacao';
const API_BANCOS_URL = '/api/geral/bancos';
const API_DOCUMENTISTAS = '/api/usuarios/documentistas';

let modalTipoDocInstance;
let modalBancoInstance;
// Novas instâncias para os modais de exclusão
let modalExcluirBancoInstance;
let modalExcluirTipoDocInstance;

let listaDocumentistasCache = [];

// Variáveis para armazenar o ID temporariamente antes de excluir
let idBancoParaDeletar = null;
let idTipoDocParaDeletar = null;

document.addEventListener('DOMContentLoaded', () => {
    verificarPermissaoGeral();

    // Inicializa modais existentes
    const modalDocEl = document.getElementById('modalTipoDoc');
    if (modalDocEl) modalTipoDocInstance = new bootstrap.Modal(modalDocEl);

    const modalBancoEl = document.getElementById('modalBanco');
    if (modalBancoEl) modalBancoInstance = new bootstrap.Modal(modalBancoEl);

    // Inicializa NOVOS modais de exclusão
    const modalExcluirBancoEl = document.getElementById('modalExcluirBanco');
    if (modalExcluirBancoEl) modalExcluirBancoInstance = new bootstrap.Modal(modalExcluirBancoEl);

    const modalExcluirTipoDocEl = document.getElementById('modalExcluirTipoDoc');
    if (modalExcluirTipoDocEl) modalExcluirTipoDocInstance = new bootstrap.Modal(modalExcluirTipoDocEl);


    // Listener para carregar dados ao clicar na aba
    const cardGeral = document.querySelector('.segment-card[data-filter="geral"]');
    if (cardGeral) {
        cardGeral.addEventListener('click', () => {
            alternarSubsecao('docs');
            carregarDocumentistasParaSelect();
        });
    }
});

// --- Função Auxiliar de Loader ---
function toggleLoader(show) {
    const loader = document.getElementById('overlay-loader');
    if (loader) {
        if (show) loader.classList.remove('d-none');
        else loader.classList.add('d-none');
    }
}

// --- Controle de Abas (Subseções) ---
function alternarSubsecao(tipo) {
    const botoes = document.querySelectorAll('.settings-menu .list-group-item');
    botoes.forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.subsecao-geral').forEach(div => div.classList.add('d-none'));

    if (tipo === 'docs') {
        document.getElementById('subsecao-docs').classList.remove('d-none');
        if (botoes[0]) botoes[0].classList.add('active');
        carregarTiposDoc();
    } else if (tipo === 'bancos') {
        document.getElementById('subsecao-bancos').classList.remove('d-none');
        if (botoes[1]) botoes[1].classList.add('active');
        carregarBancos();
    }
}

// ==========================================
//               BANCOS
// ==========================================

async function carregarBancos() {
    const tbody = document.getElementById('tbody-bancos');
    tbody.innerHTML = '<tr><td colspan="3" class="text-center py-5"><div class="spinner-border text-primary"></div></td></tr>';

    try {
        const response = await fetchComAuth(API_BANCOS_URL);
        if (!response.ok) throw new Error('Erro');
        const bancos = await response.json();

        tbody.innerHTML = '';
        if (bancos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" class="text-center py-4 text-muted">Nenhum banco cadastrado.</td></tr>';
            return;
        }

        bancos.sort((a, b) => a.codigo.localeCompare(b.codigo));

        bancos.forEach(banco => {
            const tr = document.createElement('tr');
            // Nota: Adicionei as aspas simples corretamente nos argumentos do onclick
            tr.innerHTML = `
                <td class="fw-bold text-secondary">${banco.codigo}</td>
                <td class="fw-medium text-dark">${banco.nome}</td>
                <td>
                    <button class="btn-icon-modern edit" onclick="editarBanco(${banco.id}, '${banco.codigo}', '${banco.nome}')" title="Editar">
                        <i class="bi bi-pencil-square"></i>
                    </button>
                    <button class="btn-icon-modern delete" onclick="prepararDeletarBanco(${banco.id}, '${banco.nome}')" title="Excluir">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error(error);
        mostrarToast("Erro ao carregar bancos.", "error");
    }
}

function abrirModalBanco() {
    document.getElementById('formBanco').reset();
    document.getElementById('bancoId').value = '';
    document.querySelector('#modalBanco .modal-title').textContent = 'Novo Banco';
    modalBancoInstance.show();
}

function editarBanco(id, codigo, nome) {
    document.getElementById('bancoId').value = id;
    document.getElementById('bancoCodigo').value = codigo;
    document.getElementById('bancoNome').value = nome;
    document.querySelector('#modalBanco .modal-title').textContent = 'Editar Banco';
    modalBancoInstance.show();
}

async function salvarBanco() {
    const id = document.getElementById('bancoId').value;
    const codigo = document.getElementById('bancoCodigo').value.trim();
    const nome = document.getElementById('bancoNome').value.trim();

    if (!codigo || !nome) {
        mostrarToast("Preencha código e nome.", "warning");
        return;
    }

    const payload = { codigo, nome };
    if (id) payload.id = parseInt(id);

    // 1. Mostrar Loader
    toggleLoader(true);

    try {
        const response = await fetchComAuth(API_BANCOS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            mostrarToast("Banco salvo com sucesso!", "success");
            modalBancoInstance.hide();
            await carregarBancos();
        } else {
            mostrarToast("Erro ao salvar. Verifique se o código já existe.", "error");
        }
    } catch (error) {
        console.error(error);
        mostrarToast("Erro de conexão.", "error");
    } finally {
        // 2. Esconder Loader
        toggleLoader(false);
    }
}

// -- Lógica de Exclusão de Banco (Com Modal) --

function prepararDeletarBanco(id, nome) {
    idBancoParaDeletar = id;
    document.getElementById('nomeBancoExcluir').textContent = nome;
    modalExcluirBancoInstance.show();
}

async function confirmarDeletarBanco() {
    if (!idBancoParaDeletar) return;

    modalExcluirBancoInstance.hide();
    toggleLoader(true);

    try {
        const response = await fetchComAuth(`${API_BANCOS_URL}/${idBancoParaDeletar}`, { method: 'DELETE' });
        if (response.ok) {
            mostrarToast("Banco excluído.", "success");
            await carregarBancos();
        } else {
            mostrarToast("Erro ao excluir banco.", "error");
        }
    } catch (e) {
        mostrarToast("Erro de conexão.", "error");
    } finally {
        toggleLoader(false);
        idBancoParaDeletar = null;
    }
}


// ==========================================
//           TIPOS DE DOCUMENTAÇÃO
// ==========================================

async function carregarTiposDoc() {
    const tbody = document.getElementById('tbody-tipos-doc');
    tbody.innerHTML = '<tr><td colspan="4" class="text-center py-5"><div class="spinner-border text-primary"></div></td></tr>';

    try {
        const response = await fetchComAuth(API_GERAL_URL);
        const dados = await response.json();
        tbody.innerHTML = '';

        if (dados.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-muted">Nenhum registro encontrado.</td></tr>`;
            return;
        }

        dados.sort((a, b) => a.nome.localeCompare(b.nome));

        dados.forEach(tipo => {
            const tr = document.createElement('tr');

            // Formata o valor padrão
            const valorFormatado = tipo.valorPadrao
                ? tipo.valorPadrao.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                : '-';

            // Cria badges para os documentistas
            let docBadges = '';
            if (tipo.configuracoes && tipo.configuracoes.length > 0) {
                docBadges = '<div class="d-flex flex-wrap gap-1 justify-content-center">';
                tipo.configuracoes.forEach(c => {
                    // Encontra o nome do documentista no cache
                    const docInfo = listaDocumentistasCache.find(d => d.id === c.documentistaId);
                    const nome = docInfo ? docInfo.nome.split(' ')[0] : 'ID:' + c.documentistaId;
                    const styleClass = c.valor ? 'bg-success' : 'bg-secondary'; // Verde se tiver preço especial
                    const title = c.valor ? `Valor especial: R$ ${c.valor}` : 'Valor padrão';

                    docBadges += `<span class="badge ${styleClass}" title="${title}">${nome}</span>`;
                });
                docBadges += '</div>';
            } else {
                docBadges = '<span class="text-muted small">Nenhum habilitado</span>';
            }

            // Prepara dados para edição (atenção as aspas)
            const jsonConfigs = JSON.stringify(tipo.configuracoes).replace(/"/g, "&quot;");

            tr.innerHTML = `
                <td class="fw-semibold text-dark align-middle">${tipo.nome}</td>
                
                <td class="align-middle">${valorFormatado}</td>
                
                <td class="align-middle text-center">
                    ${docBadges}
                </td>
                
                <td class="align-middle text-end">
                    <button class="btn-icon-modern edit" onclick='editarTipoDoc(${tipo.id}, "${tipo.nome}", ${tipo.valorPadrao}, ${jsonConfigs})' title="Editar">
                        <i class="bi bi-pencil-square"></i>
                    </button>
                    <button class="btn-icon-modern delete" onclick="prepararDeletarTipoDoc(${tipo.id}, '${tipo.nome}')" title="Excluir">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) { console.error(e); }
}

function renderizarListaConfig(configsExistentes = []) {
    const container = document.getElementById('listaDocumentistasConfig');
    container.innerHTML = '';

    if (!listaDocumentistasCache || listaDocumentistasCache.length === 0) {
        container.innerHTML = '<div class="p-3 text-center text-muted">Nenhum documentista encontrado.</div>';
        return;
    }

    listaDocumentistasCache.forEach(doc => {
        // Verifica configuração existente
        const config = configsExistentes.find(c => c.documentistaId === doc.id);
        const isChecked = !!config;
        const valorEspecifico = config && config.valor !== null ? config.valor : '';

        // Cria o elemento da linha (div .mdoc-item-row)
        const row = document.createElement('div');
        row.className = 'mdoc-item-row';

        // Monta o HTML interno usando as classes mdoc-
        row.innerHTML = `
            <div class="mdoc-col-check">
                <input type="checkbox" class="form-check-input chk-doc-habilitar" 
                    value="${doc.id}" ${isChecked ? 'checked' : ''} 
                    style="cursor: pointer;"
                    onchange="toggleInputValor(this)">
            </div>
            
            <div class="mdoc-col-nome" title="${doc.nome}">
                ${doc.nome}
            </div>
            
            <div class="mdoc-col-valor">
                <input type="number" step="0.01" class="form-control mdoc-input-valor input-doc-valor" 
                    placeholder="Padrão" value="${valorEspecifico}" 
                    ${!isChecked ? 'disabled' : ''}>
            </div>
        `;
        container.appendChild(row);
    });
}

window.toggleInputValor = function (checkbox) {
    // Busca o input dentro da mesma linha (.mdoc-item-row)
    const row = checkbox.closest('.mdoc-item-row');
    const input = row.querySelector('.input-doc-valor');
    if (input) {
        input.disabled = !checkbox.checked;
        if (!checkbox.checked) input.value = '';
    }
}

function abrirModalTipoDoc() {
    document.getElementById('formTipoDoc').reset();
    document.getElementById('tipoDocId').value = '';
    document.getElementById('modalTipoDocLabel').textContent = 'Novo Tipo de Documentação';

    // Renderiza a lista vazia (nenhum marcado)
    renderizarListaConfig([]);
    modalTipoDocInstance.show();
}

function editarTipoDoc(id, nome, valorPadrao, configs) {
    document.getElementById('tipoDocId').value = id;
    document.getElementById('tipoDocNome').value = nome;
    document.getElementById('tipoDocValorPadrao').value = valorPadrao || '';

    // configs vem do objeto DTO no carregarTiposDoc
    renderizarListaConfig(configs);

    document.getElementById('modalTipoDocLabel').textContent = 'Editar Tipo de Documentação';
    modalTipoDocInstance.show();
}

async function salvarTipoDoc() {
    const id = document.getElementById('tipoDocId').value;
    const nome = document.getElementById('tipoDocNome').value.trim();
    const valorPadrao = document.getElementById('tipoDocValorPadrao').value;

    if (!nome) {
        mostrarToast("O nome é obrigatório.", "warning");
        return;
    }

    // Coleta configurações
    const configuracoes = [];
    // Seleciona todas as linhas geradas
    const rows = document.querySelectorAll('#listaDocumentistasConfig .mdoc-item-row');

    rows.forEach(row => {
        const checkbox = row.querySelector('.chk-doc-habilitar');
        const inputValor = row.querySelector('.input-doc-valor');

        if (checkbox && checkbox.checked) {
            const valor = inputValor.value ? parseFloat(inputValor.value) : null;
            configuracoes.push({
                documentistaId: parseInt(checkbox.value),
                valor: valor
            });
        }
    });

    const payload = {
        id: id ? parseInt(id) : null,
        nome: nome,
        valorPadrao: valorPadrao ? parseFloat(valorPadrao) : null,
        configuracoes: configuracoes
    };

    toggleLoader(true);

    try {
        const response = await fetchComAuth(API_GERAL_URL, { // Confirme se API_GERAL_URL está apontando para /tipos-documentacao
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            modalTipoDocInstance.hide();
            mostrarToast("Salvo com sucesso!", "success");
            await carregarTiposDoc();
        } else {
            const txt = await response.text();
            mostrarToast("Erro ao salvar: " + txt, "error");
        }
    } catch (error) {
        console.error(error);
        mostrarToast("Erro de conexão.", "error");
    } finally {
        toggleLoader(false);
    }
}

// -- Lógica de Exclusão de Tipo Doc (Com Modal) --

function prepararDeletarTipoDoc(id, nome) {
    idTipoDocParaDeletar = id;
    document.getElementById('nomeTipoDocExcluir').textContent = nome;
    modalExcluirTipoDocInstance.show();
}

async function confirmarDeletarTipoDoc() {
    if (!idTipoDocParaDeletar) return;

    modalExcluirTipoDocInstance.hide();
    toggleLoader(true);

    try {
        const response = await fetchComAuth(`${API_GERAL_URL}/${idTipoDocParaDeletar}`, { method: 'DELETE' });
        if (response.ok) {
            mostrarToast("Item excluído com sucesso.", "success");
            await carregarTiposDoc();
        } else {
            // Caso o backend retorne erro (ex: chave estrangeira)
            mostrarToast('Erro ao excluir. O item pode estar em uso.', "error");
        }
    } catch (error) {
        console.error(error);
        mostrarToast('Erro ao tentar excluir.', "error");
    } finally {
        toggleLoader(false);
        idTipoDocParaDeletar = null;
    }
}

// As funções verificarPermissaoGeral e carregarDocumentistasParaSelect permanecem iguais...
// (Elas já estão no código original que você enviou, pode mantê-las abaixo se não tiver apagado)
function verificarPermissaoGeral() {
    const userRole = (localStorage.getItem("role") || "").trim().toUpperCase();
    const allowedRoles = ['ADMIN', 'CONTROLLER', 'ASSISTANT'];
    const cardGeral = document.querySelector('.segment-card[data-filter="geral"]');

    if (cardGeral) {
        if (allowedRoles.includes(userRole)) {
            cardGeral.style.display = 'block';
        } else {
            cardGeral.style.display = 'none';
        }
    }
}

async function carregarDocumentistasParaSelect() {
    if (listaDocumentistasCache.length > 0) return;
    try {
        const response = await fetchComAuth(API_DOCUMENTISTAS);
        if (response.ok) {
            listaDocumentistasCache = await response.json();
            const select = document.getElementById('tipoDocResponsavel');
            if (select) {
                select.innerHTML = '';
                listaDocumentistasCache.forEach(doc => {
                    select.add(new Option(doc.nome, doc.id));
                });
            }
        }
    } catch (error) {
        console.error("Erro documentistas", error);
    }
}