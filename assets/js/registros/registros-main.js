/**
 * registros-main.js
 * Ponto de entrada. Inicializa os módulos.
 */

document.addEventListener('DOMContentLoaded', async function () {
    // 1. Lógica de Segurança das Abas (Novo código)
    configurarVisibilidadeAbas();

    // Inicializa ações de UI (botões, modais)
    RegistrosActions.init();
    
    // Inicializa Importação/Exportação
    RegistrosIO.init();

    if (RegistrosApi.inicializarPagina) {
        await RegistrosApi.inicializarPagina();
    }

    // Configura ouvinte de busca
    document.getElementById('searchInput').addEventListener('input', RegistrosRender.renderizarTabelaComFiltro);

    // Carrega os dados da tabela
    RegistrosApi.carregarDados(0, '');
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