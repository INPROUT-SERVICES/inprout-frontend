/**
 * registros-main.js
 * Ponto de entrada. Inicializa os módulos.
 */

document.addEventListener('DOMContentLoaded', async function () {
    // 1. Configura visibilidade das abas (Segurança)
    configurarVisibilidadeAbas();

    // 2. Inicializa módulos
    RegistrosActions.init();
    RegistrosIO.init();

    if (RegistrosApi.inicializarPagina) {
        await RegistrosApi.inicializarPagina();
    }

    // 3. Listener de Busca
    document.getElementById('searchInput').addEventListener('input', RegistrosRender.renderizarTabelaComFiltro);

    // 4. Carrega os dados da tabela (Lista de Registros)
    RegistrosApi.carregarDados(0, '');

    // --- CORREÇÃO DO DASHBOARD AQUI --- //

    // Verifica permissão e carrega o Dashboard se for ADMIN
    const role = (localStorage.getItem("role") || "").trim().toUpperCase();
    if (role === 'ADMIN') {
        console.log("Iniciando carregamento do Dashboard...");
        RegistrosApi.carregarDashboard();
    }

    // Adiciona evento para recarregar/atualizar ao clicar na aba "Análise"
    const dashboardTabBtn = document.getElementById('dashboard-tab');
    if (dashboardTabBtn) {
        dashboardTabBtn.addEventListener('shown.bs.tab', function (event) {
            // Apenas recarrega se não estiver carregando (opcional)
            RegistrosApi.carregarDashboard();
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