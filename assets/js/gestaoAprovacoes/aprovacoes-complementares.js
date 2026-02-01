if (!window.API_COMPLEMENTARES_URL) {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        window.API_COMPLEMENTARES_URL = 'http://localhost:8082';
    } else {
        window.API_COMPLEMENTARES_URL = window.location.origin + '/atividades';
    }
}

const AprovacoesComplementares = {

    MS_URL: window.API_COMPLEMENTARES_URL + "/v1/solicitacoes-complementares",

    currentSolicitacao: null,
    currentOsCompleta: null,
    alteracoesBuffer: {},
    listenersConfigurados: false,
    listaCompletaLpus: null,
    mapaDetalhesOs: {},

    choicesMain: null,
    choicesEdit: null,

    init: () => {
        if (!AprovacoesComplementares.listenersConfigurados) {
            AprovacoesComplementares.listenersConfigurados = true;
            AprovacoesComplementares.injetarCSS();

            // Listeners para filtros do histórico
            const inputBusca = document.getElementById('buscaHistComp');
            const selectStatus = document.getElementById('filtroStatusHistComp');

            if (inputBusca) inputBusca.addEventListener('keyup', AprovacoesComplementares.filtrarHistoricoNaTela);
            if (selectStatus) selectStatus.addEventListener('change', AprovacoesComplementares.filtrarHistoricoNaTela);

            console.log("Módulo Complementares Iniciado.");
        }
    },

    injetarCSS: () => {
        const style = document.createElement('style');
        style.innerHTML = `
            :root { --app-primary: #198754; --app-primary-light: #d1e7dd; --app-bg: #fff; }
            .swal2-container { z-index: 20000 !important; }
            .item-modificado { background-color: #fff3cd !important; } 
            .valor-antigo { text-decoration: line-through; color: var(--bs-danger); margin-right: 6px; font-size: 0.85em; }
            .valor-novo { color: var(--app-primary); font-weight: bold; }
            .loading-text { font-style: italic; color: #adb5bd; font-size: 0.85rem; }
            .badge-status-aprovado { background-color: #d1e7dd; color: #0f5132; border: 1px solid #badbcc; }
            .badge-status-rejeitado { background-color: #f8d7da; color: #842029; border: 1px solid #f5c2c7; }
            .badge-status-pendente { background-color: #fff3cd; color: #664d03; border: 1px solid #ffecb5; }
        `;
        document.head.appendChild(style);
    },

    formatarMoeda: (valor) => {
        if (valor === undefined || valor === null) return 'R$ 0,00';
        return parseFloat(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    },

    formatarData: (dataIso) => {
        if (!dataIso) return '-';
        return new Date(dataIso).toLocaleDateString('pt-BR') + ' ' + new Date(dataIso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    },

    mostrarAlerta: (msg) => {
        const el = document.getElementById('textoAlerta');
        if (el) {
            el.innerText = msg;
            const modalEl = document.getElementById('modalAlerta');
            let modal = bootstrap.Modal.getInstance(modalEl);
            if (!modal) modal = new bootstrap.Modal(modalEl);
            modal.show();
        } else {
            alert(msg);
        }
    },

    carregarTodasLpus: async () => {
        if (AprovacoesComplementares.listaCompletaLpus) return AprovacoesComplementares.listaCompletaLpus;
        try {
            const response = await fetch(`${API_BASE_URL}/contrato`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const contratos = await response.json();
            let lpus = [];
            contratos.forEach(c => {
                if (c.lpus) c.lpus.forEach(l => {
                    if (l.ativo) lpus.push({
                        id: l.id,
                        nome: `${c.nome} | ${l.codigoLpu} - ${l.nomeLpu}`,
                        valor: l.valorSemImposto || l.valor || 0
                    });
                });
            });
            lpus.sort((a, b) => a.nome.localeCompare(b.nome));
            AprovacoesComplementares.listaCompletaLpus = lpus;
            return lpus;
        } catch (error) { return []; }
    },

    fetchDetalhesOsESalvar: async (osId) => {
        if (AprovacoesComplementares.mapaDetalhesOs[osId]) return AprovacoesComplementares.mapaDetalhesOs[osId];
        try {
            // Tenta buscar no cache global primeiro se existir para evitar chamadas ao monólito
            if (window.todosOsLancamentosGlobais) {
                const global = window.todosOsLancamentosGlobais.find(l => l.osId == osId || l.os?.id == osId);
                if (global && global.os) {
                    const info = { osCodigo: global.os.os || global.os.numero || `OS #${osId}`, projeto: global.os.projeto || '-', site: '-', loaded: true };
                    AprovacoesComplementares.mapaDetalhesOs[osId] = info;
                    AprovacoesComplementares.atualizarLinhasTabela(osId, info);
                    return info;
                }
            }

            const res = await fetch(`${API_BASE_URL}/os/${osId}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (res.ok) {
                const dados = await res.json();
                let site = dados.site || '-';
                let projeto = dados.projeto || '-';
                // --- NOVO: Captura o segmento vindo do DTO da OS ---
                let segmento = (dados.segmento && dados.segmento.nome) ? dados.segmento.nome : '-';

                if ((site === '-' || projeto === '-') && dados.detalhes && dados.detalhes.length > 0) {
                    const det = dados.detalhes[0];
                    if (site === '-') site = det.site || '-';
                    if (projeto === '-') projeto = det.regional || '-';
                }

                // Adicionei a propriedade 'segmento' no objeto info
                const info = { osCodigo: dados.os, projeto: projeto, site: site, segmento: segmento, loaded: true };
                AprovacoesComplementares.mapaDetalhesOs[osId] = info;
                AprovacoesComplementares.atualizarLinhasTabela(osId, info);
                return info;
            }
        } catch (e) { console.error("Erro fetch OS:", e); }
        return { osCodigo: 'OS #' + osId, projeto: '-', site: '-', loaded: false };
    },

    atualizarLinhasTabela: (osId, info) => {
        const spansSite = document.querySelectorAll(`.site-placeholder-${osId}`);
        const spansProjeto = document.querySelectorAll(`.projeto-placeholder-${osId}`);
        const spansOs = document.querySelectorAll(`.os-placeholder-${osId}`);
        // --- NOVO: Seleciona os spans de segmento ---
        const spansSegmento = document.querySelectorAll(`.segmento-placeholder-${osId}`);

        spansSite.forEach(el => { el.innerText = info.site; el.classList.remove('loading-text'); });
        spansProjeto.forEach(el => { el.innerText = info.projeto; el.classList.remove('loading-text'); });

        // --- NOVO: Atualiza o texto do segmento ---
        spansSegmento.forEach(el => {
            el.innerText = info.segmento || '-';
            el.classList.remove('loading-text');
        });

        spansOs.forEach(el => { el.innerText = info.osCodigo; el.classList.remove('fw-light'); el.classList.add('fw-bold'); });
    },

    // =========================================================================
    // LÓGICA DE HISTÓRICO (CORRIGIDA)
    // =========================================================================
    carregarDadosHistoricoComplementares: async () => {
        AprovacoesComplementares.init();
        const tbody = document.getElementById('tbodyHistoricoComplementares');
        const contador = document.getElementById('contadorHistComp');

        if (!tbody) return;

        tbody.innerHTML = '<tr><td colspan="10" class="text-center py-5"><div class="spinner-border text-primary" role="status"></div><p class="mt-2 text-muted">Carregando histórico...</p></td></tr>';
        if (contador) contador.innerText = 'Carregando...';

        try {
            await AprovacoesComplementares.carregarTodasLpus();

            const userRole = localStorage.getItem('role') || '';
            const userId = localStorage.getItem('usuarioId');

            // CORREÇÃO: Parâmetros enviados via HEADERS, não na URL
            const headersExtras = {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'X-User-Role': userRole,
                'X-User-Id': userId
            };

            const url = `${AprovacoesComplementares.MS_URL}/historico`;

            // Tenta fetch principal
            let lista = [];
            try {
                const response = await fetch(url, { headers: headersExtras });
                if (response.ok) {
                    lista = await response.json();
                } else {
                    throw new Error(`Status ${response.status}`);
                }
            } catch (errMain) {
                console.warn("Falha no endpoint principal de histórico, tentando fallback...", errMain);
                // Fallback para endpoint específico do usuário se o geral falhar
                const fallbackUrl = `${AprovacoesComplementares.MS_URL}/usuario/${userId}`;
                const responseFallback = await fetch(fallbackUrl, { headers: headersExtras });
                if (responseFallback.ok) {
                    lista = await responseFallback.json();
                } else {
                    throw new Error("Não foi possível carregar o histórico.");
                }
            }

            tbody.innerHTML = '';

            if (!lista || lista.length === 0) {
                tbody.innerHTML = '<tr><td colspan="10" class="text-center text-muted py-5"><i class="bi bi-inbox fs-1 opacity-25"></i><br>Nenhum registro encontrado.</td></tr>';
                if (contador) contador.innerText = '0 registros';
                return;
            }

            if (contador) contador.innerText = `${lista.length} registros`;

            // Ordenar por data (mais recente primeiro)
            lista.sort((a, b) => new Date(b.dataSolicitacao || b.dataCriacao) - new Date(a.dataSolicitacao || a.dataCriacao));

            lista.forEach(item => {
                const tr = document.createElement('tr');
                tr.className = 'historico-row';
                tr.setAttribute('data-search', `${item.osId} ${item.id} ${item.justificativa} ${item.status}`.toLowerCase());
                tr.setAttribute('data-status', item.status);

                // Busca info da OS (Cache ou ID temporário)
                const cacheOs = AprovacoesComplementares.mapaDetalhesOs[item.osId];
                const nomeOs = cacheOs ? cacheOs.osCodigo : `OS #${item.osId}`;
                const segmentoDisplay = cacheOs ? cacheOs.segmento : 'Carregando...';
                const classOsLoading = cacheOs ? '' : 'loading-text';

                // Info da LPU
                const lpu = AprovacoesComplementares.listaCompletaLpus.find(l => l.id === item.lpuOriginalId);
                const nomeLpu = lpu ? lpu.nome.split('|')[1] || lpu.nome : `LPU ${item.lpuOriginalId}`;

                // Valores
                let valor = item.valorTotalAprovado || item.valorTotalEstimado;
                if (!valor) valor = (lpu ? lpu.valor : 0) * (item.quantidadeAprovada || item.quantidadeOriginal);

                // Status Badge
                let badgeClass = 'badge-status-pendente';
                let iconeStatus = '<i class="bi bi-hourglass-split me-1"></i>';
                if (item.status === 'APROVADO' || item.status === 'CONCLUIDO') {
                    badgeClass = 'badge-status-aprovado';
                    iconeStatus = '<i class="bi bi-check-circle-fill me-1"></i>';
                }
                else if (item.status === 'REJEITADO' || item.status === 'CANCELADO' || item.status === 'DEVOLVIDO') {
                    badgeClass = 'badge-status-rejeitado';
                    iconeStatus = '<i class="bi bi-x-circle-fill me-1"></i>';
                }

                const dataSol = AprovacoesComplementares.formatarData(item.dataSolicitacao || item.dataCriacao);
                const dataAna = item.dataAnalise ? AprovacoesComplementares.formatarData(item.dataAnalise) : '-';

                tr.innerHTML = `
                    <td class="fw-bold text-muted small">#${item.id}</td>
                    <td><span class="os-placeholder-${item.osId} ${classOsLoading} fw-bold text-dark">${nomeOs}</span></td>
                    
                    <td><small class="segmento-placeholder-${item.osId} ${classOsLoading}">${segmentoDisplay}</small></td>
                    
                    <td><small class="text-secondary text-truncate d-inline-block" style="max-width: 200px;" title="${nomeLpu}">${nomeLpu}</small></td>
                    <td class="text-center">${item.quantidadeAprovada || item.quantidadeOriginal}</td>
                    <td class="text-end font-monospace text-dark small">${AprovacoesComplementares.formatarMoeda(valor)}</td>
                    <td><small class="d-inline-block text-truncate" style="max-width: 150px;" title="${item.justificativa}">${item.justificativa || '-'}</small></td>
                    <td class="small text-muted">${dataSol}</td>
                    <td class="text-center"><span class="badge ${badgeClass} text-uppercase rounded-pill border-0">${iconeStatus} ${item.status}</span></td>
                    <td class="small text-muted">${dataAna}</td>
                    <td><small class="text-danger d-inline-block text-truncate" style="max-width: 150px;" title="${item.motivoRecusa || ''}">${item.motivoRecusa || '-'}</small></td>
                `;
                tbody.appendChild(tr);
            });

            // Dispara busca assíncrona das OS que faltam
            const osIdsFaltantes = [...new Set(lista.map(i => i.osId))].filter(id => !AprovacoesComplementares.mapaDetalhesOs[id]);
            osIdsFaltantes.forEach(id => AprovacoesComplementares.fetchDetalhesOsESalvar(id));

        } catch (e) {
            console.error(e);
            tbody.innerHTML = `<tr><td colspan="10" class="text-center text-danger py-4"><i class="bi bi-exclamation-triangle"></i> Erro ao carregar: ${e.message}</td></tr>`;
        }
    },

    filtrarHistoricoNaTela: () => {
        const termo = document.getElementById('buscaHistComp').value.toLowerCase();
        const status = document.getElementById('filtroStatusHistComp').value;
        const linhas = document.querySelectorAll('#tbodyHistoricoComplementares .historico-row');
        let visiveis = 0;

        linhas.forEach(tr => {
            const texto = tr.getAttribute('data-search');
            const rowStatus = tr.getAttribute('data-status');

            const matchTermo = termo === '' || texto.includes(termo);
            const matchStatus = status === '' || rowStatus === status;

            if (matchTermo && matchStatus) {
                tr.style.display = '';
                visiveis++;
            } else {
                tr.style.display = 'none';
            }
        });

        const contador = document.getElementById('contadorHistComp');
        if (contador) contador.innerText = `${visiveis} registros visíveis`;
    },

    // =========================================================================
    // LÓGICA DE PENDÊNCIAS (MANTIDA)
    // =========================================================================

    carregarPendencias: async () => {
        AprovacoesComplementares.init();
        const tbody = document.getElementById('tbodyAprovacoesComplementares');
        const loader = document.getElementById('loader-complementares');
        if (!tbody) return;

        loader.classList.remove('d-none');
        tbody.innerHTML = '';

        try {
            await AprovacoesComplementares.carregarTodasLpus();

            const userRole = localStorage.getItem('role') || 'COORDINATOR';
            const userId = localStorage.getItem('usuarioId'); // PEGANDO O ID DO USUÁRIO

            // --- CORREÇÃO: Enviando X-User-Id e X-User-Role nos headers ---
            const response = await fetch(`${AprovacoesComplementares.MS_URL}/pendentes`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'X-User-Role': userRole,
                    'X-User-Id': userId  // OBRIGATÓRIO PARA O FILTRO DE SEGMENTO
                }
            });

            if (!response.ok) throw new Error("Erro ao buscar pendências");
            const lista = await response.json();

            AprovacoesComplementares.atualizarBadge(lista.length);
            AprovacoesComplementares.renderizarTabelaPrincipal(lista);

            const osIds = [...new Set(lista.map(item => item.osId))];
            osIds.forEach(id => AprovacoesComplementares.fetchDetalhesOsESalvar(id));

        } catch (error) {
            tbody.innerHTML = `<tr><td colspan="8" class="text-center text-danger py-4">Erro: ${error.message}</td></tr>`;
        } finally {
            loader.classList.add('d-none');
        }
    },

    atualizarBadge: (qtd) => {
        const badge = document.getElementById('badge-count-complementares') || document.querySelector('#nav-complementares .badge');
        if (badge) {
            badge.innerText = qtd;
            badge.classList.toggle('d-none', qtd === 0);
        }
    },

    renderizarTabelaPrincipal: (lista) => {
        const tbody = document.getElementById('tbodyAprovacoesComplementares');
        const msgVazio = document.getElementById('msg-sem-complementares');
        tbody.innerHTML = '';

        if (!lista || lista.length === 0) {
            if (msgVazio) { msgVazio.classList.remove('d-none'); msgVazio.classList.add('d-block'); }
            return;
        }
        if (msgVazio) { msgVazio.classList.add('d-none'); msgVazio.classList.remove('d-block'); }

        lista.forEach(item => {
            const tr = document.createElement('tr');

            const cache = AprovacoesComplementares.mapaDetalhesOs[item.osId];
            const osDisplay = cache ? cache.osCodigo : `OS #${item.osId}`;
            const siteDisplay = cache ? cache.site : 'Carregando...';
            const projetoDisplay = cache ? cache.projeto : 'Carregando...';
            const segmentoDisplay = cache ? cache.segmento : 'Carregando...';
            const loadingClass = cache ? '' : 'loading-text';

            const lpuInfo = AprovacoesComplementares.listaCompletaLpus.find(l => l.id === item.lpuOriginalId);
            const nomeLpu = lpuInfo ? lpuInfo.nome.split('|')[1] || lpuInfo.nome : `LPU ID: ${item.lpuOriginalId}`;

            let valorTotal = item.valorTotalEstimado;
            if (!valorTotal || valorTotal === 0) {
                const valorUnit = lpuInfo ? lpuInfo.valor : 0;
                valorTotal = valorUnit * item.quantidadeOriginal;
            }

            // --- Lógica de Cores e Ícones dos Status ---
            let badgeClass = 'badge bg-warning-subtle text-warning-emphasis border border-warning-subtle'; // Padrão (Pendente Coord)
            let iconeStatus = '<i class="bi bi-hourglass-split me-1"></i>';
            let statusTexto = item.status;

            if (item.status === 'APROVADO') {
                badgeClass = 'badge bg-success-subtle text-success border border-success-subtle';
                iconeStatus = '<i class="bi bi-check-circle-fill me-1"></i>';
            } else if (item.status === 'DEVOLVIDO_CONTROLLER') {
                badgeClass = 'badge bg-danger-subtle text-danger border border-danger-subtle';
                iconeStatus = '<i class="bi bi-arrow-return-left me-1"></i>';
                statusTexto = 'DEVOLVIDO';
            } else if (item.status === 'PENDENTE_CONTROLLER') {
                badgeClass = 'badge bg-info-subtle text-info-emphasis border border-info-subtle';
                iconeStatus = '<i class="bi bi-person-gear me-1"></i>';
                statusTexto = 'EM ANÁLISE';
            }

            // Define botão de ação
            const isController = item.status === 'PENDENTE_CONTROLLER';
            const btnClass = isController ? 'btn-success' : 'btn-outline-success';
            const btnIcon = isController ? 'bi-check-lg' : 'bi-pencil-square';
            const btnTitle = isController ? 'Aprovar Solicitação' : 'Analisar / Corrigir';

            // CORREÇÃO AQUI: Adicionado '${item.status}' no onclick do botão de rejeição (último botão)
            tr.innerHTML = `
            <td><span class="os-placeholder-${item.osId} text-dark fw-bold">${osDisplay}</span></td>
            <td><small class="segmento-placeholder-${item.osId} ${loadingClass}">${segmentoDisplay}</small></td>
            <td><small class="site-placeholder-${item.osId} ${loadingClass}">${siteDisplay}</small></td>
            <td><small class="projeto-placeholder-${item.osId} ${loadingClass}">${projetoDisplay}</small></td>
            <td><small class="text-truncate d-inline-block" style="max-width: 250px;" title="${nomeLpu}">${nomeLpu}</small></td>
            <td class="text-center"><span class="badge bg-light text-dark border">${item.quantidadeOriginal}</span></td>
            <td class="text-end fw-bold text-success">${AprovacoesComplementares.formatarMoeda(valorTotal)}</td>
            <td class="text-center"><span class="${badgeClass}">${iconeStatus} ${statusTexto}</span></td>
            <td class="text-center">
                <button class="btn btn-sm ${btnClass}" onclick="AprovacoesComplementares.abrirModalAnalise('${item.id}')" title="${btnTitle}"><i class="bi ${btnIcon}"></i></button>
                <button class="btn btn-sm btn-outline-danger" onclick="AprovacoesComplementares.prepararRejeicaoInicial('${item.id}', '${item.status}')" title="Rejeitar"><i class="bi bi-x-lg"></i></button>
            </td>
        `;
            tbody.appendChild(tr);
        });
    },

    abrirModalAnalise: async (id) => {
        try {
            // Feedback de carregamento no botão
            const btn = document.activeElement;
            const originalIcon = btn ? btn.innerHTML : '';
            if (btn && btn.tagName === 'BUTTON') {
                btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>';
                btn.disabled = true;
            }

            AprovacoesComplementares.alteracoesBuffer = {};

            // 1. Buscas de Dados
            const respSol = await fetch(`${AprovacoesComplementares.MS_URL}/${id}`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
            const solicitacao = await respSol.json();
            AprovacoesComplementares.currentSolicitacao = solicitacao;

            // Carrega Buffer de alterações anteriores
            if (solicitacao.alteracoesPropostasJson) {
                try {
                    const propostas = JSON.parse(solicitacao.alteracoesPropostasJson);
                    propostas.forEach(p => {
                        AprovacoesComplementares.alteracoesBuffer[p.itemId] = { novaQtd: p.novaQtd, novaLpuId: p.novaLpuId, novoBoq: p.novoBoq, novoStatus: p.novoStatus };
                    });
                } catch (errJson) { }
            }

            const respOs = await fetch(`${API_BASE_URL}/os/${solicitacao.osId}`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
            const osCompleta = respOs.ok ? await respOs.json() : null;
            AprovacoesComplementares.currentOsCompleta = osCompleta;

            // Restaura botão
            if (btn && btn.tagName === 'BUTTON') {
                btn.innerHTML = originalIcon;
                btn.disabled = false;
            }

            // 2. Prepara Layout Moderno (Injeção de HTML)
            const modalBody = document.querySelector('#modalAnaliseCoordenador .modal-body');

            modalBody.innerHTML = `
                <div id="container-alerta-controller" class="mb-3"></div>
                
                <div class="card border-0 shadow-sm bg-light mb-4">
                    <div class="card-body p-3">
                        <div id="osDetailsContainer" class="row g-3 align-items-center"></div>
                    </div>
                </div>

                <div class="d-flex align-items-center mb-2">
                    <div class="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center me-2" style="width: 24px; height: 24px;">
                        <span class="small fw-bold">1</span>
                    </div>
                    <h6 class="fw-bold text-dark mb-0">Itens Existentes na OS</h6>
                    <small class="text-muted ms-2">(Analise e proponha alterações se necessário)</small>
                </div>

                <div class="card border border-light shadow-sm mb-4 overflow-hidden">
                    <div class="table-responsive" style="max-height: 250px;">
                        <table class="table table-hover table-sm mb-0 align-middle small">
                            <thead class="table-light sticky-top">
                                <tr>
                                    <th class="ps-3">Cód. LPU</th>
                                    <th>Descrição LPU</th>
                                    <th class="text-center">Qtd.</th>
                                    <th class="text-end">Vlr. Unit.</th>
                                    <th class="text-end">Total</th>
                                    <th class="text-center">Status</th>
                                    <th class="text-center pe-3">Ações</th>
                                </tr>
                            </thead>
                            <tbody id="tbodyItensExistentes" class="bg-white"></tbody>
                        </table>
                    </div>
                </div>

                <div class="d-flex align-items-center mb-2">
                    <div class="bg-success text-white rounded-circle d-flex align-items-center justify-content-center me-2" style="width: 24px; height: 24px;">
                        <span class="small fw-bold">2</span>
                    </div>
                    <h6 class="fw-bold text-dark mb-0">Decisão / Proposta do Novo Item</h6>
                </div>

                <div class="card border-0 shadow-sm">
                    <div class="card-header bg-white py-3 border-bottom-0">
                        <div class="row g-2">
                             <div class="col-12 mb-2">
                                <div class="p-2 rounded bg-light border d-flex align-items-center gap-3">
                                    <i class="bi bi-info-circle text-primary fs-5"></i>
                                    <div class="flex-grow-1 border-end pe-3">
                                        <label class="d-block text-muted" style="font-size: 0.7rem; margin-bottom: -2px;">SOLICITADO PELO GESTOR</label>
                                        <span class="fw-bold text-dark" id="viewLpuOriginalText">Carregando...</span>
                                    </div>
                                    <div class="text-center border-end pe-3" style="min-width: 80px;">
                                        <label class="d-block text-muted" style="font-size: 0.7rem; margin-bottom: -2px;">QTD</label>
                                        <span class="fw-bold text-dark" id="viewQtdOriginalText">-</span>
                                    </div>
                                     <div class="flex-grow-1">
                                        <label class="d-block text-muted" style="font-size: 0.7rem; margin-bottom: -2px;">JUSTIFICATIVA</label>
                                        <span class="fst-italic text-secondary small" id="viewJustificativaManagerText">-</span>
                                    </div>
                                </div>
                                <input type="hidden" id="viewLpuOriginal">
                                <input type="hidden" id="viewQtdOriginal">
                                <input type="hidden" id="viewJustificativaManager">
                            </div>
                        </div>
                    </div>

                    <div class="card-body pt-0 pb-4">
                        <div class="row g-3">
                            <input type="hidden" id="analiseSolicitacaoId">
                            
                            <div class="col-md-7">
                                <label class="form-label fw-bold small text-secondary">LPU Aprovada / Proposta <span class="text-danger">*</span></label>
                                <select class="form-select form-select-sm" id="editLpuSelect"></select>
                            </div>

                            <div class="col-md-2">
                                <label class="form-label fw-bold small text-secondary">Qtd. <span class="text-danger">*</span></label>
                                <input type="number" class="form-control form-control-sm text-center fw-bold" id="editQuantidade">
                            </div>

                             <div class="col-md-3">
                                <label class="form-label fw-bold small text-secondary">Valor deste Item</label>
                                <div class="input-group input-group-sm">
                                    <span class="input-group-text bg-success text-white border-0">R$</span>
                                    <input type="text" class="form-control bg-white fw-bold text-success border-success" id="displayValorItemProposto" disabled value="0,00">
                                </div>
                            </div>
                            
                            <div class="col-md-3">
                                <label class="form-label small text-muted">BOQ</label>
                                <input type="text" class="form-control form-control-sm" id="editBoq" placeholder="Opcional">
                            </div>
                            
                            <div class="col-md-3">
                                <label class="form-label small text-muted">Status Registro</label>
                                <select class="form-select form-select-sm" id="editStatusRegistro">
                                    <option value="ATIVO">ATIVO</option>
                                    <option value="INATIVO">INATIVO (Cancelado)</option>
                                </select>
                            </div>
                            
                            <div class="col-md-6">
                                <label class="form-label small text-muted">Justificativa da Decisão</label>
                                <input type="text" class="form-control form-control-sm" id="editJustificativaCoordenador" placeholder="Escreva se houver alteração...">
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // 3. Injeta Alerta de Devolução
            if (solicitacao.status === 'DEVOLVIDO_CONTROLLER' || solicitacao.justificativaController) {
                const divAlerta = document.getElementById('container-alerta-controller');
                if (divAlerta) {
                    divAlerta.innerHTML = `
                        <div class="alert alert-danger border-0 border-start border-4 border-danger shadow-sm d-flex align-items-start p-3" role="alert">
                            <div class="me-3">
                                 <div class="bg-danger text-white rounded-circle d-flex align-items-center justify-content-center" style="width: 32px; height: 32px;">
                                    <i class="bi bi-arrow-return-left"></i>
                                 </div>
                            </div>
                            <div>
                                <h6 class="alert-heading fw-bold mb-1">Atenção: Devolvido pelo Controller</h6>
                                <p class="mb-0 small text-danger-emphasis">
                                    "${solicitacao.justificativaController || 'Motivo não especificado.'}"
                                </p>
                            </div>
                        </div>
                    `;
                }
            }

            // 4. Preenche Dados Iniciais
            const isController = solicitacao.status === 'PENDENTE_CONTROLLER';

            // Dados ReadOnly
            const lpuSolicitada = AprovacoesComplementares.listaCompletaLpus.find(l => l.id === solicitacao.lpuOriginalId);
            const nomeLpuOrig = lpuSolicitada ? lpuSolicitada.nome : `ID: ${solicitacao.lpuOriginalId}`;

            document.getElementById('viewLpuOriginalText').innerText = nomeLpuOrig.length > 50 ? nomeLpuOrig.substring(0, 50) + '...' : nomeLpuOrig;
            document.getElementById('viewLpuOriginalText').title = nomeLpuOrig;
            document.getElementById('viewQtdOriginalText').innerText = solicitacao.quantidadeOriginal;
            document.getElementById('viewJustificativaManagerText').innerText = solicitacao.justificativa || "Nenhuma justificativa informada.";

            document.getElementById('viewLpuOriginal').value = nomeLpuOrig;
            document.getElementById('viewQtdOriginal').value = solicitacao.quantidadeOriginal;
            document.getElementById('viewJustificativaManager').value = solicitacao.justificativa || '';
            document.getElementById('analiseSolicitacaoId').value = solicitacao.id;

            // Dados Editáveis (Decisão)
            const qtd = isController ? solicitacao.quantidadeAprovada : (solicitacao.quantidadeAprovada || solicitacao.quantidadeOriginal);
            const boq = isController ? solicitacao.boqAprovado : (solicitacao.boqAprovado || '');
            const status = isController ? solicitacao.statusRegistroAprovado : (solicitacao.statusRegistroAprovado || 'ATIVO');
            const just = solicitacao.justificativaCoordenador || '';

            document.getElementById('editQuantidade').value = qtd;
            document.getElementById('editBoq').value = boq;
            document.getElementById('editStatusRegistro').value = status;
            document.getElementById('editJustificativaCoordenador').value = just;

            // Bloqueia campos se for Controller
            ['editQuantidade', 'editBoq', 'editStatusRegistro', 'editJustificativaCoordenador'].forEach(fid => {
                const el = document.getElementById(fid);
                if (el) el.disabled = isController;
            });

            // Configura Select LPU (Choices)
            const lpuSelect = document.getElementById('editLpuSelect');
            let htmlLpu = '<option value="">Selecione...</option>';
            const selectedId = isController ? solicitacao.lpuAprovadaId : (solicitacao.lpuAprovadaId || solicitacao.lpuOriginalId);

            AprovacoesComplementares.listaCompletaLpus.forEach(l => {
                htmlLpu += `<option value="${l.id}" ${l.id == selectedId ? 'selected' : ''}>${l.nome}</option>`;
            });
            lpuSelect.innerHTML = htmlLpu;

            if (AprovacoesComplementares.choicesMain) AprovacoesComplementares.choicesMain.destroy();
            AprovacoesComplementares.choicesMain = new Choices(lpuSelect, { searchEnabled: true, itemSelectText: '', shouldSort: false });
            if (isController) AprovacoesComplementares.choicesMain.disable();

            // 5. Configura Listeners
            const updateValores = () => AprovacoesComplementares.recalcularTotaisTela();
            document.getElementById('editQuantidade').addEventListener('input', updateValores);
            lpuSelect.addEventListener('change', updateValores);
            document.getElementById('editStatusRegistro').addEventListener('change', updateValores);

            // 6. Renderiza Widgets
            if (osCompleta) {
                AprovacoesComplementares.renderizarItensExistentesComBuffer(isController);
                AprovacoesComplementares.recalcularTotaisTela();
            }

            // 7. Configura Botões do Modal
            const footerModal = document.querySelector('#modalAnaliseCoordenador .modal-footer');
            const btnSalvar = footerModal ? (footerModal.querySelector('.btn-success') || footerModal.querySelector('.btn-primary')) : null;

            if (btnSalvar) {
                const novoBtn = btnSalvar.cloneNode(true);
                btnSalvar.parentNode.replaceChild(novoBtn, btnSalvar);

                if (isController) {
                    novoBtn.innerHTML = '<i class="bi bi-check-circle-fill me-2"></i>Aprovar Definitivamente';
                    novoBtn.className = 'btn btn-success fw-bold px-4';
                } else {
                    novoBtn.innerHTML = '<i class="bi bi-send-fill me-2"></i>Enviar Proposta';
                    novoBtn.className = 'btn btn-primary fw-bold px-4';
                }
                novoBtn.onclick = AprovacoesComplementares.salvarAprovacao;
            }

            // Abre Modal
            const modalEl = document.getElementById('modalAnaliseCoordenador');
            let modalInstance = bootstrap.Modal.getInstance(modalEl);
            if (!modalInstance) { modalInstance = new bootstrap.Modal(modalEl); }
            modalInstance.show();

        } catch (e) {
            console.error(e);
            alert('Erro ao abrir modal: ' + e.message);
        }
    },

    recalcularTotaisTela: () => {
        // 1. Calcula Valor do Item Proposto
        const lpuId = document.getElementById('editLpuSelect').value;
        const qtdInput = document.getElementById('editQuantidade').value;
        const qtd = qtdInput ? parseFloat(qtdInput) : 0;

        let valorItemProposto = 0;
        const lpu = AprovacoesComplementares.listaCompletaLpus.find(l => l.id == lpuId);
        if (lpu) {
            valorItemProposto = (lpu.valor || 0) * qtd;
        }

        const elDisplay = document.getElementById('displayValorItemProposto');
        if (elDisplay) {
            elDisplay.value = AprovacoesComplementares.formatarMoeda(valorItemProposto).replace('R$', '').trim();
        }

        // 2. Calcula Valor Total da OS (Atual e Projetado)
        let valorAtualOS = 0;
        let valorProjetadoOS = 0;

        if (AprovacoesComplementares.currentOsCompleta && AprovacoesComplementares.currentOsCompleta.detalhes) {

            // Itera itens existentes na OS
            AprovacoesComplementares.currentOsCompleta.detalhes.forEach(item => {
                const buffer = AprovacoesComplementares.alteracoesBuffer[item.id];

                // Valor Original (Atual)
                const valorOriginalItem = item.valorTotal || 0;
                valorAtualOS += valorOriginalItem;

                // Valor Projetado (Considerando edições no buffer)
                if (buffer) {
                    const statusFinal = buffer.novoStatus || (item.statusRegistro || 'ATIVO');
                    if (statusFinal === 'ATIVO') {
                        let lpuItem = item.lpu;
                        if (buffer.novaLpuId) {
                            lpuItem = AprovacoesComplementares.listaCompletaLpus.find(l => l.id == buffer.novaLpuId);
                        }

                        const qtdFinal = buffer.novaQtd !== undefined ? buffer.novaQtd : item.quantidade;
                        const precoUnit = lpuItem ? (lpuItem.valorSemImposto || lpuItem.valor || 0) : 0;

                        valorProjetadoOS += (qtdFinal * precoUnit);
                    }
                    // Se estiver INATIVO, não soma ao projetado
                } else {
                    // Sem alteração, soma o valor original ao projetado (se ativo)
                    if ((item.statusRegistro || 'ATIVO') === 'ATIVO') {
                        valorProjetadoOS += valorOriginalItem;
                    }
                }
            });
        }

        // Soma o Novo Item ao Projetado (se o status proposto for ATIVO)
        const statusNovoItem = document.getElementById('editStatusRegistro').value;
        if (statusNovoItem === 'ATIVO') {
            valorProjetadoOS += valorItemProposto;
        }

        // 3. Atualiza Widgets no Topo
        AprovacoesComplementares.renderizarDetalhesOs(valorAtualOS, valorProjetadoOS);
    },

    renderizarDetalhesOs: (valorAtual = 0, valorProjetado = 0) => {
        const os = AprovacoesComplementares.currentOsCompleta;
        if (!os) return;

        let regional = os.regional;
        let site = os.site;
        if (os.detalhes && os.detalhes.length > 0) {
            if (!regional || regional === 'null') regional = os.detalhes[0].regional;
            if (!site || site === 'null') site = os.detalhes[0].site;
        }

        const fmtAtual = AprovacoesComplementares.formatarMoeda(valorAtual);
        const fmtProj = AprovacoesComplementares.formatarMoeda(valorProjetado);

        // Lógica de cores: Verde se o custo baixar ou mantiver, Laranja se aumentar
        const isAumento = valorProjetado > valorAtual;
        const corProj = isAumento ? 'text-warning-emphasis' : 'text-success';
        const bgProj = isAumento ? 'bg-warning-subtle' : 'bg-success-subtle';
        const iconeProj = isAumento ? 'bi-graph-up-arrow' : 'bi-check-lg';

        const html = `
            <div class="col-md-5 border-end">
                <div class="d-flex justify-content-between mb-2">
                    <div>
                        <small class="text-muted d-block text-uppercase" style="font-size: 0.7rem;">Código OS</small>
                        <span class="fw-bold text-dark">${os.os || '-'}</span>
                    </div>
                     <div class="text-end px-3">
                        <small class="text-muted d-block text-uppercase" style="font-size: 0.7rem;">Regional</small>
                        <span class="fw-bold text-dark">${regional || '-'}</span>
                    </div>
                </div>
                 <div>
                    <small class="text-muted d-block text-uppercase" style="font-size: 0.7rem;">Site / Local</small>
                    <span class="text-dark d-block text-truncate" title="${site}">${site || '-'}</span>
                </div>
            </div>

            <div class="col-md-7 ps-4">
                <div class="row g-2">
                    <div class="col-6">
                        <div class="p-2 rounded border bg-white">
                            <small class="text-secondary d-block fw-bold text-uppercase mb-1" style="font-size: 0.65rem;">Total Atual</small>
                            <span class="fw-bold text-secondary d-block fs-5">${fmtAtual}</span>
                        </div>
                    </div>
                     <div class="col-6">
                        <div class="p-2 rounded border ${bgProj}">
                            <small class="${corProj} d-block fw-bold text-uppercase mb-1" style="font-size: 0.65rem;">Projeção Final</small>
                            <div class="d-flex align-items-center">
                                <span class="fw-bold ${corProj} fs-5 me-2">${fmtProj}</span>
                                <i class="bi ${iconeProj} ${corProj}"></i>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('osDetailsContainer').innerHTML = html;
    },

    renderizarItensExistentesComBuffer: (isController = false) => {
        const itens = AprovacoesComplementares.currentOsCompleta.detalhes || [];
        const tbody = document.getElementById('tbodyItensExistentes');
        tbody.innerHTML = '';

        if (itens.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-3 small">Nenhum item vinculado a esta OS.</td></tr>';
            return;
        }

        itens.forEach(item => {
            const tr = document.createElement('tr');
            const alteracao = AprovacoesComplementares.alteracoesBuffer[item.id];

            // --- CORREÇÃO DO VALOR UNITÁRIO ---
            // Tenta pegar de todas as propriedades possíveis que o Java possa estar a enviar
            let rawValor = 0;
            if (item.lpu) {
                if (item.lpu.valor !== undefined && item.lpu.valor !== null) rawValor = item.lpu.valor;
                else if (item.lpu.valorSemImposto !== undefined && item.lpu.valorSemImposto !== null) rawValor = item.lpu.valorSemImposto;
            }
            // Se ainda for zero, tenta calcular pelo total/quantidade (fallback)
            if (rawValor === 0 && item.valorTotal && item.quantidade) {
                rawValor = item.valorTotal / item.quantidade;
            }

            const statusOriginal = item.statusRegistro || 'ATIVO';
            const qtdOriginal = item.quantidade;
            const lpuNomeOriginal = item.lpu ? (item.lpu.nomeLpu || item.lpu.nome || '-') : '-';

            const statusFinal = alteracao && alteracao.novoStatus ? alteracao.novoStatus : statusOriginal;
            const qtdFinal = alteracao && alteracao.novaQtd ? alteracao.novaQtd : qtdOriginal;
            const lpuAlterada = alteracao && alteracao.novaLpuId && alteracao.novaLpuId != (item.lpu?.id);

            if (alteracao) tr.classList.add('item-modificado');
            if (statusFinal === 'INATIVO') tr.classList.add('text-muted', 'bg-light');

            // Formatação Visual das Células
            const htmlQtd = (alteracao && alteracao.novaQtd != qtdOriginal)
                ? `<span class="valor-antigo me-1">${qtdOriginal}</span><span class="valor-novo">${qtdFinal}</span>`
                : qtdOriginal;

            const htmlStatus = (alteracao && alteracao.novoStatus != statusOriginal)
                ? `<span class="badge bg-secondary text-decoration-line-through me-1" style="font-size:0.65rem">${statusOriginal}</span><span class="badge ${statusFinal === 'ATIVO' ? 'bg-success' : 'bg-danger'}" style="font-size:0.65rem">${statusFinal} (Prop.)</span>`
                : `<span class="badge ${statusOriginal === 'ATIVO' ? 'bg-success-subtle text-success border border-success' : 'bg-secondary-subtle text-secondary'} rounded-pill" style="font-size:0.65rem">${statusOriginal}</span>`;

            let htmlLpu = `<span class="d-inline-block text-truncate" style="max-width:180px;" title="${lpuNomeOriginal}">${lpuNomeOriginal}</span>`;
            if (lpuAlterada) {
                const novaLpu = AprovacoesComplementares.listaCompletaLpus.find(l => l.id == alteracao.novaLpuId);
                const novoNome = novaLpu ? novaLpu.nome.split('|')[1] || novaLpu.nome : '(Trocado)';
                htmlLpu = `<div class="d-flex flex-column"><span class="text-decoration-line-through text-muted small" style="font-size:0.7em">${lpuNomeOriginal}</span><span class="valor-novo small text-truncate" style="max-width:180px;" title="${novoNome}"><i class="bi bi-arrow-return-right me-1"></i>${novoNome}</span></div>`;
            }

            // --- CORREÇÃO DOS BOTÕES (Conflito de ID/Submit) ---
            const btnIcon = statusFinal === 'ATIVO' ? 'bi-slash-circle' : 'bi-arrow-counterclockwise';
            const btnClass = statusFinal === 'ATIVO' ? 'btn-outline-danger' : 'btn-outline-success'; // Mudei para outline para não confundir com o botão principal
            const btnTitle = statusFinal === 'ATIVO' ? 'Propor Inativação' : 'Restaurar / Ativar';

            const acoesHtml = isController ?
                `<span class="text-muted small"><i class="bi bi-lock-fill"></i></span>` :
                `<div class="btn-group btn-group-sm">
                    <button type="button" class="btn btn-outline-primary" onclick="AprovacoesComplementares.abrirModalEdicaoItem(${item.id})" title="Editar Item"><i class="bi bi-pencil-square"></i></button>
                    <button type="button" class="btn ${btnClass}" onclick="AprovacoesComplementares.toggleStatusBuffer(${item.id}, '${statusFinal}')" title="${btnTitle}"><i class="bi ${btnIcon}"></i></button>
                 </div>`;

            tr.innerHTML = `
                <td class="ps-3"><small class="font-monospace text-muted">${item.lpu ? item.lpu.codigoLpu : '-'}</small></td>
                <td>${htmlLpu}</td>
                <td class="text-center fw-bold">${htmlQtd}</td>
                <td class="text-end text-muted small">${AprovacoesComplementares.formatarMoeda(rawValor)}</td>
                <td class="text-end fw-bold text-dark">${AprovacoesComplementares.formatarMoeda(item.valorTotal)}</td>
                <td class="text-center">${htmlStatus}</td>
                <td class="text-center pe-3">${acoesHtml}</td>
            `;
            tbody.appendChild(tr);
        });
    },

    toggleStatusBuffer: (id, statusAtual) => {
        const novoStatus = statusAtual === 'ATIVO' ? 'INATIVO' : 'ATIVO';
        if (!AprovacoesComplementares.alteracoesBuffer[id]) {
            AprovacoesComplementares.alteracoesBuffer[id] = {};
        }
        AprovacoesComplementares.alteracoesBuffer[id].novoStatus = novoStatus;
        AprovacoesComplementares.renderizarItensExistentesComBuffer(false);
    },

    abrirModalEdicaoItem: async (itemId) => {
        const item = AprovacoesComplementares.currentOsCompleta.detalhes.find(d => d.id === itemId);
        if (!item) return;

        const buffer = AprovacoesComplementares.alteracoesBuffer[itemId] || {};

        document.getElementById('editItemIdHidden').value = itemId;
        document.getElementById('modalEditQtd').value = buffer.novaQtd || item.quantidade;
        document.getElementById('modalEditBoq').value = buffer.novoBoq || item.boq || '';

        const select = document.getElementById('modalEditLpuSelect');

        if (AprovacoesComplementares.choicesEdit) { AprovacoesComplementares.choicesEdit.destroy(); }

        let html = '<option value="">Selecione...</option>';
        const currentLpuId = buffer.novaLpuId || (item.lpu ? item.lpu.id : null);

        AprovacoesComplementares.listaCompletaLpus.forEach(l => {
            html += `<option value="${l.id}" ${l.id == currentLpuId ? 'selected' : ''}>${l.nome}</option>`;
        });
        select.innerHTML = html;

        AprovacoesComplementares.choicesEdit = new Choices(select, { searchEnabled: true, itemSelectText: '', placeholderValue: 'Pesquisar...', shouldSort: false });

        const modalEl = document.getElementById('modalEditarItemOs');
        let modal = bootstrap.Modal.getInstance(modalEl);
        if (!modal) modal = new bootstrap.Modal(modalEl);
        modal.show();
    },

    salvarEdicaoBuffer: () => {
        const id = document.getElementById('editItemIdHidden').value;
        const lpuId = document.getElementById('modalEditLpuSelect').value;
        const qtd = document.getElementById('modalEditQtd').value;
        const boq = document.getElementById('modalEditBoq').value;

        if (!lpuId || !qtd) { AprovacoesComplementares.mostrarAlerta("Preencha LPU e Quantidade."); return; }

        if (!AprovacoesComplementares.alteracoesBuffer[id]) {
            AprovacoesComplementares.alteracoesBuffer[id] = {};
        }
        AprovacoesComplementares.alteracoesBuffer[id].novaLpuId = parseInt(lpuId);
        AprovacoesComplementares.alteracoesBuffer[id].novaQtd = parseInt(qtd);
        AprovacoesComplementares.alteracoesBuffer[id].novoBoq = boq;

        const modal = bootstrap.Modal.getInstance(document.getElementById('modalEditarItemOs'));
        if (modal) modal.hide();
        AprovacoesComplementares.renderizarItensExistentesComBuffer(false);
        AprovacoesComplementares.recalcularTotaisTela();
    },

    salvarAprovacao: async () => {
        const id = AprovacoesComplementares.currentSolicitacao.id;
        const usuarioId = localStorage.getItem('usuarioId');

        // Verifica qual é o papel atual
        const isController = AprovacoesComplementares.currentSolicitacao.status === 'PENDENTE_CONTROLLER';
        const endpoint = isController ? 'controller/aprovar' : 'coordenador/aprovar';

        const elLpu = document.getElementById('editLpuSelect');
        const elQtd = document.getElementById('editQuantidade');
        const elBoq = document.getElementById('editBoq');
        const elStatus = document.getElementById('editStatusRegistro');
        const elJust = document.getElementById('editJustificativaCoordenador');

        if (!elLpu || !elQtd) {
            Swal.fire('Erro', 'Campos obrigatórios não encontrados (LPU ou Quantidade).', 'error');
            return;
        }

        // --- NOVA VALIDAÇÃO: Justificativa obrigatória para Coordenador ---
        if (!isController) {
            if (!elJust || !elJust.value || elJust.value.trim() === '') {
                Swal.fire({
                    icon: 'warning',
                    title: 'Justificativa Obrigatória',
                    text: 'Por favor, insira uma justificativa para enviar a proposta.'
                });
                return; // Interrompe o envio
            }
        }
        // ------------------------------------------------------------------

        // O Java espera uma List<Map>, então transformamos { id: dados } em [ { itemId: id, ...dados } ]
        let listaAlteracoes = [];
        if (AprovacoesComplementares.alteracoesBuffer) {
            listaAlteracoes = Object.entries(AprovacoesComplementares.alteracoesBuffer).map(([keyId, dados]) => {
                return {
                    itemId: Number(keyId),
                    novaQtd: dados.novaQtd ? Number(dados.novaQtd) : null,
                    novaLpuId: dados.novaLpuId ? Number(dados.novaLpuId) : null,
                    novoBoq: dados.novoBoq || "",
                    novoStatus: dados.novoStatus || "ATIVO"
                };
            });
        }

        const dto = {
            aprovadorId: Number(usuarioId),
            lpuId: elLpu.value ? Number(elLpu.value) : null,
            quantidade: elQtd.value ? Number(elQtd.value) : null,
            boq: elBoq ? elBoq.value : '',
            statusRegistro: elStatus ? elStatus.value : 'ATIVO',
            justificativa: elJust ? elJust.value : '',
            alteracoesItensExistentesJson: listaAlteracoes.length > 0 ? JSON.stringify(listaAlteracoes) : null
        };

        const modalEl = document.getElementById('modalAnaliseCoordenador');
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();

        Swal.fire({
            title: 'Processando...',
            html: 'Salvando aprovação e aplicando alterações...',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        try {
            const response = await fetch(`${AprovacoesComplementares.MS_URL}/${id}/${endpoint}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(dto)
            });

            if (!response.ok) {
                const erroTexto = await response.text();
                throw new Error(erroTexto || "Erro desconhecido no servidor.");
            }

            Swal.fire({
                icon: 'success',
                title: 'Sucesso!',
                text: 'Aprovação realizada e alterações aplicadas.',
                timer: 2000,
                showConfirmButton: false
            });

            AprovacoesComplementares.carregarPendencias();

        } catch (error) {
            console.error(error);
            Swal.fire({ icon: 'error', title: 'Erro ao aprovar', text: error.message });
            if (modal) modal.show();
        }
    },

    prepararRejeicaoInicial: (id, status) => {
        document.getElementById('analiseSolicitacaoId').value = id;

        AprovacoesComplementares.statusRejeicaoTemp = status;

        AprovacoesComplementares.prepararRejeicao();
    },

    prepararRejeicao: () => {
        document.getElementById('textoMotivoRecusa').value = '';
        const modalEl = document.getElementById('modalRejeitar');
        let modal = bootstrap.Modal.getInstance(modalEl);
        if (!modal) modal = new bootstrap.Modal(modalEl);
        modal.show();
    },

    executarRejeicao: async () => {
        const id = document.getElementById('analiseSolicitacaoId').value;
        const motivo = document.getElementById('textoMotivoRecusa').value;

        if (!motivo || motivo.trim().length < 3) {
            alert("Digite o motivo."); return;
        }

        const modalRejeitar = bootstrap.Modal.getInstance(document.getElementById('modalRejeitar'));
        if (modalRejeitar) modalRejeitar.hide();

        const modalMain = bootstrap.Modal.getInstance(document.getElementById('modalAnaliseCoordenador'));
        if (modalMain) modalMain.hide();

        Swal.fire({ title: 'Registrando recusa...', didOpen: () => Swal.showLoading() });

        // --- CORREÇÃO: Verifica o status que veio da tabela OU do modal de análise ---
        let statusRef = AprovacoesComplementares.statusRejeicaoTemp;

        // Fallback: Se não veio da tabela, tenta pegar do objeto currentSolicitacao (caso o modal de análise esteja aberto)
        if (!statusRef && AprovacoesComplementares.currentSolicitacao) {
            statusRef = AprovacoesComplementares.currentSolicitacao.status;
        }

        const isController = statusRef === 'PENDENTE_CONTROLLER';
        // -----------------------------------------------------------------------------

        const endpointAction = isController ? 'controller/devolver' : 'coordenador/rejeitar';

        try {
            const usuarioId = localStorage.getItem('usuarioId');
            await fetch(`${AprovacoesComplementares.MS_URL}/${id}/${endpointAction}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ aprovadorId: usuarioId, motivo: motivo })
            });

            await Swal.fire({
                icon: 'success',
                title: isController ? 'Devolvido!' : 'Rejeitado!',
                text: isController ? 'Solicitação devolvida ao Coordenador.' : 'Solicitação rejeitada definitivamente.',
                timer: 1500,
                showConfirmButton: false
            });

            // Limpa a variável temporária
            AprovacoesComplementares.statusRejeicaoTemp = null;
            AprovacoesComplementares.carregarPendencias();
        } catch (e) {
            Swal.fire('Erro', 'Não foi possível rejeitar.', 'error');
        }
    },
};

window.AprovacoesComplementares = AprovacoesComplementares;
window.renderizarTabelaPendentesComplementares = AprovacoesComplementares.carregarPendencias;
window.carregarDadosHistoricoComplementares = AprovacoesComplementares.carregarDadosHistoricoComplementares;