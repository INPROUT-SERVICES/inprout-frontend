// Define a URL do serviço de materiais (Porta 8081 conforme application.yaml)
window.API_MATERIALS_URL = window.API_MATERIALS_URL || 'http://localhost:8081';
var API_MATERIALS_URL = window.API_MATERIALS_URL;

(function () { 'use strict';

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
window.toggleItemIndividual = toggleItemIndividual; // Garantindo exposição
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
    // Só cria se NÃO existir a toolbar estática do HTML
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
// 2. BUSCA DE DADOS (GET)
// =================================================================
async function carregarDadosMateriais() {
    const container = document.getElementById('container-pedidos-materiais');
    
    // Loader Global
    if (window.toggleLoader) window.toggleLoader(true, '#materiais-pane');

    if (!container) return;

    // Loader Local
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
    } finally {
        if (window.toggleLoader) window.toggleLoader(false, '#materiais-pane');
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
    const podeAprovar = ['COORDINATOR', 'ADMIN', 'CONTROLLER'].includes(role);

    lista.forEach((solicitacao, index) => {
        const pedidoId = solicitacao.id;
        const osObj = solicitacao.os || {};
        const osReal = osObj.os || osObj.numero || osObj.numeroOS || osObj.id || 'N/A';
        const solicitante = solicitacao.nomeSolicitante && solicitacao.nomeSolicitante !== 'null' ? solicitacao.nomeSolicitante : 'Solicitante Desconhecido';
        const dataStr = formatarDataHora(solicitacao.dataSolicitacao);

        let segmento = 'Geral';
        if (solicitacao.os && solicitacao.os.segmento && solicitacao.os.segmento.nome) segmento = solicitacao.os.segmento.nome;
        else if (solicitacao.os && solicitacao.os.segmentoDescricao) segmento = solicitacao.os.segmentoDescricao;

        const totalValor = calcularTotal(solicitacao.itens);
        const totalItens = (solicitacao.itens || []).length;

        const linhasItens = (solicitacao.itens || []).map(item => {
            const mat = item.material || {};
            const saldo = toNumber(mat.saldoFisico);
            const qtd = toNumber(item.quantidadeSolicitada);
            const custo = toNumber(mat.custoMedioPonderado);
            const totalItem = qtd * custo;
            const alertaEstoque = saldo < qtd;
            const isItemSelected = selecionadosMateriais.includes(item.id);

            let statusHtml = '';
            if (item.statusItem === 'PENDENTE') statusHtml = `<span class="badge bg-light text-secondary border">PENDENTE</span>`;
            else if (item.statusItem === 'APROVADO') statusHtml = `<span class="badge status-approved"><i class="bi bi-check-circle-fill me-1"></i>APROVADO</span>`;
            else if (item.statusItem === 'REPROVADO') statusHtml = `<span class="badge status-rejected"><i class="bi bi-x-circle-fill me-1"></i>RECUSADO</span>`;

            let acoesHtml = '';
            if (item.statusItem === 'PENDENTE' && podeAprovar) {
                acoesHtml = `
                    <div class="d-flex justify-content-end gap-2">
                        <button class="btn-icon-item btn-action-approve" onclick="prepararAprovacao(${pedidoId}, ${item.id}, 'ITEM')" title="Aprovar Item"><i class="bi bi-check-lg"></i></button>
                        <button class="btn-icon-item btn-action-reject" onclick="prepararRejeicao(${pedidoId}, ${item.id}, 'ITEM')" title="Recusar Item"><i class="bi bi-x-lg"></i></button>
                    </div>`;
            }

            return `
                <tr>
                    <td class="text-center">
                        ${item.statusItem === 'PENDENTE' && podeAprovar ? `
                            <div class="form-check d-flex justify-content-center prevent-expand">
                                <input class="form-check-input check-item-filho" type="checkbox" value="${item.id}" ${isItemSelected ? 'checked' : ''} onchange="toggleItemIndividual(this, ${pedidoId})">
                            </div>
                        ` : ''}
                    </td>
                    <td style="width: 60px;"><div class="material-icon-box"><i class="bi bi-box-seam"></i></div></td>
                    <td><span class="text-item-title">${mat.descricao || 'Item Desconhecido'}</span><span class="text-muted text-xs font-monospace">COD: ${mat.codigo || '-'}</span></td>
                    <td class="text-center"><span class="badge-unid">${mat.unidadeMedida || 'UN'}</span></td>
                    <td class="text-center fw-bold text-dark">${qtd}</td>
                    <td class="text-center"><span class="${alertaEstoque ? 'text-danger fw-bold' : 'text-success'}">${saldo}</span>${alertaEstoque ? '<i class="bi bi-exclamation-circle-fill text-danger ms-1" title="Estoque insuficiente"></i>' : ''}</td>
                    <td class="text-end pe-4"><span class="price-tag">${formatarMoeda(totalItem)}</span></td>
                    <td class="text-center">${statusHtml}</td>
                    <td class="text-end ps-3">${acoesHtml}</td>
                </tr>`;
        }).join('');

        const cardItem = document.createElement('div');
        cardItem.className = 'accordion-item pedido-item-dom fade-in-up';
        cardItem.setAttribute('data-search', `${osReal} ${solicitante}`.toLowerCase());
        cardItem.style.animationDelay = `${index * 0.05}s`;

        // A classe prevent-expand no form-check é crucial para o bloqueio funcionar
        cardItem.innerHTML = `
            <div class="pedido-header collapsed" data-bs-toggle="collapse" data-bs-target="#collapse-${pedidoId}">
                <div class="d-flex align-items-center w-100 gap-3">
                    ${podeAprovar ? `
                        <div class="form-check prevent-expand">
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
                            <span class="text-muted text-xs" title="Data da Solicitação"><i class="bi bi-calendar me-1"></i>${dataStr}</span>
                            <span class="badge bg-light text-dark border" title="Segmento"><i class="bi bi-layers me-1"></i>${segmento}</span>
                            <span class="fw-bold text-success ms-2">${formatarMoeda(totalValor)}</span>
                        </div>
                    </div>
                    </div>
                    
                    <div class="ms-3 text-muted opacity-50"><i class="bi bi-chevron-down transition-icon"></i></div>
                </div>
            </div>

            <div id="collapse-${pedidoId}" class="accordion-collapse collapse" data-bs-parent="#accordionMateriais">
                <div class="accordion-body bg-white p-0">
                    <div class="table-responsive p-3" style="max-height: 500px; overflow-y: auto;">
                        <table class="table-modern-2026">
                            <thead><tr><th style="width: 40px;" class="text-center"><i class="bi bi-check2-square"></i></th><th>Ref</th><th>Material / Descrição</th><th class="text-center">Unid</th><th class="text-center">Qtd</th><th class="text-center">Estoque</th><th class="text-end pe-4">Total</th><th class="text-center">Status</th><th class="text-end">Ação</th></tr></thead>
                            <tbody>
                                ${linhasItens}
                                ${solicitacao.justificativa ? `<tr class="row-justificativa"><td colspan="9"><div class="justificativa-box"><i class="bi bi-chat-quote-fill fs-5"></i><div><strong>JUSTIFICATIVA DO SOLICITANTE:</strong><br>${solicitacao.justificativa}</div></div></td></tr>` : ''}
                            </tbody>
                        </table>
                    </div>
                    <div class="p-3 bg-light border-top d-flex align-items-center justify-content-between">
                        <div class="text-muted text-xs"><i class="bi bi-info-circle me-1"></i>${totalItens} itens na solicitação</div>
                        ${podeAprovar ? `
                            <div class="d-flex gap-2">
                                <button class="btn btn-sm btn-outline-danger fw-bold border-0" onclick="prepararRejeicao(${pedidoId}, null, 'PEDIDO')">Recusar Pedido</button>
                                <button class="btn btn-success-gradient btn-sm px-4 shadow-sm" onclick="prepararAprovacao(${pedidoId}, null, 'PEDIDO')"><i class="bi bi-check2-all me-1"></i> Aprovar Tudo</button>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>`;
        accordionWrapper.appendChild(cardItem);
    });

    container.appendChild(accordionWrapper);
}

// =================================================================
// 4. LÓGICA DE INTERAÇÃO E UTILITÁRIOS
// =================================================================

// Funções de preparação e confirmação (Mantidas iguais)
function prepararAprovacao(idSolicitacao, idItem, tipo) {
    acaoIndividualAlvo = { idSolicitacao, idItem, tipo };
    let texto = "";
    if (tipo === 'ITEM') texto = "Deseja aprovar este item individualmente?";
    if (tipo === 'PEDIDO') texto = "Deseja aprovar todos os itens deste pedido?";
    if (tipo === 'LOTE') texto = `Deseja aprovar ${selecionadosMateriais.length} solicitações selecionadas?`;

    const txtEl = document.getElementById('msgAprovacaoGenerico');
    if (txtEl) txtEl.innerText = texto;
    resetModalLoadingState('modalAprovacaoGenerico', 'btnConfirmarAprovacaoGen');
    const modal = new bootstrap.Modal(document.getElementById('modalAprovacaoGenerico'));
    modal.show();
}

function prepararRejeicao(idSolicitacao, idItem, tipo) {
    acaoIndividualAlvo = { idSolicitacao, idItem, tipo };
    let texto = "";
    if (tipo === 'ITEM') texto = "Motivo da recusa deste item:";
    if (tipo === 'PEDIDO') texto = "Motivo da recusa do pedido completo:";
    if (tipo === 'LOTE') texto = `Motivo da recusa para as ${selecionadosMateriais.length} solicitações:`;

    const txtEl = document.getElementById('msgRecusaGenerico');
    if (txtEl) txtEl.innerText = texto;
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
            if(solicitacao && solicitacao.itens) {
                 const idsPendentes = solicitacao.itens.filter(i => i.statusItem === 'PENDENTE').map(i => i.id);
                 selecionadosMateriais = idsPendentes;
                 await enviarDecisaoLote('APROVAR', null);
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
        if (window.mostrarToast) mostrarToast("Motivo é obrigatório.", "warning");
        else alert("Motivo é obrigatório.");
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
            if(solicitacao && solicitacao.itens) {
                 const idsPendentes = solicitacao.itens.filter(i => i.statusItem === 'PENDENTE').map(i => i.id);
                 selecionadosMateriais = idsPendentes;
                 await enviarDecisaoLote('REJEITAR', motivo);
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

// Calls API (Mantidas)
async function enviarDecisaoItem(idSolicitacao, idItem, acao, observacao) {
    if (window.toggleLoader) window.toggleLoader(true, '#materiais-pane');
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
    } catch (error) { throw error; } finally {
        if (window.toggleLoader) window.toggleLoader(false, '#materiais-pane');
    }
}

async function enviarDecisaoLote(acao, observacao) {
    if (window.toggleLoader) window.toggleLoader(true, '#materiais-pane');
    try {
        const itensProcessados = [...selecionadosMateriais];
        selecionadosMateriais = [];
        limparSelecaoUI();
        atualizarUIGlobal();

        const role = (typeof userRole !== 'undefined' ? userRole : '').toUpperCase();
        const usuarioId = (typeof userId !== 'undefined') ? userId : null;
        let endpoint = '';
        if (role === 'CONTROLLER' || role === 'ADMIN') {
            endpoint = (acao === 'APROVAR') ? `/api/materiais/solicitacoes/controller/aprovar-lote` : `/api/materiais/solicitacoes/controller/rejeitar-lote`;
        } else {
            endpoint = (acao === 'APROVAR') ? `/api/materiais/solicitacoes/coordenador/aprovar-lote` : `/api/materiais/solicitacoes/coordenador/rejeitar-lote`;
        }

        const body = { ids: itensProcessados, aprovadorId: usuarioId, observacao: observacao };
        const response = await fetchComAuth(`${API_MATERIALS_URL}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-User-Role': role },
            body: JSON.stringify(body)
        });
        if (!response.ok) throw new Error(`Erro HTTP ${response.status}`);
        if (window.mostrarToast) mostrarToast(`Operação ${acao} realizada com sucesso!`, "success");
        await carregarDadosMateriais();
        if (typeof carregarDashboardEBadges === 'function') carregarDashboardEBadges();
    } catch (error) { throw error; } finally {
        if (window.toggleLoader) window.toggleLoader(false, '#materiais-pane');
    }
}

// -----------------------------------------------------------------
// HELPERS DE UI (CORRIGIDOS)
// -----------------------------------------------------------------

function setButtonLoadingSafe(btn, isLoading) {
    if (!btn) return;
    if (typeof window.setButtonLoading === 'function') { window.setButtonLoading(btn, isLoading); return; }
    const spinner = btn.querySelector('.spinner-border');
    const icon = btn.querySelector('i');
    btn.disabled = isLoading;
    if (spinner) isLoading ? spinner.classList.remove('d-none') : spinner.classList.add('d-none');
    if (icon) isLoading ? icon.classList.add('d-none') : icon.classList.remove('d-none');
}

function setModalInteratividade(modalEl, habilitar) {
    if (!modalEl) return;
    modalEl.querySelectorAll('[data-bs-dismiss="modal"]').forEach(btn => btn.disabled = !habilitar);
    const textarea = modalEl.querySelector('textarea');
    if (textarea) textarea.disabled = !habilitar;
}

function resetModalLoadingState(modalId, confirmBtnId) {
    const modalEl = document.getElementById(modalId);
    const btn = document.getElementById(confirmBtnId);
    setButtonLoadingSafe(btn, false);
    setModalInteratividade(modalEl, true);
}

function deduplicarSelecao() {
    selecionadosMateriais = Array.from(new Set(selecionadosMateriais));
}

function limparSelecaoUI() {
    document.querySelectorAll('.check-item-filho, .check-pedido-pai').forEach(cb => {
        cb.checked = false;
        cb.indeterminate = false;
    });
    document.querySelectorAll('.pedido-item-dom.selected-card').forEach(card => card.classList.remove('selected-card'));
}

// CORREÇÃO: Bloqueia propagação do clique em qualquer elemento marcado com 'prevent-expand'
// e nos inputs, impedindo o acordeão de abrir/fechar.
function instalarBloqueioCliqueCheckboxes() {
    document.addEventListener('click', function (e) {
        // Detecta clique no wrapper .prevent-expand ou no próprio input checkbox
        const alvo = e.target.closest('.prevent-expand, input[type="checkbox"].check-item-filho, input[type="checkbox"].check-pedido-pai');
        
        if (alvo) {
            e.stopPropagation(); // Para bubbling padrão
            if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation(); // Para outros listeners no mesmo elemento
        }
    }, true); // Use Capture phase para pegar antes do Bootstrap
}

function toggleItemIndividual(checkbox, pedidoId) {
    const itemId = parseInt(checkbox.value);
    if (checkbox.checked) { if (!selecionadosMateriais.includes(itemId)) selecionadosMateriais.push(itemId); } 
    else { selecionadosMateriais = selecionadosMateriais.filter(id => id !== itemId); }
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
        if (isChecked) { if (!selecionadosMateriais.includes(itemId)) selecionadosMateriais.push(itemId); } 
        else { selecionadosMateriais = selecionadosMateriais.filter(id => id !== itemId); }
    });
    if (isChecked) card.classList.add('selected-card'); else card.classList.remove('selected-card');
    atualizarEstadoCheckboxPai(card, pedidoId);
    deduplicarSelecao();
    atualizarUIGlobal();
}

function atualizarEstadoCheckboxPai(card, pedidoId) {
    if (!card) return;
    const checkPai = card.querySelector('.check-pedido-pai');
    const filhos = Array.from(card.querySelectorAll('.check-item-filho'));
    if(filhos.length === 0) return;
    const todosMarcados = filhos.every(c => c.checked);
    const algumMarcado = filhos.some(c => c.checked);
    if (checkPai) {
        checkPai.checked = todosMarcados;
        checkPai.indeterminate = algumMarcado && !todosMarcados; 
    }
    if (algumMarcado) card.classList.add('selected-card'); else card.classList.remove('selected-card');
}

// CORREÇÃO: Atualiza o contador procurando nos dois locais possíveis (HTML estático e Dinâmico)
function atualizarUIGlobal() {
    const toolbar = document.querySelector('.actions-group-modern');
    
    // Tenta achar o contador no HTML estático OU no dinâmico
    const counter = document.getElementById('count-global-check') || document.getElementById('count-materiais-selection');
    
    if (!toolbar || !counter) return;

    const total = selecionadosMateriais.length;
    counter.innerText = String(total);

    const hasSelection = total > 0;
    toolbar.classList.toggle('show', hasSelection);
    toolbar.style.display = hasSelection ? 'flex' : 'none';
}

function filtrarMateriaisNaTela() {
    const termo = (document.getElementById('filtro-materiais-input')?.value || '').toLowerCase();
    document.querySelectorAll('.pedido-item-dom').forEach(card => {
        const searchData = card.getAttribute('data-search').toLowerCase();
        card.classList.toggle('d-none', !searchData.includes(termo));
    });
}

// Compatibilidade
function aprovarLoteMateriais() { prepararAprovacao(null, null, 'LOTE'); }
function rejeitarLoteMateriais() { prepararRejeicao(null, null, 'LOTE'); }
function confirmarAprovacaoLoteMateriais() { confirmarAprovacao(); }
function confirmarRejeicaoLoteMateriais() { confirmarRejeicao(); }

function toNumber(v) { return Number(v) || 0; }
function calcularTotal(itens) { return (itens || []).reduce((acc, i) => acc + (toNumber(i.quantidadeSolicitada) * toNumber(i.material?.custoMedioPonderado)), 0); }
function formatarDataHora(iso) { if (!iso) return '-'; const d = new Date(iso); return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }
const formatarMoeda = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

})();