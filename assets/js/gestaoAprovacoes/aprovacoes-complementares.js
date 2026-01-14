// ==========================================================
// LÓGICA DE ATIVIDADES COMPLEMENTARES
// ==========================================================

async function carregarDadosComplementares() {
    const tabComplementares = document.getElementById('complementares-tab');
    if (!tabComplementares) return;
    toggleLoader(true, '#complementares-pane');

    try {
        const response = await fetchComAuth(`${API_BASE_URL}/solicitacoes-complementares/pendentes`, {
            headers: { 'X-User-Role': userRole, 'X-User-ID': userId }
        });
        if (!response.ok) throw new Error('Falha ao carregar pendências de ativ. complementares.');
        window.todasPendenciasComplementares = await response.json();

        renderizarTabelaPendentesComplementares(window.todasPendenciasComplementares);
    } catch (error) {
        console.error("Erro ao carregar dados de atividades complementares:", error);
        mostrarToast(error.message, 'error');
    } finally {
        toggleLoader(false, '#complementares-pane');
    }
}

async function carregarDadosHistoricoComplementares() {
    if (!document.getElementById('tbody-historico-complementares')) return;
    toggleLoader(true, '#historico-complementares-pane');

    try {
        const response = await fetchComAuth(`${API_BASE_URL}/solicitacoes-complementares/historico/${userId}`);
        if (!response.ok) throw new Error('Falha ao carregar histórico de atividades complementares.');

        window.todoHistoricoComplementares = await response.json();
        renderizarTabelaHistoricoComplementares(window.todoHistoricoComplementares);

    } catch (error) {
        console.error("Erro ao carregar histórico de ativ. complementares:", error);
        mostrarToast(error.message, 'error');
    } finally {
        toggleLoader(false, '#historico-complementares-pane');
    }
}

function renderizarTabelaPendentesComplementares(solicitacoes) {
    const tbody = document.getElementById('tbody-pendentes-complementares');
    if (!tbody) return;

    const thead = tbody.previousElementSibling;
    thead.innerHTML = `
        <tr>
            <th><input type="checkbox" class="form-check-input" id="selecionar-todos-complementar" title="Selecionar Todos"></th>
            <th>Ações</th>
            <th>Data Solicitação</th>
            <th>Solicitante</th>
            <th>OS</th>
            <th>Segmento</th> 
            <th>LPU</th>
            <th class="text-center">Quantidade</th>
            <th>Justificativa</th>
            <th>Status</th>
        </tr>`;
    tbody.innerHTML = '';

    if (!solicitacoes || solicitacoes.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" class="text-center text-muted">Nenhuma pendência de atividade complementar.</td></tr>`;
        return;
    }

    solicitacoes.forEach(s => {
        const tr = document.createElement('tr');
        tr.dataset.id = s.id;
        let acoesHtml = '';
        let statusBadge = '';
        let checkboxHtml = `<input type="checkbox" class="form-check-input linha-checkbox-complementar" data-id="${s.id}">`;
        const statusFormatado = (s.status || '').replace(/_/g, ' ');

        if ((userRole === 'COORDINATOR' && s.status === 'PENDENTE_COORDENADOR') || ((userRole === 'CONTROLLER' || userRole === 'ADMIN') && s.status === 'PENDENTE_CONTROLLER')) {
            acoesHtml = `
                <button class="btn btn-sm btn-outline-success" title="Aprovar" onclick="aprovarComplementar(${s.id})"><i class="bi bi-check-lg"></i></button>
                <button class="btn btn-sm btn-outline-danger" title="Recusar" onclick="recusarComplementar(${s.id})"><i class="bi bi-x-lg"></i></button>
            `;
            statusBadge = `<span class="badge rounded-pill text-bg-warning">${statusFormatado}</span>`;
        } else {
            checkboxHtml = ''; 
            acoesHtml = `—`;
            statusBadge = `<span class="badge rounded-pill text-bg-info">${statusFormatado}</span>`;
        }

        const dataFormatada = s.dataSolicitacao ? new Date(parseDataBrasileira(s.dataSolicitacao)).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'Data inválida';

        tr.innerHTML = `
            <td data-label="Selecionar">${checkboxHtml}</td>
            <td data-label="Ações" class="text-center">${acoesHtml}</td>
            <td data-label="Data">${dataFormatada}</td>
            <td data-label="Solicitante">${s.solicitanteNome || 'N/A'}</td>
            <td data-label="OS">${s.os.os}</td>
            <td data-label="Segmento">${s.os.segmento ? s.os.segmento.nome : 'N/A'}</td>
            <td data-label="LPU">${s.lpu.codigoLpu} - ${s.lpu.nomeLpu}</td>
            <td data-label="Quantidade" class="text-center">${s.quantidade}</td>
            <td data-label="Justificativa">${s.justificativa || ''}</td>
            <td data-label="Status">${statusBadge}</td>
        `;
        tbody.appendChild(tr);
    });
}

function renderizarTabelaHistoricoComplementares(solicitacoes) {
    const tbody = document.getElementById('tbody-historico-complementares');
    if (!tbody) return;

    const thead = tbody.previousElementSibling;
    thead.innerHTML = `
        <tr>
            <th>Status Final</th>
            <th>Data Solicitação</th>
            <th>Solicitante</th>
            <th>OS</th>
            <th>Segmento</th>
            <th>LPU</th>
            <th>Coordenador</th>
            <th>Data Ação Coord.</th>
            <th>Controller</th>
            <th>Data Ação Contr.</th>
            <th>Motivo Recusa</th>
        </tr>`;
    tbody.innerHTML = '';

    if (!solicitacoes || solicitacoes.length === 0) {
        tbody.innerHTML = `<tr><td colspan="11" class="text-center text-muted">Nenhum histórico encontrado.</td></tr>`;
        return;
    }

    solicitacoes.forEach(s => {
        const tr = document.createElement('tr');
        let statusBadge = '';
        const statusFormatado = (s.status || '').replace(/_/g, ' ');

        switch (s.status) {
            case 'APROVADO': statusBadge = `<span class="badge rounded-pill text-bg-success">${statusFormatado}</span>`; break;
            case 'REJEITADO': statusBadge = `<span class="badge rounded-pill text-bg-danger">${statusFormatado}</span>`; break;
            case 'PENDENTE_COORDENADOR': statusBadge = `<span class="badge rounded-pill text-bg-primary">${statusFormatado}</span>`; break;
            case 'PENDENTE_CONTROLLER': statusBadge = `<span class="badge rounded-pill text-bg-warning">${statusFormatado}</span>`; break;
            default: statusBadge = `<span class="badge rounded-pill text-bg-secondary">${statusFormatado}</span>`;
        }

        const dataSolicitacaoFmt = s.dataSolicitacao ? new Date(parseDataBrasileira(s.dataSolicitacao)).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'N/A';
        const dataAcaoCoordFmt = s.dataAcaoCoordenador ? new Date(parseDataBrasileira(s.dataAcaoCoordenador)).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
        const dataAcaoContrFmt = s.dataAcaoController ? new Date(parseDataBrasileira(s.dataAcaoController)).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';

        tr.innerHTML = `
            <td data-label="Status">${statusBadge}</td>
            <td data-label="Data Solicitação">${dataSolicitacaoFmt}</td>
            <td data-label="Solicitante">${s.solicitanteNome || 'N/A'}</td>
            <td data-label="OS">${s.os.os}</td>
            <td data-label="Segmento">${s.os.segmento ? s.os.segmento.nome : 'N/A'}</td>
            <td data-label="LPU">${s.lpu.codigoLpu} - ${s.lpu.nomeLpu}</td>
            <td data-label="Coordenador">${s.aprovadorCoordenadorNome || '—'}</td>
            <td data-label="Data Ação Coord.">${dataAcaoCoordFmt}</td>
            <td data-label="Controller">${s.aprovadorControllerNome || '—'}</td>
            <td data-label="Data Ação Contr.">${dataAcaoContrFmt}</td>
            <td data-label="Motivo Recusa" style="white-space: normal;">${s.motivoRecusa || '—'}</td>
        `;
        tbody.appendChild(tr);
    });
}

// Handlers do Modal
window.aprovarComplementar = function(id) {
    if (!modalAprovarComplementar) return;
    const btnConfirmar = document.getElementById('btnConfirmarAprovacaoComplementar');
    btnConfirmar.dataset.id = id;
    modalAprovarComplementar.show();
};

window.recusarComplementar = function(id) {
    if (!modalRecusarComplementar) return;
    const form = document.getElementById('formRecusarComplementar');
    form.dataset.id = id;
    form.reset();
    modalRecusarComplementar.show();
};