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
            const response = await fetch(`${AprovacoesComplementares.MS_URL}/pendentes?role=${userRole}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
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
            const loadingClass = cache ? '' : 'loading-text';

            const lpuInfo = AprovacoesComplementares.listaCompletaLpus.find(l => l.id === item.lpuOriginalId);
            const nomeLpu = lpuInfo ? lpuInfo.nome.split('|')[1] || lpuInfo.nome : `LPU ID: ${item.lpuOriginalId}`;

            let valorTotal = item.valorTotalEstimado;
            if (!valorTotal || valorTotal === 0) {
                const valorUnit = lpuInfo ? lpuInfo.valor : 0;
                valorTotal = valorUnit * item.quantidadeOriginal;
            }

            const isController = item.status === 'PENDENTE_CONTROLLER';
            const btnClass = isController ? 'btn-success' : 'btn-outline-success';
            const btnIcon = isController ? 'bi-check-lg' : 'bi-pencil-square';
            const btnTitle = isController ? 'Aprovar' : 'Analisar';

            tr.innerHTML = `
            <td><span class="os-placeholder-${item.osId} text-dark fw-bold">${osDisplay}</span></td>
            
            <td><small class="segmento-placeholder-${item.osId} ${loadingClass}">${segmentoDisplay}</small></td>
            
            <td><small class="site-placeholder-${item.osId} ${loadingClass}">${siteDisplay}</small></td>
            <td><small class="projeto-placeholder-${item.osId} ${loadingClass}">${projetoDisplay}</small></td>
            <td><small class="text-truncate d-inline-block" style="max-width: 250px;" title="${nomeLpu}">${nomeLpu}</small></td>
            <td class="text-center"><span class="badge bg-light text-dark border">${item.quantidadeOriginal}</span></td>
            <td class="text-end fw-bold text-success">${AprovacoesComplementares.formatarMoeda(valorTotal)}</td>
            <td class="text-center"><span class="badge bg-light text-dark border">${item.status}</span></td>
            <td class="text-center">
                <button class="btn btn-sm ${btnClass}" onclick="AprovacoesComplementares.abrirModalAnalise('${item.id}')" title="${btnTitle}"><i class="bi ${btnIcon}"></i></button>
                <button class="btn btn-sm btn-outline-danger" onclick="AprovacoesComplementares.prepararRejeicaoInicial('${item.id}')" title="Rejeitar"><i class="bi bi-x-lg"></i></button>
            </td>
        `;
            tbody.appendChild(tr);
        });
    },

    abrirModalAnalise: async (id) => {
        try {
            const btn = document.activeElement;
            const originalIcon = btn.innerHTML;
            if (btn && btn.tagName === 'BUTTON') btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';

            AprovacoesComplementares.alteracoesBuffer = {};

            const respSol = await fetch(`${AprovacoesComplementares.MS_URL}/${id}`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
            const solicitacao = await respSol.json();
            AprovacoesComplementares.currentSolicitacao = solicitacao;

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

            if (btn && btn.tagName === 'BUTTON') btn.innerHTML = originalIcon;

            const isController = solicitacao.status === 'PENDENTE_CONTROLLER';

            if (osCompleta) {
                AprovacoesComplementares.renderizarDetalhesOs(osCompleta);
                AprovacoesComplementares.renderizarItensExistentesComBuffer(isController);
            }

            const lpuSolicitada = AprovacoesComplementares.listaCompletaLpus.find(l => l.id === solicitacao.lpuOriginalId);
            document.getElementById('viewLpuOriginal').value = lpuSolicitada ? lpuSolicitada.nome : `ID: ${solicitacao.lpuOriginalId}`;
            document.getElementById('viewQtdOriginal').value = solicitacao.quantidadeOriginal;

            document.getElementById('viewJustificativaManagerText').innerText = solicitacao.justificativa || "Sem justificativa.";
            document.getElementById('viewJustificativaManager').value = solicitacao.justificativa;

            document.getElementById('analiseSolicitacaoId').value = solicitacao.id;

            const qtd = isController ? solicitacao.quantidadeAprovada : (solicitacao.quantidadeAprovada || solicitacao.quantidadeOriginal);
            const boq = isController ? solicitacao.boqAprovado : (solicitacao.boqAprovado || '');
            const status = isController ? solicitacao.statusRegistroAprovado : (solicitacao.statusRegistroAprovado || 'ATIVO');
            const just = solicitacao.justificativaCoordenador || '';

            document.getElementById('editQuantidade').value = qtd;
            document.getElementById('editBoq').value = boq;
            document.getElementById('editStatusRegistro').value = status;
            document.getElementById('editJustificativaCoordenador').value = just;

            ['editQuantidade', 'editBoq', 'editStatusRegistro', 'editJustificativaCoordenador'].forEach(fid => {
                document.getElementById(fid).disabled = isController;
            });

            const btnSalvar = document.querySelector('#modalAnaliseCoordenador .btn-success') || document.querySelector('#modalAnaliseCoordenador .btn-primary');
            if (isController) {
                btnSalvar.innerHTML = '<i class="bi bi-check-circle-fill me-1"></i> Aprovar Alterações';
            } else {
                btnSalvar.innerHTML = '<i class="bi bi-send-fill me-1"></i> Enviar Proposta';
            }
            btnSalvar.className = 'btn btn-success px-4 fw-bold shadow-sm';

            const lpuSelect = document.getElementById('editLpuSelect');
            if (AprovacoesComplementares.choicesMain) { AprovacoesComplementares.choicesMain.destroy(); }

            let html = '<option value="">Selecione...</option>';
            const selectedId = isController ? solicitacao.lpuAprovadaId : (solicitacao.lpuAprovadaId || solicitacao.lpuOriginalId);

            AprovacoesComplementares.listaCompletaLpus.forEach(l => {
                html += `<option value="${l.id}" ${l.id == selectedId ? 'selected' : ''}>${l.nome}</option>`;
            });
            lpuSelect.innerHTML = html;

            AprovacoesComplementares.choicesMain = new Choices(lpuSelect, { searchEnabled: true, itemSelectText: '', shouldSort: false });
            if (isController) AprovacoesComplementares.choicesMain.disable();

            const modalEl = document.getElementById('modalAnaliseCoordenador');
            let modalInstance = bootstrap.Modal.getInstance(modalEl);
            if (!modalInstance) { modalInstance = new bootstrap.Modal(modalEl); }

            const triggerEl = document.querySelector('#pills-analise-tab');
            if (triggerEl) bootstrap.Tab.getOrCreateInstance(triggerEl).show();

            modalInstance.show();

        } catch (e) {
            console.error(e);
            alert('Erro ao abrir: ' + e.message);
        }
    },

    renderizarDetalhesOs: (os) => {
        let regional = os.regional;
        let descricao = os.descricao;
        let site = os.site;

        if (os.detalhes && os.detalhes.length > 0) {
            if (!regional || regional === 'null') regional = os.detalhes[0].regional;
            if (!descricao || descricao === 'null') descricao = os.detalhes[0].objetoContratado;
            if (!site || site === 'null') site = os.detalhes[0].site;
        }

        const widgets = [
            { label: 'OS', value: os.os || '-', icon: 'bi-hash' },
            { label: 'Projeto', value: os.projeto || '-', icon: 'bi-folder' },
            { label: 'Regional', value: regional || '-', icon: 'bi-geo-alt' },
            { label: 'Site', value: site || '-', icon: 'bi-broadcast-pin' }
        ];

        let html = '';
        widgets.forEach(w => {
            html += `
                <div class="col-md-3">
                    <div class="info-widget">
                        <i class="bi ${w.icon}"></i>
                        <span class="info-widget-label">${w.label}</span>
                        <span class="info-widget-value" title="${w.value}">${w.value}</span>
                    </div>
                </div>
            `;
        });

        html += `
            <div class="col-12">
                <div class="p-3 bg-white rounded border shadow-sm">
                    <small class="text-muted fw-bold text-uppercase d-block mb-1"><i class="bi bi-card-text me-1"></i> Objeto / Descrição</small>
                    <span class="text-dark">${descricao || '-'}</span>
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
            tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-3">Vazio</td></tr>';
            return;
        }

        itens.forEach(item => {
            const tr = document.createElement('tr');
            const alteracao = AprovacoesComplementares.alteracoesBuffer[item.id];

            const statusOriginal = item.statusRegistro || 'ATIVO';
            const qtdOriginal = item.quantidade;
            const lpuNomeOriginal = item.lpu ? item.lpu.nomeLpu : '-';
            const valorUnitario = item.lpu ? (item.lpu.valorSemImposto || item.lpu.valor || 0) : 0;

            const statusFinal = alteracao && alteracao.novoStatus ? alteracao.novoStatus : statusOriginal;
            const qtdFinal = alteracao && alteracao.novaQtd ? alteracao.novaQtd : qtdOriginal;
            const lpuAlterada = alteracao && alteracao.novaLpuId && alteracao.novaLpuId != (item.lpu?.id);

            if (alteracao) tr.classList.add('item-modificado');
            if (statusFinal === 'INATIVO') tr.classList.add('text-muted');

            const htmlQtd = (alteracao && alteracao.novaQtd != qtdOriginal)
                ? `<span class="valor-antigo">${qtdOriginal}</span><span class="valor-novo">${qtdFinal}</span>`
                : qtdOriginal;

            const htmlStatus = (alteracao && alteracao.novoStatus != statusOriginal)
                ? `<span class="badge bg-secondary text-decoration-line-through me-1">${statusOriginal}</span><span class="badge ${statusFinal === 'ATIVO' ? 'bg-success' : 'bg-danger'}">${statusFinal} (Prop.)</span>`
                : `<span class="badge ${statusOriginal === 'ATIVO' ? 'bg-success' : 'bg-secondary'}">${statusOriginal}</span>`;

            let htmlLpu = `<span class="text-truncate d-inline-block" style="max-width:150px;">${lpuNomeOriginal}</span>`;
            if (lpuAlterada) {
                const novaLpu = AprovacoesComplementares.listaCompletaLpus.find(l => l.id == alteracao.novaLpuId);
                const novoNome = novaLpu ? novaLpu.nome.split('|')[1] : '(Trocado)';
                htmlLpu = `<span class="valor-novo" title="${novoNome}"><i class="bi bi-pencil-fill me-1"></i> ${novoNome}</span>`;
            }

            const btnIcon = statusFinal === 'ATIVO' ? 'bi-slash-circle' : 'bi-check-lg';
            const btnClass = statusFinal === 'ATIVO' ? 'btn-outline-danger' : 'btn-success';
            const btnTitle = statusFinal === 'ATIVO' ? 'Propor Inativação' : 'Propor Ativação';

            const acoesHtml = isController ?
                `<span class="text-muted small"><i class="bi bi-lock"></i></span>` :
                `<div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-primary" onclick="AprovacoesComplementares.abrirModalEdicaoItem(${item.id})" title="Propor Edição"><i class="bi bi-pencil"></i></button>
                    <button class="btn ${btnClass}" onclick="AprovacoesComplementares.toggleStatusBuffer(${item.id}, '${statusFinal}')" title="${btnTitle}"><i class="bi ${btnIcon}"></i></button>
                 </div>`;

            tr.innerHTML = `
                <td>${item.lpu ? item.lpu.codigoLpu : '-'}</td>
                <td>${htmlLpu}</td>
                <td class="text-center fw-bold">${htmlQtd}</td>
                <td class="text-end">${AprovacoesComplementares.formatarMoeda(valorUnitario)}</td>
                <td class="text-end fw-bold">${AprovacoesComplementares.formatarMoeda(item.valorTotal)}</td>
                <td class="text-center">${htmlStatus}</td>
                <td class="text-center">${acoesHtml}</td>
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
    },

    salvarAprovacao: async () => {
        const id = document.getElementById('analiseSolicitacaoId').value;
        const justificativa = document.getElementById('editJustificativaCoordenador').value;
        const lpuId = document.getElementById('editLpuSelect').value;

        const isController = AprovacoesComplementares.currentSolicitacao.status === 'PENDENTE_CONTROLLER';

        if (!justificativa || justificativa.trim().length < 3) {
            AprovacoesComplementares.mostrarAlerta('Preencha a Justificativa.');
            return;
        }
        if (!isController && !lpuId) {
            AprovacoesComplementares.mostrarAlerta('Selecione a LPU da decisão.');
            return;
        }

        const alteracoesArray = Object.keys(AprovacoesComplementares.alteracoesBuffer).map(itemId => {
            return {
                itemId: parseInt(itemId),
                ...AprovacoesComplementares.alteracoesBuffer[itemId]
            };
        });

        const payload = {
            aprovadorId: localStorage.getItem('usuarioId'),
            lpuId: lpuId ? parseInt(lpuId) : null,
            quantidade: parseInt(document.getElementById('editQuantidade').value),
            boq: document.getElementById('editBoq').value,
            statusRegistro: document.getElementById('editStatusRegistro').value,
            justificativa: justificativa,
            alteracoesItensExistentesJson: JSON.stringify(alteracoesArray)
        };

        const endpointAction = isController ? 'controller/aprovar' : 'coordenador/aprovar';

        try {
            AprovacoesComplementares.mostrarAlerta('Processando...');

            const resp = await fetch(`${AprovacoesComplementares.MS_URL}/${id}/${endpointAction}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (resp.ok) {
                const modal = bootstrap.Modal.getInstance(document.getElementById('modalAnaliseCoordenador'));
                if (modal) modal.hide();

                const alerta = bootstrap.Modal.getInstance(document.getElementById('modalAlerta'));
                if (alerta) alerta.hide();

                AprovacoesComplementares.carregarPendencias();
            } else { throw new Error('Erro ao processar'); }
        } catch (e) { alert('Erro: ' + e.message); }
    },

    prepararRejeicaoInicial: (id) => {
        document.getElementById('analiseSolicitacaoId').value = id;
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

        const isController = AprovacoesComplementares.currentSolicitacao?.status === 'PENDENTE_CONTROLLER';
        const endpointAction = isController ? 'controller/devolver' : 'coordenador/rejeitar';

        try {
            const usuarioId = localStorage.getItem('usuarioId');
            await fetch(`${AprovacoesComplementares.MS_URL}/${id}/${endpointAction}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ aprovadorId: usuarioId, motivo: motivo })
            });

            bootstrap.Modal.getInstance(document.getElementById('modalRejeitar')).hide();
            const mainModal = bootstrap.Modal.getInstance(document.getElementById('modalAnaliseCoordenador'));
            if (mainModal) mainModal.hide();

            AprovacoesComplementares.carregarPendencias();
        } catch (e) {
            alert("Erro ao rejeitar");
        }
    }
};

window.AprovacoesComplementares = AprovacoesComplementares;
window.renderizarTabelaPendentesComplementares = AprovacoesComplementares.carregarPendencias;
window.carregarDadosHistoricoComplementares = AprovacoesComplementares.carregarDadosHistoricoComplementares;