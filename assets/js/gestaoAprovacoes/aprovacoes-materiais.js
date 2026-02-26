if (!window.API_MATERIALS_URL) {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        window.API_MATERIALS_URL = 'http://localhost:8081';
    } else {
        window.API_MATERIALS_URL = window.location.origin;
    }
}
var API_MATERIALS_URL = window.API_MATERIALS_URL;

(function () {
    'use strict';

    // --- Estado Local ---
    let selecionadosMateriais = [];
    let listaCompletaSolicitacoes = [];
    let listaCompletaHistorico = [];

    // Controle para ação individual
    let acaoIndividualAlvo = null;

    // --- Exposição Global das Funções ---
    window.carregarDadosMateriais = carregarDadosMateriais;
    window.carregarDadosHistoricoMateriais = carregarDadosHistoricoMateriais;
    window.aprovarLoteMateriais = aprovarLoteMateriais;
    window.rejeitarLoteMateriais = rejeitarLoteMateriais;

    window.togglePedidoInteiro = togglePedidoInteiro;
    window.toggleItemIndividual = toggleItemIndividual;
    window.filtrarMateriaisNaTela = filtrarMateriaisNaTela;
    window.filtrarHistoricoMateriaisNaTela = filtrarHistoricoMateriaisNaTela; // Nova função
    window.renderizarCardsPedidos = renderizarCardsPedidos;

    // Funções de Gatilho
    window.prepararAprovacao = prepararAprovacao;
    window.prepararRejeicao = prepararRejeicao;
    window.confirmarAprovacao = confirmarAprovacao;
    window.confirmarRejeicao = confirmarRejeicao;

    window.exportarHistoricoMateriaisExcel = exportarHistoricoMateriaisExcel;
    window.exportarMateriaisPendentesExcel = exportarMateriaisPendentesExcel;

    // =================================================================
    // 1. INICIALIZAÇÃO E LISTENERS
    // =================================================================
    function iniciarComponentes() {
        injetarModaisDinamicos();
        criarToolbarFlutuante();
        instalarBloqueioCliqueCheckboxes();

        const btnFiltrarHist = document.getElementById('btn-filtrar-historico-materiais');
        if (btnFiltrarHist) {
            btnFiltrarHist.addEventListener('click', carregarDadosHistoricoMateriais);
        }

        const role = (localStorage.getItem('role') || localStorage.getItem('userRole') || (typeof userRole !== 'undefined' ? userRole : '')).toUpperCase();
        
        // Verifica se o usuário tem uma das roles permitidas
        if (role.includes('ADMIN') || role.includes('CONTROLLER') || role.includes('COORDINATOR') || role.includes('MANAGER')) {
            const btnExportarHist = document.getElementById('btn-exportar-historico-materiais');
            const btnExportarPendentes = document.getElementById('btn-exportar-materiais-pendentes');
            
            // Remove o d-none para exibir os botões
            if (btnExportarHist) btnExportarHist.classList.remove('d-none');
            if (btnExportarPendentes) btnExportarPendentes.classList.remove('d-none');
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', iniciarComponentes);
    } else {
        iniciarComponentes();
    }

    function criarToolbarFlutuante() {
        if (!document.querySelector('.actions-group-modern')) {
            const toolbar = document.createElement('div');
            toolbar.className = 'actions-group-modern';
            toolbar.innerHTML = `
            <div class="selection-info">
                <i class="bi bi-check-circle-fill text-success me-2"></i>
                <span id="count-materiais-selection">0</span> selecionados
            </div>
            <div class="d-flex gap-2">
                <button class="btn btn-light text-danger fw-bold border-0" onclick="prepararRejeicao(null, null, 'LOTE')">
                    Recusar Lote
                </button>
                <button class="btn btn-success-gradient shadow-sm" onclick="prepararAprovacao(null, null, 'LOTE')">
                    Aprovar Lote
                </button>
            </div>
        `;
            document.body.appendChild(toolbar);
            toolbar.style.display = 'none';
        }
    }

    function injetarModaisDinamicos() {
        // 1. Modal de Aprovação
        if (!document.getElementById('modalAprovacaoGenerico')) {
            const modalAprov = document.createElement('div');
            modalAprov.innerHTML = `
        <div class="modal fade" id="modalAprovacaoGenerico" tabindex="-1" aria-hidden="true" data-bs-backdrop="static">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content modal-content-modern border-0">
                    <div class="modal-body p-4 text-center">
                        <div class="modal-icon-circle bg-success bg-opacity-10 text-success mb-3">
                            <i class="bi bi-check-lg"></i>
                        </div>
                        <h5 class="fw-bold mb-2">Confirmar Aprovação</h5>
                        <p class="text-muted small mb-4" id="msgAprovacaoGenerico">Deseja realmente aprovar?</p>
                        <div class="d-flex gap-2 justify-content-center">
                            <button type="button" class="btn btn-light px-4" data-bs-dismiss="modal">Cancelar</button>
                            <button type="button" class="btn btn-success-gradient px-4 d-flex align-items-center gap-2" id="btnConfirmarAprovacaoGen" onclick="confirmarAprovacao()">
                                <span class="spinner-border spinner-border-sm d-none" role="status" aria-hidden="true"></span>
                                <i class="bi bi-check-circle"></i> Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;
            document.body.appendChild(modalAprov.firstElementChild);
        }

        // 2. Modal de Recusa
        if (!document.getElementById('modalRecusaGenerico')) {
            const modalRecusa = document.createElement('div');
            modalRecusa.innerHTML = `
        <div class="modal fade" id="modalRecusaGenerico" tabindex="-1" aria-hidden="true" data-bs-backdrop="static">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content modal-content-modern border-0">
                    <div class="modal-body p-4 text-center">
                        <div class="modal-icon-circle bg-danger bg-opacity-10 text-danger mb-3">
                            <i class="bi bi-x-lg"></i>
                        </div>
                        <h5 class="fw-bold mb-2">Confirmar Recusa</h5>
                        <p class="text-muted small mb-3" id="msgRecusaGenerico">Informe o motivo da recusa:</p>
                        <textarea id="inputMotivoGenerico" class="form-control form-control-modern mb-3" rows="3" placeholder="Digite o motivo..."></textarea>
                        <div class="d-flex gap-2 justify-content-center">
                            <button type="button" class="btn btn-light px-4" data-bs-dismiss="modal">Cancelar</button>
                            <button type="button" class="btn btn-danger-gradient px-4 d-flex align-items-center gap-2" id="btnConfirmarRecusaGen" onclick="confirmarRejeicao()">
                                <span class="spinner-border spinner-border-sm d-none" role="status" aria-hidden="true"></span>
                                <i class="bi bi-x-circle"></i> Recusar
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;
            document.body.appendChild(modalRecusa.firstElementChild);
        }
    }

    // =================================================================
    // 2. BUSCA DE DADOS
    // =================================================================

    // 2.1 PENDENTES
    async function carregarDadosMateriais() {
        const container = document.getElementById('container-pedidos-materiais');
        if (window.toggleLoader) window.toggleLoader(true, '#materiais-pane');
        if (!container) return;

        container.innerHTML = `
        <div class="empty-state-modern py-5">
            <div class="spinner-border text-success" role="status" style="width: 3rem; height: 3rem;"></div>
            <p class="mt-4 text-muted fw-bold tracking-wide">BUSCANDO SOLICITAÇÕES...</p>
        </div>`;

        try {
            const url = `${API_MATERIALS_URL}/api/materiais/solicitacoes/pendentes`;
            const headersExtras = getHeadersAuth();

            const response = await fetchComAuth(url, { method: 'GET', headers: headersExtras });
            if (!response.ok) throw new Error(`Status: ${response.status}`);

            const dados = await response.json();
            listaCompletaSolicitacoes = Array.isArray(dados) ? dados : [];
            renderizarCardsPedidos(listaCompletaSolicitacoes);

        } catch (error) {
            console.error(error);
            renderizarErro(container, error.message, 'carregarDadosMateriais');
        } finally {
            if (window.toggleLoader) window.toggleLoader(false, '#materiais-pane');
        }
    }

    // 2.2 HISTÓRICO
    async function carregarDadosHistoricoMateriais() {
        const container = document.getElementById('container-historico-materiais');
        if (!container) {
            console.warn("Container 'container-historico-materiais' não encontrado.");
            return;
        }

        if (window.toggleLoader) window.toggleLoader(true, '#historico-materiais-pane');

        container.innerHTML = `
        <div class="empty-state-modern py-5">
            <div class="spinner-border text-primary" role="status" style="width: 3rem; height: 3rem;"></div>
            <p class="mt-4 text-muted fw-bold tracking-wide">BUSCANDO HISTÓRICO...</p>
        </div>`;

        try {
            const dataInicio = document.getElementById('data-inicio-hist-material')?.value;
            const dataFim = document.getElementById('data-fim-hist-material')?.value;

            let url = `${API_MATERIALS_URL}/api/materiais/solicitacoes/historico`;
            const params = new URLSearchParams();
            if (dataInicio) params.append('inicio', dataInicio);
            if (dataFim) params.append('fim', dataFim);

            const currentUserId = (typeof userId !== 'undefined' && userId) ? userId : localStorage.getItem('usuarioId');
            if (currentUserId) params.append('usuarioId', currentUserId);

            if (Array.from(params).length > 0) url += `?${params.toString()}`;

            const headersExtras = getHeadersAuth();
            const response = await fetchComAuth(url, { method: 'GET', headers: headersExtras });
            if (!response.ok) throw new Error(`Status: ${response.status}`);

            const dados = await response.json();
            listaCompletaHistorico = Array.isArray(dados) ? dados : [];
            renderizarHistoricoMateriais(listaCompletaHistorico);

        } catch (error) {
            console.error("Erro ao carregar histórico:", error);
            renderizarErro(container, error.message, 'carregarDadosHistoricoMateriais');
        } finally {
            if (window.toggleLoader) window.toggleLoader(false, '#historico-materiais-pane');
        }
    }

    // =================================================================
    // 3. RENDERIZAÇÃO
    // =================================================================

    function renderizarCardsPedidos(lista) {
        const container = document.getElementById('container-pedidos-materiais');
        if (!container) return;

        container.innerHTML = '';
        selecionadosMateriais = [];
        atualizarUIGlobal();

        if (!lista || lista.length === 0) {
            renderizarVazio(container, "Tudo limpo por aqui!", "Nenhuma solicitação pendente no momento.");
            return;
        }

        const accordionWrapper = document.createElement('div');
        accordionWrapper.className = 'custom-accordion-modern';
        accordionWrapper.id = 'accordionMateriais';

        const role = (typeof userRole !== 'undefined' ? userRole : '').toUpperCase();

        lista.forEach((solicitacao, index) => {
            // Lógica de Permissão Dinâmica por Status do Pedido
            let podeAprovarPedido = false;
            if (role.includes('ADMIN')) {
                podeAprovarPedido = true; // Admin aprova tudo
            } else if (role.includes('CONTROLLER')) {
                podeAprovarPedido = solicitacao.status === 'PENDENTE_CONTROLLER'; // Controller só aprova se estiver na mesa dele
            } else if (role.includes('COORDINATOR') || role.includes('MANAGER')) {
                podeAprovarPedido = solicitacao.status === 'PENDENTE_COORDENADOR'; // Gestor só aprova na fase inicial
            }

            const html = criarHtmlCard(solicitacao, index, true, podeAprovarPedido);
            const cardItem = document.createElement('div');
            cardItem.className = 'accordion-item pedido-item-dom fade-in-up';
            cardItem.setAttribute('data-search', `${getOsLabel(solicitacao)} ${solicitacao.nomeSolicitante || ''}`.toLowerCase());
            cardItem.style.animationDelay = `${index * 0.05}s`;
            cardItem.innerHTML = html;
            accordionWrapper.appendChild(cardItem);
        });

        container.appendChild(accordionWrapper);
    }

    function renderizarHistoricoMateriais(lista) {
        const container = document.getElementById('container-historico-materiais');
        if (!container) return;

        container.innerHTML = '';

        if (!lista || lista.length === 0) {
            renderizarVazio(container, "Histórico vazio", "Nenhum registro encontrado no período selecionado.");
            return;
        }

        const accordionWrapper = document.createElement('div');
        accordionWrapper.className = 'custom-accordion-modern';
        accordionWrapper.id = 'accordionHistoricoMateriais';

        lista.forEach((solicitacao, index) => {
            // No histórico, passamos false para 'ehPendente'
            const html = criarHtmlCard(solicitacao, index, false, false);
            const cardItem = document.createElement('div');
            cardItem.className = 'accordion-item pedido-item-dom fade-in-up';
            cardItem.setAttribute('data-search', `${getOsLabel(solicitacao)} ${solicitacao.nomeSolicitante || ''}`.toLowerCase());
            cardItem.innerHTML = html;
            accordionWrapper.appendChild(cardItem);
        });

        container.appendChild(accordionWrapper);
    }

    // --- HELPER PARA GERAR HTML DO CARD ---
    function criarHtmlCard(solicitacao, index, ehPendente, podeAprovar) {
        const pedidoId = solicitacao.id;
        const osReal = getOsLabel(solicitacao);
        const solicitante = solicitacao.nomeSolicitante && solicitacao.nomeSolicitante !== 'null' ? solicitacao.nomeSolicitante : 'Desconhecido';
        const dataStr = formatarDataHora(solicitacao.dataSolicitacao);
        const segmento = getSegmentoLabel(solicitacao);
        const totalValor = calcularTotal(solicitacao.itens);
        const totalItens = (solicitacao.itens || []).length;
        const parentId = ehPendente ? 'accordionMateriais' : 'accordionHistoricoMateriais';
        const sufixoId = ehPendente ? 'p' : 'h';

        // Calcula Status Geral (Para o cabeçalho)
        let statusGeralBadge = '';
        if (!ehPendente) {
            const status = calcularStatusGeral(solicitacao);
            if (status === 'APROVADO') statusGeralBadge = `<span class="badge bg-success ms-2"><i class="bi bi-check-all me-1"></i>APROVADO</span>`;
            else if (status === 'REJEITADO') statusGeralBadge = `<span class="badge bg-danger ms-2"><i class="bi bi-x-circle me-1"></i>RECUSADO</span>`;
            else if (status === 'PARCIAL') statusGeralBadge = `<span class="badge bg-warning text-dark ms-2">PARCIAL</span>`;
            else statusGeralBadge = `<span class="badge bg-secondary ms-2">${status}</span>`;
        } else {
            if (solicitacao.status === 'PENDENTE_COORDENADOR') {
                statusGeralBadge = `<span class="badge bg-warning text-dark ms-2"><i class="bi bi-hourglass-split me-1"></i>Aguardando Coordenador</span>`;
            } else if (solicitacao.status === 'PENDENTE_CONTROLLER') {
                statusGeralBadge = `<span class="badge bg-primary ms-2"><i class="bi bi-hourglass-split me-1"></i>Aguardando Controller</span>`;
            }
        }

        const linhasItens = (solicitacao.itens || []).map(item => {
            const mat = item.material || {};
            const qtd = toNumber(item.quantidadeSolicitada);
            const custo = toNumber(mat.custoMedioPonderado);
            const totalItem = qtd * custo;
            const alertaEstoque = toNumber(mat.saldoFisico) < qtd;
            const isItemSelected = ehPendente ? selecionadosMateriais.includes(item.id) : false;

            let statusHtml = '';
            if (item.statusItem === 'PENDENTE') statusHtml = `<span class="badge bg-light text-secondary border">PENDENTE</span>`;
            else if (item.statusItem === 'APROVADO') statusHtml = `<span class="badge status-approved"><i class="bi bi-check-circle-fill me-1"></i>APROVADO</span>`;
            else if (item.statusItem === 'REPROVADO' || item.statusItem === 'RECUSADO') statusHtml = `<span class="badge status-rejected"><i class="bi bi-x-circle-fill me-1"></i>RECUSADO</span>`;

            let acoesHtml = '';
            if (ehPendente && item.statusItem === 'PENDENTE' && podeAprovar) {
                acoesHtml = `
                <div class="d-flex justify-content-end gap-2">
                    <button class="btn-icon-item btn-action-approve" onclick="prepararAprovacao(${pedidoId}, ${item.id}, 'ITEM')" title="Aprovar"><i class="bi bi-check-lg"></i></button>
                    <button class="btn-icon-item btn-action-reject" onclick="prepararRejeicao(${pedidoId}, ${item.id}, 'ITEM')" title="Recusar"><i class="bi bi-x-lg"></i></button>
                </div>`;
            } else if (!ehPendente && item.observacao) {
                acoesHtml = `<button class="btn btn-sm btn-light border" title="${item.observacao}"><i class="bi bi-chat-text"></i> Obs</button>`;
            }

            return `
            <tr>
                <td class="text-center">
                    ${ehPendente && item.statusItem === 'PENDENTE' && podeAprovar ? `
                        <div class="form-check d-flex justify-content-center prevent-expand">
                            <input class="form-check-input check-item-filho" type="checkbox" value="${item.id}" ${isItemSelected ? 'checked' : ''} onchange="toggleItemIndividual(this, ${pedidoId})">
                        </div>
                    ` : (ehPendente ? '' : `<i class="bi bi-circle-fill text-muted" style="font-size: 5px;"></i>`)}
                </td>
                <td style="width: 60px;"><div class="material-icon-box"><i class="bi bi-box-seam"></i></div></td>
                <td><span class="text-item-title">${mat.descricao || 'Item Desconhecido'}</span><span class="text-muted text-xs font-monospace">COD: ${mat.codigo || '-'}</span></td>
                <td class="text-center"><span class="badge-unid">${mat.unidadeMedida || 'UN'}</span></td>
                <td class="text-center fw-bold text-dark">${qtd}</td>
                <td class="text-center">${ehPendente ? (`<span class="${alertaEstoque ? 'text-danger fw-bold' : 'text-success'}">${mat.saldoFisico || 0}</span>`) : '-'}</td>
                <td class="text-end pe-4"><span class="price-tag">${formatarMoeda(totalItem)}</span></td>
                <td class="text-center">${statusHtml}</td>
                <td class="text-end ps-3">${acoesHtml}</td>
            </tr>`;
        }).join('');

        let site = 'Sem Site';

        // 1. Tenta LPU
        if (solicitacao.lpu && solicitacao.lpu.site && solicitacao.lpu.site !== '-' && solicitacao.lpu.site !== 'Sem Site') {
            site = solicitacao.lpu.site;
        }
        // 2. Se falhou, tenta OS
        else if (solicitacao.os && solicitacao.os.site && solicitacao.os.site !== '-' && solicitacao.os.site !== 'Sem Site') {
            site = solicitacao.os.site;
        }
        // 3. Fallback extra caso o backend grave direto na solicitação pai
        else if (solicitacao.site && solicitacao.site !== '-' && solicitacao.site !== 'Sem Site') {
            site = solicitacao.site;
        }

        return `
        <div class="pedido-header collapsed" data-bs-toggle="collapse" data-bs-target="#collapse-${pedidoId}-${sufixoId}">
            <div class="d-flex align-items-center w-100 gap-3">
                ${(ehPendente && podeAprovar) ? `
                    <div class="form-check prevent-expand">
                        <input class="form-check-input form-check-input-custom check-pedido-pai" type="checkbox" value="${pedidoId}" onchange="togglePedidoInteiro(this, ${pedidoId})">
                    </div>
                ` : ''}

                <div class="d-flex flex-column flex-grow-1">
                    <div class="d-flex align-items-center gap-2 mb-1 flex-wrap">
                        <span class="badge-os">OS ${osReal}</span>
                        
                        <span class="badge bg-info bg-opacity-10 text-info border border-info border-opacity-25">
                            <i class="bi bi-geo-alt-fill me-1"></i>${site}
                        </span>
                        ${statusGeralBadge}
                        <span class="text-muted text-xs ms-auto d-md-none">${dataStr}</span>
                    </div>
                    <div class="d-flex align-items-center justify-content-between">
                        <div class="user-name">
                            <i class="bi bi-person-circle text-muted me-2 opacity-50"></i>
                            <span class="fw-bold text-dark">${solicitante}</span>
                        </div>
                        <div class="d-flex align-items-center gap-3 d-none d-md-flex">
                            <span class="text-muted text-xs" title="Data"><i class="bi bi-calendar me-1"></i>${dataStr}</span>
                            <span class="badge bg-light text-dark border"><i class="bi bi-layers me-1"></i>${segmento}</span>
                            <span class="fw-bold text-success ms-2">${formatarMoeda(totalValor)}</span>
                        </div>
                    </div>
                </div>
                <div class="ms-3 text-muted opacity-50"><i class="bi bi-chevron-down transition-icon"></i></div>
            </div>
        </div>

        <div id="collapse-${pedidoId}-${sufixoId}" class="accordion-collapse collapse" data-bs-parent="#${parentId}">
            <div class="accordion-body bg-white p-0">
                <div class="table-responsive p-3" style="max-height: 500px; overflow-y: auto;">
                    <table class="table-modern-2026">
                        <thead><tr>
                            <th style="width: 40px;" class="text-center"></th>
                            <th>Ref</th><th>Material / Descrição</th><th class="text-center">Unid</th>
                            <th class="text-center">Qtd</th><th class="text-center">${ehPendente ? 'Estoque' : '-'}</th>
                            <th class="text-end pe-4">Total</th><th class="text-center">Status</th><th class="text-end">Ação</th>
                        </tr></thead>
                        <tbody>${linhasItens}</tbody>
                    </table>
                </div>
                ${(ehPendente && podeAprovar) ? `
                <div class="p-3 bg-light border-top d-flex align-items-center justify-content-between">
                    <div class="text-muted text-xs"><i class="bi bi-info-circle me-1"></i>${totalItens} itens</div>
                    <div class="d-flex gap-2">
                        <button class="btn btn-sm btn-outline-danger fw-bold border-0" onclick="prepararRejeicao(${pedidoId}, null, 'PEDIDO')">Recusar Pedido</button>
                        <button class="btn btn-success-gradient btn-sm px-4 shadow-sm" onclick="prepararAprovacao(${pedidoId}, null, 'PEDIDO')"><i class="bi bi-check2-all me-1"></i> Aprovar Tudo</button>
                    </div>
                </div>` : ''}
            </div>
        </div>`;
    }

    // =================================================================
    // 4. LÓGICA DE AÇÃO
    // =================================================================

    function prepararAprovacao(idSolicitacao, idItem, tipo) {
        acaoIndividualAlvo = { idSolicitacao, idItem, tipo };
        const txtEl = document.getElementById('msgAprovacaoGenerico');
        if (txtEl) txtEl.innerText = (tipo === 'ITEM') ? "Aprovar item?" : (tipo === 'PEDIDO') ? "Aprovar pedido?" : "Aprovar lote?";
        resetModalLoadingState('modalAprovacaoGenerico', 'btnConfirmarAprovacaoGen');
        const modal = new bootstrap.Modal(document.getElementById('modalAprovacaoGenerico'));
        modal.show();
    }

    function prepararRejeicao(idSolicitacao, idItem, tipo) {
        acaoIndividualAlvo = { idSolicitacao, idItem, tipo };
        const txtEl = document.getElementById('msgRecusaGenerico');
        if (txtEl) txtEl.innerText = "Informe o motivo da recusa:";
        document.getElementById('inputMotivoGenerico').value = '';
        resetModalLoadingState('modalRecusaGenerico', 'btnConfirmarRecusaGen');
        const modal = new bootstrap.Modal(document.getElementById('modalRecusaGenerico'));
        modal.show();
    }

    async function confirmarAprovacao() { await executarAcao('APROVAR', null, 'modalAprovacaoGenerico', 'btnConfirmarAprovacaoGen'); }

    async function confirmarRejeicao() {
        const motivo = document.getElementById('inputMotivoGenerico').value;
        if (!motivo || !motivo.trim()) { alert("Motivo é obrigatório."); return; }
        await executarAcao('REJEITAR', motivo, 'modalRecusaGenerico', 'btnConfirmarRecusaGen');
    }

    async function executarAcao(acao, observacao, modalId, btnId) {
        const modalEl = document.getElementById(modalId);
        const btn = document.getElementById(btnId);
        setModalInteratividade(modalEl, false);
        setButtonLoadingSafe(btn, true);
        try {
            if (!acaoIndividualAlvo) return;
            const { idSolicitacao, idItem, tipo } = acaoIndividualAlvo;
            if (tipo === 'LOTE') await enviarDecisaoLote(acao, observacao);
            else if (tipo === 'PEDIDO') {
                const solicitacao = listaCompletaSolicitacoes.find(s => s.id === idSolicitacao);
                if (solicitacao && solicitacao.itens) {
                    selecionadosMateriais = solicitacao.itens.filter(i => i.statusItem === 'PENDENTE').map(i => i.id);
                    if (selecionadosMateriais.length > 0) await enviarDecisaoLote(acao, observacao);
                }
            } else if (tipo === 'ITEM') await enviarDecisaoItem(idSolicitacao, idItem, acao, observacao);

            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();
        } catch (error) {
            console.error(error);
            if (window.mostrarToast) mostrarToast("Erro ao processar", "error");
        } finally {
            setButtonLoadingSafe(btn, false);
            setModalInteratividade(modalEl, true);
        }
    }

    async function enviarDecisaoItem(idSolicitacao, idItem, acao, observacao) {
        const role = (typeof userRole !== 'undefined' ? userRole : '').toUpperCase();
        const usuarioId = (typeof userId !== 'undefined') ? userId : null;
        const url = `${API_MATERIALS_URL}/api/materiais/solicitacoes/${idSolicitacao}/itens/${idItem}/decidir`;
        const body = { acao, observacao, aprovadorId: usuarioId };
        await fetchComAuth(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-User-Role': role }, body: JSON.stringify(body) });
        if (window.mostrarToast) mostrarToast(`Sucesso!`, "success");
        await carregarDadosMateriais();
    }

    async function enviarDecisaoLote(acao, observacao) {
        const ids = [...selecionadosMateriais];
        selecionadosMateriais = [];
        limparSelecaoUI();
        atualizarUIGlobal();
        const role = (typeof userRole !== 'undefined' ? userRole : '').toUpperCase();
        const usuarioId = (typeof userId !== 'undefined') ? userId : null;
        let endpoint = (role === 'CONTROLLER' || role === 'ADMIN') ? 'controller' : 'coordenador';
        endpoint += (acao === 'APROVAR') ? '/aprovar-lote' : '/rejeitar-lote';
        const body = { ids, aprovadorId: usuarioId, observacao };
        await fetchComAuth(`${API_MATERIALS_URL}/api/materiais/solicitacoes/${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-User-Role': role }, body: JSON.stringify(body) });
        if (window.mostrarToast) mostrarToast(`Sucesso!`, "success");
        await carregarDadosMateriais();
        if (typeof carregarDashboardEBadges === 'function') carregarDashboardEBadges();
    }

    // -----------------------------------------------------------------
    // UTILITÁRIOS
    // -----------------------------------------------------------------

    function getHeadersAuth() {
        const headers = {};
        const role = (typeof userRole !== 'undefined') ? userRole : '';
        const uid = (typeof userId !== 'undefined' && userId) ? userId : localStorage.getItem('usuarioId');
        if (role) headers['X-User-Role'] = role;
        if (uid) headers['X-User-Id'] = uid;
        return headers;
    }

    function getOsLabel(solicitacao) {
        const osObj = solicitacao.os || {};
        if (solicitacao.osCodigo) return solicitacao.osCodigo;
        if (osObj.os && typeof osObj.os === 'string') return osObj.os;
        if (osObj.codigo) return osObj.codigo;
        if (osObj.numero) return osObj.numero;
        return osObj.id ? `(ID) ${osObj.id}` : 'N/A';
    }

    function getSegmentoLabel(solicitacao) {
        const osObj = solicitacao.os || {};
        if (osObj.segmento && osObj.segmento.nome && osObj.segmento.nome !== '-') return osObj.segmento.nome;
        if (osObj.segmentoDescricao && osObj.segmentoDescricao !== '-') return osObj.segmentoDescricao;
        return 'Geral';
    }

    function calcularStatusGeral(solicitacao) {
        const itens = solicitacao.itens || [];
        if (itens.length === 0) return 'VAZIO';
        const todosAprovados = itens.every(i => i.statusItem === 'APROVADO');
        if (todosAprovados) return 'APROVADO';
        const todosRecusados = itens.every(i => i.statusItem === 'REPROVADO' || i.statusItem === 'RECUSADO');
        if (todosRecusados) return 'REJEITADO';
        const algumPendente = itens.some(i => i.statusItem === 'PENDENTE');
        if (algumPendente) return 'PENDENTE';
        return 'PARCIAL';
    }

    function renderizarErro(container, msg, context) {
        container.innerHTML = `<div class="text-center py-5"><h5 class="text-muted">Erro</h5><p class="small text-muted">${msg}</p><button class="btn btn-refresh-glass mx-auto mt-3" onclick="${context}()">Tentar Novamente</button></div>`;
    }

    function renderizarVazio(container, titulo, sub) {
        container.innerHTML = `<div class="empty-state-modern py-5 fade-in-up"><div style="font-size: 3rem; color: #e9ecef;"><i class="bi bi-inbox"></i></div><h5 class="mt-3 text-muted fw-bold">${titulo}</h5><p class="text-muted small">${sub}</p></div>`;
    }

    function setButtonLoadingSafe(btn, isLoading) {
        if (!btn) return;
        const spinner = btn.querySelector('.spinner-border');
        const icon = btn.querySelector('i');
        btn.disabled = isLoading;
        if (spinner) isLoading ? spinner.classList.remove('d-none') : spinner.classList.add('d-none');
        if (icon) isLoading ? icon.classList.add('d-none') : icon.classList.remove('d-none');
    }

    function setModalInteratividade(modalEl, habilitar) {
        if (!modalEl) return;
        modalEl.querySelectorAll('[data-bs-dismiss="modal"], button, textarea').forEach(el => el.disabled = !habilitar);
    }

    function resetModalLoadingState(modalId, confirmBtnId) {
        const modalEl = document.getElementById(modalId);
        setButtonLoadingSafe(document.getElementById(confirmBtnId), false);
        setModalInteratividade(modalEl, true);
    }

    function limparSelecaoUI() {
        document.querySelectorAll('.check-item-filho, .check-pedido-pai').forEach(cb => { cb.checked = false; cb.indeterminate = false; });
        document.querySelectorAll('.pedido-item-dom.selected-card').forEach(card => card.classList.remove('selected-card'));
    }

    function instalarBloqueioCliqueCheckboxes() {
        document.addEventListener('click', function (e) {
            const alvo = e.target.closest('.prevent-expand, input[type="checkbox"].check-item-filho, input[type="checkbox"].check-pedido-pai');
            if (alvo) { e.stopPropagation(); }
        }, true);
    }

    function toggleItemIndividual(checkbox, pedidoId) {
        const itemId = parseInt(checkbox.value);
        if (checkbox.checked) { if (!selecionadosMateriais.includes(itemId)) selecionadosMateriais.push(itemId); }
        else { selecionadosMateriais = selecionadosMateriais.filter(id => id !== itemId); }
        const card = checkbox.closest('.pedido-item-dom');
        atualizarEstadoCheckboxPai(card);
        selecionadosMateriais = Array.from(new Set(selecionadosMateriais));
        atualizarUIGlobal();
    }

    function togglePedidoInteiro(checkbox, pedidoId) {
        const card = checkbox.closest('.pedido-item-dom');
        const isChecked = checkbox.checked;
        card.querySelectorAll('.check-item-filho').forEach(child => {
            child.checked = isChecked;
            const itemId = parseInt(child.value);
            if (isChecked) { if (!selecionadosMateriais.includes(itemId)) selecionadosMateriais.push(itemId); }
            else { selecionadosMateriais = selecionadosMateriais.filter(id => id !== itemId); }
        });
        if (isChecked) card.classList.add('selected-card'); else card.classList.remove('selected-card');
        selecionadosMateriais = Array.from(new Set(selecionadosMateriais));
        atualizarUIGlobal();
    }

    function atualizarEstadoCheckboxPai(card) {
        if (!card) return;
        const checkPai = card.querySelector('.check-pedido-pai');
        const filhos = Array.from(card.querySelectorAll('.check-item-filho'));
        if (filhos.length === 0) return;
        const todosMarcados = filhos.every(c => c.checked);
        const algumMarcado = filhos.some(c => c.checked);
        if (checkPai) { checkPai.checked = todosMarcados; checkPai.indeterminate = algumMarcado && !todosMarcados; }
        if (algumMarcado) card.classList.add('selected-card'); else card.classList.remove('selected-card');
    }

    function atualizarUIGlobal() {
        const toolbar = document.querySelector('.actions-group-modern');
        const counter = document.getElementById('count-global-check') || document.getElementById('count-materiais-selection');
        if (!toolbar || !counter) return;
        const total = selecionadosMateriais.length;
        counter.innerText = String(total);
        toolbar.classList.toggle('show', total > 0);
        toolbar.style.display = total > 0 ? 'flex' : 'none';
    }

    function filtrarMateriaisNaTela() {
        const termo = (document.getElementById('filtro-materiais-input')?.value || '').toLowerCase();
        filtrarContainer('container-pedidos-materiais', termo);
    }

    function filtrarHistoricoMateriaisNaTela() {
        const termo = (document.getElementById('filtro-historico-materiais-input')?.value || '').toLowerCase();
        filtrarContainer('container-historico-materiais', termo);
    }

    function filtrarContainer(containerId, termo) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.querySelectorAll('.pedido-item-dom').forEach(card => {
            const searchData = card.getAttribute('data-search').toLowerCase();
            card.classList.toggle('d-none', !searchData.includes(termo));
        });
    }

    function aprovarLoteMateriais() { prepararAprovacao(null, null, 'LOTE'); }
    function rejeitarLoteMateriais() { prepararRejeicao(null, null, 'LOTE'); }
    function confirmarAprovacaoLoteMateriais() { confirmarAprovacao(); }
    function confirmarRejeicaoLoteMateriais() { confirmarRejeicao(); }

    function toNumber(v) { return Number(v) || 0; }
    function calcularTotal(itens) { return (itens || []).reduce((acc, i) => acc + (toNumber(i.quantidadeSolicitada) * toNumber(i.material?.custoMedioPonderado)), 0); }
    function formatarDataHora(iso) { if (!iso) return '-'; const d = new Date(iso); return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }
    const formatarMoeda = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

    function exportarHistoricoMateriaisExcel() {
        if (!listaCompletaHistorico || listaCompletaHistorico.length === 0) {
            if (window.mostrarToast) mostrarToast('Nenhum dado para exportar. Faça uma busca primeiro.', 'warning');
            return;
        }

        const dadosExportacao = [];

        // Varre todas as solicitações e seus itens para achatar os dados
        listaCompletaHistorico.forEach(solicitacao => {
            const osReal = getOsLabel(solicitacao);
            const solicitante = solicitacao.nomeSolicitante && solicitacao.nomeSolicitante !== 'null' ? solicitacao.nomeSolicitante : 'Desconhecido';
            const dataStr = formatarDataHora(solicitacao.dataSolicitacao);
            const segmento = getSegmentoLabel(solicitacao);
            
            let site = 'Sem Site';
            if (solicitacao.lpu && solicitacao.lpu.site && solicitacao.lpu.site !== '-' && solicitacao.lpu.site !== 'Sem Site') site = solicitacao.lpu.site;
            else if (solicitacao.os && solicitacao.os.site && solicitacao.os.site !== '-' && solicitacao.os.site !== 'Sem Site') site = solicitacao.os.site;
            else if (solicitacao.site && solicitacao.site !== '-' && solicitacao.site !== 'Sem Site') site = solicitacao.site;

            const statusGeral = calcularStatusGeral(solicitacao);

            // Cada item do pedido vai virar uma linha na planilha
            (solicitacao.itens || []).forEach(item => {
                const mat = item.material || {};
                const qtd = toNumber(item.quantidadeSolicitada);
                const custo = toNumber(mat.custoMedioPonderado);
                const totalItem = qtd * custo;

                dadosExportacao.push({
                    "OS": osReal,
                    "Segmento": segmento,
                    "Site": site,
                    "Solicitante": solicitante,
                    "Data Solicitação": dataStr,
                    "Status Pedido": statusGeral,
                    "Código Material": mat.codigo || '-',
                    "Descrição Material": mat.descricao || 'Item Desconhecido',
                    "Unidade": mat.unidadeMedida || 'UN',
                    "Qtd Solicitada": qtd,
                    "Custo Unitário": custo,
                    "Custo Total": totalItem,
                    "Status do Item": item.statusItem || 'PENDENTE',
                    "Motivo Recusa / Obs": item.observacao || item.motivoRecusa || '-'
                });
            });
        });

        // Verifica se a biblioteca XLSX está injetada no index
        if (typeof XLSX === 'undefined') {
            if (window.mostrarToast) mostrarToast('Biblioteca de exportação não encontrada.', 'error');
            console.error("A biblioteca XLSX (SheetJS) não está definida.");
            return;
        }

        // Gera a planilha e faz o download
        const worksheet = XLSX.utils.json_to_sheet(dadosExportacao);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Histórico Materiais");

        const dataAtual = new Date().toISOString().slice(0, 10);
        XLSX.writeFile(workbook, `Historico_Materiais_${dataAtual}.xlsx`);
    }

    function exportarMateriaisPendentesExcel() {
        if (!listaCompletaSolicitacoes || listaCompletaSolicitacoes.length === 0) {
            if (window.mostrarToast) mostrarToast('Nenhum dado pendente para exportar.', 'warning');
            return;
        }

        const dadosExportacao = [];

        // Varre todas as solicitações pendentes
        listaCompletaSolicitacoes.forEach(solicitacao => {
            const osReal = getOsLabel(solicitacao);
            const solicitante = solicitacao.nomeSolicitante && solicitacao.nomeSolicitante !== 'null' ? solicitacao.nomeSolicitante : 'Desconhecido';
            const dataStr = formatarDataHora(solicitacao.dataSolicitacao);
            const segmento = getSegmentoLabel(solicitacao);
            
            let site = 'Sem Site';
            if (solicitacao.lpu && solicitacao.lpu.site && solicitacao.lpu.site !== '-' && solicitacao.lpu.site !== 'Sem Site') site = solicitacao.lpu.site;
            else if (solicitacao.os && solicitacao.os.site && solicitacao.os.site !== '-' && solicitacao.os.site !== 'Sem Site') site = solicitacao.os.site;
            else if (solicitacao.site && solicitacao.site !== '-' && solicitacao.site !== 'Sem Site') site = solicitacao.site;

            // Cada item pendente vira uma linha na planilha
            (solicitacao.itens || []).forEach(item => {
                const mat = item.material || {};
                const qtd = toNumber(item.quantidadeSolicitada);
                const custo = toNumber(mat.custoMedioPonderado);
                const totalItem = qtd * custo;

                dadosExportacao.push({
                    "OS": osReal,
                    "Segmento": segmento,
                    "Site": site,
                    "Solicitante": solicitante,
                    "Data Solicitação": dataStr,
                    "Status Pedido": solicitacao.status || 'PENDENTE',
                    "Código Material": mat.codigo || '-',
                    "Descrição Material": mat.descricao || 'Item Desconhecido',
                    "Unidade": mat.unidadeMedida || 'UN',
                    "Qtd Solicitada": qtd,
                    "Custo Unitário": custo,
                    "Custo Total": totalItem,
                    "Status do Item": item.statusItem || 'PENDENTE'
                });
            });
        });

        // Verifica se a biblioteca XLSX está disponível
        if (typeof XLSX === 'undefined') {
            if (window.mostrarToast) mostrarToast('Biblioteca de exportação não encontrada.', 'error');
            return;
        }

        // Gera a planilha e faz o download
        const worksheet = XLSX.utils.json_to_sheet(dadosExportacao);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Materiais Pendentes");

        const dataAtual = new Date().toISOString().slice(0, 10);
        XLSX.writeFile(workbook, `Materiais_Pendentes_${dataAtual}.xlsx`);
    }

})();