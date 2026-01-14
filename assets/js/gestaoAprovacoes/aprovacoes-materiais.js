// ==========================================================
// LÓGICA DE APROVAÇÃO DE MATERIAIS - ULTRA MODERN UI 2026
// (Sincronizado com Backend InproutMaterialsService)
// ==========================================================

// Define a URL do serviço de materiais (Porta 8081 conforme application.yaml)
window.API_MATERIALS_URL = window.API_MATERIALS_URL || 'http://localhost:8081';
var API_MATERIALS_URL = window.API_MATERIALS_URL;

(function () {
    'use strict';

    // --- Estado Local ---
    let selecionadosMateriais = [];
    let listaCompletaSolicitacoes = [];

    // Controle para ação individual (Item ou Pedido Específico)
    let acaoIndividualAlvo = null; // { idSolicitacao, idItem (opcional), tipo: 'ITEM' | 'PEDIDO' | 'LOTE' }

    // --- Exposição Global das Funções ---
    window.carregarDadosMateriais = carregarDadosMateriais;
    window.aprovarLoteMateriais = aprovarLoteMateriais;
    window.rejeitarLoteMateriais = rejeitarLoteMateriais;

    window.togglePedidoInteiro = togglePedidoInteiro;
    window.filtrarMateriaisNaTela = filtrarMateriaisNaTela;
    window.renderizarCardsPedidos = renderizarCardsPedidos;

    // Funções de Gatilho (Botões da UI)
    window.prepararAprovacao = prepararAprovacao;
    window.prepararRejeicao = prepararRejeicao;

    // Funções de Confirmação (Chamadas pelos Modais)
    window.confirmarAprovacao = confirmarAprovacao;
    window.confirmarRejeicao = confirmarRejeicao;

    // =================================================================
    // 1. INICIALIZAÇÃO E LISTENERS
    // =================================================================
    document.addEventListener('DOMContentLoaded', () => {
        // Injeta os Modais Dinâmicos se não existirem
        injetarModaisDinamicos();
        criarToolbarFlutuante();
    });

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
        }
    }

    function injetarModaisDinamicos() {
        // 1. Modal de Aprovação (Genérico)
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
                                <button type="button" class="btn btn-success-gradient px-4" onclick="confirmarAprovacao()">
                                    <i class="bi bi-check-circle me-1"></i> Confirmar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;
            document.body.appendChild(modalAprov.firstElementChild);
        }

        // 2. Modal de Recusa (Genérico)
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
                                <button type="button" class="btn btn-danger-gradient px-4" onclick="confirmarRejeicao()">
                                    <i class="bi bi-x-circle me-1"></i> Recusar
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
    // 2. BUSCA DE DADOS (GET)
    // =================================================================
    async function carregarDadosMateriais() {
        const container = document.getElementById('container-pedidos-materiais');
        if (!container) return;

        container.innerHTML = `
            <div class="empty-state-modern py-5">
                <div class="spinner-border text-success" role="status" style="width: 3rem; height: 3rem;"></div>
                <p class="mt-4 text-muted fw-bold tracking-wide">BUSCANDO SOLICITAÇÕES...</p>
            </div>`;

        try {
            const url = `${API_MATERIALS_URL}/api/materiais/solicitacoes/pendentes`;
            const headersExtras = {};
            if (typeof userRole !== 'undefined' && userRole) {
                headersExtras['X-User-Role'] = userRole;
            }

            const response = await fetchComAuth(url, { method: 'GET', headers: headersExtras });
            if (!response.ok) throw new Error(`Status: ${response.status}`);

            const dados = await response.json();
            listaCompletaSolicitacoes = Array.isArray(dados) ? dados : [];
            renderizarCardsPedidos(listaCompletaSolicitacoes);

        } catch (error) {
            console.error(error);
            container.innerHTML = `
                <div class="text-center py-5">
                    <div class="mb-3 text-danger"><i class="bi bi-wifi-off fs-1"></i></div>
                    <h5 class="text-muted">Falha na conexão</h5>
                    <p class="small text-muted">${error.message}</p>
                    <button class="btn btn-refresh-glass mx-auto mt-3" onclick="carregarDadosMateriais()">
                        <i class="bi bi-arrow-clockwise"></i>
                    </button>
                </div>`;
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
            container.innerHTML = `
                <div class="empty-state-modern py-5 fade-in-up">
                    <div style="font-size: 4rem; color: #e9ecef;"><i class="bi bi-box-seam"></i></div>
                    <h5 class="mt-3 text-muted fw-bold">Tudo limpo por aqui!</h5>
                    <p class="text-muted small">Nenhuma solicitação pendente no momento.</p>
                </div>`;
            return;
        }

        const accordionWrapper = document.createElement('div');
        accordionWrapper.className = 'custom-accordion-modern';
        accordionWrapper.id = 'accordionMateriais';

        const role = (typeof userRole !== 'undefined' ? userRole : '').toUpperCase();
        const podeAprovar = ['COORDINATOR', 'MANAGER', 'ADMIN', 'CONTROLLER'].includes(role);

        lista.forEach((solicitacao, index) => {
            const pedidoId = solicitacao.id;

            // --- 1. CORREÇÃO OS (STRING) ---
            // Tenta pegar o campo 'os' (string) ou fallback para outros campos
            const osObj = solicitacao.os || {};
            const osReal = osObj.os || osObj.numero || osObj.numeroOS || osObj.id || 'N/A';

            // --- 2. CORREÇÃO SOLICITANTE ---
            // Usa o nome retornado pelo backend (se você aplicou as alterações Java)
            const solicitante = solicitacao.nomeSolicitante && solicitacao.nomeSolicitante !== 'null'
                ? solicitacao.nomeSolicitante
                : 'Solicitante Desconhecido';

            const dataStr = formatarDataHora(solicitacao.dataSolicitacao);

            // --- 3. CORREÇÃO SEGMENTO ---
            let segmento = 'Geral';
            if (solicitacao.os && solicitacao.os.segmento && solicitacao.os.segmento.nome) {
                segmento = solicitacao.os.segmento.nome;
            } else if (solicitacao.os && solicitacao.os.segmentoDescricao) {
                segmento = solicitacao.os.segmentoDescricao;
            }

            // --- 4. CORREÇÃO OBJETO CONTRATADO ---
            // Usa o campo lpu.nome que populamos com o Objeto Contratado no backend
            const lpuObj = solicitacao.lpu || {};
            const lpuDisplay = lpuObj.nome || lpuObj.nomeLpu || 'Objeto não informado';

            const totalValor = calcularTotal(solicitacao.itens);
            const totalItens = (solicitacao.itens || []).length;

            // Renderiza Linhas da Tabela
            const linhasItens = (solicitacao.itens || []).map(item => {
                const mat = item.material || {};
                const saldo = toNumber(mat.saldoFisico);
                const qtd = toNumber(item.quantidadeSolicitada);
                const custo = toNumber(mat.custoMedioPonderado);
                const totalItem = qtd * custo;
                const alertaEstoque = saldo < qtd;

                // Status visual
                let statusHtml = '';
                if (item.statusItem === 'PENDENTE') statusHtml = `<span class="badge bg-light text-secondary border">PENDENTE</span>`;
                else if (item.statusItem === 'APROVADO') statusHtml = `<span class="badge status-approved"><i class="bi bi-check-circle-fill me-1"></i>APROVADO</span>`;
                else if (item.statusItem === 'REPROVADO') statusHtml = `<span class="badge status-rejected"><i class="bi bi-x-circle-fill me-1"></i>RECUSADO</span>`;

                // Botões de Ação Individual
                let acoesHtml = '';
                if (item.statusItem === 'PENDENTE' && podeAprovar) {
                    acoesHtml = `
                        <div class="d-flex justify-content-end gap-2">
                            <button class="btn-icon-item btn-action-approve" onclick="prepararAprovacao(${pedidoId}, ${item.id}, 'ITEM')" title="Aprovar Item">
                                <i class="bi bi-check-lg"></i>
                            </button>
                            <button class="btn-icon-item btn-action-reject" onclick="prepararRejeicao(${pedidoId}, ${item.id}, 'ITEM')" title="Recusar Item">
                                <i class="bi bi-x-lg"></i>
                            </button>
                        </div>
                    `;
                }

                return `
                    <tr>
                        <td style="width: 60px;">
                            <div class="material-icon-box">
                                <i class="bi bi-box-seam"></i>
                            </div>
                        </td>
                        <td>
                            <span class="text-item-title">${mat.descricao || 'Item Desconhecido'}</span>
                            <span class="text-muted text-xs font-monospace">COD: ${mat.codigo || '-'}</span>
                        </td>
                        <td class="text-center"><span class="badge-unid">${mat.unidadeMedida || 'UN'}</span></td>
                        <td class="text-center fw-bold text-dark">${qtd}</td>
                        <td class="text-center">
                            <span class="${alertaEstoque ? 'text-danger fw-bold' : 'text-success'}">
                                ${saldo}
                            </span>
                            ${alertaEstoque ? '<i class="bi bi-exclamation-circle-fill text-danger ms-1" title="Estoque insuficiente"></i>' : ''}
                        </td>
                        <td class="text-end pe-4">
                            <span class="price-tag">${formatarMoeda(totalItem)}</span>
                        </td>
                        <td class="text-center">${statusHtml}</td>
                        <td class="text-end ps-3">${acoesHtml}</td>
                    </tr>
                `;
            }).join('');

            const cardItem = document.createElement('div');
            cardItem.className = 'accordion-item pedido-item-dom fade-in-up';
            cardItem.setAttribute('data-search', `${osReal} ${solicitante}`.toLowerCase());
            cardItem.style.animationDelay = `${index * 0.05}s`;

            cardItem.innerHTML = `
                <div class="pedido-header collapsed" data-bs-toggle="collapse" data-bs-target="#collapse-${pedidoId}">
                    <div class="d-flex align-items-center w-100 gap-3">
                        ${podeAprovar ? `
                            <div class="form-check" onclick="event.stopPropagation()">
                                <input class="form-check-input form-check-input-custom check-pedido-pai" 
                                       type="checkbox" 
                                       value="${pedidoId}" 
                                       onchange="togglePedidoInteiro(this, ${pedidoId})">
                            </div>
                        ` : ''}

                        <div class="d-flex flex-column flex-grow-1">
                            <div class="d-flex align-items-center gap-2 mb-1">
                                <span class="badge-os">OS ${osReal}</span>
                                <span class="text-muted text-xs ms-auto d-md-none">${dataStr}</span>
                            </div>
                            <div class="d-flex align-items-center justify-content-between">
                            <div class="user-name">
                                <i class="bi bi-person-circle text-muted me-2 opacity-50"></i>
                                <span class="fw-bold text-dark">${solicitante}</span>
                            </div>
                            <div class="d-flex align-items-center gap-3 d-none d-md-flex">
                                <span class="text-muted text-xs" title="Data da Solicitação">
                                    <i class="bi bi-calendar me-1"></i>${dataStr}
                                </span>
                                
                                <span class="badge bg-light text-dark border" title="Segmento">
                                    <i class="bi bi-layers me-1"></i>${segmento}
                                </span>
                                
                                <span class="badge bg-primary bg-opacity-10 text-primary border border-primary-subtle" title="Objeto Contratado">
                                    <i class="bi bi-file-earmark-text me-1"></i>${lpuDisplay}
                                </span>
                                
                                <span class="fw-bold text-success ms-2">${formatarMoeda(totalValor)}</span>
                            </div>
                        </div>
                        </div>
                        
                        <div class="ms-3 text-muted opacity-50">
                            <i class="bi bi-chevron-down transition-icon"></i>
                        </div>
                    </div>
                </div>

                <div id="collapse-${pedidoId}" class="accordion-collapse collapse" data-bs-parent="#accordionMateriais">
                    <div class="accordion-body bg-white p-0">
                        <div class="table-responsive p-3" style="overflow-x: visible;">
                            <table class="table-modern-2026">
                                <thead>
                                    <tr>
                                        <th>Ref</th>
                                        <th>Material / Descrição</th>
                                        <th class="text-center">Unid</th>
                                        <th class="text-center">Qtd</th>
                                        <th class="text-center">Estoque</th>
                                        <th class="text-end pe-4">Total</th>
                                        <th class="text-center">Status</th>
                                        <th class="text-end">Ação</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${linhasItens}
                                    ${solicitacao.justificativa ? `
                                        <tr class="row-justificativa">
                                            <td colspan="8">
                                                <div class="justificativa-box">
                                                    <i class="bi bi-chat-quote-fill fs-5"></i>
                                                    <div>
                                                        <strong>JUSTIFICATIVA DO SOLICITANTE:</strong><br>
                                                        ${solicitacao.justificativa}
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    ` : ''}
                                </tbody>
                            </table>
                        </div>

                        <div class="p-3 bg-light border-top d-flex align-items-center justify-content-between">
                            <div class="text-muted text-xs">
                                <i class="bi bi-info-circle me-1"></i>
                                ${totalItens} itens na solicitação
                            </div>
                            ${podeAprovar ? `
                                <div class="d-flex gap-2">
                                    <button class="btn btn-sm btn-outline-danger fw-bold border-0" 
                                            onclick="prepararRejeicao(${pedidoId}, null, 'PEDIDO')">
                                        Recusar Pedido
                                    </button>
                                    <button class="btn btn-success-gradient btn-sm px-4 shadow-sm" 
                                            onclick="prepararAprovacao(${pedidoId}, null, 'PEDIDO')">
                                        <i class="bi bi-check2-all me-1"></i> Aprovar Tudo
                                    </button>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;
            accordionWrapper.appendChild(cardItem);
        });

        container.appendChild(accordionWrapper);
    }

    // =================================================================
    // 4. LÓGICA DE INTERAÇÃO (GATILHOS)
    // =================================================================

    // --- Preparar Aprovação ---
    function prepararAprovacao(idSolicitacao, idItem, tipo) {
        acaoIndividualAlvo = { idSolicitacao, idItem, tipo };

        let texto = "";
        if (tipo === 'ITEM') texto = "Deseja aprovar este item individualmente?";
        if (tipo === 'PEDIDO') texto = "Deseja aprovar todos os itens deste pedido?";
        if (tipo === 'LOTE') texto = `Deseja aprovar ${selecionadosMateriais.length} solicitações selecionadas?`;

        const txtEl = document.getElementById('msgAprovacaoGenerico');
        if (txtEl) txtEl.innerText = texto;

        const modal = new bootstrap.Modal(document.getElementById('modalAprovacaoGenerico'));
        modal.show();
    }

    // --- Preparar Rejeição ---
    function prepararRejeicao(idSolicitacao, idItem, tipo) {
        acaoIndividualAlvo = { idSolicitacao, idItem, tipo };

        let texto = "";
        if (tipo === 'ITEM') texto = "Motivo da recusa deste item:";
        if (tipo === 'PEDIDO') texto = "Motivo da recusa do pedido completo:";
        if (tipo === 'LOTE') texto = `Motivo da recusa para as ${selecionadosMateriais.length} solicitações:`;

        const txtEl = document.getElementById('msgRecusaGenerico');
        if (txtEl) txtEl.innerText = texto;

        document.getElementById('inputMotivoGenerico').value = '';

        const modal = new bootstrap.Modal(document.getElementById('modalRecusaGenerico'));
        modal.show();
    }

    // =================================================================
    // 5. CONFIRMAÇÕES (AÇÃO REAL)
    // =================================================================

    async function confirmarAprovacao() {
        const modalEl = document.getElementById('modalAprovacaoGenerico');
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();

        if (!acaoIndividualAlvo) return;
        const { idSolicitacao, idItem, tipo } = acaoIndividualAlvo;

        if (tipo === 'LOTE') {
            await enviarDecisaoLote('APROVAR', null);
        } else if (tipo === 'PEDIDO') {
            // Pedido = Lote de 1
            selecionadosMateriais = [idSolicitacao];
            await enviarDecisaoLote('APROVAR', null);
        } else if (tipo === 'ITEM') {
            await enviarDecisaoItem(idSolicitacao, idItem, 'APROVAR', null);
        }
    }

    async function confirmarRejeicao() {
        const motivo = document.getElementById('inputMotivoGenerico').value;
        if (!motivo || motivo.trim() === '') {
            alert("Motivo é obrigatório.");
            return;
        }

        const modalEl = document.getElementById('modalRecusaGenerico');
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();

        if (!acaoIndividualAlvo) return;
        const { idSolicitacao, idItem, tipo } = acaoIndividualAlvo;

        if (tipo === 'LOTE') {
            await enviarDecisaoLote('REJEITAR', motivo);
        } else if (tipo === 'PEDIDO') {
            selecionadosMateriais = [idSolicitacao];
            await enviarDecisaoLote('REJEITAR', motivo);
        } else if (tipo === 'ITEM') {
            await enviarDecisaoItem(idSolicitacao, idItem, 'REJEITAR', motivo);
        }
    }

    // =================================================================
    // 6. BACKEND CALLS
    // =================================================================

    // --- ITEM INDIVIDUAL ---
    async function enviarDecisaoItem(idSolicitacao, idItem, acao, observacao) {
        if (window.toggleLoader) window.toggleLoader(true);
        try {
            const role = (typeof userRole !== 'undefined' ? userRole : '').toUpperCase();
            const usuarioId = (typeof userId !== 'undefined') ? userId : null;
            const url = `${API_MATERIALS_URL}/api/materiais/solicitacoes/${idSolicitacao}/itens/${idItem}/decidir`;

            const body = { acao, observacao, aprovadorId: usuarioId };

            const response = await fetchComAuth(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-User-Role': role },
                body: JSON.stringify(body)
            });

            if (!response.ok) throw new Error(`Erro HTTP ${response.status}`);

            if (window.mostrarToast) mostrarToast(`Item ${acao === 'APROVAR' ? 'Aprovado' : 'Recusado'} com sucesso!`, "success");
            await carregarDadosMateriais();

        } catch (error) {
            console.error(error);
            if (window.mostrarToast) mostrarToast(error.message, "error");
        } finally {
            if (window.toggleLoader) window.toggleLoader(false);
        }
    }

    // --- LOTE (OU PEDIDO INTEIRO) ---
    async function enviarDecisaoLote(acao, observacao) {
        if (window.toggleLoader) window.toggleLoader(true);
        try {
            const role = (typeof userRole !== 'undefined' ? userRole : '').toUpperCase();
            const usuarioId = (typeof userId !== 'undefined') ? userId : null;

            // Define rota baseada no perfil
            let endpoint = '';
            if (role === 'CONTROLLER' || role === 'ADMIN') {
                endpoint = (acao === 'APROVAR')
                    ? `/api/materiais/solicitacoes/controller/aprovar-lote`
                    : `/api/materiais/solicitacoes/controller/rejeitar-lote`;
            } else {
                endpoint = (acao === 'APROVAR')
                    ? `/api/materiais/solicitacoes/coordenador/aprovar-lote`
                    : `/api/materiais/solicitacoes/coordenador/rejeitar-lote`;
            }

            const body = {
                ids: selecionadosMateriais,
                aprovadorId: usuarioId,
                observacao: observacao
            };

            const response = await fetchComAuth(`${API_MATERIALS_URL}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-User-Role': role },
                body: JSON.stringify(body)
            });

            if (!response.ok) throw new Error(`Erro HTTP ${response.status}`);

            if (window.mostrarToast) mostrarToast(`Operação ${acao} realizada com sucesso!`, "success");

            selecionadosMateriais = [];
            await carregarDadosMateriais();
            if (typeof carregarDashboardEBadges === 'function') carregarDashboardEBadges();

        } catch (error) {
            console.error(error);
            if (window.mostrarToast) mostrarToast(error.message, "error");
        } finally {
            if (window.toggleLoader) window.toggleLoader(false);
        }
    }

    // =================================================================
    // 7. UTILITÁRIOS E FILTROS
    // =================================================================
    function togglePedidoInteiro(checkbox, id) {
        const card = checkbox.closest('.pedido-item-dom');
        if (checkbox.checked) {
            if (!selecionadosMateriais.includes(id)) selecionadosMateriais.push(id);
            if (card) card.classList.add('selected-card');
        } else {
            selecionadosMateriais = selecionadosMateriais.filter(x => x !== id);
            if (card) card.classList.remove('selected-card');
        }
        atualizarUIGlobal();
    }

    function atualizarUIGlobal() {
        const toolbar = document.querySelector('.actions-group-modern');
        const counter = document.getElementById('count-materiais-selection');
        if (toolbar && counter) {
            counter.innerText = selecionadosMateriais.length;
            if (selecionadosMateriais.length > 0) toolbar.classList.add('show');
            else toolbar.classList.remove('show');
        }
    }

    function filtrarMateriaisNaTela() {
        const termo = (document.getElementById('filtro-materiais-input')?.value || '').toLowerCase();
        document.querySelectorAll('.pedido-item-dom').forEach(card => {
            const searchData = card.getAttribute('data-search').toLowerCase();
            card.classList.toggle('d-none', !searchData.includes(termo));
        });
    }

    // Compatibilidade com código legado (caso seja chamado de fora)
    function aprovarLoteMateriais() { prepararAprovacao(null, null, 'LOTE'); }
    function rejeitarLoteMateriais() { prepararRejeicao(null, null, 'LOTE'); }
    function confirmarAprovacaoLoteMateriais() { confirmarAprovacao(); }
    function confirmarRejeicaoLoteMateriais() { confirmarRejeicao(); }
    function selecionarUnicoEExecutar(id, acao) {
        if (acao === 'aprovar') prepararAprovacao(id, null, 'PEDIDO');
        if (acao === 'rejeitar') prepararRejeicao(id, null, 'PEDIDO');
    }

    function toNumber(v) { return Number(v) || 0; }
    function calcularTotal(itens) {
        return (itens || []).reduce((acc, i) => acc + (toNumber(i.quantidadeSolicitada) * toNumber(i.material?.custoMedioPonderado)), 0);
    }
    function formatarDataHora(iso) {
        if (!iso) return '-';
        const d = new Date(iso);
        return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }
    const formatarMoeda = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

})();