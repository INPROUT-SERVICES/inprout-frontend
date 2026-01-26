document.addEventListener('DOMContentLoaded', () => {

    // --- VARIÁVEIS GLOBAIS ---
    // API_BASE_URL já deve estar definido no seu global.js, mas garantimos aqui
    const API_BASE_URL = 'https://www.inproutservices.com.br/api';
    const userRole = (localStorage.getItem("role") || "").trim().toUpperCase();
    const userId = localStorage.getItem('usuarioId'); // Essencial para os novos endpoints

    // Mapeamento dos elementos de Abas (Tabs)
    const tabs = {
        filaFaturamento: {
            nav: document.getElementById('nav-fila-faturamento'),
            pane: document.getElementById('fila-faturamento-pane'),
            btn: document.getElementById('fila-faturamento-tab'),
            thead: document.getElementById('thead-fila-faturamento'),
            tbody: document.getElementById('tbody-fila-faturamento'),
            loaderId: '#fila-faturamento-pane'
        },
        solicitarId: {
            nav: document.getElementById('nav-solicitar-id'),
            pane: document.getElementById('solicitar-id-pane'),
            btn: document.getElementById('solicitar-id-tab'),
            thead: document.getElementById('thead-solicitar-id'),
            tbody: document.getElementById('tbody-solicitar-id'),
            loaderId: '#solicitar-id-pane'
        },
        solicitarAdiantamento: {
            nav: document.getElementById('nav-solicitar-adiantamento'),
            pane: document.getElementById('solicitar-adiantamento-pane'),
            btn: document.getElementById('solicitar-adiantamento-tab'),
            thead: document.getElementById('thead-solicitar-adiantamento'),
            tbody: document.getElementById('tbody-solicitar-adiantamento'),
            loaderId: '#solicitar-adiantamento-pane'
        },
        visaoAdiantamentos: {
            nav: document.getElementById('nav-visao-adiantamentos'),
            pane: document.getElementById('nav-visao-adiantamentos'),
            btn: document.getElementById('visao-adiantamentos-tab'),
            thead: document.getElementById('thead-visao-adiantamentos'),
            tbody: document.getElementById('tbody-visao-adiantamentos'),
            loaderId: '#visao-adiantamentos-pane'
        },
        historicoFaturado: {
            nav: document.getElementById('nav-historico-faturado'),
            pane: document.getElementById('historico-faturado-pane'),
            btn: document.getElementById('historico-faturado-tab'),
            thead: document.getElementById('thead-historico-faturado'),
            tbody: document.getElementById('tbody-historico-faturado'),
            loaderId: '#historico-faturado-pane'
        }
    };
    
    // --- (NOVOS) MAPEAMENTO DOS CARDS DO DASHBOARD ---
    const cards = {
        solicitacao: document.getElementById('card-pendente-solicitacao'),
        fila: document.getElementById('card-pendente-fila'),
        recusados: document.getElementById('card-recusados'),
        adiantamentos: document.getElementById('card-adiantamentos'),
        faturados: document.getElementById('card-faturados')
    };
    
    const kpis = {
        solicitacao: document.getElementById('kpi-pendente-solicitacao'),
        fila: document.getElementById('kpi-pendente-fila'),
        recusados: document.getElementById('kpi-recusados'),
        adiantamentos: document.getElementById('kpi-adiantamentos'),
        faturadosMes: document.getElementById('kpi-faturados-mes')
    };


    // Modais do Assistant
    const modalAcaoSimplesEl = document.getElementById('modalAcaoSimplesFaturamento');
    const modalAcaoSimples = modalAcaoSimplesEl ? new bootstrap.Modal(modalAcaoSimplesEl) : null;
    const modalRecusarEl = document.getElementById('modalRecusarFaturamento');
    const modalRecusar = modalRecusarEl ? new bootstrap.Modal(modalRecusarEl) : null;


    // --- (NOVAS) FUNÇÕES AUXILIARES DE FORMATAÇÃO ---
    const get = (obj, path, defaultValue = '-') => {
        if (obj === null || obj === undefined) {
            return defaultValue;
        }
        const value = path.split('.').reduce((a, b) => (a && a[b] != null ? a[b] : undefined), obj);
        return value !== undefined ? value : defaultValue;
    };
    
    const formatarData = (dataStr) => {
        if (!dataStr || dataStr === '-') return '-';
        let dataLimpa = dataStr.split(' ')[0];
        if (dataLimpa.includes('-')) { // Formato YYYY-MM-DD
            dataLimpa = dataLimpa.split('-').reverse().join('/');
        }
        // Trata formatos dd/MM/yyyy HH:mm:ss
        else if (dataLimpa.includes('/')) {
             dataLimpa = dataLimpa.split('/')[0].length === 2 ? dataLimpa : dataStr.split(' ')[0];
        }
        
        if (dataLimpa === '//' || dataLimpa === 'Invalid Date') return '-';
        return dataLimpa;
    };

    const formatarMoeda = (valor) => {
        if (valor === null || valor === undefined || isNaN(Number(valor))) {
            return '-';
        }
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
    };

    // --- FUNÇÕES DE LÓGICA DA PÁGINA ---
    
    function setupRoleBasedTabs() {
        Object.values(tabs).forEach(tab => {
            if (tab.nav) tab.nav.style.display = 'none';
        });
        const visibilidade = {
            ADMIN: ['filaFaturamento', 'solicitarId', 'solicitarAdiantamento', 'visaoAdiantamentos', 'historicoFaturado'],
            CONTROLLER: ['filaFaturamento', 'solicitarId', 'solicitarAdiantamento', 'visaoAdiantamentos', 'historicoFaturado'],
            ASSISTANT: ['filaFaturamento', 'visaoAdiantamentos', 'historicoFaturado'],
            COORDINATOR: ['solicitarId', 'solicitarAdiantamento', 'visaoAdiantamentos', 'historicoFaturado'],
            MANAGER: []
        };
        const abasVisiveis = visibilidade[userRole] || [];
        abasVisiveis.forEach(tabKey => {
            if (tabs[tabKey] && tabs[tabKey].nav) {
                tabs[tabKey].nav.style.display = 'block';
            }
        });
        const primeiraAbaVisivel = Object.values(tabs).find(tab =>
            tab.nav && tab.nav.style.display === 'block'
        );
        if (primeiraAbaVisivel) {
            Object.values(tabs).forEach(tab => {
                tab.btn?.classList.remove('active');
                tab.pane?.classList.remove('show', 'active');
            });
            primeiraAbaVisivel.btn?.classList.add('active');
            primeiraAbaVisivel.pane?.classList.add('show', 'active');
        } else {
            const content = document.getElementById('faturamentoTabContent');
            if (content) {
                content.innerHTML = '<div class="alert alert-warning">Você não tem permissão para acessar este módulo.</div>';
            }
        }
    }

    function toggleLoader(paneId, ativo = true) {
        const container = document.querySelector(paneId);
        if (container) {
            const overlay = container.querySelector(".overlay-loader");
            if (overlay) {
                overlay.classList.toggle("d-none", !ativo);
            }
        }
    }

    function formatarDataHora(dataISO) {
        if (!dataISO) return 'N/A';
        try {
            return new Date(dataISO).toLocaleString('pt-BR', {
                dateStyle: 'short',
                timeStyle: 'short'
            });
        } catch (e) {
            return 'Data inválida';
        }
    }
    
    function formatarStatusFaturamento(status) {
        if (!status) return '';
        const statusLimpo = status.replace(/_/g, ' ');
        let cor = 'secondary';
        switch (status) {
            case 'PENDENTE_ASSISTANT': cor = 'warning'; break;
            case 'ID_RECEBIDO': cor = 'info'; break;
            case 'ID_RECUSADO': cor = 'danger'; break;
            case 'FATURADO': cor = 'success'; break;
        }
        return `<span class="badge text-bg-${cor}">${statusLimpo}</span>`;
    }

    // --- (NOVA) FUNÇÃO DO DASHBOARD ---
    async function carregarDashboard() {
        if (!userId) return; // Não faz nada se não tiver ID
        
        try {
            const response = await fetchComAuth(`${API_BASE_URL}/faturamento/dashboard`, {
                headers: { 'X-User-ID': userId }
            });
            if (!response.ok) throw new Error('Falha ao carregar dashboard.');
            
            const data = await response.json();

            // 1. Preenche os valores dos KPIs
            if (kpis.solicitacao) kpis.solicitacao.textContent = data.pendenteSolicitacao;
            if (kpis.fila) kpis.fila.textContent = data.pendenteFila;
            if (kpis.recusados) kpis.recusados.textContent = data.idsRecusados;
            if (kpis.adiantamentos) kpis.adiantamentos.textContent = data.adiantamentosPendentes;
            if (kpis.faturadosMes) kpis.faturadosMes.textContent = data.faturadoMes;

            // 2. Controla a visibilidade dos cards com base na role
            switch (userRole) {
                case 'ADMIN':
                case 'CONTROLLER':
                    Object.values(cards).forEach(card => card.style.display = 'block');
                    break;
                case 'COORDINATOR':
                    if (cards.solicitacao) cards.solicitacao.style.display = 'block';
                    if (cards.recusados) cards.recusados.style.display = 'block';
                    if (cards.adiantamentos) cards.adiantamentos.style.display = 'block';
                    break;
                case 'ASSISTANT':
                    if (cards.fila) cards.fila.style.display = 'block';
                    if (cards.recusados) cards.recusados.style.display = 'block';
                    if (cards.adiantamentos) cards.adiantamentos.style.display = 'block';
                    break;
                // MANAGER não vê nada por padrão (CSS)
            }
            
        } catch (error) {
            console.error("Erro ao carregar dashboard:", error);
            // Esconde o container do dashboard se der erro
            const dashboardContainer = document.getElementById('dashboard-container-faturamento');
            if (dashboardContainer) dashboardContainer.innerHTML = `<p class="text-danger small">${error.message}</p>`;
        }
    }


    // --- FUNÇÕES DE RENDERIZAÇÃO DAS TABELAS (ATUALIZADAS) ---

    async function carregarFilaFaturamento() {
        const tab = tabs.filaFaturamento;
        toggleLoader(tab.loaderId, true);
        
        try {
            // ATUALIZADO: Envia X-User-ID
            const response = await fetchComAuth(`${API_BASE_URL}/faturamento/fila-assistant`, {
                headers: { 'X-User-ID': userId }
            });
            if (!response.ok) throw new Error('Falha ao carregar a fila de faturamento.');
            const dados = await response.json();
            
            // ================== INÍCIO DA ALTERAÇÃO (FILA FATURAMENTO) ==================
            tab.thead.innerHTML = `
                <tr>
                    <th>Tipo</th>
                    <th>OS</th>
                    <th>Projeto</th>
                    <th>Segmento</th>
                    <th>LPU</th>
                    <th>Lote</th>
                    <th>BOQ</th>
                    <th>PO</th>
                    <th>Item</th>
                    <th>Objeto Contratado</th>
                    <th>Qtd.</th>
                    <th>Valor Total OS</th>
                    <th>Observações</th>
                    <th>Data PO</th>
                    <th>Data Atividade</th>
                    <th>KEY</th>
                    <th>Ações</th>
                </tr>
            `;

            if (dados.length === 0) {
                tab.tbody.innerHTML = `<tr><td colspan="17" class="text-center text-muted p-4">Nenhuma solicitação pendente na fila.</td></tr>`;
            } else {
                tab.tbody.innerHTML = dados.map(item => {
                    const detalhe = item.osLpuDetalhe; // Este é o OsLpuDetalheCompletoDto
                    const ultimoLancamento = get(detalhe, 'ultimoLancamento', {});
                    const isAdiantamento = item.tipo === 'ADIANTAMENTO';
                    const linhaClass = isAdiantamento ? 'linha-adiantamento' : '';
                    const tipoBadge = isAdiantamento ? `<span class="badge bg-warning">ADIANTAMENTO</span>` : `<span class="badge bg-info">REGULAR</span>`;
                    
                    let acoesHtml = '';
                    if (userRole === 'ASSISTANT' || userRole === 'ADMIN') {
                         acoesHtml = `
                            <button class="btn btn-sm btn-outline-success" data-action="id-recebido" data-id="${item.id}" title="Marcar ID Recebido">
                                <i class="bi bi-check-circle"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-danger" data-action="id-recusado" data-id="${item.id}" title="Marcar ID Recusado">
                                <i class="bi bi-x-circle"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-primary" data-action="faturado" data-id="${item.id}" title="Marcar como Faturado">
                                <i class="bi bi-cash-stack"></i>
                            </button>
                        `;
                    } else {
                        acoesHtml = '—'; // Visão (Controller)
                    }

                    return `
                        <tr class="${linhaClass}">
                            <td data-label="Tipo">${tipoBadge}</td>
                            <td data-label="OS">${get(detalhe, 'os.os', '-')}</td>
                            <td data-label="Projeto">${get(detalhe, 'os.projeto', '-')}</td>
                            <td data-label="Segmento">${get(detalhe, 'os.segmento.nome', '-')}</td>
                            <td data-label="LPU">${get(detalhe, 'lpu.codigoLpu', '-')}</td>
                            <td data-label="Lote">${get(detalhe, 'lote', '-')}</td>
                            <td data-label="BOQ">${get(detalhe, 'boq', '-')}</td>
                            <td data-label="PO">${get(detalhe, 'po', '-')}</td>
                            <td data-label="Item">${get(detalhe, 'item', '-')}</td>
                            <td data-label="Objeto Contratado">${get(detalhe, 'lpu.nomeLpu', '-')}</td>
                            <td data-label="Qtd.">${get(detalhe, 'quantidade', '-')}</td>
                            <td data-label="Valor Total OS">${formatarMoeda(get(detalhe, 'valorTotal'))}</td>
                            <td data-label="Observações">${get(detalhe, 'observacoes', '-')}</td>
                            <td data-label="Data PO">${formatarData(get(detalhe, 'dataPo'))}</td>
                            <td data-label="Data Atividade">${formatarData(get(ultimoLancamento, 'dataAtividade'))}</td>
                            <td data-label="KEY">${get(detalhe, 'key', '-')}</td>
                            <td data-label="Ações"><div class="d-flex justify-content-center gap-1">${acoesHtml}</div></td>
                        </tr>
                    `;
                }).join('');
            }
            // ================== FIM DA ALTERAÇÃO (FILA FATURAMENTO) ==================

        } catch (error) {
            console.error(error);
            tab.tbody.innerHTML = `<tr><td colspan="17" class="text-center text-danger p-4">${error.message}</td></tr>`;
        } finally {
            toggleLoader(tab.loaderId, false);
        }
    }

    async function carregarFilaSolicitarID() {
        const tab = tabs.solicitarId;
        toggleLoader(tab.loaderId, true);
        
        try {
            // ATUALIZADO: Envia X-User-ID
            const response = await fetchComAuth(`${API_BASE_URL}/faturamento/fila-coordenador`, {
                headers: { 'X-User-ID': userId }
            });
            if (!response.ok) throw new Error('Falha ao carregar a fila de solicitação de ID.');
            const dados = await response.json();
            
            // ================== INÍCIO DA ALTERAÇÃO (SOLICITAR ID) ==================
            tab.thead.innerHTML = `
                <tr>
                    <th>Tipo</th>
                    <th>OS</th>
                    <th>Projeto</th>
                    <th>Segmento</th>
                    <th>LPU</th>
                    <th>Lote</th>
                    <th>BOQ</th>
                    <th>PO</th>
                    <th>Item</th>
                    <th>Objeto Contratado</th>
                    <th>Qtd.</th>
                    <th>Valor Total OS</th>
                    <th>Observações</th>
                    <th>Data PO</th>
                    <th>Data Atividade</th>
                    <th>KEY</th>
                    <th>Ação</th>
                </tr>
            `;

            if (dados.length === 0) {
                tab.tbody.innerHTML = `<tr><td colspan="17" class="text-center text-muted p-4">Nenhum item na etapa "Solicitar ID" aguardando ação.</td></tr>`;
            } else {
                tab.tbody.innerHTML = dados.map(item => {
                    const detalhe = item.detalhe; // Este é o OsLpuDetalheCompletoDto
                    const ultimoLancamento = get(detalhe, 'ultimoLancamento', {});
                    const tipoBadge = `<span class="badge bg-info">REGULAR</span>`; // Esta fila é sempre REGULAR

                    let acaoHtml = '';
                    if (userRole === 'COORDINATOR' || userRole === 'ADMIN') {
                         acaoHtml = `<button class="btn btn-sm btn-success" data-action="solicitar-id" data-id="${detalhe.id}">
                                        <i class="bi bi-send me-1"></i> Solicitar ID
                                     </button>`;
                    } else {
                        acaoHtml = '—'; // Visão (Controller)
                    }

                    return `
                        <tr>
                            <td data-label="Tipo">${tipoBadge}</td>
                            <td data-label="OS">${get(detalhe, 'os.os', '-')}</td>
                            <td data-label="Projeto">${get(detalhe, 'os.projeto', '-')}</td>
                            <td data-label="Segmento">${get(detalhe, 'os.segmento.nome', '-')}</td>
                            <td data-label="LPU">${get(detalhe, 'lpu.codigoLpu', '-')}</td>
                            <td data-label="Lote">${get(detalhe, 'lote', '-')}</td>
                            <td data-label="BOQ">${get(detalhe, 'boq', '-')}</td>
                            <td data-label="PO">${get(detalhe, 'po', '-')}</td>
                            <td data-label="Item">${get(detalhe, 'item', '-')}</td>
                            <td data-label="Objeto Contratado">${get(detalhe, 'lpu.nomeLpu', '-')}</td>
                            <td data-label="Qtd.">${get(detalhe, 'quantidade', '-')}</td>
                            <td data-label="Valor Total OS">${formatarMoeda(get(detalhe, 'valorTotal'))}</td>
                            <td data-label="Observações">${get(detalhe, 'observacoes', '-')}</td>
                            <td data-label="Data PO">${formatarData(get(detalhe, 'dataPo'))}</td>
                            <td data-label="Data Atividade">${formatarData(get(ultimoLancamento, 'dataAtividade'))}</td>
                            <td data-label="KEY">${get(detalhe, 'key', '-')}</td>
                            <td data-label="Ação">${acaoHtml}</td>
                        </tr>
                    `;
                }).join('');
            }
            // ================== FIM DA ALTERAÇÃO (SOLICITAR ID) ==================

        } catch (error) {
            console.error(error);
            tab.tbody.innerHTML = `<tr><td colspan="17" class="text-center text-danger p-4">${error.message}</td></tr>`;
        } finally {
            toggleLoader(tab.loaderId, false);
        }
    }

    async function carregarFilaAdiantamento() {
        const tab = tabs.solicitarAdiantamento;
        toggleLoader(tab.loaderId, true);
        
        try {
            // ATUALIZADO: Envia X-User-ID
            const response = await fetchComAuth(`${API_BASE_URL}/faturamento/fila-adiantamento-coordenador`, {
                headers: { 'X-User-ID': userId }
            });
            if (!response.ok) throw new Error('Falha ao carregar a fila de adiantamento.');
            const dados = await response.json();

            // NENHUMA ALTERAÇÃO SOLICITADA NESTA ABA
            tab.thead.innerHTML = `
                <tr>
                    <th>OS</th>
                    <th>Item (LPU)</th>
                    <th>KEY</th>
                    <th>Status Operacional</th>
                    <th>Ação</th>
                </tr>
            `;

            if (dados.length === 0) {
                tab.tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted p-4">Nenhum item elegível para adiantamento encontrado.</td></tr>`;
            } else {
                tab.tbody.innerHTML = dados.map(item => {
                    const detalhe = item.detalhe; // Este é o OsLpuDetalheCompletoDto
                    const ultimoLancamento = get(detalhe, 'ultimoLancamento', {});

                    let acaoHtml = '';
                    if (userRole === 'COORDINATOR' || userRole === 'ADMIN') {
                         acaoHtml = `<button class="btn btn-sm btn-warning" data-action="solicitar-adiantamento" data-id="${detalhe.id}">
                                        <i class="bi bi-skip-forward-circle me-1"></i> Solicitar Adiantamento
                                     </button>`;
                    } else {
                        acaoHtml = '—'; // Visão (Controller)
                    }
                    
                    const statusOperacional = get(ultimoLancamento, 'situacao', 'NÃO INICIADO').replace(/_/g, ' ');

                    return `
                        <tr>
                            <td data-label="OS">${get(detalhe, 'os.os', '-')}</td>
                            <td data-label="Item (LPU)">${get(detalhe, 'lpu.nomeLpu', '-')}</td>
                            <td data-label="KEY">${get(detalhe, 'key', '-')}</td>
                            <td data-label="Status Operacional"><span class="badge bg-info">${statusOperacional}</span></td>
                            <td data-label="Ação">${acaoHtml}</td>
                        </tr>
                    `;
                }).join('');
            }

        } catch (error) {
            console.error(error);
            tab.tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger p-4">${error.message}</td></tr>`;
        } finally {
            toggleLoader(tab.loaderId, false);
        }
    }

    async function carregarVisaoAdiantamentos() {
        const tab = tabs.visaoAdiantamentos;
        toggleLoader(tab.loaderId, true);
        
        try {
            // ATUALIZADO: Envia X-User-ID (já estava assim, mas confirmando)
            const response = await fetchComAuth(`${API_BASE_URL}/faturamento/visao-adiantamentos`, {
                headers: { 'X-User-ID': userId }
            });
            if (!response.ok) throw new Error('Falha ao carregar a visão de adiantamentos.');
            const dados = await response.json();

            // ================== INÍCIO DA ALTERAÇÃO (VISÃO ADIANTAMENTOS) ==================
            tab.thead.innerHTML = `
                <tr>
                    <th>STATUS</th>
                    <th>Data Solicitação</th>
                    <th>DATA ATIVIDADE</th>
                    <th>OS</th>
                    <th>SITE</th>
                    <th>SEGMENTO</th>
                    <th>PROJETO</th>
                    <th>LPU</th>
                    <th>GESTOR TIM</th>
                    <th>REGIONAL</th>
                    <th>VISTORIA</th>
                    <th>PLANO DE VISTORIA</th>
                    <th>DESMOBILIZAÇÃO</th>
                    <th>PLANO DESMOBILIZAÇÃO</th>
                    <th>INSTALAÇÃO</th>
                    <th>PLANO INSTALAÇÃO</th>
                    <th>ATIVAÇÃO</th>
                    <th>PLANO DE ATIVAÇÃO</th>
                    <th>DOCUMENTAÇÃO</th>
                    <th>PLANO DE DOCUMENTAÇÃO</th>
                    <th>ETAPA GERAL</th>
                    <th>ETAPA DETALHADA</th>
                    <th>STATUS (Lanc.)</th>
                    <th>SITUAÇÃO</th>
                    <th>DETALHE DIÁRIO</th>
                    <th>CÓD. PRESTADOR</th>
                    <th>PRESTADOR</th>
                    <th>VALOR</th>
                    <th>GESTOR</th>
                    <th>KEY</th>
                </tr>
            `;
            
            if (dados.length === 0) {
                tab.tbody.innerHTML = `<tr><td colspan="30" class="text-center text-muted p-4">Nenhum adiantamento solicitado.</td></tr>`;
            } else {
                tab.tbody.innerHTML = dados.map(item => {
                    const detalhe = item.osLpuDetalhe; // OsLpuDetalheCompletoDto
                    const ultimoLancamento = get(detalhe, 'ultimoLancamento', {});
                    const linhaClass = item.isOperacionalFinalizado ? '' : 'linha-adiantamento-pendente';
                    
                    // User requested 'STATUS' instead of 'STATUS FATURAMENTO'
                    const statusFaturamento = formatarStatusFaturamento(item.statusFaturamento);

                    return `
                        <tr class="${linhaClass}">
                            <td data-label="STATUS">${statusFaturamento}</td>
                            <td data-label="Data Solicitação">${formatarDataHora(item.dataSolicitacao)}</td>
                            <td data-label="DATA ATIVIDADE">${formatarData(get(ultimoLancamento, 'dataAtividade'))}</td>
                            <td data-label="OS">${get(detalhe, 'os.os', '-')}</td>
                            <td data-label="SITE">${get(detalhe, 'site', '-')}</td>
                            <td data-label="SEGMENTO">${get(detalhe, 'os.segmento.nome', '-')}</td>
                            <td data-label="PROJETO">${get(detalhe, 'os.projeto', '-')}</td>
                            <td data-label="LPU">${get(detalhe, 'lpu.codigoLpu', '-')}</td>
                            <td data-label="GESTOR TIM">${get(detalhe, 'os.gestorTim', '-')}</td>
                            <td data-label="REGIONAL">${get(detalhe, 'regional', '-')}</td>
                            <td data-label="VISTORIA">${get(ultimoLancamento, 'vistoria', '-')}</td>
                            <td data-label="PLANO DE VISTORIA">${formatarData(get(ultimoLancamento, 'planoVistoria'))}</td>
                            <td data-label="DESMOBILIZAÇÃO">${get(ultimoLancamento, 'desmobilizacao', '-')}</td>
                            <td data-label="PLANO DESMOBILIZAÇÃO">${formatarData(get(ultimoLancamento, 'planoDesmobilizacao'))}</td>
                            <td data-label="INSTALAÇÃO">${get(ultimoLancamento, 'instalacao', '-')}</td>
                            <td data-label="PLANO INSTALAÇÃO">${formatarData(get(ultimoLancamento, 'planoInstalacao'))}</td>
                            <td data-label="ATIVAÇÃO">${get(ultimoLancamento, 'ativacao', '-')}</td>
                            <td data-label="PLANO DE ATIVAÇÃO">${formatarData(get(ultimoLancamento, 'planoAtivacao'))}</td>
                            <td data-label="DOCUMENTAÇÃO">${get(ultimoLancamento, 'documentacao', '-')}</td>
                            <td data-label="PLANO DE DOCUMENTAÇÃO">${formatarData(get(ultimoLancamento, 'planoDocumentacao'))}</td>
                            <td data-label="ETAPA GERAL">${get(ultimoLancamento, 'etapa.nomeGeral', '-')}</td>
                            <td data-label="ETAPA DETALHADA">${get(ultimoLancamento, 'etapa.nomeDetalhado', '-')}</td>
                            <td data-label="STATUS (Lanc.)">${get(ultimoLancamento, 'status', '-')}</td>
                            <td data-label="SITUAÇÃO">${get(ultimoLancamento, 'situacao', '-')}</td>
                            <td data-label="DETALHE DIÁRIO">${get(ultimoLancamento, 'detalheDiario', '-')}</td>
                            <td data-label="CÓD. PRESTADOR">${get(ultimoLancamento, 'prestador.codigo', '-')}</td>
                            <td data-label="PRESTADOR">${get(ultimoLancamento, 'prestador.nome', '-')}</td>
                            <td data-label="VALOR">${formatarMoeda(get(ultimoLancamento, 'valor'))}</td>
                            <td data-label="GESTOR">${get(ultimoLancamento, 'manager.nome', '-')}</td>
                            <td data-label="KEY">${get(detalhe, 'key', '-')}</td>
                        </tr>
                    `;
                }).join('');
            }
            // ================== FIM DA ALTERAÇÃO (VISÃO ADIANTAMENTOS) ==================
        } catch (error) {
            console.error(error);
            tab.tbody.innerHTML = `<tr><td colspan="30" class="text-center text-danger p-4">${error.message}</td></tr>`;
        } finally {
            toggleLoader(tab.loaderId, false);
        }
    }

    async function carregarHistoricoFaturado() {
        const tab = tabs.historicoFaturado;
        toggleLoader(tab.loaderId, true);
        
        try {
            // ATUALIZADO: Envia X-User-ID (já estava assim, mas confirmando)
            const response = await fetchComAuth(`${API_BASE_URL}/faturamento/historico-faturado`, {
                headers: { 'X-User-ID': userId }
            });
            if (!response.ok) throw new Error('Falha ao carregar o histórico de faturamento.');
            const dados = await response.json();

            // ================== INÍCIO DA ALTERAÇÃO (HISTÓRICO FATURADO) ==================
            tab.thead.innerHTML = `
                <tr>
                    <th>Data Faturamento</th>
                    <th>Solicit ID Fat</th>
                    <th>Receb. ID Fat</th>
                    <th>Solicit FS Portal</th>
                    <th>Data FS</th>
                    <th>Num. FS</th>
                    <th>Tipo</th>
                    <th>OS</th>
                    <th>Projeto</th>
                    <th>Segmento</th>
                    <th>LPU</th>
                    <th>Lote</th>
                    <th>BOQ</th>
                    <th>PO</th>
                    <th>Item</th>
                    <th>Objeto Contratado</th>
                    <th>Qtd.</th>
                    <th>Valor Total OS</th>
                    <th>Observações</th>
                    <th>Data PO</th>
                    <th>Data Atividade</th>
                    <th>KEY</th>
                </tr>
            `;
            
            if (dados.length === 0) {
                tab.tbody.innerHTML = `<tr><td colspan="22" class="text-center text-muted p-4">Nenhum item faturado encontrado no histórico.</td></tr>`;
            } else {
                tab.tbody.innerHTML = dados.map(item => {
                    const detalhe = item.osLpuDetalhe; // OsLpuDetalheCompletoDto
                    const ultimoLancamento = get(detalhe, 'ultimoLancamento', {});
                    const tipoBadge = item.tipo === 'ADIANTAMENTO' ? `<span class="badge bg-warning">ADIANTAMENTO</span>` : `<span class="badge bg-info">REGULAR</span>`;

                    return `
                        <tr>
                            <td data-label="Data Faturamento">${formatarDataHora(item.dataUltimaAcao)}</td>
                            <td data-label="Solicit ID Fat">${get(detalhe, 'solitIdFat', '-')}</td>
                            <td data-label="Receb. ID Fat">${get(detalhe, 'recebIdFat', '-')}</td>
                            <td data-label="Solicit FS Portal">${get(detalhe, 'solitFsPortal', '-')}</td>
                            <td data-label="Data FS">${formatarData(get(detalhe, 'dataFs'))}</td>
                            <td data-label="Num. FS">${get(detalhe, 'numFs', '-')}</td>
                            <td data-label="Tipo">${tipoBadge}</td>
                            <td data-label="OS">${get(detalhe, 'os.os', '-')}</td>
                            <td data-label="Projeto">${get(detalhe, 'os.projeto', '-')}</td>
                            <td data-label="Segmento">${get(detalhe, 'os.segmento.nome', '-')}</td>
                            <td data-label="LPU">${get(detalhe, 'lpu.codigoLpu', '-')}</td>
                            <td data-label="Lote">${get(detalhe, 'lote', '-')}</td>
                            <td data-label="BOQ">${get(detalhe, 'boq', '-')}</td>
                            <td data-label="PO">${get(detalhe, 'po', '-')}</td>
                            <td data-label="Item">${get(detalhe, 'item', '-')}</td>
                            <td data-label="Objeto Contratado">${get(detalhe, 'lpu.nomeLpu', '-')}</td>
                            <td data-label="Qtd.">${get(detalhe, 'quantidade', '-')}</td>
                            <td data-label="Valor Total OS">${formatarMoeda(get(detalhe, 'valorTotal'))}</td>
                            <td data-label="Observações">${get(detalhe, 'observacoes', '-')}</td>
                            <td data-label="Data PO">${formatarData(get(detalhe, 'dataPo'))}</td>
                            <td data-label="Data Atividade">${formatarData(get(ultimoLancamento, 'dataAtividade'))}</td>
                            <td data-label="KEY">${get(detalhe, 'key', '-')}</td>
                        </tr>
                    `;
                }).join('');
            }
            // ================== FIM DA ALTERAÇÃO (HISTÓRICO FATURADO) ==================
        } catch (error) {
            console.error(error);
            tab.tbody.innerHTML = `<tr><td colspan="22" class="text-center text-danger p-4">${error.message}</td></tr>`;
        } finally {
            toggleLoader(tab.loaderId, false);
        }
    }

    // --- FUNÇÕES DE AÇÃO (HANDLERS) ---

    async function handleSolicitarId(osLpuDetalheId, buttonElement) {
        buttonElement.disabled = true;
        buttonElement.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Solicitando...`;

        try {
            const payload = { osLpuDetalheId: osLpuDetalheId, coordinatorId: userId };
            const response = await fetchComAuth(`${API_BASE_URL}/faturamento/solicitar-id`, {
                method: 'POST', body: JSON.stringify(payload)
            });
            if (!response.ok) throw new Error((await response.json()).message || 'Erro ao processar solicitação.');

            mostrarToast('Solicitação de ID enviada para o Assistant!', 'success');
            // Recarrega o dashboard e as filas
            carregarDashboard();
            tabs.solicitarId.pane.dataset.loaded = 'false'; 
            carregarFilaSolicitarID();
            tabs.filaFaturamento.pane.dataset.loaded = 'false';
            if (tabs.filaFaturamento.pane.classList.contains('active')) {
                carregarFilaFaturamento();
            }
        } catch (error) {
            mostrarToast(error.message, 'error');
            buttonElement.disabled = false;
            buttonElement.innerHTML = `<i class="bi bi-send me-1"></i> Solicitar ID`;
        }
    }

    async function handleSolicitarAdiantamento(osLpuDetalheId, buttonElement) {
        buttonElement.disabled = true;
        buttonElement.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Solicitando...`;

        try {
            const payload = { osLpuDetalheId: osLpuDetalheId, coordinatorId: userId };
            const response = await fetchComAuth(`${API_BASE_URL}/faturamento/solicitar-adiantamento`, {
                method: 'POST', body: JSON.stringify(payload)
            });
            if (!response.ok) throw new Error((await response.json()).message || 'Erro ao solicitar adiantamento.');

            mostrarToast('Solicitação de adiantamento enviada para o Assistant!', 'success');
            // Recarrega o dashboard e as filas
            carregarDashboard();
            tabs.solicitarAdiantamento.pane.dataset.loaded = 'false'; 
            carregarFilaAdiantamento();
            tabs.filaFaturamento.pane.dataset.loaded = 'false';
            if (tabs.filaFaturamento.pane.classList.contains('active')) {
                carregarFilaFaturamento();
            }
        } catch (error) {
            mostrarToast(error.message, 'error');
            buttonElement.disabled = false;
            buttonElement.innerHTML = `<i class="bi bi-skip-forward-circle me-1"></i> Solicitar Adiantamento`;
        }
    }

    function handleAcaoAssistant(action, solicitacaoId) {
        if (!solicitacaoId) return;

        if (action === 'id-recebido' && modalAcaoSimples) {
            document.getElementById('modalAcaoSimplesTitle').innerHTML = '<i class="bi bi-check-circle-fill text-success me-2"></i>Marcar ID Recebido';
            document.getElementById('modalAcaoSimplesBody').textContent = 'Confirmar o recebimento do ID para esta solicitação?';
            document.getElementById('acaoSimplesSolicitacaoId').value = solicitacaoId;
            document.getElementById('acaoSimplesEndpoint').value = 'id-recebido';
            modalAcaoSimples.show();
        
        } else if (action === 'faturado' && modalAcaoSimples) {
            document.getElementById('modalAcaoSimplesTitle').innerHTML = '<i class="bi bi-cash-stack text-primary me-2"></i>Marcar como Faturado';
            document.getElementById('modalAcaoSimplesBody').textContent = 'Confirmar que este item foi faturado? Esta é a ação final do fluxo.';
            document.getElementById('acaoSimplesSolicitacaoId').value = solicitacaoId;
            document.getElementById('acaoSimplesEndpoint').value = 'faturado';
            modalAcaoSimples.show();
        
        } else if (action === 'id-recusado' && modalRecusar) {
            document.getElementById('recusarSolicitacaoId').value = solicitacaoId;
            document.getElementById('formRecusarFaturamento').reset();
            modalRecusar.show();
        }
    }

    async function handleConfirmarAcaoSimples(buttonElement) {
        const solicitacaoId = document.getElementById('acaoSimplesSolicitacaoId').value;
        const endpoint = document.getElementById('acaoSimplesEndpoint').value;
        
        buttonElement.disabled = true;
        buttonElement.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Processando...`;

        try {
            const payload = { assistantId: userId };
            const response = await fetchComAuth(`${API_BASE_URL}/faturamento/${solicitacaoId}/${endpoint}`, {
                method: 'POST', body: JSON.stringify(payload)
            });
            if (!response.ok) throw new Error((await response.json()).message || 'Erro ao processar ação.');

            mostrarToast('Status atualizado com sucesso!', 'success');
            modalAcaoSimples.hide();
            
            // Recarrega tudo
            carregarDashboard();
            tabs.filaFaturamento.pane.dataset.loaded = 'false';
            carregarFilaFaturamento();
            tabs.visaoAdiantamentos.pane.dataset.loaded = 'false';
            tabs.historicoFaturado.pane.dataset.loaded = 'false';

        } catch (error) {
            mostrarToast(error.message, 'error');
        } finally {
            buttonElement.disabled = false;
            buttonElement.innerHTML = 'Confirmar';
        }
    }

    async function handleConfirmarRecusa(formElement, buttonElement) {
        const solicitacaoId = document.getElementById('recusarSolicitacaoId').value;
        const motivo = document.getElementById('motivoRecusa').value;

        buttonElement.disabled = true;
        buttonElement.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Recusando...`;

        try {
            const payload = { assistantId: userId, motivo: motivo };
            const response = await fetchComAuth(`${API_BASE_URL}/faturamento/${solicitacaoId}/id-recusado`, {
                method: 'POST', body: JSON.stringify(payload)
            });
            if (!response.ok) throw new Error((await response.json()).message || 'Erro ao processar recusa.');

            mostrarToast('Solicitação marcada como "ID Recusado"!', 'success');
            modalRecusar.hide();
            
            // Recarrega tudo
            carregarDashboard();
            tabs.filaFaturamento.pane.dataset.loaded = 'false';
            carregarFilaFaturamento();
            tabs.visaoAdiantamentos.pane.dataset.loaded = 'false';
            tabs.historicoFaturado.pane.dataset.loaded = 'false';

        } catch (error) {
            mostrarToast(error.message, 'error');
        } finally {
            buttonElement.disabled = false;
            buttonElement.innerHTML = 'Confirmar Recusa';
        }
    }


    // --- INICIALIZAÇÃO E EVENT LISTENERS ---

    const funcoesDeCarregamento = {
        '#fila-faturamento-pane': carregarFilaFaturamento,
        '#solicitar-id-pane': carregarFilaSolicitarID,
        '#solicitar-adiantamento-pane': carregarFilaAdiantamento,
        '#visao-adiantamentos-pane': carregarVisaoAdiantamentos,
        '#historico-faturado-pane': carregarHistoricoFaturado,
    };

    const tabElements = document.querySelectorAll('#faturamento-tabs .nav-link');
    tabElements.forEach(tabEl => {
        tabEl.addEventListener('show.bs.tab', function (event) {
            const targetPaneId = event.target.getAttribute('data-bs-target');
            const funcaoParaChamar = funcoesDeCarregamento[targetPaneId];
            const pane = document.querySelector(targetPaneId);
            
            if (funcaoParaChamar && (pane.dataset.loaded !== 'true' || targetPaneId === '#fila-faturamento-pane')) {
                funcaoParaChamar();
                pane.dataset.loaded = 'true';
            }
        });
    });

    // Delegação de eventos para os botões de ação nas tabelas
    const tabContent = document.getElementById('faturamentoTabContent');
    tabContent.addEventListener('click', (e) => {
        const button = e.target.closest('button[data-action]');
        if (!button) return;

        const action = button.dataset.action;
        const id = button.dataset.id; 

        if (action === 'solicitar-id') {
            handleSolicitarId(id, button);
        }
        else if (action === 'solicitar-adiantamento') {
            handleSolicitarAdiantamento(id, button);
        }
        else if (['id-recebido', 'faturado', 'id-recusado'].includes(action)) {
            handleAcaoAssistant(action, id);
        }
    });

    // (Listeners dos Modais do Assistant)
    if (modalAcaoSimplesEl) {
        document.getElementById('btnConfirmarAcaoSimples').addEventListener('click', function() {
            handleConfirmarAcaoSimples(this);
        });
    }
    if (modalRecusarEl) {
        document.getElementById('formRecusarFaturamento').addEventListener('submit', function(e) {
            e.preventDefault();
            const btn = document.getElementById('btnConfirmarRecusa');
            handleConfirmarRecusa(this, btn);
        });
    }

    // Função de inicialização
    function init() {
        setupRoleBasedTabs();
        
        // --- (NOVO) CHAMA O DASHBOARD ---
        carregarDashboard();
        
        const abaAtiva = document.querySelector('#faturamento-tabs .nav-link.active');
        if (abaAtiva) {
            const targetPaneId = abaAtiva.getAttribute('data-bs-target');
            const funcaoParaChamar = funcoesDeCarregamento[targetPaneId];
            if (funcaoParaChamar) {
                funcaoParaChamar();
                document.querySelector(targetPaneId).dataset.loaded = 'true';
            }
        }
    }

    // Inicia a página
    init();
});