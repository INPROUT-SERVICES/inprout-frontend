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
    // Importante: O dashboard depende de RegistrosState.todasAsLinhas estar preenchido
    await RegistrosApi.carregarDados(0, '');

    // 5. Configuração do Dashboard de Análise
    const dashboardTabBtn = document.getElementById('dashboard-tab');
    if (dashboardTabBtn) {
        // Inicializa o dashboard se a aba já estiver ativa (ex: ADMIN)
        if (dashboardTabBtn.classList.contains('active')) {
            RegistrosRender.renderizarDashboardAnalise();
        }

        // Listener para atualizar o dashboard ao clicar na aba
        dashboardTabBtn.addEventListener('shown.bs.tab', function (event) {
            // Chama a função de renderização local usando os dados já carregados
            RegistrosRender.renderizarDashboardAnalise();
        });
    }
});

/**
 * Configura qual aba deve aparecer baseada na Role do usuário.
 * Apenas ADMIN vê o Dashboard. Outros perfis vão direto para a Lista.
 */
function configurarVisibilidadeAbas() {
    const role = (localStorage.getItem("role") || "").trim().toUpperCase();
    const dashboardTabBtn = document.getElementById('dashboard-tab');
    const dashboardPane = document.getElementById('dashboard-pane');
    const listaTabBtn = document.getElementById('lista-tab');
    const listaPane = document.getElementById('lista-pane');

    // Se NÃO for ADMIN, removemos/escondemos o dashboard e ativamos a lista
    if (role !== 'ADMIN') {
        // Esconde o botão da aba Dashboard
        if (dashboardTabBtn) {
            dashboardTabBtn.parentElement.style.display = 'none'; // Esconde o <li> inteiro
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