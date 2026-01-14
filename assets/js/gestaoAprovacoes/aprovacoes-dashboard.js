// ==========================================================
// LÓGICA DO DASHBOARD SUPERIOR (KPIs)
// ==========================================================

async function carregarDashboardEBadges() {
    toggleLoader(true, '.overview-card');

    try {
        const [
            responseGeral,
            responsePendenciasAtiv,
            responsePendenciasCoord,
            responsePendenciasMat,
            responsePendenciasCompl
        ] = await Promise.all([
            fetchComAuth(`${API_BASE_URL}/lancamentos`),
            fetchComAuth(`${API_BASE_URL}/lancamentos/pendentes/${userId}`),
            fetchComAuth(`${API_BASE_URL}/lancamentos/pendencias-por-coordenador`),
            fetchComAuth(`${API_BASE_URL}/solicitacoes/pendentes`, { headers: { 'X-User-Role': userRole, 'X-User-ID': userId } }),
            fetchComAuth(`${API_BASE_URL}/solicitacoes-complementares/pendentes`, { headers: { 'X-User-Role': userRole, 'X-User-ID': userId } })
        ]);

        if (!responseGeral.ok || !responsePendenciasAtiv.ok || !responsePendenciasCoord.ok || !responsePendenciasMat.ok || !responsePendenciasCompl.ok) {
            throw new Error('Falha ao carregar um ou mais dados do dashboard.');
        }

        window.todosOsLancamentosGlobais = await responseGeral.json();
        window.todasPendenciasAtividades = await responsePendenciasAtiv.json();
        const pendenciasPorCoordenador = await responsePendenciasCoord.json();
        window.todasPendenciasMateriais = await responsePendenciasMat.json();
        window.todasPendenciasComplementares = await responsePendenciasCompl.json();

        renderizarCardsDashboard(
            window.todosOsLancamentosGlobais,
            pendenciasPorCoordenador,
            window.todasPendenciasMateriais.length,
            window.todasPendenciasComplementares.length
        );

        atualizarBadge('#materiais-tab', window.todasPendenciasMateriais.length);
        atualizarBadge('#complementares-tab', window.todasPendenciasComplementares.length);

    } catch (error) {
        console.error('Falha ao carregar dashboard e badges:', error);
        mostrarToast('Falha ao carregar o dashboard.', 'error');
        const dashboardContainer = document.getElementById('dashboard-container');
        if (dashboardContainer) dashboardContainer.innerHTML = `<div class="alert alert-danger">Falha ao carregar dashboard.</div>`;
    } finally {
        toggleLoader(false, '.overview-card');
    }
}

function atualizarBadge(tabSelector, count) {
    const tab = document.querySelector(tabSelector);
    if (!tab) return;
    let badge = tab.querySelector('.badge');
    if (!badge) {
        badge = document.createElement('span');
        badge.className = 'position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger';
        tab.appendChild(badge);
    }
    badge.textContent = count > 9 ? '9+' : count;
    badge.style.display = count > 0 ? '' : 'none';
}

function renderizarCardsDashboard(todosLancamentos, pendenciasPorCoordenador, pendenciasMateriaisCount, pendenciasComplementaresCount) {
    const dashboardContainer = document.getElementById('dashboard-container');
    const coordenadoresContainer = document.getElementById('dashboard-coordenadores-container');
    const coordenadoresCards = document.getElementById('coordenadores-cards');

    if (!dashboardContainer || !coordenadoresContainer || !coordenadoresCards) return;

    dashboardContainer.innerHTML = '';
    coordenadoresCards.innerHTML = '';
    coordenadoresContainer.style.display = 'none';
    let cardsHtml = '';

    if (userRole !== 'MANAGER') {
        cardsHtml += `
            <div class="card card-stat card-perigo">
                <div class="card-body"><h5>Pendências de Materiais</h5><p>${pendenciasMateriaisCount}</p></div>
            </div>
            <div class="card card-stat card-perigo">
                <div class="card-body"><h5>Ativ. Complementares</h5><p>${pendenciasComplementaresCount}</p></div>
            </div>
        `;
    }

    if (userRole === 'CONTROLLER' || userRole === 'ADMIN') {
        const pendenciasGerais = todosLancamentos.filter(l => l.situacaoAprovacao === 'PENDENTE_CONTROLLER').length;
        const solicitacoesPrazo = todosLancamentos.filter(l => l.situacaoAprovacao === 'AGUARDANDO_EXTENSAO_PRAZO').length;
        const prazosVencidos = todosLancamentos.filter(l => l.situacaoAprovacao === 'PRAZO_VENCIDO').length;
        const hojeString = new Date().toLocaleDateString('pt-BR');
        const aprovadosHoje = todosLancamentos.filter(l => {
            const dataAcao = l.ultUpdate ? new Date(parseDataBrasileira(l.ultUpdate)).toLocaleDateString('pt-BR') : null;
            return l.situacaoAprovacao === 'APROVADO' && dataAcao === hojeString;
        }).length;

        cardsHtml += `
        <div class="card card-stat card-info">
            <div class="card-body"><h5>Pendências para Ação</h5><p>${pendenciasGerais}</p></div>
        </div>
        <div class="card card-stat card-alerta">
            <div class="card-body"><h5>Solicitações de Prazo</h5><p>${solicitacoesPrazo}</p></div>
        </div>
        <div class="card card-stat card-perigo">
            <div class="card-body"><h5>Prazos Vencidos</h5><p>${prazosVencidos}</p></div>
        </div>
        <div class="card card-stat card-sucesso">
            <div class="card-body"><h5>Aprovados hoje</h5><p>${aprovadosHoje}</p></div>
        </div>`;

        if (pendenciasPorCoordenador && pendenciasPorCoordenador.length > 0) {
            coordenadoresContainer.style.display = 'block';
            let coordenadoresHtml = '';
            pendenciasPorCoordenador.forEach(item => {
                coordenadoresHtml += `
                <div class="card card-stat card-planejamento">
                    <div class="card-body"><h5>${item.coordenadorNome}</h5><p>${item.quantidade}</p></div>
                </div>`;
            });
            coordenadoresCards.innerHTML = coordenadoresHtml;
        }
    }
    dashboardContainer.innerHTML = cardsHtml;
}