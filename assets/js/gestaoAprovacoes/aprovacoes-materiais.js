// Define a URL do serviço de materiais (Porta 8081 ou conforme configurado)
window.API_MATERIALS_URL = window.API_MATERIALS_URL || 'http://localhost:8081';
var API_MATERIALS_URL = window.API_MATERIALS_URL;

(function () { 'use strict';

    // =================================================================
    // 1. ESTADO LOCAL
    // =================================================================
    let selecionadosMateriais = [];
    let listaCompletaSolicitacoes = [];
    let acaoIndividualAlvo = null; // { idSolicitacao, idItem, tipo: 'ITEM'|'PEDIDO'|'LOTE' }

    // =================================================================
    // 2. INICIALIZAÇÃO E LISTENERS
    // =================================================================
    function iniciarComponentes() {
        injetarModaisDinamicos();
        criarToolbarFlutuante();
        instalarBloqueioCliqueCheckboxes();
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
                                    <span class="spinner-border spinner-border-sm d-none" role="status"></span>
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
                            <p class="text-muted small mb-3" id="msgRecusaGenerico">Informe o motivo:</p>
                            
                            <textarea id="inputMotivoGenerico" class="form-control form-control-modern mb-3" rows="3" placeholder="Digite o motivo..."></textarea>
                            
                            <div class="d-flex gap-2 justify-content-center">
                                <button type="button" class="btn btn-light px-4" data-bs-dismiss="modal">Cancelar</button>
                                <button type="button" class="btn btn-danger-gradient px-4 d-flex align-items-center gap-2" id="btnConfirmarRecusaGen" onclick="confirmarRejeicao()">
                                    <span class="spinner-border spinner-border-sm d-none" role="status"></span>
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
    // 3. BUSCA DE DADOS (GET)
    // =================================================================
    
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
            const role = (localStorage.getItem('role') || '').toUpperCase();
            
            const response = await fetchComAuth(url, { method: 'GET', headers: { 'X-User-Role': role } });
            if (!response.ok) throw new Error(`Status: ${response.status}`);

            const dados = await response.json();
            listaCompletaSolicitacoes = Array.isArray(dados) ? dados : [];
            renderizarCardsPedidos(listaCompletaSolicitacoes, 'container-pedidos-materiais', true);

        } catch (error) {
            console.error(error);
            container.innerHTML = `
                <div class="text-center py-5">
                    <div class="mb-3 text-danger"><i class="bi bi-wifi-off fs-1"></i></div>
                    <h5 class="text-muted">Falha na conexão</h5>
                    <p class="small text-muted">${error.message}</p>
                    <button class="btn btn-refresh-glass mx-auto mt-3" onclick="carregarDadosMateriais()">
                        <i class="bi bi-arrow-clockwise"></i> Tentar Novamente
                    </button>
                </div>`;
        } finally {
            if (window.toggleLoader) window.toggleLoader(false, '#materiais-pane');
        }
    }

    async function carregarDadosHistoricoMateriais() {
        const container = document.getElementById('container-historico-materiais'); 
        if (window.toggleLoader) window.toggleLoader(true, '#historico-materiais-pane');
        if (!container) return;

        container.innerHTML = `
            <div class="empty-state-modern py-5">
                <div class="spinner-border text-primary" role="status"></div>
                <p class="mt-3 text-muted">CARREGANDO HISTÓRICO...</p>
            </div>`;

        try {
            const url = `${API_MATERIALS_URL}/api/materiais/solicitacoes/historico`;
            const role = (localStorage.getItem('role') || '').toUpperCase();
            const userId = localStorage.getItem('userId');

            const response = await fetchComAuth(url, { 
                method: 'GET', 
                headers: { 'X-User-Role': role, 'X-User-ID': userId } 
            });
            
            if (!response.ok) throw new Error(`Status: ${response.status}`);

            const dados = await response.json();
            renderizarCardsPedidos(dados, 'container-historico-materiais', false);

        } catch (error) {
            console.error(error);
            container.innerHTML = `<div class="text-center py-5 text-muted">Não foi possível carregar o histórico.</div>`;
        } finally {
            if (window.toggleLoader) window.toggleLoader(false, '#historico-materiais-pane');
        }
    }

    // =================================================================
    // 4. RENDERIZAÇÃO
    // =================================================================
    function renderizarCardsPedidos(lista, containerId = 'container-pedidos-materiais', permitirAcao = true) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = '';
        
        if (permitirAcao) {
            selecionadosMateriais = [];
            atualizarUIGlobal();
        }

        if (!lista || lista.length === 0) {
            container.innerHTML = `
                <div class="empty-state-modern py-5 fade-in-up">
                    <div style="font-size: 4rem; color: #e9ecef;"><i class="bi bi-check2-circle"></i></div>
                    <h5 class="mt-3 text-muted fw-bold">Nenhuma solicitação encontrada</h5>
                    <p class="text-muted small">Tudo em dia por aqui.</p>
                </div>`;
            return;
        }

        const accordionWrapper = document.createElement('div');
        accordionWrapper.className = 'custom-accordion-modern';
        accordionWrapper.id = 'accordionMateriais-' + containerId;

        const role = (localStorage.getItem('role') || '').toUpperCase();
        const podeAprovar = permitirAcao && ['COORDINATOR', 'MANAGER', 'ADMIN', 'CONTROLLER'].includes(role);

        lista.forEach((solicitacao, index) => {
            const pedidoId = solicitacao.id;
            const osReal = solicitacao.os?.os || solicitacao.os?.numero || 'N/A';
            const solicitante = solicitacao.nomeSolicitante || 'Desconhecido';
            const dataStr = formatarDataHora(solicitacao.dataSolicitacao);
            const totalValor = calcularTotal(solicitacao.itens);
            const totalItens = (solicitacao.itens || []).length;
            const statusBadge = getStatusBadge(solicitacao.status);

            const linhasItens = (solicitacao.itens || []).map(item => {
                const mat = item.material || {};
                const qtd = toNumber(item.quantidadeSolicitada);
                const custo = toNumber(mat.custoMedioPonderado);
                const totalItem = qtd * custo;
                const alertaEstoque = (mat.saldoFisico || 0) < qtd;
                const isSelected = selecionadosMateriais.includes(item.id);

                let statusItemHtml = `<span class="badge bg-light text-secondary border">PENDENTE</span>`;
                if (item.statusItem === 'APROVADO') statusItemHtml = `<span class="badge bg-success-subtle text-success"><i class="bi bi-check2"></i> Aprovado</span>`;
                if (item.statusItem === 'REPROVADO') statusItemHtml = `<span class="badge bg-danger-subtle text-danger"><i class="bi bi-x"></i> Recusado</span>`;

                let acoesHtml = '';
                if (podeAprovar && item.statusItem === 'PENDENTE') {
                    acoesHtml = `
                        <div class="d-flex justify-content-end gap-2">
                            <button class="btn-icon-item btn-action-approve" onclick="prepararAprovacao(${pedidoId}, ${item.id}, 'ITEM')" title="Aprovar Item"><i class="bi bi-check-lg"></i></button>
                            <button class="btn-icon-item btn-action-reject" onclick="prepararRejeicao(${pedidoId}, ${item.id}, 'ITEM')" title="Recusar Item"><i class="bi bi-x-lg"></i></button>
                        </div>`;
                }

                return `
                    <tr>
                        <td class="text-center">
                            ${podeAprovar && item.statusItem === 'PENDENTE' ? `
                                <div class="form-check d-flex justify-content-center prevent-expand">
                                    <input class="form-check-input check-item-filho" 
                                           type="checkbox" 
                                           value="${item.id}" 
                                           ${isSelected ? 'checked' : ''}
                                           onchange="toggleItemIndividual(this, ${pedidoId})">
                                </div>
                            ` : ''}
                        </td>
                        <td style="width: 50px;"><div class="material-icon-box"><i class="bi bi-box-seam"></i></div></td>
                        <td>
                            <span class="d-block fw-medium text-dark">${mat.descricao || 'Item'}</span>
                            <span class="text-muted text-xs font-monospace">COD: ${mat.codigo || '-'}</span>
                        </td>
                        <td class="text-center"><span class="badge-unid">${mat.unidadeMedida || 'UN'}</span></td>
                        <td class="text-center fw-bold">${qtd}</td>
                        <td class="text-center">
                            <span class="${alertaEstoque ? 'text-danger fw-bold' : 'text-success'}">${mat.saldoFisico || 0}</span>
                            ${alertaEstoque ? '<i class="bi bi-exclamation-circle-fill text-danger ms-1" title="Estoque Baixo"></i>' : ''}
                        </td>
                        <td class="text-end pe-3"><span class="price-tag">${formatarMoeda(totalItem)}</span></td>
                        <td class="text-center">${statusItemHtml}</td>
                        <td class="text-end ps-2">${acoesHtml}</td>
                    </tr>`;
            }).join('');

            const card = document.createElement('div');
            card.className = 'accordion-item pedido-item-dom fade-in-up mb-3 shadow-sm border-0';
            card.setAttribute('data-search', `${osReal} ${solicitante}`.toLowerCase());
            
            card.innerHTML = `
                <div class="pedido-header collapsed bg-white p-3 rounded" data-bs-toggle="collapse" data-bs-target="#collapse-${pedidoId}-${containerId}" style="cursor: pointer;">
                    <div class="d-flex align-items-center w-100 gap-3">
                        ${podeAprovar ? `
                            <div class="form-check prevent-expand">
                                <input class="form-check-input check-pedido-pai" 
                                       type="checkbox" 
                                       value="${pedidoId}" 
                                       onchange="togglePedidoInteiro(this, ${pedidoId})">
                            </div>
                        ` : ''}

                        <div class="d-flex flex-column flex-grow-1">
                            <div class="d-flex align-items-center justify-content-between mb-1">
                                <div class="d-flex align-items-center gap-2">
                                    <span class="badge-os">OS ${osReal}</span>
                                    ${statusBadge}
                                </div>
                                <span class="text-muted text-xs"><i class="bi bi-calendar me-1"></i>${dataStr}</span>
                            </div>
                            <div class="d-flex align-items-center justify-content-between">
                                <div class="user-name text-dark fw-bold">
                                    <i class="bi bi-person-circle text-muted me-2 opacity-50"></i>${solicitante}
                                </div>
                                <span class="fw-bold text-success fs-6">${formatarMoeda(totalValor)}</span>
                            </div>
                        </div>
                        
                        <div class="ms-2 text-muted opacity-25"><i class="bi bi-chevron-down transition-icon"></i></div>
                    </div>
                </div>

                <div id="collapse-${pedidoId}-${containerId}" class="accordion-collapse collapse" data-bs-parent="#accordionMateriais-${containerId}">
                    <div class="accordion-body bg-white border-top p-0">
                        <div class="table-responsive p-3" style="max-height: 400px; overflow-y: auto;">
                            <table class="table table-hover align-middle mb-0 small">
                                <thead class="table-light">
                                    <tr>
                                        <th style="width: 40px;"></th>
                                        <th style="width: 60px;"></th>
                                        <th>Material</th>
                                        <th class="text-center">Unid</th>
                                        <th class="text-center">Qtd</th>
                                        <th class="text-center">Estoque</th>
                                        <th class="text-end">Total</th>
                                        <th class="text-center">Status</th>
                                        <th class="text-end">Ação</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${linhasItens}
                                    ${solicitacao.justificativa ? `
                                    <tr class="bg-light">
                                        <td colspan="9" class="p-3 fst-italic text-muted">
                                            <i class="bi bi-chat-quote-fill me-2"></i><strong>Justificativa:</strong> ${solicitacao.justificativa}
                                        </td>
                                    </tr>` : ''}
                                </tbody>
                            </table>
                        </div>
                        
                        ${podeAprovar ? `
                        <div class="p-3 bg-light border-top d-flex justify-content-between align-items-center">
                            <span class="text-muted small"><i class="bi bi-info-circle me-1"></i>${totalItens} itens no pedido</span>
                            <div class="d-flex gap-2">
                                <button class="btn btn-sm btn-outline-danger border-0 fw-bold" onclick="prepararRejeicao(${pedidoId}, null, 'PEDIDO')">
                                    Recusar Pedido
                                </button>
                                <button class="btn btn-sm btn-success px-3 shadow-sm" onclick="prepararAprovacao(${pedidoId}, null, 'PEDIDO')">
                                    <i class="bi bi-check2-all me-1"></i> Aprovar Tudo
                                </button>
                            </div>
                        </div>` : ''}
                    </div>
                </div>`;
            
            accordionWrapper.appendChild(card);
        });

        container.appendChild(accordionWrapper);
    }

    // =================================================================
    // 5. AÇÕES (PREPARAR E CONFIRMAR)
    // =================================================================

    function prepararAprovacao(idSolicitacao, idItem, tipo) {
        acaoIndividualAlvo = { idSolicitacao, idItem, tipo };
        let texto = "";
        if (tipo === 'ITEM') texto = "Aprovar este item individualmente?";
        if (tipo === 'PEDIDO') texto = "Aprovar todos os itens deste pedido?";
        if (tipo === 'LOTE') texto = `Aprovar as ${selecionadosMateriais.length} solicitações selecionadas?`;

        document.getElementById('msgAprovacaoGenerico').innerText = texto;
        resetModalLoadingState('modalAprovacaoGenerico', 'btnConfirmarAprovacaoGen');
        const modal = new bootstrap.Modal(document.getElementById('modalAprovacaoGenerico'));
        modal.show();
    }

    function prepararRejeicao(idSolicitacao, idItem, tipo) {
        acaoIndividualAlvo = { idSolicitacao, idItem, tipo };
        let texto = "";
        if (tipo === 'ITEM') texto = "Motivo da recusa do item:";
        if (tipo === 'PEDIDO') texto = "Motivo da recusa do pedido completo:";
        if (tipo === 'LOTE') texto = `Motivo da recusa para ${selecionadosMateriais.length} itens selecionados:`;

        document.getElementById('msgRecusaGenerico').innerText = texto;
        document.getElementById('inputMotivoGenerico').value = '';
        resetModalLoadingState('modalRecusaGenerico', 'btnConfirmarRecusaGen');
        const modal = new bootstrap.Modal(document.getElementById('modalRecusaGenerico'));
        modal.show();
    }

    async function confirmarAprovacao() {
        const modalEl = document.getElementById('modalAprovacaoGenerico');
        const btn = document.getElementById('btnConfirmarAprovacaoGen');
        setModalInteratividade(modalEl, false);
        setButtonLoadingSafe(btn, true);

        try {
            if (!acaoIndividualAlvo) return;
            const { idSolicitacao, idItem, tipo } = acaoIndividualAlvo;

            if (tipo === 'LOTE') {
                await enviarDecisaoLote('APROVAR', null);
            } else if (tipo === 'PEDIDO') {
                const solicitacao = listaCompletaSolicitacoes.find(s => s.id === idSolicitacao);
                if (solicitacao && solicitacao.itens) {
                    const idsPendentes = solicitacao.itens.filter(i => i.statusItem === 'PENDENTE').map(i => i.id);
                    const backupSelecao = [...selecionadosMateriais];
                    selecionadosMateriais = idsPendentes;
                    await enviarDecisaoLote('APROVAR', null);
                    selecionadosMateriais = backupSelecao; 
                }
            } else if (tipo === 'ITEM') {
                await enviarDecisaoItem(idSolicitacao, idItem, 'APROVAR', null);
            }

            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();

        } catch (error) {
            console.error(error);
            if (window.mostrarToast) mostrarToast("Erro ao processar aprovação", "error");
        } finally {
            setButtonLoadingSafe(btn, false);
            setModalInteratividade(modalEl, true);
        }
    }

    async function confirmarRejeicao() {
        const motivo = document.getElementById('inputMotivoGenerico').value;
        
        if (!motivo || motivo.trim() === '') {
            if (window.mostrarToast) mostrarToast("O motivo é obrigatório para recusar.", "warning");
            else alert("Motivo obrigatório.");
            return;
        }

        const modalEl = document.getElementById('modalRecusaGenerico');
        const btn = document.getElementById('btnConfirmarRecusaGen');
        setModalInteratividade(modalEl, false);
        setButtonLoadingSafe(btn, true);

        try {
            if (!acaoIndividualAlvo) return;
            const { idSolicitacao, idItem, tipo } = acaoIndividualAlvo;

            if (tipo === 'LOTE') {
                await enviarDecisaoLote('REJEITAR', motivo);
            } else if (tipo === 'PEDIDO') {
                const solicitacao = listaCompletaSolicitacoes.find(s => s.id === idSolicitacao);
                if (solicitacao && solicitacao.itens) {
                    const idsPendentes = solicitacao.itens.filter(i => i.statusItem === 'PENDENTE').map(i => i.id);
                    const backupSelecao = [...selecionadosMateriais];
                    selecionadosMateriais = idsPendentes;
                    await enviarDecisaoLote('REJEITAR', motivo);
                    selecionadosMateriais = backupSelecao;
                }
            } else if (tipo === 'ITEM') {
                await enviarDecisaoItem(idSolicitacao, idItem, 'REJEITAR', motivo);
            }

            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();

        } catch (error) {
            console.error(error);
            if (window.mostrarToast) mostrarToast("Erro ao processar recusa", "error");
        } finally {
            setButtonLoadingSafe(btn, false);
            setModalInteratividade(modalEl, true);
        }
    }

    // =================================================================
    // 6. BACKEND CALLS
    // =================================================================

    async function enviarDecisaoItem(idSolicitacao, idItem, acao, observacao) {
        if (window.toggleLoader) window.toggleLoader(true, '#materiais-pane');
        try {
            const role = (localStorage.getItem('role') || '').toUpperCase();
            const usuarioId = localStorage.getItem('userId');
            const url = `${API_MATERIALS_URL}/api/materiais/solicitacoes/${idSolicitacao}/itens/${idItem}/decidir`;

            const body = { acao, observacao, aprovadorId: usuarioId };

            const response = await fetchComAuth(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-User-Role': role },
                body: JSON.stringify(body)
            });

            if (!response.ok) throw new Error(`Erro HTTP ${response.status}`);

            if (window.mostrarToast) mostrarToast(`Item ${acao === 'APROVAR' ? 'Aprovado' : 'Recusado'}!`, "success");
            await carregarDadosMateriais();

        } catch (error) { throw error; } 
        finally { if (window.toggleLoader) window.toggleLoader(false, '#materiais-pane'); }
    }

    async function enviarDecisaoLote(acao, observacao) {
        if (window.toggleLoader) window.toggleLoader(true, '#materiais-pane');
        try {
            const idsParaProcessar = [...selecionadosMateriais];
            
            // Limpa UI imediatamente
            selecionadosMateriais = [];
            limparSelecaoUI();
            atualizarUIGlobal();

            const role = (localStorage.getItem('role') || '').toUpperCase();
            const usuarioId = localStorage.getItem('userId');
            
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

            const body = { ids: idsParaProcessar, aprovadorId: usuarioId, observacao: observacao };

            const response = await fetchComAuth(`${API_MATERIALS_URL}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-User-Role': role },
                body: JSON.stringify(body)
            });

            if (!response.ok) throw new Error(`Erro HTTP ${response.status}`);

            if (window.mostrarToast) mostrarToast(`Operação realizada com sucesso!`, "success");
            await carregarDadosMateriais();
            if (typeof carregarDashboardEBadges === 'function') carregarDashboardEBadges();

        } catch (error) { throw error; } 
        finally { if (window.toggleLoader) window.toggleLoader(false, '#materiais-pane'); }
    }

    // =================================================================
    // 7. UTILITÁRIOS E HELPERS
    // =================================================================

    function instalarBloqueioCliqueCheckboxes() {
        document.addEventListener('click', function (e) {
            const alvo = e.target.closest('.prevent-expand, input[type="checkbox"].check-item-filho, input[type="checkbox"].check-pedido-pai');
            if (alvo) {
                e.stopPropagation();
                if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
            }
        }, true);
    }

    function toggleItemIndividual(checkbox, pedidoId) {
        const itemId = parseInt(checkbox.value);
        if (checkbox.checked) { 
            if (!selecionadosMateriais.includes(itemId)) selecionadosMateriais.push(itemId); 
        } else { 
            selecionadosMateriais = selecionadosMateriais.filter(id => id !== itemId); 
        }
        const card = checkbox.closest('.pedido-item-dom');
        atualizarEstadoCheckboxPai(card, pedidoId);
        deduplicarSelecao();
        atualizarUIGlobal();
    }

    function togglePedidoInteiro(checkbox, pedidoId) {
        const card = checkbox.closest('.pedido-item-dom');
        const checkboxesFilhos = card.querySelectorAll('.check-item-filho');
        const isChecked = checkbox.checked;

        checkboxesFilhos.forEach(child => {
            child.checked = isChecked;
            const itemId = parseInt(child.value);
            if (isChecked) { 
                if (!selecionadosMateriais.includes(itemId)) selecionadosMateriais.push(itemId); 
            } else { 
                selecionadosMateriais = selecionadosMateriais.filter(id => id !== itemId); 
            }
        });

        if (isChecked) card.classList.add('selected-card'); 
        else card.classList.remove('selected-card');

        atualizarEstadoCheckboxPai(card, pedidoId);
        deduplicarSelecao();
        atualizarUIGlobal();
    }

    function atualizarEstadoCheckboxPai(card, pedidoId) {
        if (!card) return;
        const checkPai = card.querySelector('.check-pedido-pai');
        const filhos = Array.from(card.querySelectorAll('.check-item-filho'));
        
        if (filhos.length === 0) return;

        const todosMarcados = filhos.every(c => c.checked);
        const algumMarcado = filhos.some(c => c.checked);

        if (checkPai) {
            checkPai.checked = todosMarcados;
            checkPai.indeterminate = algumMarcado && !todosMarcados;
        }
        
        if (algumMarcado) card.classList.add('selected-card');
        else card.classList.remove('selected-card');
    }

    function atualizarUIGlobal() {
        const counter = document.getElementById('count-global-check') || document.getElementById('count-materiais-selection');
        const toolbar = document.querySelector('.actions-group-modern');
        
        if (!toolbar) return;

        const total = selecionadosMateriais.length;
        if (counter) counter.innerText = String(total);

        if (total > 0) {
            toolbar.style.display = 'flex';
            setTimeout(() => toolbar.classList.add('show'), 10);
        } else {
            toolbar.classList.remove('show');
            setTimeout(() => toolbar.style.display = 'none', 300);
        }
    }

    function limparSelecaoUI() {
        document.querySelectorAll('.check-item-filho, .check-pedido-pai').forEach(cb => {
            cb.checked = false;
            cb.indeterminate = false;
        });
        document.querySelectorAll('.pedido-item-dom.selected-card').forEach(card => card.classList.remove('selected-card'));
    }

    function deduplicarSelecao() {
        selecionadosMateriais = [...new Set(selecionadosMateriais)];
    }

    function filtrarMateriaisNaTela() {
        const termo = (document.getElementById('filtro-materiais-input')?.value || '').toLowerCase();
        document.querySelectorAll('.pedido-item-dom').forEach(card => {
            const searchData = card.getAttribute('data-search').toLowerCase();
            card.classList.toggle('d-none', !searchData.includes(termo));
        });
    }

    function getStatusBadge(status) {
        const map = {
            'PENDENTE_COORDENADOR': '<span class="badge bg-warning text-dark border border-warning"><i class="bi bi-hourglass-split"></i> Aguardando Coordenador</span>',
            'PENDENTE_CONTROLLER': '<span class="badge bg-info text-dark border border-info"><i class="bi bi-shield-check"></i> Aguardando Controller</span>',
            'APROVADO': '<span class="badge bg-success border border-success"><i class="bi bi-check-circle-fill"></i> Aprovado / Comprado</span>',
            'REPROVADO': '<span class="badge bg-danger border border-danger"><i class="bi bi-x-circle-fill"></i> Reprovado</span>',
            'REJEITADO_COORDENADOR': '<span class="badge bg-danger"><i class="bi bi-x-octagon"></i> Recusado (Coord)</span>',
            'REJEITADO_CONTROLLER': '<span class="badge bg-danger"><i class="bi bi-x-octagon"></i> Recusado (Control)</span>',
            'FINALIZADO': '<span class="badge bg-dark"><i class="bi bi-flag-fill"></i> Finalizado</span>'
        };
        return map[status] || `<span class="badge bg-secondary">${status}</span>`;
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
    function formatarMoeda(v) {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
    }

    // Helpers UI do Modal
    function setButtonLoadingSafe(btn, isLoading) {
        if (!btn) return;
        btn.disabled = isLoading;
        const spinner = btn.querySelector('.spinner-border');
        const icon = btn.querySelector('i');
        if (spinner) isLoading ? spinner.classList.remove('d-none') : spinner.classList.add('d-none');
        if (icon) isLoading ? icon.classList.add('d-none') : icon.classList.remove('d-none');
    }

    function setModalInteratividade(modalEl, habilitar) {
        if (!modalEl) return;
        modalEl.querySelectorAll('button, textarea').forEach(el => el.disabled = !habilitar);
    }

    function resetModalLoadingState(modalId, confirmBtnId) {
        const modalEl = document.getElementById(modalId);
        const btn = document.getElementById(confirmBtnId);
        setButtonLoadingSafe(btn, false);
        setModalInteratividade(modalEl, true);
    }

    // =================================================================
    // 8. EXPORTS (NO FINAL PARA GARANTIR HOISTING)
    // =================================================================
    window.carregarDadosMateriais = carregarDadosMateriais;
    window.carregarDadosHistoricoMateriais = carregarDadosHistoricoMateriais;
    window.aprovarLoteMateriais = function() { prepararAprovacao(null, null, 'LOTE'); };
    window.rejeitarLoteMateriais = function() { prepararRejeicao(null, null, 'LOTE'); };
    window.togglePedidoInteiro = togglePedidoInteiro;
    window.toggleItemIndividual = toggleItemIndividual;
    window.filtrarMateriaisNaTela = filtrarMateriaisNaTela;
    window.renderizarCardsPedidos = renderizarCardsPedidos;
    window.prepararAprovacao = prepararAprovacao;
    window.prepararRejeicao = prepararRejeicao;
    window.confirmarAprovacao = confirmarAprovacao;
    window.confirmarRejeicao = confirmarRejeicao;

})();