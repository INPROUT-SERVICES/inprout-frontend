// ==========================================================
// LÓGICA DA ABA: DOCUMENTAÇÃO (Nova API de Microsserviço)
// ==========================================================

let filtroDocAtual = 'TODOS';
let solicitacoesDocCache = [];
let graficoEvolucaoInstance = null;
let ultimosFiltradosDocs = [];
const LIMITE_HISTORICO = 50;

// ==========================================================
// 1. CARREGAMENTO DE DADOS (COM FILTRO POR PERFIL)
// ==========================================================

async function carregarDadosDocumentacao() {
    try {
        const userRole = (localStorage.getItem("role") || "").trim().toUpperCase();
        const userId = localStorage.getItem("usuarioId");

        // O backend já filtra:
        // - MANAGER/COORDINATOR: por segmento (via usuarioId)
        // - DOCUMENTIST: por documentistaId
        // - ADMIN/CONTROLLER/ASSISTANT: vê tudo
        let url = `/api/docs/solicitacoes?size=1000&usuarioId=${userId}`;
        if (userRole === 'DOCUMENTIST') {
            url += `&documentistaId=${userId}`;
        }

        const response = await fetchComAuth(url);
        const data = await response.json();

        solicitacoesDocCache = Array.isArray(data) ? data : (data.content || []);

        atualizarBadgeDocumentacao();
        popularFiltrosSelect();
        aplicarFiltroDocumentacao(filtroDocAtual);
        carregarGraficoEvolucao();
    } catch (error) {
        console.error("Erro ao carregar solicitações de documentação:", error);
    }
}

// ==========================================================
// 2. BADGE (Apenas ADMIN e DOCUMENTIST — conta "Em Análise")
// ==========================================================

function atualizarBadgeDocumentacao() {
    const userRole = (localStorage.getItem("role") || "").trim().toUpperCase();
    const badge = document.getElementById('badge-documentacao');
    if (!badge) return;

    // Badge visível apenas para ADMIN e DOCUMENTIST
    if (userRole !== 'ADMIN' && userRole !== 'DOCUMENTIST') {
        badge.textContent = '0';
        badge.classList.add('d-none');
        window.minhasDocsPendentes = [];
        return;
    }

    // Conta apenas RECEBIDO (Em Análise) — são os que requerem ação
    const emAnalise = (solicitacoesDocCache || []).filter(item =>
        item.status === 'RECEBIDO'
    );

    const n = emAnalise.length;
    if (n <= 0) {
        badge.textContent = '0';
        badge.classList.add('d-none');
    } else {
        badge.textContent = n > 99 ? '99+' : String(n);
        badge.classList.remove('d-none');
    }

    window.minhasDocsPendentes = emAnalise;
}

// ==========================================================
// 3. INICIALIZAÇÃO (ABA PADRÃO POR PERFIL)
// ==========================================================

function initDocumentacaoTab() {
    console.log("Iniciando aba de documentação (Nova API)...");

    const userRole = (localStorage.getItem("role") || "").trim().toUpperCase();

    // Aba padrão: DOCUMENTIST → Em Análise; demais → Todos
    if (userRole === 'DOCUMENTIST') {
        filtroDocAtual = 'EM_ANALISE';
        const radioAnalise = document.getElementById('filtroDocAnalise');
        if (radioAnalise) radioAnalise.checked = true;
    } else {
        filtroDocAtual = 'TODOS';
        const radioTodos = document.getElementById('filtroDocTodos');
        if (radioTodos) radioTodos.checked = true;
    }

    // Listeners nos radios de status
    const radiosFiltro = document.querySelectorAll('input[name="filtroDocStatus"]');
    radiosFiltro.forEach(radio => {
        radio.addEventListener('change', (e) => {
            filtroDocAtual = e.target.value;
            aplicarFiltroDocumentacao(filtroDocAtual);
        });
    });

    // Busca texto
    const inputBusca = document.getElementById('doc-busca-texto');
    if (inputBusca) {
        inputBusca.addEventListener('input', () => aplicarFiltroDocumentacao(filtroDocAtual));
    }

    // Filtro Tipo Documento
    const selectTipoDoc = document.getElementById('doc-filtro-tipo-documento');
    if (selectTipoDoc) {
        selectTipoDoc.addEventListener('change', () => aplicarFiltroDocumentacao(filtroDocAtual));
    }

    // Filtro Documentista
    const selectDocumentista = document.getElementById('doc-filtro-documentista');
    if (selectDocumentista) {
        selectDocumentista.addEventListener('change', () => aplicarFiltroDocumentacao(filtroDocAtual));
    }

    // Ordenação
    const selectOrdenacao = document.getElementById('doc-ordenacao');
    if (selectOrdenacao) {
        selectOrdenacao.addEventListener('change', () => aplicarFiltroDocumentacao(filtroDocAtual));
    }

    // Botão atualizar
    const btnAtualizar = document.getElementById('btn-atualizar-docs');
    if (btnAtualizar) {
        btnAtualizar.onclick = async function () {
            if (typeof setButtonLoading === 'function') setButtonLoading(this, true);
            toggleLoader(true, '#minhas-docs-pane');
            await carregarDadosDocumentacao();
            toggleLoader(false, '#minhas-docs-pane');
            if (typeof setButtonLoading === 'function') setButtonLoading(this, false);
            mostrarToast("Lista atualizada.", "success");
        };
    }

    // Botão exportar
    const btnExportar = document.getElementById('btn-exportar-docs');
    if (btnExportar) {
        btnExportar.addEventListener('click', () => exportarDocumentacao());
    }

    carregarDadosDocumentacao();
}

// ==========================================================
// 4. POPULAR SELECTS DE FILTRO (Dinâmico a partir do cache)
// ==========================================================

function popularFiltrosSelect() {
    const selectTipoDoc = document.getElementById('doc-filtro-tipo-documento');
    const selectDocumentista = document.getElementById('doc-filtro-documentista');

    if (selectTipoDoc) {
        const valorAtual = selectTipoDoc.value;
        const tiposUnicos = [...new Set(
            solicitacoesDocCache
                .map(s => s.documento ? s.documento.nome : null)
                .filter(Boolean)
        )].sort();

        selectTipoDoc.innerHTML = '<option value="">Todos os Documentos</option>';
        tiposUnicos.forEach(tipo => {
            selectTipoDoc.innerHTML += `<option value="${tipo}" ${tipo === valorAtual ? 'selected' : ''}>${tipo}</option>`;
        });
    }

    if (selectDocumentista) {
        const valorAtual = selectDocumentista.value;
        const documentistasMap = {};
        solicitacoesDocCache.forEach(s => {
            if (s.documentistaId && s.documentistaNome) {
                documentistasMap[s.documentistaId] = s.documentistaNome;
            }
        });

        selectDocumentista.innerHTML = '<option value="">Todos os Documentistas</option>';
        Object.entries(documentistasMap)
            .sort((a, b) => a[1].localeCompare(b[1]))
            .forEach(([id, nome]) => {
                selectDocumentista.innerHTML += `<option value="${id}" ${id === valorAtual ? 'selected' : ''}>${nome}</option>`;
            });
    }
}

// ==========================================================
// 5. APLICAR FILTRO + BUSCA + ORDENAÇÃO
// ==========================================================

function aplicarFiltroDocumentacao(tipoFiltro) {
    // 5a. Filtro de Status (abas)
    let dadosFiltrados = [];

    const thAssunto = document.getElementById('th-assunto-email');
    if (thAssunto) {
        if (tipoFiltro === 'HISTORICO') thAssunto.classList.remove('d-none');
        else thAssunto.classList.add('d-none');
    }

    const HISTORICO_STATUSES = ['FINALIZADO', 'FINALIZADO_FORA_PRAZO', 'DEVOLVIDO', 'REPROVADO'];

    switch (tipoFiltro) {
        case 'HISTORICO':
            dadosFiltrados = solicitacoesDocCache.filter(item =>
                HISTORICO_STATUSES.includes(item.status)
            );
            break;
        case 'PENDENTE_RECEBIMENTO':
            dadosFiltrados = solicitacoesDocCache.filter(item => item.status === 'AGUARDANDO_RECEBIMENTO');
            break;
        case 'EM_ANALISE':
            dadosFiltrados = solicitacoesDocCache.filter(item => item.status === 'RECEBIDO');
            break;
        case 'RECUSADOS':
            dadosFiltrados = solicitacoesDocCache.filter(item => item.status === 'RECUSADO');
            break;
        case 'TODOS':
        default:
            dadosFiltrados = solicitacoesDocCache.filter(item =>
                !HISTORICO_STATUSES.includes(item.status)
            );
            break;
    }

    // 5b. Filtro por texto de busca
    const textoBusca = (document.getElementById('doc-busca-texto')?.value || '').trim().toLowerCase();
    if (textoBusca) {
        dadosFiltrados = dadosFiltrados.filter(item => {
            const os = (item.os || '').toLowerCase();
            const projeto = (item.projeto || item.osNome || '').toLowerCase();
            const tipoDoc = (item.documento?.nome || '').toLowerCase();
            const documentista = (item.documentistaNome || '').toLowerCase();
            const solicitante = (item.solicitanteNome || '').toLowerCase();
            return os.includes(textoBusca) || projeto.includes(textoBusca) ||
                tipoDoc.includes(textoBusca) || documentista.includes(textoBusca) ||
                solicitante.includes(textoBusca);
        });
    }

    // 5c. Filtro por Tipo Documento (select)
    const tipoDocFiltro = document.getElementById('doc-filtro-tipo-documento')?.value || '';
    if (tipoDocFiltro) {
        dadosFiltrados = dadosFiltrados.filter(item =>
            item.documento && item.documento.nome === tipoDocFiltro
        );
    }

    // 5d. Filtro por Documentista (select)
    const documentistaFiltro = document.getElementById('doc-filtro-documentista')?.value || '';
    if (documentistaFiltro) {
        dadosFiltrados = dadosFiltrados.filter(item =>
            String(item.documentistaId) === documentistaFiltro
        );
    }

    // 5e. Ordenação
    const ordenacao = document.getElementById('doc-ordenacao')?.value || 'prazo-asc';
    dadosFiltrados = ordenarDocs(dadosFiltrados, ordenacao, tipoFiltro);

    // Guardar todos os filtrados para export (antes de limitar)
    ultimosFiltradosDocs = dadosFiltrados;

    // Limitar histórico a 50 itens na tela
    let dadosParaTabela = dadosFiltrados;
    if (tipoFiltro === 'HISTORICO' && dadosFiltrados.length > LIMITE_HISTORICO) {
        dadosParaTabela = dadosFiltrados.slice(0, LIMITE_HISTORICO);
    }

    renderizarTabelaDocsAgrupada(dadosParaTabela, tipoFiltro, dadosFiltrados.length);
}

function ordenarDocs(lista, ordenacao, contextoFiltro) {
    const [campo, direcao] = ordenacao.split('-');
    const mult = direcao === 'desc' ? -1 : 1;

    return [...lista].sort((a, b) => {
        let valA, valB;

        switch (campo) {
            case 'prazo':
                // Para histórico: ordenar por finalizadoEm
                if (contextoFiltro === 'HISTORICO') {
                    valA = a.finalizadoEm ? new Date(a.finalizadoEm).getTime() : 0;
                    valB = b.finalizadoEm ? new Date(b.finalizadoEm).getTime() : 0;
                } else {
                    // Para pendentes: ordenar por deadline (recebidoEm + 48h)
                    valA = a.recebidoEm ? new Date(a.recebidoEm).getTime() : Number.MAX_SAFE_INTEGER;
                    valB = b.recebidoEm ? new Date(b.recebidoEm).getTime() : Number.MAX_SAFE_INTEGER;
                }
                break;
            case 'os':
                valA = (a.os || '').toLowerCase();
                valB = (b.os || '').toLowerCase();
                return mult * valA.localeCompare(valB);
            case 'valor':
                valA = a.valor || 0;
                valB = b.valor || 0;
                break;
            case 'criadoEm':
                valA = a.criadoEm ? new Date(a.criadoEm).getTime() : 0;
                valB = b.criadoEm ? new Date(b.criadoEm).getTime() : 0;
                break;
            default:
                return 0;
        }

        if (valA < valB) return -1 * mult;
        if (valA > valB) return 1 * mult;
        return 0;
    });
}

// ==========================================================
// 6. RENDERIZAÇÃO DA TABELA
// ==========================================================

function renderizarTabelaDocsAgrupada(listaDeSolicitacoes, contextoFiltro, totalSemLimite = null) {
    const tbody = document.getElementById('tbody-minhas-docs');
    const msgVazio = document.getElementById('msg-sem-docs');

    // Reconstruir thead dinamicamente para controlar coluna Assunto Email
    if (tbody) {
        const table = tbody.closest('table');
        if (table) {
            const thead = table.querySelector('thead');
            if (thead) {
                const displayAssunto = contextoFiltro === 'HISTORICO' ? '' : 'd-none';
                thead.innerHTML = `
                    <tr>
                        <th style="width: 100px;" class="text-center">Ação</th>
                        <th style="width: 120px;" class="text-center">Status</th>
                        <th>OS</th>
                        <th>Projeto</th>
                        <th>Solicitante</th>
                        <th>Tipo Documento</th>
                        <th style="width: 110px;" class="text-center">Prazo</th>
                        <th style="width: 110px;" class="text-end">Valor</th>
                        <th>Responsável</th>
                        <th id="th-assunto-email" class="${displayAssunto}">Assunto Email</th>
                    </tr>
                `;
            }
        }
    }

    const userRole = (localStorage.getItem("role") || "").trim().toUpperCase();
    const userId = String(localStorage.getItem('usuarioId') || "0");

    // KPIs Dashboard — calculados do cache completo (não dos filtrados)
    const HIST = ['FINALIZADO', 'FINALIZADO_FORA_PRAZO', 'DEVOLVIDO', 'REPROVADO'];
    const docsPendentes = solicitacoesDocCache.filter(i => !HIST.includes(i.status));
    const docsHistorico = solicitacoesDocCache.filter(i => HIST.includes(i.status));

    const valorPendente = docsPendentes.reduce((acc, curr) => acc + (curr.valor || 0), 0);
    const valorHistorico = docsHistorico.reduce((acc, curr) => acc + (curr.valor || 0), 0);
    const valorTotal = valorPendente + valorHistorico;

    const formataMoeda = (val) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const elSaldo = document.getElementById('doc-carteira-previsto');
    const elFinalizado = document.getElementById('doc-carteira-finalizado');
    const elTotal = document.getElementById('doc-carteira-total');

    if (elSaldo) elSaldo.innerText = formataMoeda(valorPendente);
    if (elFinalizado) elFinalizado.innerText = formataMoeda(valorHistorico);
    if (elTotal) elTotal.innerText = formataMoeda(valorTotal);

    if (!tbody) return;
    tbody.innerHTML = '';

    if (!listaDeSolicitacoes || listaDeSolicitacoes.length === 0) {
        if (msgVazio) msgVazio.classList.remove('d-none');
        return;
    } else {
        if (msgVazio) msgVazio.classList.add('d-none');
    }

    listaDeSolicitacoes.forEach(item => {
        const status = item.status || 'RASCUNHO';
        const tipoDoc = item.documento ? item.documento.nome : '-';
        const nomeSolicitante = item.solicitanteNome || 'Sistema (Legado)';
        const osCodigo = item.os ? item.os : `OS Num. ${item.osId}`;
        const projetoNome = item.projeto ? item.projeto : (item.osNome || 'Projeto não informado');
        const responsavelNome = item.documentistaNome || (item.documentistaId ? `ID: ${item.documentistaId}` : 'Sem Responsável');
        const valorFormatado = (item.valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        // Cálculo do Prazo
        let htmlPrazo = '-';
        if (contextoFiltro === 'HISTORICO') {
            const dataCriado = item.criadoEm ? new Date(item.criadoEm).toLocaleDateString('pt-BR') : '-';
            const dataFinalizado = item.finalizadoEm ? new Date(item.finalizadoEm).toLocaleDateString('pt-BR') : '-';
            htmlPrazo = `
                <div class="small">
                    <span class="text-muted d-block">Solicitado: <b>${dataCriado}</b></span>
                    <span class="text-success d-block">Finalizado: <b>${dataFinalizado}</b></span>
                </div>`;
        } else {
            if (item.recebidoEm) {
                const dataRecebimento = new Date(item.recebidoEm);
                dataRecebimento.setHours(dataRecebimento.getHours() + 48);
                const dataStr = dataRecebimento.toLocaleDateString('pt-BR');
                const horaStr = dataRecebimento.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

                const isVencido = dataRecebimento < new Date();
                const corPrazo = isVencido ? 'text-danger fw-bold doc-prazo-vencido' : 'text-muted';
                htmlPrazo = `<span class="${corPrazo}"><i class="bi bi-clock me-1"></i>${dataStr} ${horaStr}</span>`;
            } else {
                htmlPrazo = '<span class="text-warning small"><i class="bi bi-clock"></i> Aguardando<br>Recebimento</span>';
            }
        }

        // Badges de Status (mais modernos)
        let htmlStatus = `<span class="doc-badge-status badge bg-secondary">${status}</span>`;
        if (status === 'AGUARDANDO_RECEBIMENTO') htmlStatus = `<span class="doc-badge-status badge bg-warning text-dark">Aguardando Envio</span>`;
        else if (status === 'RECEBIDO') htmlStatus = `<span class="doc-badge-status badge bg-primary">Em Análise</span>`;
        else if (status === 'FINALIZADO' || status === 'FINALIZADO_FORA_PRAZO') htmlStatus = `<span class="doc-badge-status badge bg-success">Finalizado</span>`;
        else if (status === 'RECUSADO' || status === 'DEVOLVIDO' || status === 'REPROVADO') htmlStatus = `<span class="doc-badge-status badge bg-danger">Recusado</span>`;

        // ==== LÓGICA DE AÇÕES — Apenas ADMIN e DOCUMENTIST responsável ====
        const isAdmin = userRole === 'ADMIN';
        const isDocResponsavel = (userRole === 'DOCUMENTIST' && String(item.documentistaId) === userId);
        const btnComentarios = `<button class="btn btn-sm btn-outline-secondary" onclick="abrirModalComentarios('${item.id}', false)" title="Ver Histórico/Comentários"><i class="bi bi-clock-history"></i></button>`;

        let acoesHtml = '';
        const isHistoricoOuFinalizado = contextoFiltro === 'HISTORICO' || status.includes('FINALIZADO') || status === 'DEVOLVIDO' || status === 'REPROVADO';

        if (status === 'RECUSADO') {
            // Re-solicitar: ADMIN, COORDINATOR ou MANAGER
            const podeResolicitar = isAdmin || userRole === 'COORDINATOR' || userRole === 'MANAGER';
            if (podeResolicitar) {
                acoesHtml += `<button class="btn btn-sm btn-warning me-1" onclick="iniciarResolicitacao('${item.id}')" title="Re-solicitar Documento"><i class="bi bi-arrow-repeat"></i> Re-solicitar</button>`;
            }
        } else if (!isHistoricoOuFinalizado) {
            if (status === 'AGUARDANDO_RECEBIMENTO') {
                // Receber: apenas ADMIN
                if (isAdmin) {
                    acoesHtml += `<button class="btn btn-sm btn-outline-primary me-1" onclick="receberDocumentacao(this, '${item.id}')" title="Confirmar Recebimento"><i class="bi bi-box-arrow-in-down"></i></button>`;
                }
            } else if (status === 'RECEBIDO') {
                // Aprovar/Recusar: apenas ADMIN ou DOCUMENTIST responsável
                if (isAdmin || isDocResponsavel) {
                    acoesHtml += `
                        <button class="btn btn-sm btn-success btn-finalizar-doc me-1" data-id="${item.id}" title="Aprovar e Finalizar"><i class="bi bi-check-lg"></i></button>
                        <button class="btn btn-sm btn-outline-danger me-1" onclick="iniciarRecusa('${item.id}')" title="Recusar Documento"><i class="bi bi-x-lg"></i></button>
                    `;
                }
            }
        }

        let botoesFinal = acoesHtml !== '' ? `<div class="d-flex justify-content-center align-items-center">${acoesHtml}${btnComentarios}</div>` : btnComentarios;

        const displayAssunto = contextoFiltro === 'HISTORICO' ? '' : 'd-none';
        const provaEnvioTexto = item.provaEnvio ? `<span class="text-truncate d-inline-block text-primary fw-bold" style="max-width: 150px;" title="${item.provaEnvio}"><i class="bi bi-link-45deg"></i> ${item.provaEnvio}</span>` : '-';

        const trClass = status === 'RECUSADO' ? 'table-danger' : '';
        const tr = `
            <tr class="${trClass}">
                <td class="align-middle text-center">${botoesFinal}</td>
                <td class="align-middle text-center">${htmlStatus}</td>
                <td class="align-middle fw-bold text-primary">${osCodigo}</td>
                <td class="align-middle text-secondary" style="max-width: 150px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${projetoNome}">${projetoNome}</td>
                <td class="align-middle"><span class="fw-medium text-dark">${nomeSolicitante}</span></td>
                <td class="align-middle fw-medium text-wrap" style="max-width:200px;">${tipoDoc}</td>
                <td class="align-middle text-center">${htmlPrazo}</td>
                <td class="align-middle text-success fw-bold">${valorFormatado}</td>
                <td class="align-middle text-center small">${responsavelNome}</td>
                <td class="align-middle text-center small ${displayAssunto}">${provaEnvioTexto}</td>
            </tr>
        `;
        tbody.innerHTML += tr;
    });

    // Mensagem de limite quando no histórico
    if (contextoFiltro === 'HISTORICO' && totalSemLimite && totalSemLimite > listaDeSolicitacoes.length) {
        const trAviso = `
            <tr>
                <td colspan="10" class="text-center py-3 text-muted bg-light">
                    <i class="bi bi-info-circle me-1"></i>
                    Exibindo os ${listaDeSolicitacoes.length} registros mais recentes de ${totalSemLimite} no total.
                    Use <strong>Exportar</strong> para obter o relatório completo.
                </td>
            </tr>`;
        tbody.innerHTML += trAviso;
    }
}

// ==========================================================
// 7. EXPORTAÇÃO (SweetAlert2 + XLSX — mesmo padrão de registros)
// ==========================================================

async function exportarDocumentacao() {
    const vistaAtual = ultimosFiltradosDocs || [];
    const totalBase = solicitacoesDocCache.length;

    const result = await Swal.fire({
        title: '<span class="fw-bold text-dark">Exportar Documentação</span>',
        width: 700,
        padding: '2em',
        html: `
            <style>
                .export-options-container {
                    display: flex;
                    gap: 15px;
                    justify-content: center;
                    margin-top: 20px;
                    flex-wrap: wrap;
                }
                .export-card {
                    flex: 1;
                    min-width: 220px;
                    border: 2px solid #e9ecef;
                    border-radius: 16px;
                    padding: 20px 10px;
                    cursor: pointer;
                    transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
                    background: white;
                    position: relative;
                    overflow: hidden;
                }
                .export-card:hover {
                    border-color: #198754;
                    transform: translateY(-5px);
                    box-shadow: 0 10px 25px rgba(25, 135, 84, 0.15);
                }
                .export-card:hover .icon-box {
                    background-color: #e8f5e9;
                    color: #198754;
                }
                .icon-box {
                    width: 50px;
                    height: 50px;
                    background-color: #f8f9fa;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto 15px;
                    font-size: 1.5rem;
                    color: #6c757d;
                    transition: all 0.3s;
                }
                .export-title {
                    font-weight: 700;
                    color: #343a40;
                    margin-bottom: 8px;
                    font-size: 1rem;
                }
                .export-desc {
                    font-size: 0.8rem;
                    color: #6c757d;
                    margin-bottom: 15px;
                    line-height: 1.4;
                    min-height: 45px;
                }
                .export-badge {
                    background-color: #f1f3f5;
                    color: #495057;
                    padding: 4px 10px;
                    border-radius: 30px;
                    font-size: 0.75rem;
                    font-weight: 600;
                }
            </style>

            <p class="text-muted mb-4">Selecione o tipo de exportação desejada:</p>

            <div class="export-options-container">
                <div class="export-card" onclick="window._docExportTipo='VISTA_ATUAL'; Swal.clickConfirm()">
                    <div class="icon-box"><i class="bi bi-funnel"></i></div>
                    <h5 class="export-title">Vista Atual</h5>
                    <p class="export-desc">Apenas os registros filtrados e visíveis na tela.</p>
                    <span class="export-badge"><i class="bi bi-list-check"></i> ${vistaAtual.length} registros</span>
                </div>

                <div class="export-card" onclick="window._docExportTipo='COMPLETO'; Swal.clickConfirm()">
                    <div class="icon-box"><i class="bi bi-database-down"></i></div>
                    <h5 class="export-title">Base Completa</h5>
                    <p class="export-desc">Todos os documentos carregados (todas as abas).</p>
                    <span class="export-badge"><i class="bi bi-server"></i> ${totalBase} registros</span>
                </div>
            </div>
        `,
        showConfirmButton: false,
        showCancelButton: true,
        cancelButtonText: 'Cancelar',
        buttonsStyling: false,
        customClass: {
            cancelButton: 'btn btn-outline-secondary px-4 mt-4 rounded-pill'
        },
        didOpen: () => { window._docExportTipo = ''; }
    });

    if (!result.isConfirmed && !window._docExportTipo) return;

    const tipo = window._docExportTipo;
    delete window._docExportTipo;

    const modalEl = document.getElementById('modalProgressoExportacaoDocs');
    const modalProgresso = new bootstrap.Modal(modalEl);
    modalProgresso.show();

    const textoProgresso = document.getElementById('textoProgressoDocs');
    const barraProgresso = document.getElementById('barraProgressoDocs');

    const atualizarProgresso = (pct, texto) => {
        barraProgresso.style.width = `${pct}%`;
        barraProgresso.textContent = `${pct}%`;
        if (texto) textoProgresso.textContent = texto;
    };

    atualizarProgresso(10, 'Iniciando exportação...');

    setTimeout(async () => {
        try {
            const linhas = tipo === 'VISTA_ATUAL' ? vistaAtual : solicitacoesDocCache;

            if (!linhas || linhas.length === 0) {
                throw new Error("Nenhum dado encontrado para exportar.");
            }

            atualizarProgresso(40, 'Processando dados...');

            const formataMoeda = (val) => (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            const formatData = (dt) => dt ? new Date(dt).toLocaleDateString('pt-BR') : '-';

            // Cabeçalhos
            const headers = ['OS', 'Projeto', 'Segmento', 'Solicitante', 'Tipo Documento', 'Responsável', 'Status', 'Valor (R$)', 'Data Solicitação', 'Data Recebimento', 'Data Finalização', 'Prova Envio'];

            // Linhas
            const rows = linhas.map(item => {
                let statusLabel = item.status || '-';
                if (statusLabel === 'AGUARDANDO_RECEBIMENTO') statusLabel = 'Aguardando Envio';
                else if (statusLabel === 'RECEBIDO') statusLabel = 'Em Análise';
                else if (statusLabel === 'FINALIZADO' || statusLabel === 'FINALIZADO_FORA_PRAZO') statusLabel = 'Finalizado';
                else if (statusLabel === 'RECUSADO' || statusLabel === 'DEVOLVIDO' || statusLabel === 'REPROVADO') statusLabel = 'Recusado';

                return [
                    item.os || `OS ${item.osId}`,
                    item.projeto || item.osNome || '-',
                    item.segmentoNome || '-',
                    item.solicitanteNome || '-',
                    item.documento?.nome || '-',
                    item.documentistaNome || '-',
                    statusLabel,
                    item.valor || 0,
                    formatData(item.criadoEm),
                    formatData(item.recebidoEm),
                    formatData(item.finalizadoEm),
                    item.provaEnvio || '-'
                ];
            });

            atualizarProgresso(70, 'Gerando arquivo Excel...');

            // Resumo por status
            const statusCount = {};
            let valorTotal = 0;
            linhas.forEach(item => {
                const st = item.status || 'DESCONHECIDO';
                if (!statusCount[st]) statusCount[st] = { qtd: 0, valor: 0 };
                statusCount[st].qtd++;
                statusCount[st].valor += (item.valor || 0);
                valorTotal += (item.valor || 0);
            });

            const resumoHeaders = ['Status', 'Quantidade', 'Valor (R$)'];
            const resumoRows = Object.entries(statusCount).map(([st, dados]) => [st, dados.qtd, dados.valor]);
            resumoRows.push(['TOTAL', linhas.length, valorTotal]);

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([resumoHeaders, ...resumoRows]), "Resumo");
            XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([headers, ...rows]), "Detalhes");

            const nomeArquivo = `Relatorio_Documentacao_${new Date().toISOString().slice(0, 10)}.xlsx`;
            _downloadXlsxDocs(wb, nomeArquivo);

            atualizarProgresso(100, 'Concluído!');
            mostrarToast('Exportação concluída com sucesso!', 'success');

        } catch (e) {
            console.error(e);
            mostrarToast('Erro ao exportar: ' + e.message, 'error');
        } finally {
            setTimeout(() => modalProgresso.hide(), 1000);
        }
    }, 300);
}

function _downloadXlsxDocs(wb, filename) {
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);
}

// ==========================================================
// 8. GRÁFICO DE EVOLUÇÃO (Últimos 6 meses — client-side)
// ==========================================================

function carregarGraficoEvolucao() {
    const canvas = document.getElementById('graficoCarteiraDoc');
    if (!canvas || typeof Chart === 'undefined') return;

    const formataMoeda = (val) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    // Calcular dados dos últimos 6 meses a partir do cache (em VALOR R$)
    const agora = new Date();
    const mesesRaw = [];

    for (let i = 5; i >= 0; i--) {
        const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
        const ano = d.getFullYear();
        const mes = d.getMonth();
        const label = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });

        const valorCriadas = solicitacoesDocCache
            .filter(s => {
                if (!s.criadoEm) return false;
                const dt = new Date(s.criadoEm);
                return dt.getFullYear() === ano && dt.getMonth() === mes;
            })
            .reduce((acc, s) => acc + (s.valor || 0), 0);

        const valorFinalizadas = solicitacoesDocCache
            .filter(s => {
                if (!s.finalizadoEm) return false;
                const dt = new Date(s.finalizadoEm);
                return dt.getFullYear() === ano && dt.getMonth() === mes;
            })
            .reduce((acc, s) => acc + (s.valor || 0), 0);

        mesesRaw.push({ label, valorCriadas, valorFinalizadas });
    }

    // Filtrar: só mostrar meses que tenham algum dado (não nulos)
    const mesesComDados = mesesRaw.filter(m => m.valorCriadas > 0 || m.valorFinalizadas > 0);

    // Se não houver dados, mostrar mensagem no canvas
    if (mesesComDados.length === 0) {
        const ctx = canvas.getContext('2d');
        if (graficoEvolucaoInstance) { graficoEvolucaoInstance.destroy(); graficoEvolucaoInstance = null; }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = '11px sans-serif';
        ctx.fillStyle = '#adb5bd';
        ctx.textAlign = 'center';
        ctx.fillText('Sem dados de evolução', canvas.width / 2, canvas.height / 2);
        return;
    }

    const labels = mesesComDados.map(m => m.label);
    const dataCriadas = mesesComDados.map(m => m.valorCriadas);
    const dataFinalizadas = mesesComDados.map(m => m.valorFinalizadas);

    // Destruir gráfico anterior se existir
    if (graficoEvolucaoInstance) {
        graficoEvolucaoInstance.destroy();
        graficoEvolucaoInstance = null;
    }

    graficoEvolucaoInstance = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Criadas (R$)',
                    data: dataCriadas,
                    backgroundColor: 'rgba(255, 193, 7, 0.7)',
                    borderColor: 'rgba(255, 193, 7, 1)',
                    borderWidth: 1,
                    borderRadius: 4,
                    barPercentage: 0.6
                },
                {
                    label: 'Finalizadas (R$)',
                    data: dataFinalizadas,
                    backgroundColor: 'rgba(25, 135, 84, 0.7)',
                    borderColor: 'rgba(25, 135, 84, 1)',
                    borderWidth: 1,
                    borderRadius: 4,
                    barPercentage: 0.6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: { font: { size: 10 }, boxWidth: 12, padding: 6 }
                },
                tooltip: {
                    callbacks: {
                        title: (items) => items[0].label,
                        label: (item) => `${item.dataset.label}: ${formataMoeda(item.raw)}`
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { font: { size: 9 } }
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        font: { size: 9 },
                        callback: (val) => 'R$ ' + val.toLocaleString('pt-BR')
                    },
                    grid: { color: 'rgba(0,0,0,0.05)' }
                }
            }
        }
    });
}

// =====================================================================
// 9. FLUXO DE AÇÕES E INTEGRAÇÕES
// =====================================================================

async function receberDocumentacao(btnElement, id) {
    if (!confirm('Confirmar o recebimento do documento? O prazo de 48h começará a contar agora.')) return;

    if (typeof setButtonLoading === 'function') setButtonLoading(btnElement, true);
    toggleLoader(true, '#minhas-docs-pane');

    try {
        const userId = parseInt(localStorage.getItem('usuarioId'));
        await fetchComAuth(`/api/docs/solicitacoes/${id}/receber`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ actorUsuarioId: userId, comentario: 'Documento marcado como recebido pelo Gestor/Admin.' })
        });

        mostrarToast("Documentos recebidos com sucesso!", "success");
        await carregarDadosDocumentacao();
    } catch (e) {
        mostrarToast("Erro ao confirmar recebimento: " + e.message, 'error');
    } finally {
        toggleLoader(false, '#minhas-docs-pane');
        if (typeof setButtonLoading === 'function') setButtonLoading(btnElement, false);
    }
}

// =====================================================================
// 10. MODAL DE HISTÓRICO / COMENTÁRIOS E RECUSA
// =====================================================================

function iniciarRecusa(id) {
    abrirModalComentarios(id, true);
}

function iniciarResolicitacao(id) {
    abrirModalComentarios(id, false, true);
}

async function processarResolicitacao(id, motivo, btnElement, modalInstance) {
    if (!motivo.trim()) {
        mostrarToast("Informe o motivo da re-solicitação.", "warning");
        return;
    }

    if (typeof setButtonLoading === 'function') setButtonLoading(btnElement, true);
    toggleLoader(true, '#minhas-docs-pane');

    try {
        const userId = parseInt(localStorage.getItem('usuarioId'));
        const resp = await fetchComAuth(`/api/docs/solicitacoes/${id}/resolicitar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ actorUsuarioId: userId, comentario: motivo })
        });

        if (!resp.ok) {
            const errData = await resp.json().catch(() => ({}));
            throw new Error(errData.message || errData.error || `Erro ao re-solicitar (Status: ${resp.status})`);
        }

        mostrarToast("Documento re-solicitado com sucesso. Voltou para Aguardando Recebimento.", "success");
        modalInstance.hide();
        limparBackdropModal();
        await carregarDadosDocumentacao();
    } catch (e) {
        mostrarToast("Erro na re-solicitação: " + e.message, 'error');
        if (typeof setButtonLoading === 'function') setButtonLoading(btnElement, false);
    } finally {
        toggleLoader(false, '#minhas-docs-pane');
    }
}

async function carregarHistoricoNoModal(id) {
    const container = document.getElementById('listaComentariosContainer');
    container.innerHTML = '<div class="text-center p-4"><div class="spinner-border text-primary" role="status"></div><br><span class="mt-2 text-muted">Carregando histórico...</span></div>';

    try {
        const res = await fetchComAuth(`/api/docs/solicitacoes/${id}/historico`);
        if (!res.ok) throw new Error("Falha na API de histórico");
        const historico = await res.json();

        if (!historico || historico.length === 0) {
            container.innerHTML = '<div class="text-center p-4 text-muted"><i class="bi bi-inbox fs-1 d-block mb-2"></i>Nenhum registro encontrado.</div>';
            return;
        }

        let htmlTimeline = '<div class="timeline-container position-relative mt-2" style="border-left: 2px solid #dee2e6; margin-left: 15px; padding-left: 20px;">';

        historico.forEach(ev => {
            const dataForm = new Date(ev.criadoEm).toLocaleString('pt-BR');
            const eventoNome = ev.tipoEvento ? ev.tipoEvento.replace(/_/g, ' ') : 'ATUALIZAÇÃO';
            const atorNome = ev.actorNome || `ID: ${ev.actorUsuarioId}`;

            let iconClass = 'bg-primary';
            if (eventoNome.includes('RECUSA')) iconClass = 'bg-danger';
            else if (eventoNome.includes('FINALIZADO')) iconClass = 'bg-success';
            else if (eventoNome.includes('COMENTARIO')) iconClass = 'bg-secondary';

            htmlTimeline += `
                <div class="mb-4 position-relative">
                    <span class="position-absolute translate-middle rounded-circle border border-white border-2 ${iconClass}"
                          style="width: 16px; height: 16px; left: -21px; top: 15px;"></span>
                    <div class="card border-0 shadow-sm bg-light">
                        <div class="card-body p-3">
                            <div class="d-flex justify-content-between align-items-center mb-2">
                                <h6 class="mb-0 text-dark fw-bold">${atorNome}</h6>
                                <span class="badge ${iconClass} bg-opacity-10 text-dark" style="font-size: 0.70rem;">${eventoNome}</span>
                            </div>
                            <p class="mb-2 text-secondary small" style="white-space: pre-wrap;">${ev.comentario || 'Ação registrada no sistema.'}</p>
                            <small class="text-muted" style="font-size: 0.75rem;"><i class="bi bi-calendar3 me-1"></i>${dataForm}</small>
                        </div>
                    </div>
                </div>
            `;
        });
        htmlTimeline += '</div>';
        container.innerHTML = htmlTimeline;

    } catch (e) {
        container.innerHTML = '<div class="text-center p-3 text-danger"><i class="bi bi-exclamation-triangle"></i> Não foi possível carregar o histórico.</div>';
    }
}

function abrirModalComentarios(id, isRecusa = false, isResolicitacao = false) {
    const modalEl = document.getElementById('modalComentarios');
    const modal = new bootstrap.Modal(modalEl);

    carregarHistoricoNoModal(id);

    const btnEnviar = document.getElementById('btnEnviarComentarioModal');
    const txtArea = document.getElementById('novoComentarioTexto');
    if (txtArea) txtArea.value = '';

    const novoBtn = btnEnviar.cloneNode(true);
    btnEnviar.parentNode.replaceChild(novoBtn, btnEnviar);

    if (isRecusa) {
        document.getElementById('modalComentariosLabel').innerHTML = '<i class="bi bi-x-circle text-danger"></i> Recusar Documento';
        novoBtn.className = 'btn btn-danger';
        novoBtn.innerHTML = '<i class="bi bi-x-lg"></i> Confirmar Recusa';
        txtArea.placeholder = "Motivo da recusa (obrigatório para recusar)...";

        novoBtn.addEventListener('click', () => processarRecusa(id, txtArea.value, novoBtn, modal));
    } else if (isResolicitacao) {
        document.getElementById('modalComentariosLabel').innerHTML = '<i class="bi bi-arrow-repeat text-warning"></i> Re-solicitar Documento';
        novoBtn.className = 'btn btn-warning';
        novoBtn.innerHTML = '<i class="bi bi-arrow-repeat"></i> Confirmar Re-solicitação';
        txtArea.placeholder = "Motivo da re-solicitação (obrigatório)...";

        novoBtn.addEventListener('click', () => processarResolicitacao(id, txtArea.value, novoBtn, modal));
    } else {
        document.getElementById('modalComentariosLabel').innerHTML = '<i class="bi bi-chat-dots text-primary"></i> Histórico e Comentários';
        novoBtn.className = 'btn btn-primary';
        novoBtn.innerHTML = '<i class="bi bi-send"></i> Enviar Comentário';
        txtArea.placeholder = "Adicionar um comentário...";

        novoBtn.addEventListener('click', async () => {
            if (!txtArea.value.trim()) {
                mostrarToast("O comentário não pode ser vazio.", "warning");
                return;
            }
            if (typeof setButtonLoading === 'function') setButtonLoading(novoBtn, true);

            try {
                const userId = parseInt(localStorage.getItem('usuarioId'));
                await fetchComAuth(`/api/docs/solicitacoes/${id}/comentar`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ actorUsuarioId: userId, comentario: txtArea.value })
                });
                mostrarToast("Comentário adicionado!", "success");
                txtArea.value = '';
                carregarHistoricoNoModal(id);
            } catch (e) {
                mostrarToast("Erro ao comentar.", "error");
            } finally {
                if (typeof setButtonLoading === 'function') setButtonLoading(novoBtn, false);
            }
        });
    }

    modal.show();
}

async function processarRecusa(id, motivo, btnElement, modalInstance) {
    if (!motivo.trim()) {
        mostrarToast("O motivo da recusa é obrigatório.", "warning");
        return;
    }

    if (typeof setButtonLoading === 'function') setButtonLoading(btnElement, true);
    toggleLoader(true, '#minhas-docs-pane');

    try {
        const userId = parseInt(localStorage.getItem('usuarioId'));
        const resp = await fetchComAuth(`/api/docs/solicitacoes/${id}/recusar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ actorUsuarioId: userId, comentario: motivo })
        });

        if (!resp.ok) {
            const errData = await resp.json().catch(() => ({}));
            throw new Error(errData.message || errData.error || `Erro ao recusar (Status: ${resp.status})`);
        }

        mostrarToast("Documentação recusada com sucesso.", "success");
        modalInstance.hide();
        limparBackdropModal();
        await carregarDadosDocumentacao();
    } catch (e) {
        mostrarToast("Erro na recusa: " + e.message, 'error');
        if (typeof setButtonLoading === 'function') setButtonLoading(btnElement, false);
    } finally {
        toggleLoader(false, '#minhas-docs-pane');
    }
}

// =====================================================================
// 11. FINALIZAR (Aprovar e inserir prova de envio)
// =====================================================================

document.addEventListener('click', async function (e) {
    const btn = e.target.closest('.btn-finalizar-doc');
    if (btn) {
        e.stopPropagation();
        const id = btn.dataset.id;

        const modalFinalizar = new bootstrap.Modal(document.getElementById('modalFinalizarDoc'));
        const inputId = document.getElementById('finalizarDocId');
        if (inputId) inputId.value = id;

        document.getElementById('assuntoEmailDoc').value = '';
        modalFinalizar.show();
    }
});

const btnConfirmarFinalizar = document.getElementById('btnConfirmarFinalizarDoc');
if (btnConfirmarFinalizar) {
    const novoBtn = btnConfirmarFinalizar.cloneNode(true);
    btnConfirmarFinalizar.parentNode.replaceChild(novoBtn, btnConfirmarFinalizar);

    novoBtn.addEventListener('click', async function () {
        const id = document.getElementById('finalizarDocId').value;
        const assunto = document.getElementById('assuntoEmailDoc').value;

        if (!assunto.trim()) {
            mostrarToast("O envio da prova/link é obrigatório para aprovar.", "warning");
            return;
        }

        if (typeof setButtonLoading === 'function') setButtonLoading(novoBtn, true);
        toggleLoader(true, '#minhas-docs-pane');

        try {
            const userId = parseInt(localStorage.getItem('usuarioId'));
            const payload = {
                actorUsuarioId: userId,
                comentario: "Documento Aprovado e Finalizado.",
                provaEnvio: assunto
            };

            const response = await fetchComAuth(`/api/docs/solicitacoes/${id}/finalizar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                let erroMsg = `Erro ${response.status}`;
                try {
                    const errJson = await response.json();
                    erroMsg = errJson.message || errJson.error || erroMsg;
                } catch (e) { }
                throw new Error(erroMsg);
            }

            mostrarToast("Aprovado e Finalizado com sucesso!", "success");

            const modalEl = document.getElementById('modalFinalizarDoc');
            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();
            limparBackdropModal();

            await carregarDadosDocumentacao();

        } catch (e) {
            console.error(e);
            mostrarToast(e.message, 'error');
        } finally {
            if (typeof setButtonLoading === 'function') setButtonLoading(novoBtn, false);
            toggleLoader(false, '#minhas-docs-pane');
        }
    });
}

function limparBackdropModal() {
    const backdrops = document.querySelectorAll('.modal-backdrop');
    backdrops.forEach(b => b.remove());
    document.body.classList.remove('modal-open');
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';
}
