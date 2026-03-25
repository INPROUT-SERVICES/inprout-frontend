/**
 * registros-main.js
 * Ponto de entrada. Inicializa os módulos.
 */

document.addEventListener('DOMContentLoaded', async function () {
    // 1. Configura visibilidade das abas
    configurarVisibilidadeAbas();

    // Mostra o loader do dashboard imediatamente para cobrir o tempo de busca dos Gates e Segmentos iniciais
    const dashboardTabBtn = document.getElementById('dashboard-tab');
    const dashboardLoader = document.getElementById('dashboard-loader');
    if (dashboardTabBtn && dashboardTabBtn.classList.contains('active') && dashboardLoader) {
        dashboardLoader.classList.remove('d-none');
    }

    // 2. Inicializa módulos
    RegistrosActions.init();
    RegistrosIO.init();

    // 2.1 Botao "Nova OS" — visivel para COORDINATOR, ADMIN, ASSISTANT
    const btnNovaOs = document.getElementById('btnNovaOs');
    if (btnNovaOs && ['COORDINATOR', 'ADMIN', 'ASSISTANT'].includes(RegistrosState.userRole)) {
        btnNovaOs.style.display = 'inline-block';
        btnNovaOs.addEventListener('click', () => NovaOsManager.abrirModal());
    }

    // 2.2 Listeners do modal Nova OS
    const btnAdicionarLpu = document.getElementById('btnAdicionarLpuNovaOs');
    if (btnAdicionarLpu) btnAdicionarLpu.addEventListener('click', () => NovaOsManager.adicionarLpu());

    const btnSubmeterNovaOs = document.getElementById('btnSubmeterNovaOs');
    if (btnSubmeterNovaOs) btnSubmeterNovaOs.addEventListener('click', () => NovaOsManager.submeter());

    // Validacao de projeto existente (debounce)
    const inputProjeto = document.getElementById('novaOsProjeto');
    if (inputProjeto) {
        let projetoTimeout = null;
        inputProjeto.addEventListener('input', (e) => {
            clearTimeout(projetoTimeout);
            projetoTimeout = setTimeout(() => {
                NovaOsManager.validarProjeto(e.target.value);
            }, 700);
        });
    }

    // Auto-preencher Unidade ao selecionar LPU (listener no select via Choices.js change event)
    const selectLpuEl = document.getElementById('novaOsSelectLpu');
    if (selectLpuEl) {
        selectLpuEl.addEventListener('change', () => NovaOsManager.onLpuSelecionada());
    }

    // Delegated click para remover LPU da tabela de itens
    const tabelaItensNovaOs = document.getElementById('tabelaItensNovaOs');
    if (tabelaItensNovaOs) {
        tabelaItensNovaOs.addEventListener('click', (e) => {
            const btnRemover = e.target.closest('.btn-remover-lpu-nova-os');
            if (btnRemover) {
                const idx = parseInt(btnRemover.dataset.index);
                NovaOsManager.removerLpu(idx);
            }
        });
    }

    if (RegistrosApi.inicializarPagina) {
        await RegistrosApi.inicializarPagina();
    }

    // 3. Listener de Busca
    const searchInput = document.getElementById('searchInput');

    if (searchInput) {
        searchInput.addEventListener('input', RegistrosRender.renderizarTabelaComFiltro);
    }

    // 4. Carrega os dados da tabela
    await RegistrosApi.carregarDados(0, '');

    // 5. Inicializa o seletor de GATEs e configura o dashboard
    await inicializarGateSeletor();

    // 6. Configuração do Dashboard de Análise
    if (dashboardTabBtn) {
        // Inicializa o dashboard se a aba já estiver ativa (ex: ADMIN ou CONTROLLER)
        if (dashboardTabBtn.classList.contains('active')) {
            RegistrosRender.renderizarDashboardAnalise();
        }

        // Listener para atualizar o dashboard ao clicar na aba
        dashboardTabBtn.addEventListener('shown.bs.tab', function (event) {
            RegistrosRender.renderizarDashboardAnalise();
        });
    }

});

/**
 * Busca os GATEs, popula o select e auto-seleciona o gate vigente.
 */
async function inicializarGateSeletor() {
    const gateSelect = document.getElementById('dashboard-gate-select');
    if (!gateSelect) return;

    try {
        const gates = await RegistrosApi.fetchGates();

        // Monta as opções do select
        let optionsHTML = '<option value="">Todos os GATEs</option>';

        // Ordena por dataInicio decrescente (mais recente primeiro)
        gates.sort((a, b) => new Date(b.dataInicio) - new Date(a.dataInicio));

        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        let gateAtualNome = null;

        gates.forEach(gate => {
            const inicio = new Date(gate.dataInicio);
            const fim = new Date(gate.dataFim);
            inicio.setHours(0, 0, 0, 0);
            fim.setHours(23, 59, 59, 999);

            // Verifica se hoje está dentro do intervalo deste gate
            if (hoje >= inicio && hoje <= fim && !gateAtualNome) {
                gateAtualNome = gate.nome;
            }

            // Formata as datas para exibição
            const inicioFormatado = inicio.toLocaleDateString('pt-BR');
            const fimFormatado = fim.toLocaleDateString('pt-BR');
            const label = `${gate.nome} (${inicioFormatado} - ${fimFormatado})`;

            optionsHTML += `<option value="${gate.nome}">${label}</option>`;
        });

        gateSelect.innerHTML = optionsHTML;

        // Auto-seleciona o gate vigente
        if (gateAtualNome) {
            gateSelect.value = gateAtualNome;
        }

        // Listener para quando o usuário trocar o gate
        gateSelect.addEventListener('change', () => {
            RegistrosRender.renderizarDashboardAnalise();
        });

    } catch (e) {
        console.error('Erro ao inicializar seletor de GATE:', e);
        gateSelect.innerHTML = '<option value="">Erro ao carregar GATEs</option>';
    }
}

/**
 * Configura qual aba deve aparecer baseada na Role do usuário.
 * ADMIN e CONTROLLER veem o Dashboard. Outros perfis vão direto para a Lista.
 */
function configurarVisibilidadeAbas() {
    const role = (localStorage.getItem("role") || "").trim().toUpperCase();
    const dashboardTabBtn = document.getElementById('dashboard-tab');
    const dashboardPane = document.getElementById('dashboard-pane');
    const listaTabBtn = document.getElementById('lista-tab');
    const listaPane = document.getElementById('lista-pane');

    // Se NÃO for ADMIN, NÃO for CONTROLLER e NÃO for ASSISTANT, removemos/escondemos o dashboard e ativamos a lista
    if (role !== 'ADMIN' && role !== 'CONTROLLER' && role !== 'ASSISTANT' && role !== 'VISUALIZADOR') {
        // Esconde o botão da aba Dashboard
        if (dashboardTabBtn) {
            dashboardTabBtn.parentElement.style.display = 'none';
            dashboardTabBtn.classList.remove('active');
            dashboardTabBtn.setAttribute('aria-selected', 'false');
        }

        // Desativa o painel do Dashboard
        if (dashboardPane) {
            dashboardPane.classList.remove('show', 'active');
        }

        // Ativa o botão da aba Lista
        if (listaTabBtn) {
            listaTabBtn.classList.add('active');
            listaTabBtn.setAttribute('aria-selected', 'true');
        }

        // Ativa o painel da Lista
        if (listaPane) {
            listaPane.classList.add('show', 'active');
        }
    }
}