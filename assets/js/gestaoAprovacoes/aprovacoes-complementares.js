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
    statusRejeicaoTemp: null,

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
            const baseUrl = window.API_BASE_URL || '/api';
            const response = await fetchComAuth(`${baseUrl}/contrato`);
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
                        segmento: segmentoCache,
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
        const spansSegmento = document.querySelectorAll(`.segmento-placeholder-${osId}`);

        spansSite.forEach(el => { el.innerText = info.site; el.classList.remove('loading-text'); });
        spansProjeto.forEach(el => { el.innerText = info.projeto; el.classList.remove('loading-text'); });
        spansSegmento.forEach(el => {
            el.innerText = info.segmento || '-';
            el.classList.remove('loading-text');
        });
        spansOs.forEach(el => { el.innerText = info.osCodigo; el.classList.remove('fw-light'); el.classList.add('fw-bold'); });
    },

    // =========================================================================
    // LÓGICA DE HISTÓRICO
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

            const segmentoIdsHistorico = localStorage.getItem('segmentos') || '[]';
            const headersExtras = {
                'X-User-Role': userRole,
                'X-User-Id': userId,
                'X-Segmento-Ids': segmentoIdsHistorico
            };

            const url = `${AprovacoesComplementares.MS_URL}/historico`;

            let lista = [];
            try {
                const response = await fetchComAuth(url, { headers: headersExtras });
                console.log('[Complementares] Historico response status:', response.status);
                if (response.ok) {
                    lista = await response.json();
                } else {
                    throw new Error(`Status ${response.status}`);
                }
            } catch (errMain) {
                console.warn("[Complementares] Falha no endpoint principal de historico, tentando fallback...", errMain);
                const fallbackUrl = `${AprovacoesComplementares.MS_URL}/usuario/${userId}`;
                const responseFallback = await fetchComAuth(fallbackUrl, { headers: headersExtras });
                if (responseFallback.ok) {
                    lista = await responseFallback.json();
                } else {
                    throw new Error("Nao foi possivel carregar o historico.");
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
    // LÓGICA DE PENDÊNCIAS
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
            const userId = localStorage.getItem('usuarioId');

            const segmentoIds = localStorage.getItem('segmentos') || '[]';
            const response = await fetchComAuth(`${AprovacoesComplementares.MS_URL}/pendentes`, {
                headers: {
                    'X-User-Role': userRole,
                    'X-User-Id': userId,
                    'X-Segmento-Ids': segmentoIds
                }
            });
            console.log('[Complementares] Pendencias response status:', response.status);

            if (!response.ok) throw new Error("Erro ao buscar pendências");
            const lista = await response.json();
            AprovacoesComplementares.ultimaListaPendentes = lista;

            AprovacoesComplementares.atualizarBadge(lista.length);
            AprovacoesComplementares.renderizarTabelaPrincipal(lista);

            const osIds = [...new Set(lista.map(item => item.osId))];
            osIds.forEach(id => AprovacoesComplementares.fetchDetalhesOsESalvar(id));

        } catch (error) {
            console.error('[Complementares] Erro ao carregar pendencias:', error);
            tbody.innerHTML = `<tr><td colspan="9" class="text-center text-danger py-4"><i class="bi bi-exclamation-triangle me-2"></i>Erro ao carregar: ${error.message}</td></tr>`;
        } finally {
            if (loader) loader.classList.add('d-none');
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
            AprovacoesComplementares.alteracoesBuffer = {};

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

            // Inicializa decisões (padrão: aprovar) com todos os campos editáveis
            itens.forEach(item => {
                AprovacoesComplementares.loteDecisoes[item.id] = {
                    decisao: 'aprovar',
                    lpuId: isController ? item.lpuAprovadaId : (item.lpuAprovadaId || item.lpuOriginalId),
                    quantidade: isController ? item.quantidadeAprovada : (item.quantidadeAprovada || item.quantidadeOriginal),
                    boq: item.boqAprovado || '',
                    statusRegistro: item.statusRegistroAprovado || 'ATIVO'
                };
            });

            // Monta tabela de itens do lote (com campos de edição por item)
            // Pré-constrói as options de LPU para cada item (evita repetir)
            const todoLpusOptsCache = AprovacoesComplementares.listaCompletaLpus.map(l =>
                ({ id: l.id, label: l.nome, valor: l.valor || 0 })
            );

            let itensHtml = '';
            itens.forEach(item => {
                const lpu = AprovacoesComplementares.listaCompletaLpus.find(l => l.id === item.lpuOriginalId);
                const nomeLpu = lpu ? (lpu.nome.split('|')[1] || lpu.nome).trim() : ('LPU ' + item.lpuOriginalId);
                const codigoLpu = lpu ? (lpu.nome.split('|')[0] || '').trim() : '';
                let valor = item.valorTotalEstimado;
                if (!valor) valor = (lpu ? lpu.valor : 0) * item.quantidadeOriginal;

                const decInit = AprovacoesComplementares.loteDecisoes[item.id];
                const lpuSelId = decInit.lpuId || item.lpuOriginalId;
                const qtdInit = decInit.quantidade || item.quantidadeOriginal;
                const boqInit = decInit.boq || '';
                const statusInit = decInit.statusRegistro || 'ATIVO';

                let lpuOpts = '';
                todoLpusOptsCache.forEach(l => {
                    const sel = l.id == lpuSelId ? 'selected' : '';
                    lpuOpts += `<option value="${l.id}" ${sel}>${l.label}</option>`;
                });

                // Valor estimado inicial com base na LPU e Qtd pré-selecionadas
                const lpuSelInit = AprovacoesComplementares.listaCompletaLpus.find(l => l.id == lpuSelId);
                const valorEstInit = lpuSelInit ? (lpuSelInit.valor || 0) * qtdInit : 0;
                const valorEstFmt = valorEstInit > 0
                    ? AprovacoesComplementares.formatarMoeda(valorEstInit).replace('R$', '').trim()
                    : '0,00';
                const unitFmt = lpuSelInit && lpuSelInit.valor
                    ? 'unit. ' + AprovacoesComplementares.formatarMoeda(lpuSelInit.valor)
                    : '';

                itensHtml += `
                    <tr id="lote-item-row-${item.id}">
                        <td class="ps-2 align-middle">
                            <div class="text-truncate fw-semibold" style="max-width:220px" title="${nomeLpu}">${nomeLpu}</div>
                            ${codigoLpu ? `<small class="text-muted font-monospace" style="font-size:0.7rem">${codigoLpu}</small>` : ''}
                        </td>
                        <td class="text-center align-middle fw-bold">${item.quantidadeOriginal}</td>
                        <td class="text-end align-middle text-muted small">${AprovacoesComplementares.formatarMoeda(lpu ? lpu.valor : 0)}</td>
                        <td class="text-end align-middle fw-bold text-dark">${AprovacoesComplementares.formatarMoeda(valor)}</td>
                        <td class="text-center align-middle pe-2" style="white-space:nowrap">
                            <div class="btn-group btn-group-sm" role="group">
                                <button type="button" class="btn btn-success btn-dec active" data-item-id="${item.id}" data-dec="aprovar" ${isController ? 'disabled' : ''}>Aprovar</button>
                                <button type="button" class="btn btn-outline-danger btn-dec" data-item-id="${item.id}" data-dec="rejeitar" ${isController ? 'disabled' : ''}>Rejeitar</button>
                            </div>
                        </td>
                    </tr>
                    <tr id="lote-item-edit-${item.id}" class="bg-light">
                        <td colspan="5" class="py-2 px-3 border-bottom border-2">
                            <div class="row g-2 align-items-end">
                                <div class="col-md-5">
                                    <label class="form-label small text-muted mb-1" style="font-size:0.72rem">LPU Aprovada / Proposta</label>
                                    <input type="search" class="form-control form-control-sm mb-1 lote-lpu-search" id="lpu-search-${item.id}" data-item-id="${item.id}" placeholder="🔍 Filtrar LPU..." autocomplete="off" oninput="AprovacoesComplementares.filtrarLpuSelect('${item.id}', this.value)" ${isController ? 'disabled' : ''}>
                                    <select class="form-select form-select-sm lote-lpu-sel" id="lpu-sel-${item.id}" data-item-id="${item.id}" size="1" ${isController ? 'disabled' : ''}>${lpuOpts}</select>
                                    <small class="text-muted mt-1 d-block lote-lpu-unit" id="lpu-unit-${item.id}" style="font-size:0.7rem">${unitFmt}</small>
                                </div>
                                <div class="col-md-2">
                                    <label class="form-label small text-muted mb-1" style="font-size:0.72rem">Qtd Aprovada</label>
                                    <input type="number" class="form-control form-control-sm text-center lote-qtd-inp" id="qtd-inp-${item.id}" data-item-id="${item.id}" value="${qtdInit}" min="1" ${isController ? 'disabled' : ''}>
                                </div>
                                <div class="col-md-2">
                                    <label class="form-label small text-muted mb-1" style="font-size:0.72rem">BOQ</label>
                                    <input type="text" class="form-control form-control-sm lote-boq-inp" id="boq-inp-${item.id}" data-item-id="${item.id}" value="${boqInit}" placeholder="Opcional" ${isController ? 'disabled' : ''}>
                                </div>
                                <div class="col-md-2">
                                    <label class="form-label small text-muted mb-1" style="font-size:0.72rem">Status do Registro</label>
                                    <select class="form-select form-select-sm lote-status-sel" id="status-sel-${item.id}" data-item-id="${item.id}" ${isController ? 'disabled' : ''}>
                                        <option value="ATIVO" ${statusInit === 'ATIVO' ? 'selected' : ''}>ATIVO</option>
                                        <option value="INATIVO" ${statusInit === 'INATIVO' ? 'selected' : ''}>INATIVO (Cancelado)</option>
                                    </select>
                                </div>
                                <div class="col-md-1">
                                    <label class="form-label small text-muted mb-1" style="font-size:0.72rem">Vlr Est.</label>
                                    <div class="input-group input-group-sm">
                                        <span class="input-group-text bg-success-subtle text-success border-0 px-1" style="font-size:0.7rem">R$</span>
                                        <input type="text" class="form-control form-control-sm fw-bold text-success border-0 bg-success-subtle lote-valor-est" id="valor-est-${item.id}" data-item-id="${item.id}" disabled value="${valorEstFmt}">
                                    </div>
                                </div>
                            </div>
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

                ${(() => {
                    let justHtml = '';
                    // Justificativa do Manager (visível para coordenador e controller)
                    if (firstItem.justificativa) {
                        justHtml += `
                        <div class="d-flex align-items-start gap-2 mb-2">
                            <div class="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center flex-shrink-0" style="width: 28px; height: 28px;">
                                <i class="bi bi-person-fill" style="font-size: 0.75rem;"></i>
                            </div>
                            <div>
                                <small class="fw-bold text-dark">Justificativa do Gestor (Manager)</small>
                                <p class="mb-0 small text-muted fst-italic">"${firstItem.justificativa}"</p>
                            </div>
                        </div>`;
                    }
                    // Justificativa do Coordenador (visível apenas para controller)
                    if (isController && firstItem.justificativaCoordenador) {
                        justHtml += `
                        <div class="d-flex align-items-start gap-2 mb-2">
                            <div class="bg-success text-white rounded-circle d-flex align-items-center justify-content-center flex-shrink-0" style="width: 28px; height: 28px;">
                                <i class="bi bi-person-check-fill" style="font-size: 0.75rem;"></i>
                            </div>
                            <div>
                                <small class="fw-bold text-dark">Justificativa do Coordenador</small>
                                <p class="mb-0 small text-muted fst-italic">"${firstItem.justificativaCoordenador}"</p>
                            </div>
                        </div>`;
                    }
                    // Motivo de recusa (se foi recusado)
                    if (firstItem.motivoRecusa) {
                        justHtml += `
                        <div class="d-flex align-items-start gap-2 mb-2">
                            <div class="bg-danger text-white rounded-circle d-flex align-items-center justify-content-center flex-shrink-0" style="width: 28px; height: 28px;">
                                <i class="bi bi-x-circle-fill" style="font-size: 0.75rem;"></i>
                            </div>
                            <div>
                                <small class="fw-bold text-danger">Motivo da Recusa</small>
                                <p class="mb-0 small text-danger fst-italic">"${firstItem.motivoRecusa}"</p>
                            </div>
                        </div>`;
                    }
                    if (justHtml) {
                        return `<div class="card border-0 shadow-sm mb-3"><div class="card-body p-3">${justHtml}</div></div>`;
                    }
                    return '';
                })()}

                <div class="d-flex align-items-center mb-2">
                    <div class="bg-success text-white rounded-circle d-flex align-items-center justify-content-center me-2" style="width: 24px; height: 24px;">
                        <span class="small fw-bold">2</span>
                    </div>
                    <h6 class="fw-bold text-dark mb-0">Decisão / Proposta do Novo Item</h6>
                </div>

                <div class="card border border-light shadow-sm mb-4">
                    <div class="table-responsive" style="overflow: visible;">
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
                                    <td colspan="3" class="text-end fw-bold small">Total aprovado do lote:</td>
                                    <td class="text-end fw-bold text-success" id="lote-total-footer">${AprovacoesComplementares.formatarMoeda(itens.reduce((s, i) => { let v = i.valorTotalEstimado; if (!v) { const l = AprovacoesComplementares.listaCompletaLpus.find(x => x.id === i.lpuOriginalId); v = (l ? l.valor : 0) * i.quantidadeOriginal; } return s + v; }, 0))}</td>
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

            // Listeners de decisão por item (botões Aprovar/Rejeitar)
            document.querySelectorAll('.btn-dec').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const bt = e.currentTarget;
                    const itemId = bt.dataset.itemId;
                    const dec = bt.dataset.dec;
                    AprovacoesComplementares.loteDecisoes[itemId].decisao = dec;

                    // Atualiza visual dos botões do grupo
                    document.querySelectorAll(`.btn-dec[data-item-id="${itemId}"]`).forEach(b => {
                        const isAprovar = b.dataset.dec === 'aprovar';
                        b.classList.remove('active', 'btn-success', 'btn-outline-success', 'btn-danger', 'btn-outline-danger');
                        if (isAprovar) {
                            b.classList.add(dec === 'aprovar' ? 'btn-success' : 'btn-outline-success');
                            if (dec === 'aprovar') b.classList.add('active');
                        } else {
                            b.classList.add(dec === 'rejeitar' ? 'btn-danger' : 'btn-outline-danger');
                            if (dec === 'rejeitar') b.classList.add('active');
                        }
                    });

                    // Efeito visual na linha e mostra/esconde campos de edição
                    const row = document.getElementById('lote-item-row-' + itemId);
                    const editRow = document.getElementById('lote-item-edit-' + itemId);
                    if (dec === 'rejeitar') {
                        row.classList.add('table-danger');
                        row.style.opacity = '0.6';
                        row.style.textDecoration = 'line-through';
                        if (editRow) editRow.style.display = 'none';
                    } else {
                        row.classList.remove('table-danger');
                        row.style.opacity = '1';
                        row.style.textDecoration = 'none';
                        if (editRow) editRow.style.display = '';
                    }
                    AprovacoesComplementares.recalcularTotaisTela();
                });
            });

            // Listener: LPU selecionada por item
            document.querySelectorAll('.lote-lpu-sel').forEach(sel => {
                sel.addEventListener('change', (e) => {
                    const itemId = e.target.dataset.itemId;
                    const lpuId = e.target.value ? parseInt(e.target.value) : null;
                    AprovacoesComplementares.loteDecisoes[itemId].lpuId = lpuId;
                    // Mostra valor unitário da LPU escolhida
                    const lpuInfo = AprovacoesComplementares.listaCompletaLpus.find(l => l.id == lpuId);
                    const unitEl = document.getElementById('lpu-unit-' + itemId);
                    if (unitEl) unitEl.textContent = lpuInfo && lpuInfo.valor ? 'unit. ' + AprovacoesComplementares.formatarMoeda(lpuInfo.valor) : '';
                    AprovacoesComplementares.atualizarValorEstimadoItem(itemId);
                    AprovacoesComplementares.recalcularTotaisTela();
                });
            });

            // Listener: Quantidade por item
            document.querySelectorAll('.lote-qtd-inp').forEach(inp => {
                inp.addEventListener('input', (e) => {
                    const itemId = e.target.dataset.itemId;
                    AprovacoesComplementares.loteDecisoes[itemId].quantidade = parseInt(e.target.value) || 1;
                    AprovacoesComplementares.atualizarValorEstimadoItem(itemId);
                    AprovacoesComplementares.recalcularTotaisTela();
                });
            });

            // Listener: BOQ por item
            document.querySelectorAll('.lote-boq-inp').forEach(inp => {
                inp.addEventListener('input', (e) => {
                    const itemId = e.target.dataset.itemId;
                    AprovacoesComplementares.loteDecisoes[itemId].boq = e.target.value;
                });
            });

            // Listener: Status do registro por item
            document.querySelectorAll('.lote-status-sel').forEach(sel => {
                sel.addEventListener('change', (e) => {
                    const itemId = e.target.dataset.itemId;
                    AprovacoesComplementares.loteDecisoes[itemId].statusRegistro = e.target.value;
                    AprovacoesComplementares.recalcularTotaisTela();
                });
            });

            // Renderiza detalhes da OS com valores (restaurado)
            if (osCompleta) {
                AprovacoesComplementares.renderizarItensExistentesComBuffer(isController);
                AprovacoesComplementares.recalcularTotaisTela();
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

    recalcularTotaisTela: () => {
        // Calcula valor total da OS (Atual e Projetado)
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
                } else {
                    // Sem alteração, soma o valor original ao projetado (se ativo)
                    if ((item.statusRegistro || 'ATIVO') === 'ATIVO') {
                        valorProjetadoOS += valorOriginalItem;
                    }
                }
            });
        }

        // Soma os novos itens do lote aprovados, usando LPU/Qtd/Status da decisão
        if (AprovacoesComplementares.currentLoteItens) {
            const valorNovoItens = AprovacoesComplementares.currentLoteItens.reduce((sum, item) => {
                const decisao = AprovacoesComplementares.loteDecisoes[item.id];
                // Ignora itens rejeitados ou marcados como INATIVO
                if (!decisao || decisao.decisao !== 'aprovar') return sum;
                if ((decisao.statusRegistro || 'ATIVO') !== 'ATIVO') return sum;
                // Usa LPU e Qtd da decisão (pode ter sido alterada pelo coordenador)
                const lpuId = decisao.lpuId || item.lpuOriginalId;
                const lpu = AprovacoesComplementares.listaCompletaLpus.find(l => l.id == lpuId);
                const valorUnit = lpu ? (lpu.valor || 0) : 0;
                const qtd = decisao.quantidade || item.quantidadeOriginal;
                return sum + (valorUnit * qtd);
            }, 0);
            valorProjetadoOS += valorNovoItens;
        }

        // Atualiza Widgets no Topo
        AprovacoesComplementares.renderizarDetalhesOs(valorAtualOS, valorProjetadoOS);

        // Atualiza total aprovado no rodapé da tabela de lote
        const footerEl = document.getElementById('lote-total-footer');
        if (footerEl && AprovacoesComplementares.currentLoteItens) {
            const totalAprovado = AprovacoesComplementares.currentLoteItens.reduce((sum, item) => {
                const decisao = AprovacoesComplementares.loteDecisoes[item.id];
                if (!decisao || decisao.decisao !== 'aprovar') return sum;
                if ((decisao.statusRegistro || 'ATIVO') !== 'ATIVO') return sum;
                const lpuId = decisao.lpuId || item.lpuOriginalId;
                const lpu = AprovacoesComplementares.listaCompletaLpus.find(l => l.id == lpuId);
                const qtd = decisao.quantidade || item.quantidadeOriginal;
                return sum + ((lpu ? lpu.valor : 0) * qtd);
            }, 0);
            footerEl.textContent = AprovacoesComplementares.formatarMoeda(totalAprovado);
        }
    },

    // Atualiza o campo "Vlr Est." de um item do lote
    atualizarValorEstimadoItem: (itemId) => {
        const decisao = AprovacoesComplementares.loteDecisoes[itemId];
        if (!decisao) return;
        const lpuId = decisao.lpuId;
        const qtd = decisao.quantidade || 1;
        const lpu = AprovacoesComplementares.listaCompletaLpus.find(l => l.id == lpuId);
        const valorEst = lpu ? (lpu.valor || 0) * qtd : 0;
        const el = document.getElementById('valor-est-' + itemId);
        if (el) el.value = AprovacoesComplementares.formatarMoeda(valorEst).replace('R$', '').trim();
    },

    // Filtra as options do select de LPU de um item pelo texto digitado
    filtrarLpuSelect: (itemId, termo) => {
        const select = document.getElementById('lpu-sel-' + itemId);
        if (!select) return;
        const t = termo.toLowerCase().trim();
        Array.from(select.options).forEach(opt => {
            opt.style.display = (!t || opt.text.toLowerCase().includes(t)) ? '' : 'none';
        });
        // Se houver apenas 1 visível, pré-seleciona automaticamente
        const visiveis = Array.from(select.options).filter(o => o.style.display !== 'none');
        if (visiveis.length === 1 && t.length > 2) {
            select.value = visiveis[0].value;
            select.dispatchEvent(new Event('change'));
        }
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
        if (!tbody) return;
        tbody.innerHTML = '';

        if (itens.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-3 small">Nenhum item vinculado a esta OS.</td></tr>';
            return;
        }

        itens.forEach(item => {
            const tr = document.createElement('tr');
            const alteracao = AprovacoesComplementares.alteracoesBuffer[item.id];

            // Trata valor unitário
            let rawValor = 0;
            if (item.lpu) {
                if (item.lpu.valor !== undefined && item.lpu.valor !== null) rawValor = item.lpu.valor;
                else if (item.lpu.valorSemImposto !== undefined && item.lpu.valorSemImposto !== null) rawValor = item.lpu.valorSemImposto;
            }
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

            // Formatação Visual
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

            const btnIcon = statusFinal === 'ATIVO' ? 'bi-slash-circle' : 'bi-arrow-counterclockwise';
            const btnClass = statusFinal === 'ATIVO' ? 'btn-outline-danger' : 'btn-outline-success';
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
        AprovacoesComplementares.recalcularTotaisTela();
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

                    // Monta alterações dos itens existentes
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
                        lpuId: (decisao && decisao.lpuId) ? Number(decisao.lpuId) : item.lpuOriginalId,
                        quantidade: (decisao && decisao.quantidade) ? Number(decisao.quantidade) : item.quantidadeOriginal,
                        boq: (decisao && decisao.boq) ? decisao.boq : '',
                        statusRegistro: (decisao && decisao.statusRegistro) ? decisao.statusRegistro : 'ATIVO',
                        justificativa: justificativa,
                        alteracoesItensExistentesJson: listaAlteracoes.length > 0 ? JSON.stringify(listaAlteracoes) : null
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
        AprovacoesComplementares.alteracoesBuffer = {};
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
