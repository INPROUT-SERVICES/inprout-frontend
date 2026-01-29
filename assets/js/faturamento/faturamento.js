document.addEventListener('DOMContentLoaded', () => {

    const API_BASE_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ? 'http://localhost:8083'
        : window.location.origin;

    const userRole = (localStorage.getItem("role") || "").trim().toUpperCase();
    const userId = localStorage.getItem('usuarioId');

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
            pane: document.getElementById('visao-adiantamentos-pane'), // Corrigido ID duplicado do nav
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

    // Cards e KPIs
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

    // Modais
    const modalAcaoSimplesEl = document.getElementById('modalAcaoSimplesFaturamento');
    const modalAcaoSimples = modalAcaoSimplesEl ? new bootstrap.Modal(modalAcaoSimplesEl) : null;
    const modalRecusarEl = document.getElementById('modalRecusarFaturamento');
    const modalRecusar = modalRecusarEl ? new bootstrap.Modal(modalRecusarEl) : null;

    // --- FUNÇÕES AUXILIARES ---
    const get = (obj, path, defaultValue = '-') => {
        if (obj === null || obj === undefined) return defaultValue;
        const value = path.split('.').reduce((a, b) => (a && a[b] != null ? a[b] : undefined), obj);
        return value !== undefined ? value : defaultValue;
    };

    const formatarData = (dataStr) => {
        if (!dataStr || dataStr === '-') return '-';
        // Tratamento simples para ISO date ou arrays de data
        if (Array.isArray(dataStr)) return new Date(dataStr[0], dataStr[1] - 1, dataStr[2]).toLocaleDateString('pt-BR');
        let dataLimpa = dataStr.toString().split(' ')[0];
        if (dataLimpa.includes('-')) {
            return new Date(dataLimpa).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
        }
        return dataLimpa;
    };

    const formatarDataHora = (dataStr) => {
        if (!dataStr) return '-';
        try {
            return new Date(dataStr).toLocaleString('pt-BR');
        } catch (e) { return dataStr; }
    };

    const formatarMoeda = (valor) => {
        if (valor === null || valor === undefined || isNaN(Number(valor))) return '-';
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
    };

    // --- LÓGICA DE PERMISSÕES ---
    function setupRoleBasedTabs() {
        Object.values(tabs).forEach(tab => { if (tab.nav) tab.nav.style.display = 'none'; });
        const visibilidade = {
            ADMIN: ['filaFaturamento', 'solicitarId', 'solicitarAdiantamento', 'visaoAdiantamentos', 'historicoFaturado'],
            CONTROLLER: ['filaFaturamento', 'solicitarId', 'solicitarAdiantamento', 'visaoAdiantamentos', 'historicoFaturado'],
            ASSISTANT: ['filaFaturamento', 'visaoAdiantamentos', 'historicoFaturado'],
            COORDINATOR: ['solicitarId', 'solicitarAdiantamento', 'visaoAdiantamentos', 'historicoFaturado'],
            MANAGER: []
        };
        const abasVisiveis = visibilidade[userRole] || [];
        abasVisiveis.forEach(tabKey => {
            if (tabs[tabKey] && tabs[tabKey].nav) tabs[tabKey].nav.style.display = 'block';
        });

        // Ativa a primeira aba visível se nenhuma estiver ativa
        if (!document.querySelector('#faturamento-tabs .nav-link.active')) {
            const primeira = Object.values(tabs).find(tab => tab.nav && tab.nav.style.display === 'block');
            if (primeira) {
                primeira.btn?.classList.add('active');
                primeira.pane?.classList.add('show', 'active');
            }
        }
    }

    function toggleLoader(paneId, ativo = true) {
        const container = document.querySelector(paneId);
        if (container) {
            const overlay = container.querySelector(".overlay-loader");
            if (overlay) overlay.classList.toggle("d-none", !ativo);
        }
    }

    // --- DASHBOARD ---
    async function carregarDashboard() {
        if (!userId) return;
        try {
            const response = await fetchComAuth(`${API_BASE_URL}/faturamento/dashboard/${userId}`);
            if (!response.ok) throw new Error('Falha ao carregar dashboard.');
            const data = await response.json();

            if (kpis.solicitacao) kpis.solicitacao.textContent = data.pendenteSolicitacao || 0;
            if (kpis.fila) kpis.fila.textContent = data.pendenteFila || 0;
            if (kpis.recusados) kpis.recusados.textContent = data.idsRecusados || 0;
            if (kpis.adiantamentos) kpis.adiantamentos.textContent = data.adiantamentosPendentes || 0;
            if (kpis.faturadosMes) kpis.faturadosMes.textContent = formatarMoeda(data.faturadoMes || 0);

            // Visibilidade dos Cards
            if (['ADMIN', 'CONTROLLER'].includes(userRole)) Object.values(cards).forEach(c => c && (c.style.display = 'block'));
            else if (userRole === 'COORDINATOR') {
                if (cards.solicitacao) cards.solicitacao.style.display = 'block';
                if (cards.recusados) cards.recusados.style.display = 'block';
                if (cards.adiantamentos) cards.adiantamentos.style.display = 'block';
            } else if (userRole === 'ASSISTANT') {
                if (cards.fila) cards.fila.style.display = 'block';
                if (cards.recusados) cards.recusados.style.display = 'block';
                if (cards.adiantamentos) cards.adiantamentos.style.display = 'block';
            }
        } catch (error) {
            console.error("Erro dashboard:", error);
        }
    }

    // --- CARREGAMENTO DE TABELAS (ADAPTADO PARA NOVOS DTOs) ---

    async function carregarFilaFaturamento() {
        const tab = tabs.filaFaturamento;
        toggleLoader(tab.loaderId, true);

        try {
            const response = await fetchComAuth(`${API_BASE_URL}/faturamento/fila-assistant/${userId}`);
            if (!response.ok) throw new Error('Erro ao carregar fila.');
            const dados = await response.json();

            // Colunas simplificadas baseadas no que temos no DTO
            tab.thead.innerHTML = `
                <tr>
                    <th>Status</th>
                    <th>Tipo</th>
                    <th>OS</th>
                    <th>Item</th>
                    <th>Valor</th>
                    <th>Solicitante</th>
                    <th>Data Solicitação</th>
                    <th>Observações</th>
                    <th>Ações</th>
                </tr>
            `;

            if (dados.length === 0) {
                tab.tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted p-4">Fila vazia.</td></tr>`;
            } else {
                tab.tbody.innerHTML = dados.map(item => {
                    const isAdiantamento = item.tipo === 'ADIANTAMENTO';
                    const badgeTipo = isAdiantamento ? '<span class="badge bg-warning">ADIANTAMENTO</span>' : '<span class="badge bg-info">REGULAR</span>';

                    let acoes = '';

                    // Regra de Visibilidade e Ações do Assistant
                    if (userRole === 'ASSISTANT') {
                        // Botão de Recusa (sempre disponível até faturar)
                        const btnRecusar = `<button class="btn btn-sm btn-outline-danger ms-1" data-action="id-recusado" data-id="${item.id}" title="Recusar"><i class="bi bi-x-circle"></i></button>`;

                        if (item.status === 'PENDENTE_ASSISTANT') {
                            // Passo 1: Marcar como Solicitado
                            acoes = `
                            <button class="btn btn-sm btn-info text-white" data-action="marcar-solicitado" data-id="${item.id}" title="Confirmar Solicitação de ID">
                                <i class="bi bi-envelope-paper"></i> Já Solicitei
                            </button>
                            ${btnRecusar}
                        `;
                        } else if (item.status === 'ID_SOLICITADO') {
                            // Passo 2: Marcar como Recebido
                            acoes = `
                            <button class="btn btn-sm btn-warning" data-action="id-recebido" data-id="${item.id}" title="Confirmar Recebimento">
                                <i class="bi bi-check-circle"></i> Já Recebi
                            </button>
                            ${btnRecusar}
                        `;
                        } else if (item.status === 'ID_RECEBIDO') {
                            // Passo 3: Faturar
                            acoes = `
                            <button class="btn btn-sm btn-success" data-action="faturado" data-id="${item.id}" title="Faturar">
                                <i class="bi bi-cash-stack"></i> Faturar
                            </button>
                            ${btnRecusar}
                        `;
                        } else {
                            acoes = '<span class="badge bg-success">Concluído</span>';
                        }
                    } else {
                        acoes = '<span class="text-muted"><i class="bi bi-eye"></i> Somente Leitura</span>';
                    }

                    return `
                    <tr>
                        <td><span class="badge bg-secondary">${item.status}</span></td>
                        <td>${badgeTipo}</td>
                        <td>${item.numeroOs || '-'}</td>
                        <td>${item.descricaoItem || '-'}</td>
                        <td>${formatarMoeda(item.valor)}</td>
                        <td>${item.solicitanteNome || '-'}</td>
                        <td>${formatarDataHora(item.dataSolicitacao)}</td>
                        <td>${item.observacao || '-'}</td>
                        <td><div class="d-flex align-items-center">${acoes}</div></td>
                    </tr>
                `;
                }).join('');
            }
        } catch (error) {
            tab.tbody.innerHTML = `<tr><td colspan="9" class="text-center text-danger">${error.message}</td></tr>`;
        } finally {
            toggleLoader(tab.loaderId, false);
        }
    }

    function handleAcaoAssistant(action, solicitacaoId) {
        if (action === 'id-recusado') {
            document.getElementById('recusarSolicitacaoId').value = solicitacaoId;
            modalRecusar.show();
            return;
        }

        // Mapeamento Action -> Status Enum
        let novoStatus = '';
        let titulo = '';

        if (action === 'marcar-solicitado') {
            novoStatus = 'ID_SOLICITADO';
            titulo = 'Confirmar Solicitação de ID';
        } else if (action === 'id-recebido') {
            novoStatus = 'ID_RECEBIDO';
            titulo = 'Confirmar Recebimento de ID';
        } else if (action === 'faturado') {
            novoStatus = 'FATURADO';
            titulo = 'Confirmar Faturamento';
        }

        document.getElementById('acaoSimplesSolicitacaoId').value = solicitacaoId;
        document.getElementById('acaoSimplesEndpoint').value = novoStatus; // Passamos o STATUS direto
        document.getElementById('modalAcaoSimplesTitle').innerText = titulo;
        document.getElementById('modalAcaoSimplesBody').innerText = `Deseja alterar o status para: ${titulo}?`;
        modalAcaoSimples.show();
    }

    async function carregarFilaSolicitarID() {
        const tab = tabs.solicitarId;
        toggleLoader(tab.loaderId, true);

        try {
            const response = await fetchComAuth(`${API_BASE_URL}/faturamento/fila-coordenador/${userId}`);
            if (!response.ok) throw new Error('Erro ao carregar fila.');
            const dados = await response.json();

            tab.thead.innerHTML = `
                <tr>
                    <th>OS</th>
                    <th>Segmento</th>
                    <th>Objeto Contratado</th>
                    <th>Ação</th>
                </tr>
            `;

            if (dados.length === 0) {
                tab.tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted p-4">Nenhuma pendência.</td></tr>`;
            } else {
                tab.tbody.innerHTML = dados.map(item => {
                    // DTO: FilaCoordenadorDTO
                    let btn = '-';
                    if (['COORDINATOR', 'ADMIN'].includes(userRole)) {
                        btn = `<button class="btn btn-sm btn-success" data-action="solicitar-id" data-id="${item.osLpuDetalheId}">
                                 <i class="bi bi-send"></i> Solicitar ID
                               </button>`;
                    }
                    return `
                        <tr>
                            <td>${item.numeroOs || '-'}</td>
                            <td>${item.segmento || '-'}</td>
                            <td>${item.descricaoItem || '-'}</td>
                            <td>${btn}</td>
                        </tr>
                    `;
                }).join('');
            }
        } catch (error) {
            tab.tbody.innerHTML = `<tr><td colspan="4" class="text-center text-danger">${error.message}</td></tr>`;
        } finally {
            toggleLoader(tab.loaderId, false);
        }
    }

    async function carregarFilaAdiantamento() {
        const tab = tabs.solicitarAdiantamento;
        toggleLoader(tab.loaderId, true);
        try {
            // URL Ajustada conforme Controller
            const response = await fetchComAuth(`${API_BASE_URL}/faturamento/fila-adiantamento/${userId}`);
            if (!response.ok) throw new Error('Erro ao carregar fila.');
            const dados = await response.json();

            tab.thead.innerHTML = `<tr><th>OS</th><th>Item</th><th>Ação</th></tr>`;

            if (!dados || dados.length === 0) {
                tab.tbody.innerHTML = `<tr><td colspan="3" class="text-center text-muted p-4">Nada para adiantar.</td></tr>`;
            } else {
                tab.tbody.innerHTML = dados.map(item => {
                    // Assumindo DTO similar ao de coordenador
                    const btn = `<button class="btn btn-sm btn-warning" data-action="solicitar-adiantamento" data-id="${item.osLpuDetalheId}">
                                    <i class="bi bi-skip-forward"></i> Adiantar
                                 </button>`;
                    return `
                        <tr>
                            <td>${item.numeroOs || '-'}</td>
                            <td>${item.descricaoItem || '-'}</td>
                            <td>${btn}</td>
                        </tr>`;
                }).join('');
            }
        } catch (error) {
            tab.tbody.innerHTML = `<tr><td colspan="3" class="text-center text-danger">${error.message}</td></tr>`;
        } finally {
            toggleLoader(tab.loaderId, false);
        }
    }

    async function carregarVisaoAdiantamentos() {
        const tab = tabs.visaoAdiantamentos;
        toggleLoader(tab.loaderId, true);
        try {
            const response = await fetchComAuth(`${API_BASE_URL}/faturamento/visao-adiantamentos/${userId}`);
            if (!response.ok) throw new Error('Erro ao carregar visão.');
            const dados = await response.json();

            tab.thead.innerHTML = `<tr><th>OS</th><th>Item</th><th>Status</th><th>Data Solicitação</th></tr>`;
            if (!dados || dados.length === 0) {
                tab.tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted p-4">Sem histórico.</td></tr>`;
            } else {
                tab.tbody.innerHTML = dados.map(item => `
                    <tr>
                        <td>${item.numeroOs || '-'}</td>
                        <td>${item.descricaoItem || '-'}</td>
                        <td>${item.status || '-'}</td>
                        <td>${formatarDataHora(item.dataSolicitacao)}</td>
                    </tr>
                `).join('');
            }
        } catch (error) {
            tab.tbody.innerHTML = `<tr><td colspan="4" class="text-center text-danger">${error.message}</td></tr>`;
        } finally {
            toggleLoader(tab.loaderId, false);
        }
    }

    async function carregarHistoricoFaturado() {
        const tab = tabs.historicoFaturado;
        toggleLoader(tab.loaderId, true);
        // O endpoint getHistoricoFaturado não existe no Controller Java fornecido.
        // Vou deixar vazio para não quebrar.
        tab.tbody.innerHTML = `<tr><td colspan="10" class="text-center text-muted p-4">Funcionalidade em desenvolvimento no backend.</td></tr>`;
        toggleLoader(tab.loaderId, false);
    }

    // --- ACTIONS HANDLERS ---

    // Delegação de eventos de clique
    document.getElementById('faturamentoTabContent').addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;
        const action = btn.dataset.action;
        const id = btn.dataset.id;

        if (action === 'solicitar-id') handleSolicitarId(id, btn);
        else if (action === 'solicitar-adiantamento') handleSolicitarAdiantamento(id, btn);
        // Atualizado para incluir a nova ação
        else if (['marcar-solicitado', 'id-recebido', 'faturado', 'id-recusado'].includes(action)) {
            handleAcaoAssistant(action, id);
        }
    });

    async function handleSolicitarId(osLpuDetalheId, btn) {
        btn.disabled = true;
        try {
            const res = await fetchComAuth(`${API_BASE_URL}/faturamento/solicitar/${osLpuDetalheId}/${userId}`, { method: 'POST' });
            if (!res.ok) throw new Error((await res.json()).message || 'Erro');
            mostrarToast('Solicitado com sucesso!', 'success');
            carregarDashboard();
            carregarFilaSolicitarID();
        } catch (e) { mostrarToast(e.message, 'error'); btn.disabled = false; }
    }

    async function handleSolicitarAdiantamento(osLpuDetalheId, btn) {
        // Endpoint placeholder, ajuste conforme sua rota real
        btn.disabled = true;
        try {
            const res = await fetchComAuth(`${API_BASE_URL}/faturamento/solicitar-adiantamento/${osLpuDetalheId}/${userId}`, { method: 'POST' });
            if (!res.ok) throw new Error((await res.json()).message || 'Erro');
            mostrarToast('Adiantamento solicitado!', 'success');
            carregarDashboard();
            carregarFilaAdiantamento();
        } catch (e) { mostrarToast(e.message, 'error'); btn.disabled = false; }
    }

    function handleAcaoAssistant(action, solicitacaoId) {
        // Abre modais
        if (action === 'id-recusado') {
            document.getElementById('recusarSolicitacaoId').value = solicitacaoId;
            modalRecusar.show();
        } else {
            // ID Recebido ou Faturado
            document.getElementById('acaoSimplesSolicitacaoId').value = solicitacaoId;
            document.getElementById('acaoSimplesEndpoint').value = action === 'id-recebido' ? 'ID_RECEBIDO' : 'FATURADO'; // Enum do status
            const titulo = action === 'id-recebido' ? 'Confirmar Recebimento de ID' : 'Confirmar Faturamento';
            document.getElementById('modalAcaoSimplesTitle').innerText = titulo;
            document.getElementById('modalAcaoSimplesBody').innerText = `Deseja atualizar o status para ${titulo}?`;
            modalAcaoSimples.show();
        }
    }

    // Listeners dos Modais
    if (modalAcaoSimplesEl) {
        document.getElementById('btnConfirmarAcaoSimples').addEventListener('click', async function () {
            const id = document.getElementById('acaoSimplesSolicitacaoId').value;
            const status = document.getElementById('acaoSimplesEndpoint').value; // Usando status direto
            const btn = this;
            btn.disabled = true;

            try {
                const payload = { status: status, responsavelId: userId };
                const res = await fetchComAuth(`${API_BASE_URL}/faturamento/status/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (!res.ok) throw new Error('Erro ao atualizar');

                mostrarToast('Atualizado!', 'success');
                modalAcaoSimples.hide();
                carregarDashboard();
                carregarFilaFaturamento();
            } catch (e) { mostrarToast(e.message, 'error'); } finally { btn.disabled = false; }
        });
    }

    if (modalRecusarEl) {
        document.getElementById('formRecusarFaturamento').addEventListener('submit', async function (e) {
            e.preventDefault();
            const id = document.getElementById('recusarSolicitacaoId').value;
            const obs = document.getElementById('motivoRecusa').value;
            const btn = document.getElementById('btnConfirmarRecusa');
            btn.disabled = true;

            try {
                const payload = { status: 'ID_RECUSADO', responsavelId: userId, observacao: obs };
                const res = await fetchComAuth(`${API_BASE_URL}/faturamento/status/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (!res.ok) throw new Error('Erro ao recusar');

                mostrarToast('Recusado!', 'success');
                modalRecusar.hide();
                carregarDashboard();
                carregarFilaFaturamento();
            } catch (e) { mostrarToast(e.message, 'error'); } finally { btn.disabled = false; }
        });
    }

    // Inicialização
    const funcoesLoad = {
        '#fila-faturamento-pane': carregarFilaFaturamento,
        '#solicitar-id-pane': carregarFilaSolicitarID,
        '#solicitar-adiantamento-pane': carregarFilaAdiantamento,
        '#visao-adiantamentos-pane': carregarVisaoAdiantamentos,
        '#historico-faturado-pane': carregarHistoricoFaturado
    };

    document.querySelectorAll('#faturamento-tabs .nav-link').forEach(tab => {
        tab.addEventListener('show.bs.tab', (e) => {
            const target = e.target.getAttribute('data-bs-target');
            if (funcoesLoad[target]) funcoesLoad[target]();
        });
    });

    function init() {
        setupRoleBasedTabs();
        carregarDashboard();
        // Carrega a aba ativa inicial
        const active = document.querySelector('#faturamento-tabs .nav-link.active');
        if (active) {
            const target = active.getAttribute('data-bs-target');
            if (funcoesLoad[target]) funcoesLoad[target]();
        }
    }

    init();
});