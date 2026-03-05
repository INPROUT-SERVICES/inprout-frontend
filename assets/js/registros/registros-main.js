/**
 * registros-main.js
 * Ponto de entrada. Inicializa os módulos.
 */

document.addEventListener('DOMContentLoaded', async function () {
    // 1. Configura visibilidade das abas
    configurarVisibilidadeAbas();

    // 2. Inicializa módulos
    RegistrosActions.init();
    RegistrosIO.init();

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

    // 4.5 Inicializa flatpickr nos inputs de data do dashboard (dd/mm/yyyy)
    if (typeof flatpickr !== 'undefined' && flatpickr.l10ns && flatpickr.l10ns.pt) {
        const fpConfig = {
            dateFormat: 'Y-m-d',
            altInput: true,
            altFormat: 'd/m/Y',
            locale: flatpickr.l10ns.pt,
            altInputClass: 'form-control form-control-sm'
        };
        flatpickr('#dashboard-data-inicio', fpConfig);
        flatpickr('#dashboard-data-fim', fpConfig);
    }

    // 5. Inicializa o seletor de GATEs e configura o dashboard
    await inicializarGateSeletor();

    // 6. Configuração do Dashboard de Análise
    const dashboardTabBtn = document.getElementById('dashboard-tab');
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

    // 7. Listeners dos filtros de data do Dashboard
    const btnFiltrar = document.getElementById('btnFiltrarDashboard');
    const btnLimpar = document.getElementById('btnLimparFiltroDashboard');

    if (btnFiltrar) {
        btnFiltrar.addEventListener('click', () => {
            // Ao clicar em filtrar com datas manuais, desseleciona o gate
            const gateSelect = document.getElementById('dashboard-gate-select');
            if (gateSelect) gateSelect.value = 'custom';
            RegistrosRender.renderizarDashboardAnalise();
        });
    }

    if (btnLimpar) {
        btnLimpar.addEventListener('click', () => {
            const inputInicio = document.getElementById('dashboard-data-inicio');
            const inputFim = document.getElementById('dashboard-data-fim');
            const gateSelect = document.getElementById('dashboard-gate-select');
            if (inputInicio?._flatpickr) inputInicio._flatpickr.clear();
            else if (inputInicio) inputInicio.value = '';
            if (inputFim?._flatpickr) inputFim._flatpickr.clear();
            else if (inputFim) inputFim.value = '';
            if (gateSelect) gateSelect.value = '';
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
        let optionsHTML = '<option value="">Sem filtro de GATE</option>';
        optionsHTML += '<option value="custom">Personalizado</option>';

        // Ordena por dataInicio decrescente (mais recente primeiro)
        gates.sort((a, b) => new Date(b.dataInicio) - new Date(a.dataInicio));

        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        let gateAtualId = null;

        gates.forEach(gate => {
            const inicio = new Date(gate.dataInicio);
            const fim = new Date(gate.dataFim);
            inicio.setHours(0, 0, 0, 0);
            fim.setHours(23, 59, 59, 999);

            // Verifica se hoje está dentro do intervalo deste gate
            if (hoje >= inicio && hoje <= fim && !gateAtualId) {
                gateAtualId = gate.id;
            }

            // Formata as datas para exibição
            const inicioFormatado = inicio.toLocaleDateString('pt-BR');
            const fimFormatado = fim.toLocaleDateString('pt-BR');
            const label = `${gate.nome} (${inicioFormatado} - ${fimFormatado})`;

            optionsHTML += `<option value="${gate.id}" data-inicio="${gate.dataInicio}" data-fim="${gate.dataFim}">${label}</option>`;
        });

        gateSelect.innerHTML = optionsHTML;

        // Auto-seleciona o gate vigente
        if (gateAtualId) {
            gateSelect.value = gateAtualId;
            aplicarDatasDoGate(gateSelect);
        }

        // Listener para quando o usuário trocar o gate
        gateSelect.addEventListener('change', () => {
            const valor = gateSelect.value;

            if (valor === '' || valor === 'custom') {
                // Sem gate ou personalizado: limpa as datas
                if (valor === '') {
                    const inputInicio = document.getElementById('dashboard-data-inicio');
                    const inputFim = document.getElementById('dashboard-data-fim');
                    if (inputInicio?._flatpickr) inputInicio._flatpickr.clear();
                    else if (inputInicio) inputInicio.value = '';
                    if (inputFim?._flatpickr) inputFim._flatpickr.clear();
                    else if (inputFim) inputFim.value = '';
                }
                // Se "custom", mantém as datas atuais para o usuário editar manualmente
            } else {
                // Gate selecionado: preenche as datas automaticamente
                aplicarDatasDoGate(gateSelect);
            }

            // Recarrega o dashboard
            RegistrosRender.renderizarDashboardAnalise();
        });

    } catch (e) {
        console.error('Erro ao inicializar seletor de GATE:', e);
        gateSelect.innerHTML = '<option value="">Erro ao carregar GATEs</option>';
    }
}

/**
 * Extrai as datas do gate selecionado e preenche os inputs de data.
 * Usa a API do flatpickr quando disponível, com fallback para .value direto.
 */
function aplicarDatasDoGate(selectElement) {
    const selectedOption = selectElement.options[selectElement.selectedIndex];
    const dataInicioISO = selectedOption.dataset.inicio;
    const dataFimISO = selectedOption.dataset.fim;

    if (dataInicioISO && dataFimISO) {
        const inicio = dataInicioISO.split('T')[0];
        const fim = dataFimISO.split('T')[0];

        const inputInicio = document.getElementById('dashboard-data-inicio');
        const inputFim = document.getElementById('dashboard-data-fim');

        if (inputInicio?._flatpickr) inputInicio._flatpickr.setDate(inicio, false);
        else if (inputInicio) inputInicio.value = inicio;

        if (inputFim?._flatpickr) inputFim._flatpickr.setDate(fim, false);
        else if (inputFim) inputFim.value = fim;
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
    if (role !== 'ADMIN' && role !== 'CONTROLLER' && role !== 'ASSISTANT') {
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