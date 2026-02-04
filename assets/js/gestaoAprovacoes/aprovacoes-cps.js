// ==========================================================
// LÓGICA DO CONTROLE CPS (Inicialização Estável)
// ==========================================================

// --- Variáveis de Dados ---
window.choicesCpsPrestador = null;
window.choicesCpsHistPrestador = null;
window.dadosCpsGlobais = [];
window.dadosCpsHistorico = [];

// --- Inicialização ---
document.addEventListener('DOMContentLoaded', () => {
    // Inicializa modais
    const elAlterar = document.getElementById('modalAlterarValorCPS');
    const elRecusar = document.getElementById('modalRecusarCPS');
    const elSolAdiant = document.getElementById('modalSolicitarAdiantamento');
    const elAprAdiant = document.getElementById('modalAprovarAdiantamento');
    const elRecAdiant = document.getElementById('modalRecusarAdiantamento');

    if (elAlterar) window.modalAlterarValorCPS = new bootstrap.Modal(elAlterar);
    if (elRecusar) window.modalRecusarCPS = new bootstrap.Modal(elRecusar);
    if (elSolAdiant) window.modalSolicitarAdiantamento = new bootstrap.Modal(elSolAdiant);
    if (elAprAdiant) window.modalAprovarAdiantamento = new bootstrap.Modal(elAprAdiant);
    if (elRecAdiant) window.modalRecusarAdiantamento = new bootstrap.Modal(elRecAdiant);

    // Renderiza a interface moderna
    renderizarBarraFiltrosModerna();

    // Inicia a lógica de filtros e, somente após terminar, carrega os dados
    setTimeout(async () => {
        await initFiltrosCPS();

        // VINCULA O EVENTO DE CLIQUE AQUI TAMBÉM (Segurança extra)
        const btnUpdateModerno = document.getElementById('btn-atualizar-lista-cps');
        const btnUpdateOriginal = document.getElementById('btn-atualizar-cps'); // ID do HTML original

        const acaoAtualizar = () => carregarPendenciasCPS();

        if (btnUpdateModerno) btnUpdateModerno.addEventListener('click', acaoAtualizar);
        if (btnUpdateOriginal) btnUpdateOriginal.addEventListener('click', acaoAtualizar);

        // Carregamento inicial
        atualizarDashboardFixo();
        carregarPendenciasCPS();
    }, 100);
});

async function atualizarDashboardFixo() {
    const userId = localStorage.getItem('usuarioId');
    const hoje = new Date();
    
    // --- LÓGICA DE COMPETÊNCIA (Regra do dia 7) ---
    // Se hoje for dia 7 ou menos, a referência é o mês anterior.
    // Se for dia 8 ou mais, a referência é o mês atual.
    let dataReferencia = new Date(hoje);
    
    if (hoje.getDate() <= 7) {
        dataReferencia.setMonth(dataReferencia.getMonth() - 1);
    }
    
    // Define início (dia 1) e fim (último dia) da competência calculada
    const inicio = new Date(dataReferencia.getFullYear(), dataReferencia.getMonth(), 1);
    const fim = new Date(dataReferencia.getFullYear(), dataReferencia.getMonth() + 1, 0);

    // --- ATUALIZAÇÃO VISUAL DO LABEL ---
    const nomesMeses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const textoMes = `${nomesMeses[inicio.getMonth()]}/${inicio.getFullYear()}`;
    
    // Tenta encontrar ou criar o aviso na tela
    let labelContainer = document.getElementById('cps-dashboard-label-container');
    if (!labelContainer) {
        // Se não existir, cria dinamicamente logo acima dos filtros ou do dashboard
        const pane = document.getElementById('cps-pendencias-pane');
        if (pane) {
            labelContainer = document.createElement('div');
            labelContainer.id = 'cps-dashboard-label-container';
            // Estilo "badge" elegante e discreto
            labelContainer.className = 'd-flex align-items-center mb-3 text-secondary';
            labelContainer.innerHTML = `
                <div class="bg-white border rounded-pill px-3 py-1 shadow-sm d-flex align-items-center" style="font-size: 0.85rem;">
                    <i class="bi bi-graph-up-arrow text-primary me-2"></i>
                    <span class="me-1">Dashboard Referência:</span>
                    <strong class="text-dark" id="cps-dashboard-ref-text">...</strong>
                    ${hoje.getDate() <= 7 ? '<span class="badge bg-warning text-dark ms-2" style="font-size:0.7rem">Dados disponiveis até dia 07.</span>' : '<span class="badge bg-success-subtle text-success ms-2" style="font-size:0.7rem">Mês Vigente</span>'}
                </div>
            `;
            // Insere no topo da aba de pendências
            pane.insertBefore(labelContainer, pane.firstChild);
        }
    }
    
    // Atualiza o texto do mês se o elemento existir
    const txtEl = document.getElementById('cps-dashboard-ref-text');
    if (txtEl) txtEl.textContent = textoMes;

    // --- BUSCA DADOS NO BACKEND ---
    const params = new URLSearchParams({
        inicio: inicio.toISOString().split('T')[0],
        fim: fim.toISOString().split('T')[0],
        segmentoId: '', // Fixo geral
        prestadorId: '' // Fixo geral
    });

    try {
        const res = await fetchComAuth(`${API_BASE_URL}/controle-cps/dashboard?${params.toString()}`, { headers: { 'X-User-ID': userId } });
        if (res.ok) {
            const d = await res.json();
            const fmt = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

            document.querySelectorAll('.kpi-cps-total-mes-value').forEach(e => e.textContent = fmt(d.valorTotal));
            document.querySelectorAll('.kpi-cps-total-adiantado-value').forEach(e => e.textContent = fmt(d.valorTotalAdiantado));
            document.querySelectorAll('.kpi-cps-total-confirmado-value').forEach(e => e.textContent = fmt(d.valorTotalConfirmado));
            document.querySelectorAll('.kpi-cps-total-pendente-value').forEach(e => e.textContent = fmt(d.valorTotalPendente));
            document.querySelectorAll('.kpi-cps-total-pago-value').forEach(e => e.textContent = fmt(d.valorTotalPago));
            
            if (d.quantidadeItens !== undefined) {
                document.querySelectorAll('.kpi-cps-qtd-itens-value').forEach(e => e.textContent = d.quantidadeItens);
            }
        }
    } catch (e) { console.error("Erro dashboard fixo:", e); }
}

// --- CSS Injetado (Styles Dinâmicos) ---
if (!document.getElementById('cps-custom-styles')) {
    const styleSheet = document.createElement("style");
    styleSheet.id = 'cps-custom-styles';
    styleSheet.innerText = `
      /* Estilo dos Acordeões */
      .accordion-item.cps-selected { background-color: #f8f9fa !important; border: 1px solid #198754 !important; }
      .accordion-item.cps-selected .accordion-button { background-color: #e8f5e9 !important; color: #198754 !important; font-weight: 600; }
      
      .table-primary-light { background-color: #f0f7ff !important; }
      .table-warning-light { background-color: #fff3cd !important; }

      /* --- Toolbar Flutuante (Floating Dock) --- */
      .cps-toolbar-floating {
          position: fixed;
          bottom: 30px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 1060;
          background: rgba(255, 255, 255, 0.98);
          backdrop-filter: blur(10px);
          padding: 8px 20px;
          box-shadow: 0 8px 30px rgba(0,0,0,0.12);
          border: 1px solid #dee2e6;
          border-radius: 50px;
          display: flex;
          align-items: center;
          gap: 15px;
          animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          min-width: 380px;
          justify-content: space-between;
      }
      .cps-toolbar-actions { display: flex; gap: 8px; }

      @keyframes slideUp { 
          from { transform: translate(-50%, 150%); opacity: 0; } 
          to { transform: translate(-50%, 0); opacity: 1; } 
      }

      /* --- Filtros Modernos --- */
      .filter-bar-container {
          background: #fff;
          border-radius: 10px;
          padding: 15px 20px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.03);
          margin-bottom: 20px;
          border: 1px solid #f1f3f5;
      }
      .filter-label { 
          font-size: 0.7rem; 
          text-transform: uppercase; 
          letter-spacing: 0.5px; 
          color: #adb5bd; 
          font-weight: 700; 
          margin-bottom: 4px; 
          display: block; 
      }
      .form-select-modern {
          border-radius: 6px;
          border: 1px solid #ced4da;
          padding: 6px 10px;
          font-size: 0.9rem;
          background-color: #fff;
          height: 38px;
      }
      .form-select-modern:focus { border-color: #198754; box-shadow: 0 0 0 2px rgba(25, 135, 84, 0.1); }
      
      .choices__inner {
          border-radius: 6px !important;
          background-color: #fff !important;
          border: 1px solid #ced4da !important;
          min-height: 38px !important;
          padding: 4px 10px !important;
      }
      .choices__list--dropdown { z-index: 1080 !important; }

      .btn-update-modern {
          height: 38px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          font-weight: 500;
          font-size: 0.9rem;
          border-radius: 6px;
          padding: 0 20px;
          white-space: nowrap;
      }
    `;
    document.head.appendChild(styleSheet);
}

// ==========================================================
// RENDERIZAÇÃO DE UI (Barra de Filtros)
// ==========================================================

function renderizarBarraFiltrosModerna() {
    const pane = document.getElementById('cps-pendencias-pane');
    if (!pane) return;

    const antigoContainer = pane.querySelector('.card.shadow-sm.border-0.mb-3');
    if (antigoContainer) antigoContainer.remove();
    const barraExistente = pane.querySelector('.filter-bar-container');
    if (barraExistente) barraExistente.remove();

    const filterContainer = document.createElement('div');
    filterContainer.className = 'filter-bar-container';

    // CORREÇÃO: Botão com type="button" para evitar submit/reload
    filterContainer.innerHTML = `
        <div class="row g-3 align-items-end">
            <div class="col-md-3">
                <label class="filter-label"><i class="bi bi-calendar-event me-1"></i> Competência</label>
                <select class="form-select form-select-modern" id="cps-filtro-mes-ref"></select>
            </div>
            <div class="col-md-3">
                <label class="filter-label"><i class="bi bi-layers me-1"></i> Segmento</label>
                <select class="form-select form-select-modern" id="cps-filtro-segmento">
                    <option value="">Todos os Segmentos</option>
                </select>
            </div>
            <div class="col-md-4">
                <label class="filter-label"><i class="bi bi-person-badge me-1"></i> Prestador</label>
                <select class="form-select form-select-modern" id="cps-filtro-prestador">
                    <option value="">Todos os Prestadores</option>
                </select>
            </div>
            <div class="col-md-2 text-end">
                 <button type="button" class="btn btn-primary btn-update-modern w-100" id="btn-atualizar-lista-cps">
                    <i class="bi bi-arrow-clockwise"></i> Atualizar
                </button>
            </div>
        </div>
    `;

    pane.insertBefore(filterContainer, pane.firstChild);

    // Adiciona o listener SOMENTE no botão
    const btnUpdate = filterContainer.querySelector('#btn-atualizar-lista-cps');
    if (btnUpdate) {
        btnUpdate.addEventListener('click', carregarPendenciasCPS);
    }
}

// ==========================================================
// INICIALIZAÇÃO DE FILTROS E CHOICES
// ==========================================================

async function initFiltrosCPS() {
    const nomesMeses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const hoje = new Date();

    const selectMesPend = document.getElementById('cps-filtro-mes-ref');
    const selectMesHist = document.getElementById('cps-hist-filtro-mes-ref');

    // --- MUDANÇA AQUI: Adiciona opção "Todos" e seleciona ela por padrão ---
    if (selectMesPend) {
        selectMesPend.innerHTML = '';

        // Opção Padrão (Vazia -> Todos) selecionada
        selectMesPend.add(new Option("Todos os Meses", "", true, true));

        for (let i = 0; i < 12; i++) {
            const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
            const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const txt = `${nomesMeses[d.getMonth()]}/${d.getFullYear()}`;
            // Removemos o 'selected' daqui, pois o padrão agora é o "Todos"
            selectMesPend.add(new Option(txt, val));
        }
    }

    // (O restante do código para Histórico e Segmentos permanece igual...)
    if (selectMesHist && selectMesHist.options.length === 0) {
        for (let i = 0; i < 12; i++) {
            const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
            const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const txt = `${nomesMeses[d.getMonth()]}/${d.getFullYear()}`;
            selectMesHist.add(new Option(txt, val, i === 0, i === 0));
        }
    }

    const selectsSeg = [document.getElementById('cps-filtro-segmento'), document.getElementById('cps-hist-filtro-segmento')];
    const selectsPrest = [document.getElementById('cps-filtro-prestador'), document.getElementById('cps-hist-filtro-prestador')];

    try {
        const [resSeg, resPrest] = await Promise.all([
            fetchComAuth(`${API_BASE_URL}/segmentos`),
            fetchComAuth(`${API_BASE_URL}/index/prestadores`)
        ]);

        if (resSeg.ok) {
            const segs = await resSeg.json();
            selectsSeg.forEach(sel => {
                if (sel) {
                    const valAtual = sel.value;
                    sel.innerHTML = '<option value="">Todos os Segmentos</option>';
                    segs.forEach(s => sel.add(new Option(s.nome, s.id)));
                    if (valAtual) sel.value = valAtual;
                }
            });
        }

        if (resPrest.ok) {
            const prests = await resPrest.json();

            // Lógica do Choices.js mantida...
            const elPrestPend = selectsPrest[0];
            if (elPrestPend) {
                if (window.choicesCpsPrestador) {
                    window.choicesCpsPrestador.destroy();
                    window.choicesCpsPrestador = null;
                }
                elPrestPend.innerHTML = '<option value="">Todos os Prestadores</option>';
                prests.forEach(p => elPrestPend.add(new Option(`${p.codigoPrestador} - ${p.prestador}`, p.id)));

                window.choicesCpsPrestador = new Choices(elPrestPend, {
                    searchEnabled: true,
                    itemSelectText: '',
                    shouldSort: false,
                    placeholder: true,
                    placeholderValue: 'Pesquisar prestador...'
                });
            }

            const elPrestHist = selectsPrest[1];
            if (elPrestHist) {
                if (window.choicesCpsHistPrestador) {
                    window.choicesCpsHistPrestador.destroy();
                    window.choicesCpsHistPrestador = null;
                }
                elPrestHist.innerHTML = '<option value="">Todos os Prestadores</option>';
                prests.forEach(p => elPrestHist.add(new Option(`${p.codigoPrestador} - ${p.prestador}`, p.id)));

                window.choicesCpsHistPrestador = new Choices(elPrestHist, {
                    searchEnabled: true,
                    itemSelectText: '',
                    shouldSort: false
                });
            }
        }
    } catch (e) {
        console.error("Erro ao inicializar filtros CPS", e);
    }
}

// ==========================================================
// CARREGAMENTO E DASHBOARD
// ==========================================================

async function carregarPendenciasCPS() {
    toggleLoader(true, '#cps-pendencias-pane');
    const userId = localStorage.getItem('usuarioId');

    try {
        // 1. Captura os valores dos filtros
        const segmentoId = document.getElementById('cps-filtro-segmento')?.value || '';
        const mesVal = document.getElementById('cps-filtro-mes-ref')?.value || '';
        
        // Tratamento especial para o Choices.js do prestador
        let prestadorId = '';
        const prestadorEl = document.getElementById('cps-filtro-prestador');
        if (window.choicesCpsPrestador && prestadorEl) {
            prestadorId = window.choicesCpsPrestador.getValue(true) || '';
        } else if (prestadorEl) {
            prestadorId = prestadorEl.value || '';
        }

        // 2. Prepara parâmetros para a API (Trazendo dados para filtrar)
        const paramsLista = {};
        
        // Se houver mês selecionado, usamos para limitar a busca no banco (otimização)
        // Se for "Todos", não enviamos data, trazendo tudo pendente
        if (mesVal) {
            const [ano, mes] = mesVal.split('-');
            paramsLista.inicio = `${ano}-${mes}-01`;
            paramsLista.fim = `${ano}-${mes}-${new Date(ano, mes, 0).getDate()}`;
        }
        // Nota: Opcionalmente enviamos segmento/prestador ao back ou filtramos só no front.
        // Aqui enviamos para reduzir payload, mas garantimos filtro no front também.
        if (segmentoId) paramsLista.segmentoId = segmentoId;
        if (prestadorId) paramsLista.prestadorId = prestadorId;

        // 3. Busca a lista
        const paramsUrl = new URLSearchParams(paramsLista);
        const res = await fetchComAuth(`${API_BASE_URL}/controle-cps?${paramsUrl.toString()}`, { headers: { 'X-User-ID': userId } });
        if (!res.ok) throw new Error('Erro ao buscar pendências.');

        const dadosBrutos = await res.json();

        // 4. Filtragem Rigorosa no Front-end (Lógica "E")
        const dadosFiltrados = dadosBrutos.filter(item => {
            let match = true;

            // Filtro Prestador
            if (prestadorId) {
                if (!item.prestador || String(item.prestador.id) !== String(prestadorId)) match = false;
            }

            // Filtro Segmento (verifica vários locais onde o ID pode estar)
            if (segmentoId && match) {
                const idSegItem = item.os?.segmentoId || item.segmentoId || item.os?.segmento?.id;
                if (String(idSegItem) !== String(segmentoId)) match = false;
            }

            // Filtro Mês/Competência
            if (mesVal && match) {
                if (!item.dataAtividade) {
                    match = false;
                } else {
                    // Normaliza datas (YYYY-MM-DD ou DD/MM/YYYY)
                    let itemAno, itemMes;
                    if (item.dataAtividade.includes('/')) { 
                        [, itemMes, itemAno] = item.dataAtividade.split('/'); 
                    } else { 
                        [itemAno, itemMes] = item.dataAtividade.split('-'); 
                    }
                    const [anoFiltro, mesFiltro] = mesVal.split('-');
                    if (itemAno !== anoFiltro || itemMes !== mesFiltro) match = false;
                }
            }

            return match;
        });

        // 5. Atualiza a tela (Somente Lista)
        window.dadosCpsGlobais = dadosFiltrados;
        renderizarAcordeonCPS(window.dadosCpsGlobais, 'accordionPendenciasCPS', 'msg-sem-pendencias-cps', true);

        // Reaplica busca textual se houver algo digitado
        const inputBusca = document.getElementById('input-busca-cps-pendencias');
        if (inputBusca && inputBusca.value) {
            aplicarFiltroVisualCPS('accordionPendenciasCPS', 'input-busca-cps-pendencias');
        }
        
        // IMPORTANTE: Não chamamos atualização do Dashboard aqui para mantê-lo fixo.

    } catch (error) {
        console.error(error);
        mostrarToast(error.message, 'error');
    } finally {
        toggleLoader(false, '#cps-pendencias-pane');
    }
}

async function confirmarPagamentoComData(ids, tipo) {
    const hoje = new Date().toISOString().split('T')[0];
    const titulo = tipo === 'ADIANTAMENTO' ? 'Pagar Adiantamentos' : 'Realizar Pagamento CPS';
    
    // HTML do SweetAlert com campo de Data
    const htmlContent = `
        <div class="text-start">
            <label class="form-label small fw-bold">Data do Pagamento *</label>
            <input type="date" id="swal-data-pag" class="form-control mb-3" value="${hoje}">
            <div class="alert alert-info small py-2">
                <i class="bi bi-info-circle me-1"></i>
                Confirmar pagamento de <b>${ids.length}</b> item(ns)?
            </div>
        </div>
    `;

    const { value: formValues } = await Swal.fire({
        title: titulo,
        html: htmlContent,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Confirmar Pagamento',
        cancelButtonText: 'Cancelar',
        focusConfirm: false,
        preConfirm: () => {
            const data = document.getElementById('swal-data-pag').value;
            if (!data) Swal.showValidationMessage('A data do pagamento é obrigatória');
            return { data };
        }
    });

    if (formValues) {
        // Define Endpoint e Body
        // Se for 1 item ou lote, o backend deve estar preparado para receber lista ou ID
        const url = tipo === 'ADIANTAMENTO' ? '/lancamentos/pagar-adiantamento-lote' : '/controle-cps/pagar-lote';
        
        const body = {
            lancamentoIds: ids,
            usuarioId: localStorage.getItem('usuarioId'),
            controllerId: localStorage.getItem('usuarioId'),
            dataPagamento: formValues.data // DATA INCLUÍDA AQUI
        };

        // Envia para o Backend
        Swal.fire({ title: 'Processando...', didOpen: () => Swal.showLoading() });
        try {
            const res = await fetchComAuth(`${API_BASE_URL}${url}`, { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body) 
            });

            if (res.ok) {
                Swal.fire('Sucesso!', 'Pagamento registrado com a data informada.', 'success');
                
                // Limpa seleção e recarrega a lista e o dashboard (para atualizar os "Pagos")
                document.querySelectorAll('.cps-check').forEach(c => c.checked = false);
                
                // Atualiza ambos para refletir a mudança de status
                carregarPendenciasCPS();
                atualizarDashboardFixo();
            } else {
                throw new Error(await res.text());
            }
        } catch (e) {
            Swal.fire('Erro', e.message, 'error');
        }
    }
}

function calcularDashboardLocal(lista) {
    // Inicializa zerado
    let totalCps = 0;
    let totalAdiantado = 0;
    let totalConfirmado = 0;
    let totalPendente = 0;
    let totalPago = 0;
    let qtdItens = 0;

    if (lista && lista.length > 0) {
        qtdItens = lista.length;

        lista.forEach(l => {
            // Garante número
            const valorItem = parseFloat(l.valor || 0);
            const valorPagamento = l.valorPagamento !== null ? parseFloat(l.valorPagamento) : valorItem;
            const valorAdiantamento = parseFloat(l.valorAdiantamento || 0);
            const status = l.statusPagamento;

            // 1. Total CPS (Soma bruta dos itens listados)
            totalCps += valorItem;

            // 2. Total Adiantado
            if (valorAdiantamento > 0) {
                totalAdiantado += valorAdiantamento;
            }

            // Lógica baseada nos status do Backend
            const isPago = status === 'PAGO' || status === 'CONCLUIDO';
            const isConfirmado = status === 'FECHADO' || status === 'ALTERACAO_SOLICITADA';

            // 3. Total Confirmado (Soma tudo que já foi "aprovado" pelo coord ou pago)
            if (isPago || isConfirmado) {
                totalConfirmado += valorPagamento;
            }

            // 4. Total Pendente (Confirmado mas ainda não pago pelo Controller)
            if (isConfirmado) {
                totalPendente += valorPagamento;
            }

            // 5. Total Pago
            if (isPago) {
                totalPago += valorPagamento;
            }
        });
    }

    // Atualiza o DOM
    const fmt = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

    document.querySelectorAll('.kpi-cps-total-mes-value').forEach(e => e.textContent = fmt(totalCps));
    document.querySelectorAll('.kpi-cps-total-adiantado-value').forEach(e => e.textContent = fmt(totalAdiantado));
    document.querySelectorAll('.kpi-cps-total-confirmado-value').forEach(e => e.textContent = fmt(totalConfirmado));
    document.querySelectorAll('.kpi-cps-total-pendente-value').forEach(e => e.textContent = fmt(totalPendente));
    document.querySelectorAll('.kpi-cps-total-pago-value').forEach(e => e.textContent = fmt(totalPago));

    // Se tiver contador de itens
    document.querySelectorAll('.kpi-cps-qtd-itens-value').forEach(e => e.textContent = qtdItens);
}

function configurarSelectAllVisiveis() {
    const chkMaster = document.getElementById('cps-check-selecionar-todos-visiveis');
    if (!chkMaster) return;

    // Reseta o estado inicial
    chkMaster.checked = false;

    // Remove listener antigo para não duplicar (caso recarregue a lista)
    const novoChk = chkMaster.cloneNode(true);
    chkMaster.parentNode.replaceChild(novoChk, chkMaster);

    novoChk.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        const accordion = document.getElementById('accordionPendenciasCPS');

        if (!accordion) return;

        // Seleciona todas as linhas (tr) dentro do acordeão
        const linhas = accordion.querySelectorAll('tbody tr');

        linhas.forEach(tr => {
            // VERIFICAÇÃO CRUCIAL:
            // Só altera se a linha NÃO tiver a classe 'd-none' (oculta pelo filtro)
            if (!tr.classList.contains('d-none')) {
                const checkbox = tr.querySelector('.cps-check');
                if (checkbox) {
                    checkbox.checked = isChecked;
                }
            }
        });

        // Atualiza também os checkboxes dos cabeçalhos dos grupos (opcional, mas visualmente bom)
        // Se estiver marcando tudo, marca os headers visíveis também
        accordion.querySelectorAll('.accordion-item').forEach(item => {
            if (!item.classList.contains('d-none')) {
                const headerCheck = item.querySelector('.cps-select-all');
                if (headerCheck) {
                    // Verifica se todas as linhas visíveis desse grupo estão marcadas
                    const linhasDoGrupo = item.querySelectorAll('tbody tr:not(.d-none) .cps-check');
                    const todasMarcadas = Array.from(linhasDoGrupo).every(c => c.checked);
                    headerCheck.checked = todasMarcadas && linhasDoGrupo.length > 0;

                    // Aplica estilo visual de seleção no acordeão
                    if (headerCheck.checked) item.classList.add('cps-selected');
                    else item.classList.remove('cps-selected');
                }
            }
        });

        // Atualiza a toolbar flutuante
        atualizarBotoesLoteCPS();
    });
}

async function atualizarHeaderKpiCPS(filtrosExternos = null) {
    const els = document.querySelectorAll('.kpi-cps-total-mes-value');
    if (!els.length) return;

    const userId = localStorage.getItem('usuarioId');
    let params;

    if (filtrosExternos) {
        // Usa os filtros passados pela função principal
        params = new URLSearchParams(filtrosExternos);
    } else {
        // Fallback: Tenta ler do DOM se chamado isoladamente (raro)
        const mesVal = document.getElementById('cps-filtro-mes-ref')?.value;
        if (!mesVal) return;

        const [ano, mes] = mesVal.split('-');
        params = new URLSearchParams({
            inicio: `${ano}-${mes}-01`,
            fim: `${ano}-${mes}-${new Date(ano, mes, 0).getDate()}`,
            segmentoId: document.getElementById('cps-filtro-segmento')?.value || '',
            prestadorId: document.getElementById('cps-filtro-prestador')?.value || ''
        });
    }

    try {
        const res = await fetchComAuth(`${API_BASE_URL}/controle-cps/dashboard?${params.toString()}`, { headers: { 'X-User-ID': userId } });
        if (res.ok) {
            const d = await res.json();
            const fmt = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

            // Atualiza os valores na tela
            document.querySelectorAll('.kpi-cps-total-mes-value').forEach(e => e.textContent = fmt(d.valorTotal));
            document.querySelectorAll('.kpi-cps-total-adiantado-value').forEach(e => e.textContent = fmt(d.valorTotalAdiantado));
            document.querySelectorAll('.kpi-cps-total-confirmado-value').forEach(e => e.textContent = fmt(d.valorTotalConfirmado));
            document.querySelectorAll('.kpi-cps-total-pendente-value').forEach(e => e.textContent = fmt(d.valorTotalPendente));
            document.querySelectorAll('.kpi-cps-total-pago-value').forEach(e => e.textContent = fmt(d.valorTotalPago));
            // Caso tenha campo de quantidade
            if (d.quantidadeItens !== undefined) {
                document.querySelectorAll('.kpi-cps-qtd-itens-value').forEach(e => e.textContent = d.quantidadeItens);
            }
        }
    } catch (e) { console.error("Erro dashboard CPS:", e); }
}

async function carregarHistoricoCPS(append = false) {
    toggleLoader(true, '#cps-historico-pane');
    const btn = document.getElementById('btn-carregar-mais-historico-cps');
    if (btn) btn.disabled = true;

    const userId = localStorage.getItem('usuarioId');
    const mesRefSelect = document.getElementById('cps-hist-filtro-mes-ref');
    const mesRef = mesRefSelect ? mesRefSelect.value : null;

    if (!append) {
        if (mesRef) {
            const [ano, mes] = mesRef.split('-').map(Number);
            window.cpsHistDataInicio = new Date(ano, mes - 1, 1);
            window.cpsHistDataFim = new Date(ano, mes, 0);
        } else {
            window.cpsHistDataFim = new Date();
            window.cpsHistDataInicio = new Date();
            window.cpsHistDataInicio.setDate(window.cpsHistDataFim.getDate() - 30);
        }

        window.dadosCpsHistorico = [];
        const acc = document.getElementById('accordionHistoricoCPS');
        if (acc) acc.innerHTML = '';
    } else {
        const novaDataFim = new Date(window.cpsHistDataInicio);
        novaDataFim.setDate(novaDataFim.getDate() - 1);
        window.cpsHistDataFim = novaDataFim;

        const novaDataInicio = new Date(window.cpsHistDataFim);
        novaDataInicio.setDate(novaDataInicio.getDate() - 30);
        window.cpsHistDataInicio = novaDataInicio;
    }

    const params = new URLSearchParams({
        inicio: window.cpsHistDataInicio.toISOString().split('T')[0],
        fim: window.cpsHistDataFim.toISOString().split('T')[0],
        segmentoId: document.getElementById('cps-hist-filtro-segmento')?.value || '',
        prestadorId: document.getElementById('cps-hist-filtro-prestador')?.value || ''
    });

    try {
        const res = await fetchComAuth(`${API_BASE_URL}/controle-cps/historico?${params}`, { headers: { 'X-User-ID': userId } });
        if (!res.ok) throw new Error('Erro ao buscar histórico.');
        const novos = await res.json();

        window.dadosCpsHistorico = append ? [...window.dadosCpsHistorico, ...novos] : novos;
        renderizarAcordeonCPS(window.dadosCpsHistorico, 'accordionHistoricoCPS', 'msg-sem-historico-cps', false);

        const inputHist = document.getElementById('input-busca-cps-historico');
        if (inputHist && inputHist.value) {
            aplicarFiltroVisualCPS('accordionHistoricoCPS', 'input-busca-cps-historico');
        }

    } catch (error) {
        mostrarToast(error.message, 'error');
    } finally {
        toggleLoader(false, '#cps-historico-pane');
        if (btn) btn.disabled = false;
    }
}

// ==========================================================
// RENDERIZAÇÃO DA TABELA (Acordeões)
// ==========================================================

function renderizarAcordeonCPS(lista, containerId, msgVazioId, isPendencia) {
    const container = document.getElementById(containerId);
    const msgDiv = document.getElementById(msgVazioId);
    if (!container) return;
    container.innerHTML = '';

    const userRole = (localStorage.getItem("role") || localStorage.getItem("userRole") || "").trim().toUpperCase();

    // Filtros de visualização por perfil (Client Side)
    if (isPendencia) {
        lista = lista.filter(l => {
            if (['COORDINATOR', 'MANAGER'].includes(userRole)) return l.statusPagamento === 'EM_ABERTO';
            if (userRole === 'CONTROLLER') return ['FECHADO', 'ALTERACAO_SOLICITADA', 'SOLICITACAO_ADIANTAMENTO'].includes(l.statusPagamento);
            return true;
        });
    }

    if (!lista || lista.length === 0) {
        if (msgDiv) msgDiv.classList.remove('d-none');
        const toolbar = document.getElementById('cps-toolbar-lote');
        if (toolbar) toolbar.classList.add('d-none');
        return;
    }
    if (msgDiv) msgDiv.classList.add('d-none');

    // Agrupamento por OS
    const gruposMap = lista.reduce((acc, l) => {
        const id = l.os?.id || 0;
        if (!acc[id]) {
            acc[id] = {
                os: l.os?.os, projeto: l.os?.projeto,
                totalCps: l.valorCps || 0,
                totalPago: 0, totalAdiantado: 0, totalConfirmado: 0, itens: []
            };
        }

        if (l.valorAdiantamento) acc[id].totalAdiantado += parseFloat(l.valorAdiantamento) || 0;
        if (['FECHADO', 'ALTERACAO_SOLICITADA', 'PAGO', 'CONCLUIDO'].includes(l.statusPagamento)) acc[id].totalConfirmado += parseFloat(l.valorPagamento || l.valor) || 0;
        if (['PAGO', 'CONCLUIDO'].includes(l.statusPagamento)) acc[id].totalPago += parseFloat(l.valorPagamento || l.valor) || 0;

        acc[id].itens.push(l);
        return acc;
    }, {});

    const listaGrupos = Object.values(gruposMap);

    // Ordenação (Prioridade Visual)
    listaGrupos.sort((a, b) => {
        const aTemAdiant = a.itens.some(i => i.statusPagamento === 'SOLICITACAO_ADIANTAMENTO');
        const bTemAdiant = b.itens.some(i => i.statusPagamento === 'SOLICITACAO_ADIANTAMENTO');
        if (userRole === 'CONTROLLER') {
            if (aTemAdiant && !bTemAdiant) return -1;
            if (!aTemAdiant && bTemAdiant) return 1;
        }
        return 0;
    });

    const fmt = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

    listaGrupos.forEach((grp, idx) => {
        const uid = `cps-${isPendencia ? 'pend' : 'hist'}-${idx}`;

        // Ordenação interna
        grp.itens.sort((a, b) => {
            if (a.statusPagamento === 'SOLICITACAO_ADIANTAMENTO') return -1;
            if (b.statusPagamento === 'SOLICITACAO_ADIANTAMENTO') return 1;
            return 0;
        });

        const temSolicitacaoAdiantamento = grp.itens.some(i => i.statusPagamento === 'SOLICITACAO_ADIANTAMENTO');
        let headerStyleClass = '';
        let headerStyleInline = '';

        if (isPendencia && userRole === 'CONTROLLER' && temSolicitacaoAdiantamento) {
            headerStyleClass = 'bg-warning-subtle';
            headerStyleInline = 'background-color: #fff3cd !important; color: #664d03;';
        }

        let showHeaderCheck = false;
        if (isPendencia) {
            if (['ADMIN', 'COORDINATOR', 'MANAGER'].includes(userRole) && grp.itens.some(i => i.statusPagamento === 'EM_ABERTO')) showHeaderCheck = true;
            else if (['CONTROLLER', 'ADMIN'].includes(userRole) && grp.itens.some(i => ['FECHADO', 'ALTERACAO_SOLICITADA', 'SOLICITACAO_ADIANTAMENTO'].includes(i.statusPagamento))) showHeaderCheck = true;
        }

        const checkHtml = showHeaderCheck ? `<div class="position-absolute top-50 start-0 translate-middle-y ms-3 check-container-header" style="z-index: 5;"><input class="form-check-input cps-select-all shadow-sm" type="checkbox" data-target-body="collapse-${uid}"></div>` : '';
        const pl = showHeaderCheck ? 'ps-5' : 'ps-3';

        const headerHtml = `
            <div class="header-content w-100">
                <div class="header-title-wrapper">
                    <span class="header-title-project">${grp.projeto || '-'}</span>
                    <span class="header-title-os">${grp.os || '-'}</span>
                    ${temSolicitacaoAdiantamento && userRole === 'CONTROLLER' ? '<span class="badge bg-warning text-dark ms-2"><i class="bi bi-exclamation-triangle-fill"></i> Adiantamento</span>' : ''}
                </div>
                <div class="header-kpi-wrapper d-flex gap-3">
                    <div class="header-kpi"><span class="kpi-label">TOTAL CPS</span><span class="kpi-value">${fmt(grp.totalCps)}</span></div>
                    <div class="header-kpi"><span class="kpi-label text-primary">CONFIRMADO</span><span class="kpi-value text-primary">${fmt(grp.totalConfirmado)}</span></div>
                    <div class="header-kpi"><span class="kpi-label text-warning">ADIANTADO</span><span class="kpi-value text-warning">${fmt(grp.totalAdiantado)}</span></div>
                    <div class="header-kpi"><span class="kpi-label text-success">PAGO</span><span class="kpi-value text-success">${fmt(grp.totalPago)}</span></div>
                </div>
            </div>`;

        const linhas = grp.itens.map(l => {
            let btns = `<button class="btn btn-sm btn-outline-info me-1" title="Ver" onclick="verComentarios(${l.id})"><i class="bi bi-eye"></i></button>`;
            let showRowCheck = false;

            const isConfirmado = l.statusPagamento === 'FECHADO' || l.statusPagamento === 'ALTERACAO_SOLICITADA';
            const isPago = l.statusPagamento === 'PAGO' || l.statusPagamento === 'CONCLUIDO';
            const isAdiantado = (parseFloat(l.valorAdiantamento) || 0) > 0;
            const isSolicitacao = l.statusPagamento === 'SOLICITACAO_ADIANTAMENTO';

            let rowClass = isPago ? 'table-success' : (isConfirmado ? 'table-primary-light' : (isAdiantado ? 'table-warning-light' : ''));
            if (isSolicitacao) rowClass = 'table-warning';

            if (isPendencia) {
                if (['COORDINATOR', 'MANAGER', 'ADMIN'].includes(userRole) && l.statusPagamento === 'EM_ABERTO') {
                    btns += `<button class="btn btn-sm btn-outline-success me-1" title="Fechar" onclick="abrirModalCpsValor(${l.id}, 'fechar')"><i class="bi bi-check-circle"></i></button>`;
                    btns += `<button class="btn btn-sm btn-outline-primary me-1" title="Adiantar" onclick="abrirModalSolicitarAdiantamento(${l.id}, ${l.valor}, ${l.valorAdiantamento || 0})"><i class="bi bi-cash-stack"></i></button>`;
                    btns += `<button class="btn btn-sm btn-outline-danger" title="Recusar" onclick="abrirModalCpsValor(${l.id}, 'recusar')"><i class="bi bi-x-circle"></i></button>`;
                    showRowCheck = true;
                } else if (['CONTROLLER', 'ADMIN'].includes(userRole)) {
                    if (l.statusPagamento === 'SOLICITACAO_ADIANTAMENTO') {
                        btns += `<button class="btn btn-sm btn-outline-success me-1" onclick="aprovarAdiantamento(${l.id}, ${l.valorSolicitadoAdiantamento})"><i class="bi bi-check-lg"></i></button>`;
                        btns += `<button class="btn btn-sm btn-outline-danger" onclick="recusarAdiantamento(${l.id})"><i class="bi bi-x-lg"></i></button>`;
                        showRowCheck = true;
                    } else if (isConfirmado) {
                        btns += `<button class="btn btn-sm btn-outline-danger" onclick="abrirModalCpsRecusarController(${l.id})"><i class="bi bi-arrow-counterclockwise"></i></button>`;
                        showRowCheck = true;
                    }
                }
            }
            const checkTd = showRowCheck ? `<td><input type="checkbox" class="form-check-input cps-check" data-id="${l.id}" data-status="${l.statusPagamento}"></td>` : (isPendencia ? '<td></td>' : '');

            return `
            <tr class="${rowClass}">
                ${checkTd}
                <td class="text-center bg-transparent">${btns}</td>
                <td class="bg-transparent"><span class="badge text-bg-secondary">${(l.statusPagamento || '').replace(/_/g, ' ')}</span></td>
                <td class="bg-transparent">${l.dataAtividade || '-'}</td>
                <td class="bg-transparent fw-bold text-primary">${l.dataCompetencia || '-'}</td>
                <td class="bg-transparent">${l.detalhe?.site || '-'}</td>
                <td class="bg-transparent">${l.detalhe?.lpu?.nomeLpu || '-'}</td>
                <td class="bg-transparent">${l.prestador?.nome || '-'}</td>
                <td class="bg-transparent">${l.manager?.nome || '-'}</td>
                <td class="bg-transparent fw-bold text-end">${fmt(l.valorPagamento || l.valor)}</td>
            </tr>`;
        }).join('');

        container.insertAdjacentHTML('beforeend', `
        <div class="accordion-item border mb-2 shadow-sm" style="border-radius: 8px; overflow: hidden;">
            <h2 class="accordion-header position-relative" id="heading-${uid}">
                ${checkHtml}
                <button class="accordion-button collapsed ${pl} ${headerStyleClass}" type="button" 
                        style="${headerStyleInline}"
                        data-bs-toggle="collapse" data-bs-target="#collapse-${uid}">
                    ${headerHtml}
                </button>
            </h2>
            <div id="collapse-${uid}" class="accordion-collapse collapse">
                <div class="accordion-body p-0">
                    <div class="table-responsive">
                        <table class="table mb-0 align-middle small table-hover">
                            <thead class="table-light"><tr>${isPendencia ? '<th><i class="bi bi-check-all"></i></th>' : ''}<th class="text-center">Ações</th><th>Status</th><th>Data</th><th>Comp.</th><th>Site</th><th>Item</th><th>Prestador</th><th>Gestor</th><th class="text-end">Valor</th></tr></thead>
                            <tbody id="tbody-${uid}">${linhas}</tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>`);
    });

    if (isPendencia) {
        registrarEventosCps();
        configurarSelectAllVisiveis();
        atualizarBotoesLoteCPS();
        configurarBuscaCps('input-busca-cps-pendencias', 'accordionPendenciasCPS');
    } else {
        configurarBuscaCps('input-busca-cps-historico', 'accordionHistoricoCPS');
    }
}

// ==========================================================
// FUNÇÃO CENTRALIZADA DE FILTRO VISUAL (NOVO)
// ==========================================================

function aplicarFiltroVisualCPS(accordionId, inputId) {
    const input = document.getElementById(inputId);
    const accordion = document.getElementById(accordionId);
    if (!input || !accordion) return;

    const termo = input.value.toLowerCase();

    // Se estiver vazio, mostra tudo
    if (!termo) {
        accordion.querySelectorAll('.accordion-item').forEach(item => {
            item.classList.remove('d-none');
            item.querySelectorAll('tbody tr').forEach(tr => tr.classList.remove('d-none'));
        });
        return;
    }

    // Aplica o filtro
    accordion.querySelectorAll('.accordion-item').forEach(item => {
        const headerText = item.querySelector('.accordion-header').innerText.toLowerCase();
        let headerMatches = headerText.includes(termo);
        let hasVisibleRow = false;

        const linhas = item.querySelectorAll('tbody tr');
        linhas.forEach(tr => {
            const rowText = tr.innerText.toLowerCase();
            if (rowText.includes(termo)) {
                tr.classList.remove('d-none');
                hasVisibleRow = true;
            } else {
                tr.classList.add('d-none');
            }
        });

        // Se o header der match, mostra todas as linhas (ou pode manter a lógica de filtrar só as linhas)
        if (headerMatches) {
            item.classList.remove('d-none');
            linhas.forEach(tr => tr.classList.remove('d-none'));
        } else {
            if (hasVisibleRow) {
                item.classList.remove('d-none');
            } else {
                item.classList.add('d-none');
            }
        }
    });
}

function configurarBuscaCps(inputId, accordionId) {
    const input = document.getElementById(inputId);
    if (!input) return;

    // Sobrescreve handlers para evitar duplicação de listeners
    input.onkeyup = function () {
        aplicarFiltroVisualCPS(accordionId, inputId);
    };
    input.onsearch = function () {
        aplicarFiltroVisualCPS(accordionId, inputId);
    };
}


// ==========================================================
// AÇÕES EM LOTE (Toolbar Flutuante)
// ==========================================================

function registrarEventosCps() {
    document.querySelectorAll('.cps-select-all').forEach(chk => {
        chk.addEventListener('click', e => e.stopPropagation());
        chk.addEventListener('change', e => {
            const target = document.getElementById(e.target.dataset.targetBody);
            const accItem = e.target.closest('.accordion-item');
            if (accItem) e.target.checked ? accItem.classList.add('cps-selected') : accItem.classList.remove('cps-selected');
            if (target) target.querySelectorAll('.cps-check').forEach(c => c.checked = e.target.checked);
            atualizarBotoesLoteCPS();
        });
    });
    document.querySelectorAll('.cps-check').forEach(chk => chk.addEventListener('change', () => atualizarBotoesLoteCPS()));
}

function atualizarBotoesLoteCPS() {
    const selecionados = document.querySelectorAll('.cps-check:checked');
    const qtd = selecionados.length;
    const userRole = (localStorage.getItem("role") || localStorage.getItem("userRole") || "").trim().toUpperCase();

    let toolbar = document.getElementById('cps-toolbar-lote');
    if (!toolbar) {
        const pane = document.getElementById('cps-pendencias-pane');
        if (pane) {
            toolbar = document.createElement('div');
            toolbar.id = 'cps-toolbar-lote';
            toolbar.className = 'cps-toolbar-floating d-none';
            document.body.appendChild(toolbar);

            document.querySelectorAll('button[data-bs-toggle="tab"]').forEach(tab => {
                tab.addEventListener('show.bs.tab', () => toolbar.classList.add('d-none'));
            });
        } else return;
    }

    const abaAtiva = document.querySelector('#cps-pendencias-pane.active');
    if (!abaAtiva || qtd === 0) {
        toolbar.classList.add('d-none');
        return;
    }

    let temEmAberto = false, temAdiantamento = false, temFechado = false;
    selecionados.forEach(cb => {
        const s = cb.dataset.status;
        if (s === 'EM_ABERTO') temEmAberto = true;
        if (s === 'SOLICITACAO_ADIANTAMENTO') temAdiantamento = true;
        if (['FECHADO', 'ALTERACAO_SOLICITADA'].includes(s)) temFechado = true;
    });

    let htmlBtns = '';

    if (['COORDINATOR', 'MANAGER', 'ADMIN'].includes(userRole)) {
        if (temEmAberto && !temAdiantamento && !temFechado) {
            htmlBtns += `
                <button class="btn btn-sm btn-success rounded-pill px-3" onclick="executarAcaoLote('fechar')"><i class="bi bi-check-circle me-1"></i> Fechar</button>
                <button class="btn btn-sm btn-primary rounded-pill px-3" onclick="executarAcaoLote('solicitarAdiantamento')"><i class="bi bi-cash-stack me-1"></i> Adiantar</button>
                <button class="btn btn-sm btn-outline-danger rounded-pill px-3" onclick="executarAcaoLote('recusarCoord')"><i class="bi bi-x-circle me-1"></i> Recusar</button>`;
        }
    }
    if (['CONTROLLER', 'ADMIN'].includes(userRole)) {
        if (temFechado && !temEmAberto && !temAdiantamento) {
            htmlBtns += `<button class="btn btn-sm btn-success rounded-pill px-3" onclick="executarAcaoLote('pagarController')"><i class="bi bi-cash-coin me-1"></i> Pagar</button>
                         <button class="btn btn-sm btn-outline-danger rounded-pill px-3" onclick="executarAcaoLote('recusarController')"><i class="bi bi-arrow-counterclockwise me-1"></i> Devolver</button>`;
        }
        if (temAdiantamento && !temEmAberto && !temFechado) {
            htmlBtns += `<button class="btn btn-sm btn-success rounded-pill px-3" onclick="executarAcaoLote('pagarAdiantamento')"><i class="bi bi-check-lg me-1"></i> Pagar Adiant.</button>
                         <button class="btn btn-sm btn-outline-danger rounded-pill px-3" onclick="executarAcaoLote('recusarAdiantamento')"><i class="bi bi-x-lg me-1"></i> Recusar</button>`;
        }
    }

    if (htmlBtns !== '') {
        toolbar.classList.remove('d-none');
        toolbar.innerHTML = `
            <div class="d-flex align-items-center text-secondary" style="font-size:0.9rem;">
                <i class="bi bi-check-square-fill text-primary fs-5 me-2"></i> 
                <span class="fw-bold text-dark me-1">${qtd}</span> item(s)
            </div>
            <div class="cps-toolbar-actions">${htmlBtns}</div>
        `;
    } else {
        toolbar.classList.add('d-none');
    }
}

// ==========================================================
// FUNÇÕES DE AÇÃO (LOTE E UNITÁRIO)
// ==========================================================

window.executarAcaoLote = function (acao) {
    const ids = Array.from(document.querySelectorAll('.cps-check:checked')).map(c => parseInt(c.dataset.id));
    if (!ids.length) return;

    // Configura flags dos modais existentes (mantido da lógica original)
    if (window.modalAlterarValorCPS) window.modalAlterarValorCPS._element.dataset.acaoEmLote = 'true';
    if (window.modalRecusarCPS) window.modalRecusarCPS._element.dataset.acaoEmLote = 'true';

    // --- AÇÕES DO COORDENADOR (Mantidas iguais) ---
    if (acao === 'fechar') {
        // ... (Mantenha o código original do 'fechar' aqui) ...
        document.getElementById('formAlterarValorCPS').reset();
        document.querySelector('#modalAlterarValorCPS .modal-title').innerHTML = '<i class="bi bi-check-all text-success me-2"></i> Fechar Lote';
        document.getElementById('cpsAcaoCoordenador').value = 'fechar';
        document.getElementById('divCompetenciaCps').style.display = 'block';
        gerarOpcoesCompetencia();
        const valInput = document.getElementById('cpsValorPagamentoInput');
        valInput.value = 'Vários'; valInput.disabled = true;
        const btn = document.getElementById('btnConfirmarAcaoCPS');
        btn.className = 'btn btn-success'; btn.textContent = "Confirmar Lote";
        if (window.modalAlterarValorCPS) window.modalAlterarValorCPS.show();
    }
    else if (acao === 'solicitarAdiantamento') {
        // ... (Mantenha o código original do 'solicitarAdiantamento' aqui) ...
        const modalEl = document.getElementById('modalSolicitarAdiantamento');
        if (modalEl) {
            modalEl.dataset.acaoEmLote = 'true';
            document.getElementById('adiantamentoValorTotalDisplay').innerText = "Vários Itens";
            document.getElementById('adiantamentoValorJaPagoDisplay').innerText = "-";
            document.getElementById('valorSolicitadoInput').value = '';
            document.getElementById('justificativaAdiantamentoInput').value = '';
            if (window.modalSolicitarAdiantamento) window.modalSolicitarAdiantamento.show();
        }
    }
    else if (acao === 'recusarCoord') {
        // ... (Mantenha o código original do 'recusarCoord' aqui) ...
        const form = document.getElementById('formAlterarValorCPS');
        form.reset();
        document.querySelector('#modalAlterarValorCPS .modal-title').innerHTML = '<i class="bi bi-x-circle text-danger"></i> Recusar Lote';
        document.getElementById('cpsAcaoCoordenador').value = 'recusar';
        document.getElementById('divCompetenciaCps').style.display = 'none';
        document.getElementById('cpsValorPagamentoInput').disabled = true;
        document.getElementById('cpsJustificativaInput').required = true;
        const btn = document.getElementById('btnConfirmarAcaoCPS');
        btn.className = 'btn btn-danger'; btn.textContent = "Recusar Lote";
        if (window.modalAlterarValorCPS) window.modalAlterarValorCPS.show();
    }
    
    // --- AÇÕES DO CONTROLLER (ALTERADAS PARA USAR DATA) ---
    else if (acao === 'pagarController') {
        confirmarPagamentoComData(ids, 'QUITACAO');
    }
    else if (acao === 'pagarAdiantamento') {
        confirmarPagamentoComData(ids, 'ADIANTAMENTO');
    }
    
    // --- RECUSAS DO CONTROLLER (Mantidas iguais) ---
    else if (acao === 'recusarController') {
        if (window.modalRecusarCPS) {
            window.modalRecusarCPS._element.dataset.acaoEmLote = 'true';
            document.getElementById('cpsMotivoRecusaInput').value = '';
            window.modalRecusarCPS.show();
        }
    }
    else if (acao === 'recusarAdiantamento') {
        if (window.modalRecusarAdiantamento) {
            document.getElementById('modalRecusarAdiantamento').dataset.acaoEmLote = 'true';
            document.getElementById('motivoRecusaAdiantamento').value = '';
            window.modalRecusarAdiantamento.show();
        }
    }
};

async function processarAcaoControllerDireta(endpoint, body, modalInstance) {
    const btn = document.getElementById('btnGenericoConfirmar');
    setLoading(btn, true);
    try {
        const res = await fetchComAuth(`${API_BASE_URL}${endpoint}`, { method: 'POST', body: JSON.stringify(body) });
        if (res.ok) {
            mostrarToast("Sucesso!", "success");
            if (modalInstance) modalInstance.hide();
            carregarPendenciasCPS();
        } else {
            throw new Error(await res.text());
        }
    } catch (e) { mostrarToast(e.message, "error"); }
    finally { setLoading(btn, false); }
}

function setLoading(btn, isLoading) {
    if (!btn) return;
    if (isLoading) {
        if (!btn.dataset.originalText) btn.dataset.originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Processando...`;
    } else {
        btn.disabled = false;
        if (btn.dataset.originalText) btn.innerHTML = btn.dataset.originalText;
    }
}

// --- FUNÇÃO DE LOADER LOCAL (SEM CONFLITO) ---
function toggleLoader(show, selector) {
    const container = document.querySelector(selector);
    if (!container) return;

    // Tenta encontrar o loader interno específico
    const loader = container.querySelector('.overlay-loader');

    if (loader) {
        // Se existe o loader "bonito"
        if (show) {
            loader.classList.remove('d-none');
            // Garante que o efeito "feio" de opacidade NÃO esteja aplicado
            container.classList.remove('opacity-50', 'pointer-events-none');
        } else {
            loader.classList.add('d-none');
            // Limpa tudo
            container.classList.remove('opacity-50', 'pointer-events-none');
        }
    } else {
        // Fallback: Se não tiver o loader no HTML, usa opacidade
        if (show) {
            container.classList.add('opacity-50', 'pointer-events-none');
        } else {
            container.classList.remove('opacity-50', 'pointer-events-none');
        }
    }
}

// --- Handlers de Formulários (Solicitações, Aprovações e Recusas) ---
const formSolAdiant = document.getElementById('formSolicitarAdiantamento');
if (formSolAdiant) {
    formSolAdiant.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btnConfirmarSolicitacaoAdiantamento');
        setLoading(btn, true);
        const modalEl = document.getElementById('modalSolicitarAdiantamento');
        const isLote = modalEl.dataset.acaoEmLote === 'true';

        // Tratamento do valor
        let valorRaw = document.getElementById('valorSolicitadoInput').value;
        let valor = valorRaw ? parseFloat(valorRaw.replace(/\./g, '').replace(',', '.')) : null;

        const just = document.getElementById('justificativaAdiantamentoInput').value;
        const uId = localStorage.getItem('usuarioId');

        try {
            if (isLote) {
                // =================================================================
                // LÓGICA DE DISTRIBUIÇÃO CORRIGIDA
                // =================================================================
                const checkedElements = document.querySelectorAll('.cps-check:checked');
                let saldoRestanteParaAdiantar = valor; // Valor total que o usuário quer adiantar

                let erros = [];
                let itensProcessados = 0;

                for (const chk of checkedElements) {
                    // Se já não tem mais nada para adiantar (ex: 0.00), encerra o loop
                    if (saldoRestanteParaAdiantar <= 0.01) break;

                    const id = chk.dataset.id;
                    // Busca os dados originais na lista global para calcular o saldo real
                    const item = window.dadosCpsGlobais.find(i => i.id == id);
                    
                    if (!item) continue;

                    const valorTotalItem = parseFloat(item.valor || 0);
                    const valorJaAdiantado = parseFloat(item.valorAdiantamento || 0);
                    const saldoDisponivelItem = valorTotalItem - valorJaAdiantado;

                    // Se o item não tem saldo, pula para o próximo
                    if (saldoDisponivelItem <= 0.01) continue;

                    // Calcula quanto tirar deste item específico
                    // Pega o MÍNIMO entre "o que o usuário quer" e "o que o item tem"
                    let valorParaEsteItem = 0;
                    if (saldoRestanteParaAdiantar >= saldoDisponivelItem) {
                        valorParaEsteItem = saldoDisponivelItem;
                    } else {
                        valorParaEsteItem = saldoRestanteParaAdiantar;
                    }

                    // Subtrai do montante global
                    saldoRestanteParaAdiantar -= valorParaEsteItem;

                    // Envia a requisição apenas com o valor parcial deste item
                    const res = await fetchComAuth(`${API_BASE_URL}/controle-cps/${id}/solicitar-adiantamento`, {
                        method: 'POST',
                        body: JSON.stringify({ valor: valorParaEsteItem, usuarioId: uId, justificativa: just })
                    });

                    if (!res.ok) {
                        const textoErro = await res.text();
                        console.error(`Falha no item ${id}:`, textoErro);
                        erros.push(`Item ${id}: não processado.`);
                    } else {
                        itensProcessados++;
                    }
                }

                if (erros.length > 0) {
                    if (itensProcessados === 0) {
                        throw new Error("Falha ao solicitar adiantamento. Verifique se os itens selecionados possuem saldo.");
                    } else {
                        mostrarToast(`Processado parcialmente. ${itensProcessados} itens ok, ${erros.length} falharam.`, "warning");
                    }
                } else {
                    if (itensProcessados === 0) {
                        mostrarToast("Nenhum item tinha saldo disponível para o adiantamento.", "warning");
                    } else {
                        mostrarToast("Solicitações em lote enviadas com sucesso!", "success");
                    }
                }

            } else {
                // Fluxo unitário (mantido igual)
                const id = document.getElementById('adiantamentoLancamentoId').value;
                const res = await fetchComAuth(`${API_BASE_URL}/controle-cps/${id}/solicitar-adiantamento`, {
                    method: 'POST',
                    body: JSON.stringify({ valor: valor, usuarioId: uId, justificativa: just })
                });

                if (!res.ok) {
                    const erroTxt = await res.text();
                    throw new Error(erroTxt || "Erro na solicitação.");
                }

                mostrarToast("Solicitação enviada!", "success");
            }

            if (window.modalSolicitarAdiantamento) window.modalSolicitarAdiantamento.hide();
            carregarPendenciasCPS();

        } catch (e) {
            mostrarToast("Erro: " + e.message, "error");
        } finally {
            setLoading(btn, false);
            delete modalEl.dataset.acaoEmLote;
        }
    });
}

const btnConfRecAdiant = document.getElementById('btnConfirmarRecusaAdiantamento');
if (btnConfRecAdiant) {
    btnConfRecAdiant.addEventListener('click', async () => {
        const modalEl = document.getElementById('modalRecusarAdiantamento');
        const isLote = modalEl.dataset.acaoEmLote === 'true';
        const motivo = document.getElementById('motivoRecusaAdiantamento').value;
        const uId = localStorage.getItem('usuarioId');
        if (!motivo) { alert("Motivo obrigatório"); return; }
        setLoading(btnConfRecAdiant, true);
        try {
            if (isLote) {
                const ids = Array.from(document.querySelectorAll('.cps-check:checked')).map(c => parseInt(c.dataset.id));
                for (const id of ids) {
                    await fetchComAuth(`${API_BASE_URL}/controle-cps/${id}/recusar-adiantamento`, { method: 'POST', body: JSON.stringify({ usuarioId: uId, motivo: motivo }) });
                }
                mostrarToast("Lote recusado!", "success");
            } else {
                const id = document.getElementById('idAdiantamentoRecusar').value;
                const res = await fetchComAuth(`${API_BASE_URL}/controle-cps/${id}/recusar-adiantamento`, { method: 'POST', body: JSON.stringify({ usuarioId: uId, motivo: motivo }) });
                if (!res.ok) throw new Error("Erro");
                mostrarToast("Recusado!", "success");
            }
            if (window.modalRecusarAdiantamento) window.modalRecusarAdiantamento.hide();
            carregarPendenciasCPS();
        } catch (e) { mostrarToast(e.message, "error"); }
        finally { setLoading(btnConfRecAdiant, false); delete modalEl.dataset.acaoEmLote; }
    });
}

const btnAprovarAdiant = document.getElementById('btnConfirmarAprovarAdiantamento');
if (btnAprovarAdiant) {
    btnAprovarAdiant.addEventListener('click', async function () {
        const id = document.getElementById('idAdiantamentoAprovar').value;
        setLoading(this, true);
        toggleLoader(true, '#cps-pendencias-pane');
        try {
            const res = await fetchComAuth(`${API_BASE_URL}/controle-cps/${id}/pagar-adiantamento`, { method: 'POST', body: JSON.stringify({ usuarioId: localStorage.getItem('usuarioId') }) });
            if (!res.ok) throw new Error("Erro ao processar pagamento.");
            mostrarToast("Adiantamento pago!", "success");
            if (window.modalAprovarAdiantamento) window.modalAprovarAdiantamento.hide();
            carregarPendenciasCPS();
        } catch (error) { mostrarToast(error.message, 'error'); }
        finally { toggleLoader(false, '#cps-pendencias-pane'); setLoading(this, false); }
    });
}

const formAlterar = document.getElementById('formAlterarValorCPS');
if (formAlterar) {
    formAlterar.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btnConfirmarAcaoCPS');
        setLoading(btn, true);
        const isLote = window.modalAlterarValorCPS._element.dataset.acaoEmLote === 'true';
        const acao = document.getElementById('cpsAcaoCoordenador').value;
        const ids = isLote ? Array.from(document.querySelectorAll('.cps-check:checked')).map(c => parseInt(c.dataset.id)) : [parseInt(document.getElementById('cpsLancamentoIdAcao').value)];
        const uId = localStorage.getItem('usuarioId');

        let url = '', body = {};
        if (acao === 'recusar') {
            url = isLote ? '/controle-cps/recusar-lote' : '/controle-cps/recusar';
            body = { lancamentoIds: ids, lancamentoId: ids[0], coordenadorId: uId, justificativa: document.getElementById('cpsJustificativaInput').value };
        } else {
            url = isLote ? '/controle-cps/fechar-lote' : '/controle-cps/fechar';
            const val = parseFloat(document.getElementById('cpsValorPagamentoInput').value.replace(/\./g, '').replace(',', '.'));
            body = { lancamentoIds: ids, lancamentoId: ids[0], coordenadorId: uId, competencia: document.getElementById('cpsCompetenciaInput').value, valorPagamento: isLote ? null : val, justificativa: document.getElementById('cpsJustificativaInput').value };
        }

        try {
            const res = await fetchComAuth(`${API_BASE_URL}${url}`, { method: 'POST', body: JSON.stringify(body) });
            if (res.ok) {
                mostrarToast("Ação realizada!", "success");
                if (window.modalAlterarValorCPS) window.modalAlterarValorCPS.hide();
                carregarPendenciasCPS();
            } else throw new Error((await res.json()).message || "Erro");
        } catch (err) { mostrarToast(err.message, "error"); }
        finally { setLoading(btn, false); }
    });
}

const formRecu = document.getElementById('formRecusarCPS');
if (formRecu) {
    formRecu.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = formRecu.querySelector('button[type="submit"]');
        const motivo = document.getElementById('cpsMotivoRecusaInput').value;
        const usuarioId = parseInt(localStorage.getItem('usuarioId'));
        const isLote = window.modalRecusarCPS._element.dataset.acaoEmLote === 'true';

        if (!motivo || motivo.trim() === "") {
            mostrarToast("O motivo da recusa é obrigatório.", "warning");
            return;
        }
        if (!usuarioId) {
            mostrarToast("Erro de sessão. Faça login novamente.", "error");
            return;
        }

        let ids = [];
        if (isLote) {
            ids = Array.from(document.querySelectorAll('.cps-check:checked'))
                .map(c => parseInt(c.dataset.id))
                .filter(id => !isNaN(id));
        } else {
            const idUnico = parseInt(document.getElementById('cpsLancamentoIdRecusar').value);
            if (idUnico) ids.push(idUnico);
        }

        if (ids.length === 0) {
            mostrarToast("Nenhum lançamento selecionado para recusa.", "warning");
            return;
        }

        setLoading(btn, true);

        const url = isLote ? '/controle-cps/recusar-controller-lote' : '/controle-cps/recusar-controller';
        const payload = isLote
            ? { lancamentoIds: ids, controllerId: usuarioId, motivo: motivo }
            : { lancamentoId: ids[0], controllerId: usuarioId, motivo: motivo };

        try {
            const res = await fetchComAuth(`${API_BASE_URL}${url}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                mostrarToast("Devolução realizada com sucesso!", "success");
                if (window.modalRecusarCPS) window.modalRecusarCPS.hide();
                document.querySelectorAll('.cps-check:checked').forEach(c => c.checked = false);
                document.querySelectorAll('.cps-select-all').forEach(c => c.checked = false);
                atualizarBotoesLoteCPS();
                carregarPendenciasCPS();
            } else {
                const erroTxt = await res.text();
                let msgErro = "Erro ao recusar.";
                try {
                    const erroJson = JSON.parse(erroTxt);
                    msgErro = erroJson.message || msgErro;
                } catch (e) { msgErro = erroTxt; }
                throw new Error(msgErro);
            }
        } catch (err) {
            console.error(err);
            mostrarToast(err.message, "error");
        } finally {
            setLoading(btn, false);
        }
    });
}

window.abrirModalCpsValor = function (id, acao) {
    const l = window.dadosCpsGlobais.find(x => x.id == id);
    if (!l || !window.modalAlterarValorCPS) return;

    document.getElementById('cpsLancamentoIdAcao').value = id;
    document.getElementById('cpsAcaoCoordenador').value = acao;
    window.modalAlterarValorCPS._element.dataset.acaoEmLote = 'false';

    const btn = document.getElementById('btnConfirmarAcaoCPS');
    const inputJust = document.getElementById('cpsJustificativaInput');
    const divComp = document.getElementById('divCompetenciaCps');
    const inputVal = document.getElementById('cpsValorPagamentoInput');
    inputVal.disabled = true;

    document.querySelector('#modalAlterarValorCPS .modal-title').innerText = acao === 'recusar' ? 'Recusar Pagamento' : 'Fechar Pagamento';
    const val = l.valorPagamento !== null ? l.valorPagamento : l.valor;
    inputVal.value = val.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

    if (acao === 'recusar') {
        btn.className = 'btn btn-danger';
        btn.textContent = "Confirmar Recusa";
        divComp.style.display = 'none';
        document.getElementById('cpsCompetenciaInput').required = false;
        inputJust.required = true;
    } else {
        btn.className = 'btn btn-success';
        btn.textContent = "Confirmar Fechamento";
        divComp.style.display = 'block';
        gerarOpcoesCompetencia();
        document.getElementById('cpsCompetenciaInput').required = true;
        inputJust.required = false;
    }
    window.modalAlterarValorCPS.show();
};

window.abrirModalCpsRecusarController = function (id) {
    document.getElementById('cpsLancamentoIdRecusar').value = id;
    if (window.modalRecusarCPS) {
        window.modalRecusarCPS._element.dataset.acaoEmLote = 'false';
        document.getElementById('cpsMotivoRecusaInput').value = '';
        window.modalRecusarCPS.show();
    }
};

window.abrirModalSolicitarAdiantamento = function (id, valorTotal, valorJaAdiantado) {
    document.getElementById('adiantamentoLancamentoId').value = id;
    document.getElementById('adiantamentoValorTotalDisplay').innerText = (valorTotal || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    document.getElementById('adiantamentoValorJaPagoDisplay').innerText = (valorJaAdiantado || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    document.getElementById('valorSolicitadoInput').value = '';
    if (window.modalSolicitarAdiantamento) window.modalSolicitarAdiantamento.show();
};

window.aprovarAdiantamento = function (id, valor) {
    document.getElementById('idAdiantamentoAprovar').value = id;
    document.getElementById('displayValorAdiantamento').innerText = (valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    if (window.modalAprovarAdiantamento) {
        delete window.modalAprovarAdiantamento._element.dataset.acaoEmLote;
        window.modalAprovarAdiantamento.show();
    }
};

window.recusarAdiantamento = function (id) {
    document.getElementById('idAdiantamentoRecusar').value = id;
    document.getElementById('motivoRecusaAdiantamento').value = '';
    if (window.modalRecusarAdiantamento) {
        delete window.modalRecusarAdiantamento._element.dataset.acaoEmLote;
        window.modalRecusarAdiantamento.show();
    }
};

function gerarOpcoesCompetencia() {
    const select = document.getElementById('cpsCompetenciaInput');
    if (!select) return;
    select.innerHTML = '';

    const hoje = new Date();
    // Define a data base como o dia 1º do mês atual
    let dataBase = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

    // REGRA PADRÃO: Se hoje for dia 6 ou mais, a competência mínima vira o mês seguinte.
    // Ex: Hoje é 06/02 -> Pula para Março (03). 
    // Se fosse 05/02 -> Continuaria Fevereiro (02).
    if (hoje.getDate() > 5) {
        dataBase.setMonth(dataBase.getMonth() + 1);
    }

    // --- REMOVIDA A LÓGICA DE EXCEÇÃO DE JANEIRO/2026 AQUI ---

    const mesesNomes = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];

    // Gera opções para os próximos 12 meses a partir da dataBase calculada
    for (let i = 0; i < 12; i++) {
        const mes = dataBase.getMonth();
        const ano = dataBase.getFullYear();

        // Formata o valor como "MM/YYYY" (ex: "02/2026") para o value do option
        const valor = `${ano}-${String(mes + 1).padStart(2, '0')}-01`;
        // Texto visível para o usuário (ex: "Fevereiro/2026")
        const texto = `${mesesNomes[mes]}/${ano}`;

        const option = document.createElement('option');
        option.value = valor;
        option.textContent = texto;
        select.appendChild(option);

        // Avança para o próximo mês no loop
        dataBase.setMonth(dataBase.getMonth() + 1);
    }
}