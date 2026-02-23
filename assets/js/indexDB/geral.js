const API_DOCS_URL = '/api/docs/documentos';
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
        // 1. Busca a lista básica de documentos (só traz dados básicos)
        const response = await fetchComAuth(API_DOCS_URL);
        const documentosBasicos = await response.json();
        
        tbody.innerHTML = '';

        // Filtra apenas os ativos, já que o novo backend usa soft delete (ativo = true)
        const ativos = documentosBasicos.filter(doc => doc.ativo);

        if (ativos.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-muted">Nenhum registro encontrado.</td></tr>`;
            return;
        }

        // 2. Busca o detalhe de cada documento para obter as precificações e montar a tabela
        const detalhesPromises = ativos.map(doc => 
            fetchComAuth(`${API_DOCS_URL}/${doc.id}`).then(res => res.json())
        );
            
        let dados = await Promise.all(detalhesPromises);
        dados.sort((a, b) => a.nome.localeCompare(b.nome));

        dados.forEach(tipo => {
            const tr = document.createElement('tr');

            // O novo backend não tem valor padrão, deixamos como um traço ou aviso visual
            const valorFormatado = '-';

            // Cria badges para os documentistas e seus respectivos valores
            let docBadges = '';
            if (tipo.precificacoes && tipo.precificacoes.length > 0) {
                docBadges = '<div class="d-flex flex-wrap gap-1 justify-content-center">';
                tipo.precificacoes.forEach(c => {
                    const docInfo = listaDocumentistasCache.find(d => d.id === c.usuarioId);
                    const nome = docInfo ? docInfo.nome.split(' ')[0] : 'ID:' + c.usuarioId;
                    const styleClass = c.valor ? 'bg-success' : 'bg-secondary';
                    const title = c.valor ? `Valor: R$ ${c.valor}` : 'Sem valor definido';

                    docBadges += `<span class="badge ${styleClass}" title="${title}">${nome}</span>`;
                });
                docBadges += '</div>';
            } else {
                docBadges = '<span class="text-muted small">Nenhum habilitado</span>';
            }

            // Prepara dados para edição
            const jsonConfigs = JSON.stringify(tipo.precificacoes).replace(/"/g, "&quot;");

            tr.innerHTML = `
                <td class="fw-semibold text-dark align-middle">${tipo.nome}</td>
                <td class="align-middle text-muted">${valorFormatado}</td>
                <td class="align-middle text-center">${docBadges}</td>
                <td class="align-middle text-end">
                    <button class="btn-icon-modern edit" onclick='editarTipoDoc(${tipo.id}, "${tipo.nome}", ${jsonConfigs})' title="Editar">
                        <i class="bi bi-pencil-square"></i>
                    </button>
                    <button class="btn-icon-modern delete" onclick="prepararDeletarTipoDoc(${tipo.id}, '${tipo.nome}')" title="Excluir">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) { 
        console.error(e); 
        mostrarToast("Erro ao carregar os documentos.", "error");
    }
}

function renderizarListaConfig(configsExistentes = []) {
    const container = document.getElementById('listaDocumentistasConfig');
    container.innerHTML = '';

    if (!listaDocumentistasCache || listaDocumentistasCache.length === 0) {
        container.innerHTML = '<div class="p-3 text-center text-muted">Nenhum documentista encontrado.</div>';
        return;
    }

    listaDocumentistasCache.forEach(doc => {
        // No novo backend a referência é "usuarioId" em vez de "documentistaId"
        const config = configsExistentes.find(c => c.usuarioId === doc.id);
        const isChecked = !!config;
        const valorEspecifico = config && config.valor !== null ? config.valor : '';

        const row = document.createElement('div');
        row.className = 'mdoc-item-row';

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
                    placeholder="Valor" value="${valorEspecifico}" 
                    ${!isChecked ? 'disabled' : ''}>
            </div>
        `;
        container.appendChild(row);
    });
}

window.toggleInputValor = function (checkbox) {
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
    
    // Desabilita o valor padrão visualmente
    const valorPadraoEl = document.getElementById('tipoDocValorPadrao');
    if(valorPadraoEl) {
        valorPadraoEl.value = '';
        valorPadraoEl.disabled = true; 
        valorPadraoEl.placeholder = "Indisponível no novo modelo";
    }

    document.getElementById('modalTipoDocLabel').textContent = 'Novo Tipo de Documentação';
    renderizarListaConfig([]);
    modalTipoDocInstance.show();
}

function editarTipoDoc(id, nome, configs) {
    document.getElementById('tipoDocId').value = id;
    document.getElementById('tipoDocNome').value = nome;
    
    // Desabilita o valor padrão visualmente
    const valorPadraoEl = document.getElementById('tipoDocValorPadrao');
    if(valorPadraoEl) {
        valorPadraoEl.value = '';
        valorPadraoEl.disabled = true; 
        valorPadraoEl.placeholder = "Indisponível no novo modelo";
    }

    renderizarListaConfig(configs);
    document.getElementById('modalTipoDocLabel').textContent = 'Editar Tipo de Documentação';
    modalTipoDocInstance.show();
}

async function salvarTipoDoc() {
    const id = document.getElementById('tipoDocId').value;
    const nome = document.getElementById('tipoDocNome').value.trim();

    if (!nome) {
        mostrarToast("O nome é obrigatório.", "warning");
        return;
    }

    // Coleta configurações
    const documentistaIds = [];
    const precificacoes = [];
    const rows = document.querySelectorAll('#listaDocumentistasConfig .mdoc-item-row');

    rows.forEach(row => {
        const checkbox = row.querySelector('.chk-doc-habilitar');
        const inputValor = row.querySelector('.input-doc-valor');

        if (checkbox && checkbox.checked) {
            const docId = parseInt(checkbox.value);
            documentistaIds.push(docId);
            const valor = inputValor.value ? parseFloat(inputValor.value) : 0.0;
            precificacoes.push({
                usuarioId: docId,
                valor: valor
            });
        }
    });

    const payloadDocumento = {
        nome: nome,
        documentistaIds: documentistaIds
    };

    toggleLoader(true);

    try {
        let docId = id;
        
        // 1. CHAMA O ENDPOINT DE CRIAR OU ATUALIZAR
        if (!id) {
            const response = await fetchComAuth(API_DOCS_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payloadDocumento)
            });
            if (!response.ok) throw new Error("Erro ao criar documento.");
            const data = await response.json();
            docId = data.id; // Guarda o ID gerado
        } else {
            const response = await fetchComAuth(`${API_DOCS_URL}/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payloadDocumento)
            });
            if (!response.ok) throw new Error("Erro ao atualizar documento.");
        }

        // 2. CHAMA O ENDPOINT DE PRECIFICAR COM OS VALORES COLETADOS
        const payloadPrecificacao = {
            precificacoes: precificacoes
        };

        const precificacaoResponse = await fetchComAuth(`${API_DOCS_URL}/${docId}/precificar`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payloadPrecificacao)
        });

        if (!precificacaoResponse.ok) throw new Error("Erro ao salvar as precificações dos documentistas.");

        modalTipoDocInstance.hide();
        mostrarToast("Documento salvo e precificado com sucesso!", "success");
        await carregarTiposDoc();
        
    } catch (error) {
        console.error(error);
        mostrarToast(error.message || "Erro de conexão.", "error");
    } finally {
        toggleLoader(false);
    }
}

// -- Lógica de Exclusão de Tipo Doc --

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
        // No novo backend, deletar é um PATCH que desativa o documento
        const response = await fetchComAuth(`${API_DOCS_URL}/${idTipoDocParaDeletar}/desativar`, { 
            method: 'PATCH' 
        });
        
        if (response.ok) {
            mostrarToast("Documento desativado com sucesso.", "success");
            await carregarTiposDoc();
        } else {
            mostrarToast('Erro ao tentar desativar o documento.', "error");
        }
    } catch (error) {
        console.error(error);
        mostrarToast('Erro de conexão ao tentar desativar.', "error");
    } finally {
        toggleLoader(false);
        idTipoDocParaDeletar = null;
    }
}