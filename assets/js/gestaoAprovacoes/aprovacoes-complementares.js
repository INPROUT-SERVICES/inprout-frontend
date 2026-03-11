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
    ultimaListaPendentes: [],
    currentLoteKey: null,
    currentLoteItens: null,
    loteDecisoes: {},

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
            // Tenta buscar no cache global primeiro
            if (window.todosOsLancamentosGlobais) {
                const global = window.todosOsLancamentosGlobais.find(l => l.osId == osId || l.os?.id == osId);
                if (global && global.os) {

                    const segmentoCache = (global.os.segmento && global.os.segmento.nome) ? global.os.segmento.nome : '-';
                    const siteCache = global.os.site || '-';
                    
                    const info = { 
                        osCodigo: global.os.os || global.os.numero || `OS #${osId}`, 
                        projeto: global.os.projeto || '-', 
                        site: siteCache, 
                        segmento: segmentoCache, // Adicionado
                        loaded: true 
                    };
                    
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
                let segmento = (dados.segmento && dados.segmento.nome) ? dados.segmento.nome : '-';

                if ((site === '-' || projeto === '-') && dados.detalhes && dados.detalhes.length > 0) {
                    const det = dados.detalhes[0];
                    if (site === '-') site = det.site || '-';
                    if (projeto === '-') projeto = det.regional || '-';
                }

                const info = { osCodigo: dados.os, projeto: projeto, site: site, segmento: segmento, loaded: true };
                AprovacoesComplementares.mapaDetalhesOs[osId] = info;
                AprovacoesComplementares.atualizarLinhasTabela(osId, info);
                return info;
            }
        } catch (e) { console.error("Erro fetch OS:", e); }
        
        return { osCodigo: 'OS #' + osId, projeto: '-', site: '-', segmento: '-', loaded: false };
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
            AprovacoesComplementares.ultimaListaPendentes = lista;

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

        // Agrupa por loteId
        const loteMap = new Map();
        lista.forEach(item => {
            const key = item.loteId || ('_single_' + item.id);
            if (!loteMap.has(key)) loteMap.set(key, []);
            loteMap.get(key).push(item);
        });

        loteMap.forEach((itens, loteKey) => {
            const tr = document.createElement('tr');
            const firstItem = itens[0];
            const osId = firstItem.osId;

            const cache = AprovacoesComplementares.mapaDetalhesOs[osId];
            const osDisplay = cache ? cache.osCodigo : 'OS #' + osId;
            const siteDisplay = cache ? cache.site : 'Carregando...';
            const projetoDisplay = cache ? cache.projeto : 'Carregando...';
            const segmentoDisplay = cache ? cache.segmento : 'Carregando...';
            const loadingClass = cache ? '' : 'loading-text';

            let lpuDisplay;
            if (itens.length === 1) {
                const lpuInfo = AprovacoesComplementares.listaCompletaLpus.find(l => l.id === firstItem.lpuOriginalId);
                const nomeLpu = lpuInfo ? (lpuInfo.nome.split('|')[1] || lpuInfo.nome) : 'LPU ID: ' + firstItem.lpuOriginalId;
                lpuDisplay = '<small class="text-truncate d-inline-block" style="max-width: 250px;" title="' + nomeLpu + '">' + nomeLpu + '</small>';
            } else {
                lpuDisplay = '<span class="badge bg-primary-subtle text-primary border border-primary-subtle"><i class="bi bi-collection me-1"></i>' + itens.length + ' itens</span>';
            }

            let valorTotal = itens.reduce((sum, i) => {
                let v = i.valorTotalEstimado;
                if (!v || v === 0) {
                    const lpuInfo = AprovacoesComplementares.listaCompletaLpus.find(l => l.id === i.lpuOriginalId);
                    v = (lpuInfo ? lpuInfo.valor : 0) * i.quantidadeOriginal;
                }
                return sum + v;
            }, 0);

            const qtdTotal = itens.reduce((sum, i) => sum + (i.quantidadeOriginal || 0), 0);

            const status = firstItem.status;
            let badgeClass = 'badge bg-warning-subtle text-warning-emphasis border border-warning-subtle';
            let iconeStatus = '<i class="bi bi-hourglass-split me-1"></i>';
            let statusTexto = status;

            if (status === 'APROVADO') {
                badgeClass = 'badge bg-success-subtle text-success border border-success-subtle';
                iconeStatus = '<i class="bi bi-check-circle-fill me-1"></i>';
            } else if (status === 'DEVOLVIDO_CONTROLLER') {
                badgeClass = 'badge bg-danger-subtle text-danger border border-danger-subtle';
                iconeStatus = '<i class="bi bi-arrow-return-left me-1"></i>';
                statusTexto = 'DEVOLVIDO';
            } else if (status === 'PENDENTE_CONTROLLER') {
                badgeClass = 'badge bg-info-subtle text-info-emphasis border border-info-subtle';
                iconeStatus = '<i class="bi bi-person-gear me-1"></i>';
                statusTexto = 'EM ANÁLISE';
            }

            const isController = status === 'PENDENTE_CONTROLLER';
            const btnClass = isController ? 'btn-success' : 'btn-outline-success';
            const btnIcon = isController ? 'bi-check-lg' : 'bi-pencil-square';
            const btnTitle = isController ? 'Aprovar Lote' : 'Analisar Lote';

            const escapedKey = loteKey.replace(/'/g, "\\'");

            tr.innerHTML = '<td><span class="os-placeholder-' + osId + ' text-dark fw-bold">' + osDisplay + '</span></td>'
                + '<td><small class="segmento-placeholder-' + osId + ' ' + loadingClass + '">' + segmentoDisplay + '</small></td>'
                + '<td><small class="site-placeholder-' + osId + ' ' + loadingClass + '">' + siteDisplay + '</small></td>'
                + '<td><small class="projeto-placeholder-' + osId + ' ' + loadingClass + '">' + projetoDisplay + '</small></td>'
                + '<td>' + lpuDisplay + '</td>'
                + '<td class="text-center"><span class="badge bg-light text-dark border">' + qtdTotal + '</span></td>'
                + '<td class="text-end fw-bold text-success">' + AprovacoesComplementares.formatarMoeda(valorTotal) + '</td>'
                + '<td class="text-center"><span class="' + badgeClass + '">' + iconeStatus + ' ' + statusTexto + '</span></td>'
                + '<td class="text-center">'
                + '  <button class="btn btn-sm ' + btnClass + '" onclick="AprovacoesComplementares.abrirModalAnaliseLote(\'' + escapedKey + '\')" title="' + btnTitle + '"><i class="bi ' + btnIcon + '"></i></button>'
                + '  <button class="btn btn-sm btn-outline-danger" onclick="AprovacoesComplementares.prepararRejeicaoLote(\'' + escapedKey + '\')" title="Rejeitar"><i class="bi bi-x-lg"></i></button>'
                + '</td>';

            tbody.appendChild(tr);
        });

        const osIdsFaltantes = [...new Set(lista.map(i => i.osId))].filter(id => !AprovacoesComplementares.mapaDetalhesOs[id]);
        osIdsFaltantes.forEach(id => AprovacoesComplementares.fetchDetalhesOsESalvar(id));
    },

        abrirModalAnaliseLote: async (loteKey) => {
        try {
            AprovacoesComplementares.currentLoteKey = loteKey;
            AprovacoesComplementares.loteDecisoes = {};

            const itens = AprovacoesComplementares.ultimaListaPendentes.filter(i => {
                const key = i.loteId || ('_single_' + i.id);
                return key === loteKey;
            });

            if (itens.length === 0) return;
            AprovacoesComplementares.currentLoteItens = itens;

            const firstItem = itens[0];
            const osId = firstItem.osId;
            const isController = firstItem.status === 'PENDENTE_CONTROLLER';

            const respOs = await fetch(`${API_BASE_URL}/os/${osId}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const osCompleta = respOs.ok ? await respOs.json() : null;
            AprovacoesComplementares.currentOsCompleta = osCompleta;

            // Inicializa decisões (padrão: aprovar)
            itens.forEach(item => {
                AprovacoesComplementares.loteDecisoes[item.id] = {
                    decisao: 'aprovar',
                    lpuId: isController ? item.lpuAprovadaId : (item.lpuAprovadaId || item.lpuOriginalId),
                    quantidade: isController ? item.quantidadeAprovada : (item.quantidadeAprovada || item.quantidadeOriginal)
                };
            });

            // Monta tabela de itens do lote
            let itensHtml = '';
            itens.forEach(item => {
                const lpu = AprovacoesComplementares.listaCompletaLpus.find(l => l.id === item.lpuOriginalId);
                const nomeLpu = lpu ? (lpu.nome.split('|')[1] || lpu.nome).trim() : ('LPU ' + item.lpuOriginalId);
                let valor = item.valorTotalEstimado;
                if (!valor) valor = (lpu ? lpu.valor : 0) * item.quantidadeOriginal;

                itensHtml += `
                    <tr id="lote-item-row-${item.id}">
                        <td class="ps-3"><small class="text-truncate d-inline-block" style="max-width:280px;" title="${nomeLpu}">${nomeLpu}</small></td>
                        <td class="text-center fw-bold">${item.quantidadeOriginal}</td>
                        <td class="text-end text-muted small">${AprovacoesComplementares.formatarMoeda(lpu ? lpu.valor : 0)}</td>
                        <td class="text-end fw-bold text-dark">${AprovacoesComplementares.formatarMoeda(valor)}</td>
                        <td class="text-center pe-3">
                            <select class="form-select form-select-sm decisao-item-select" data-item-id="${item.id}" ${isController ? 'disabled' : ''} style="width: 130px; display: inline-block;">
                                <option value="aprovar" selected>✅ Aprovar</option>
                                <option value="rejeitar">❌ Rejeitar</option>
                            </select>
                        </td>
                    </tr>`;
            });

            const modalBody = document.querySelector('#modalAnaliseCoordenador .modal-body');
            let alertaHtml = '';
            if (firstItem.status === 'DEVOLVIDO_CONTROLLER' || firstItem.justificativaController) {
                alertaHtml = `
                    <div class="alert alert-danger border-0 border-start border-4 border-danger shadow-sm d-flex align-items-start p-3 mb-3" role="alert">
                        <div class="me-3"><div class="bg-danger text-white rounded-circle d-flex align-items-center justify-content-center" style="width: 32px; height: 32px;"><i class="bi bi-arrow-return-left"></i></div></div>
                        <div><h6 class="alert-heading fw-bold mb-1">Devolvido pelo Controller</h6><p class="mb-0 small text-danger-emphasis">"${firstItem.justificativaController || 'Motivo não especificado.'}"</p></div>
                    </div>`;
            }

            modalBody.innerHTML = `
                ${alertaHtml}
                <div class="card border-0 shadow-sm bg-light mb-4">
                    <div class="card-body p-3">
                        <div id="osDetailsContainer" class="row g-3 align-items-center"></div>
                    </div>
                </div>

                <div class="d-flex align-items-center mb-2">
                    <div class="bg-success text-white rounded-circle d-flex align-items-center justify-content-center me-2" style="width: 24px; height: 24px;">
                        <span class="small fw-bold">${itens.length}</span>
                    </div>
                    <h6 class="fw-bold text-dark mb-0">Itens do Lote</h6>
                    <small class="text-muted ms-2 fst-italic">${firstItem.justificativa || 'Sem justificativa do gestor'}</small>
                </div>

                <div class="card border border-light shadow-sm mb-4 overflow-hidden">
                    <div class="table-responsive">
                        <table class="table table-hover table-sm mb-0 align-middle small">
                            <thead class="table-light">
                                <tr>
                                    <th class="ps-3">Item LPU Solicitado</th>
                                    <th class="text-center">Qtd</th>
                                    <th class="text-end">Vlr. Unit.</th>
                                    <th class="text-end">Total Est.</th>
                                    <th class="text-center pe-3" style="width: 150px;">Decisão</th>
                                </tr>
                            </thead>
                            <tbody>${itensHtml}</tbody>
                            <tfoot>
                                <tr class="table-light">
                                    <td colspan="3" class="text-end fw-bold">Total do Lote:</td>
                                    <td class="text-end fw-bold text-success">${AprovacoesComplementares.formatarMoeda(itens.reduce((s, i) => { let v = i.valorTotalEstimado; if (!v) { const l = AprovacoesComplementares.listaCompletaLpus.find(x => x.id === i.lpuOriginalId); v = (l ? l.valor : 0) * i.quantidadeOriginal; } return s + v; }, 0))}</td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                <div class="mb-0">
                    <label class="form-label small text-secondary fw-bold">Justificativa da Decisão <span class="text-danger">*</span></label>
                    <textarea class="form-control form-control-sm" id="editJustificativaCoordenador" rows="2" placeholder="Justificativa para as decisões do lote..." ${isController ? 'disabled' : ''}></textarea>
                </div>

                <input type="hidden" id="analiseSolicitacaoId" value="${firstItem.id}">
            `;

            // Listeners de decisão por item
            document.querySelectorAll('.decisao-item-select').forEach(sel => {
                sel.addEventListener('change', (e) => {
                    const itemId = e.target.dataset.itemId;
                    AprovacoesComplementares.loteDecisoes[itemId].decisao = e.target.value;
                    const row = document.getElementById('lote-item-row-' + itemId);
                    if (e.target.value === 'rejeitar') {
                        row.classList.add('table-danger');
                        row.style.opacity = '0.6';
                        row.style.textDecoration = 'line-through';
                    } else {
                        row.classList.remove('table-danger');
                        row.style.opacity = '1';
                        row.style.textDecoration = 'none';
                    }
                });
            });

            // Renderiza detalhes da OS
            if (osCompleta) {
                AprovacoesComplementares.renderizarDetalhesOsLote(osCompleta);
            }

            // Configura botões do footer
            const footerModal = document.querySelector('#modalAnaliseCoordenador .modal-footer');
            const btnSalvar = footerModal ? (footerModal.querySelector('.btn-success') || footerModal.querySelector('.btn-primary')) : null;

            if (btnSalvar) {
                const novoBtn = btnSalvar.cloneNode(true);
                btnSalvar.parentNode.replaceChild(novoBtn, btnSalvar);
                if (isController) {
                    novoBtn.innerHTML = '<i class="bi bi-check-circle-fill me-2"></i>Aprovar Lote';
                    novoBtn.className = 'btn btn-success fw-bold px-4';
                } else {
                    novoBtn.innerHTML = '<i class="bi bi-send-fill me-2"></i>Enviar Decisões';
                    novoBtn.className = 'btn btn-primary fw-bold px-4';
                }
                novoBtn.onclick = AprovacoesComplementares.salvarAprovacaoLote;
            }

            const modalEl = document.getElementById('modalAnaliseCoordenador');
            let modalInstance = bootstrap.Modal.getInstance(modalEl);
            if (!modalInstance) modalInstance = new bootstrap.Modal(modalEl);
            modalInstance.show();

        } catch (e) {
            console.error(e);
            alert('Erro ao abrir modal: ' + e.message);
        }
    },

    renderizarDetalhesOsLote: (os) => {
        if (!os) return;
        let regional = os.regional;
        let site = os.site;
        if (os.detalhes && os.detalhes.length > 0) {
            if (!regional || regional === 'null') regional = os.detalhes[0].regional;
            if (!site || site === 'null') site = os.detalhes[0].site;
        }
        const html = `
            <div class="col-md-4">
                <small class="text-muted d-block text-uppercase" style="font-size: 0.7rem;">Código OS</small>
                <span class="fw-bold text-dark">${os.os || '-'}</span>
            </div>
            <div class="col-md-4">
                <small class="text-muted d-block text-uppercase" style="font-size: 0.7rem;">Regional</small>
                <span class="fw-bold text-dark">${regional || '-'}</span>
            </div>
            <div class="col-md-4">
                <small class="text-muted d-block text-uppercase" style="font-size: 0.7rem;">Site / Local</small>
                <span class="text-dark d-block text-truncate" title="${site}">${site || '-'}</span>
            </div>
        `;
        document.getElementById('osDetailsContainer').innerHTML = html;
    },

    salvarAprovacaoLote: async () => {
        const itens = AprovacoesComplementares.currentLoteItens;
        const decisoes = AprovacoesComplementares.loteDecisoes;
        if (!itens || itens.length === 0) return;

        const isController = itens[0].status === 'PENDENTE_CONTROLLER';
        const justificativa = document.getElementById('editJustificativaCoordenador')?.value || '';

        if (!isController && (!justificativa || justificativa.trim() === '')) {
            Swal.fire({ icon: 'warning', title: 'Justificativa Obrigatória', text: 'Por favor, insira uma justificativa para enviar as decisões.' });
            return;
        }

        const modalEl = document.getElementById('modalAnaliseCoordenador');
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();

        Swal.fire({ title: 'Processando...', html: 'Salvando decisões do lote...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        const usuarioId = localStorage.getItem('usuarioId');
        let erros = [];
        let sucessos = 0;

        for (const item of itens) {
            const decisao = decisoes[item.id];
            try {
                if (!decisao || decisao.decisao === 'aprovar') {
                    const endpoint = isController ? 'controller/aprovar' : 'coordenador/aprovar';
                    const dto = {
                        aprovadorId: Number(usuarioId),
                        lpuId: (decisao && decisao.lpuId) ? Number(decisao.lpuId) : item.lpuOriginalId,
                        quantidade: (decisao && decisao.quantidade) ? Number(decisao.quantidade) : item.quantidadeOriginal,
                        boq: '',
                        statusRegistro: 'ATIVO',
                        justificativa: justificativa,
                        alteracoesItensExistentesJson: null
                    };
                    const resp = await fetch(`${AprovacoesComplementares.MS_URL}/${item.id}/${endpoint}`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify(dto)
                    });
                    if (!resp.ok) throw new Error(await resp.text());
                    sucessos++;
                } else {
                    const endpoint = isController ? 'controller/devolver' : 'coordenador/rejeitar';
                    const resp = await fetch(`${AprovacoesComplementares.MS_URL}/${item.id}/${endpoint}`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ aprovadorId: Number(usuarioId), motivo: justificativa })
                    });
                    if (!resp.ok) throw new Error(await resp.text());
                    sucessos++;
                }
            } catch (e) {
                erros.push('Item #' + item.id + ': ' + e.message);
            }
        }

        if (erros.length === 0) {
            Swal.fire({ icon: 'success', title: 'Sucesso!', text: sucessos + ' item(ns) processado(s).', timer: 2000, showConfirmButton: false });
        } else {
            Swal.fire({ icon: 'warning', title: 'Parcialmente Processado', html: sucessos + ' sucesso(s), ' + erros.length + ' erro(s):<br>' + erros.join('<br>') });
        }

        AprovacoesComplementares.currentLoteItens = null;
        AprovacoesComplementares.loteDecisoes = {};
        AprovacoesComplementares.carregarPendencias();
    },

    prepararRejeicaoLote: (loteKey) => {
        const itens = AprovacoesComplementares.ultimaListaPendentes.filter(i => {
            const key = i.loteId || ('_single_' + i.id);
            return key === loteKey;
        });
        if (itens.length === 0) return;

        AprovacoesComplementares.currentLoteItens = itens;
        AprovacoesComplementares.statusRejeicaoTemp = itens[0].status;
        document.getElementById('analiseSolicitacaoId').value = itens[0].id;

        document.getElementById('textoMotivoRecusa').value = '';
        const modalEl = document.getElementById('modalRejeitar');
        let modal = bootstrap.Modal.getInstance(modalEl);
        if (!modal) modal = new bootstrap.Modal(modalEl);
        modal.show();
    },

        prepararRejeicaoInicial: (id, status) => {
        // Compat: chamado via botão de rejeição individual (se existir)
        const item = AprovacoesComplementares.ultimaListaPendentes.find(i => i.id == id);
        if (item) {
            const loteKey = item.loteId || ('_single_' + item.id);
            AprovacoesComplementares.prepararRejeicaoLote(loteKey);
        } else {
            document.getElementById('analiseSolicitacaoId').value = id;
            AprovacoesComplementares.statusRejeicaoTemp = status;
            document.getElementById('textoMotivoRecusa').value = '';
            const modalEl = document.getElementById('modalRejeitar');
            let modal = bootstrap.Modal.getInstance(modalEl);
            if (!modal) modal = new bootstrap.Modal(modalEl);
            modal.show();
        }
    },

    prepararRejeicao: () => {
        document.getElementById('textoMotivoRecusa').value = '';
        const modalEl = document.getElementById('modalRejeitar');
        let modal = bootstrap.Modal.getInstance(modalEl);
        if (!modal) modal = new bootstrap.Modal(modalEl);
        modal.show();
    },

    executarRejeicao: async () => {
        const motivo = document.getElementById('textoMotivoRecusa').value;
        if (!motivo || motivo.trim().length < 3) {
            alert("Digite o motivo (mínimo 3 caracteres)."); return;
        }

        const modalRejeitar = bootstrap.Modal.getInstance(document.getElementById('modalRejeitar'));
        if (modalRejeitar) modalRejeitar.hide();

        const modalMain = bootstrap.Modal.getInstance(document.getElementById('modalAnaliseCoordenador'));
        if (modalMain) modalMain.hide();

        Swal.fire({ title: 'Registrando recusa...', didOpen: () => Swal.showLoading() });

        const statusRef = AprovacoesComplementares.statusRejeicaoTemp
            || (AprovacoesComplementares.currentLoteItens && AprovacoesComplementares.currentLoteItens[0] ? AprovacoesComplementares.currentLoteItens[0].status : null)
            || (AprovacoesComplementares.currentSolicitacao ? AprovacoesComplementares.currentSolicitacao.status : null);

        const isController = statusRef === 'PENDENTE_CONTROLLER';
        const endpointAction = isController ? 'controller/devolver' : 'coordenador/rejeitar';
        const usuarioId = localStorage.getItem('usuarioId');

        const itens = AprovacoesComplementares.currentLoteItens || [];

        if (itens.length === 0) {
            // Fallback: item único (compat)
            const id = document.getElementById('analiseSolicitacaoId')?.value;
            if (!id) { Swal.close(); return; }
            try {
                await fetch(`${AprovacoesComplementares.MS_URL}/${id}/${endpointAction}`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ aprovadorId: usuarioId, motivo: motivo })
                });
                await Swal.fire({ icon: 'success', title: isController ? 'Devolvido!' : 'Rejeitado!', timer: 1500, showConfirmButton: false });
            } catch (e) {
                Swal.fire('Erro', 'Não foi possível rejeitar.', 'error');
            }
        } else {
            // Rejeição em lote
            let erros = [];
            for (const item of itens) {
                try {
                    const resp = await fetch(`${AprovacoesComplementares.MS_URL}/${item.id}/${endpointAction}`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ aprovadorId: usuarioId, motivo: motivo })
                    });
                    if (!resp.ok) throw new Error(await resp.text());
                } catch (e) {
                    erros.push('Item #' + item.id + ': ' + e.message);
                }
            }

            if (erros.length === 0) {
                await Swal.fire({ icon: 'success', title: isController ? 'Lote Devolvido!' : 'Lote Rejeitado!', text: itens.length + ' item(ns) processado(s).', timer: 2000, showConfirmButton: false });
            } else {
                Swal.fire({ icon: 'warning', title: 'Parcialmente Processado', html: erros.length + ' erro(s):<br>' + erros.join('<br>') });
            }
        }

        AprovacoesComplementares.statusRejeicaoTemp = null;
        AprovacoesComplementares.currentLoteItens = null;
        AprovacoesComplementares.carregarPendencias();
    },
};

window.AprovacoesComplementares = AprovacoesComplementares;
window.renderizarTabelaPendentesComplementares = AprovacoesComplementares.carregarPendencias;
window.carregarDadosHistoricoComplementares = AprovacoesComplementares.carregarDadosHistoricoComplementares;