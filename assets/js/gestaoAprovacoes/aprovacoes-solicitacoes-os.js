// ==========================================================
// MÓDULO: Solicitações de Criação de OS
// ==========================================================

window.todasSolicitacoesOS = [];

const SolicitacoesOS = {

    filtroAtual: 'pendentes',

    // ========================
    // CARREGAR DADOS
    // ========================
    carregarDados: async function () {
        toggleLoader(true, '#solicitacoes-os-pane');
        try {
            let endpoint = '';
            if (this.filtroAtual === 'pendentes') {
                endpoint = `${API_BASE_URL}/solicitacoes-os/pendentes`;
            } else if (this.filtroAtual === 'historico') {
                endpoint = `${API_BASE_URL}/solicitacoes-os/historico`;
            }

            console.log('[SolicitacoesOS] Carregando:', endpoint);
            const resp = await fetchComAuth(endpoint);
            console.log('[SolicitacoesOS] Status:', resp.status, resp.statusText);

            if (resp.ok) {
                window.todasSolicitacoesOS = await resp.json();
                console.log('[SolicitacoesOS] Dados recebidos:', window.todasSolicitacoesOS.length, 'itens');
            } else {
                console.error('[SolicitacoesOS] Erro HTTP:', resp.status, '- Verifique se o backend foi deployado com o SolicitacaoOSController');
                window.todasSolicitacoesOS = [];
            }
            this.renderizar();
        } catch (e) {
            console.error('Erro ao carregar solicitações OS:', e);
            window.todasSolicitacoesOS = [];
            this.renderizar();
        } finally {
            toggleLoader(false, '#solicitacoes-os-pane');
        }
    },

    // ========================
    // FILTRAR
    // ========================
    filtrar: function (tipo) {
        this.filtroAtual = tipo;
        this.carregarDados();
    },

    // ========================
    // RENDERIZAR TABELA
    // ========================
    renderizar: function () {
        const tbody = document.getElementById('tbodySolicitacoesOS');
        const msgVazio = document.getElementById('msg-sem-solicitacoes-os');
        if (!tbody) return;

        const lista = window.todasSolicitacoesOS || [];

        if (lista.length === 0) {
            tbody.innerHTML = '';
            if (msgVazio) msgVazio.classList.remove('d-none');
            return;
        }
        if (msgVazio) msgVazio.classList.add('d-none');

        const role = (localStorage.getItem('role') || '').trim().toUpperCase();
        const isPendente = this.filtroAtual === 'pendentes';
        const podeAvaliar = isPendente && ['CONTROLLER', 'ADMIN'].includes(role);

        tbody.innerHTML = lista.map(s => {
            const statusBadge = this._badgeStatus(s.status);
            const data = s.dataSolicitacao ? this._formatarData(s.dataSolicitacao) : '-';
            const valorTotal = s.valorTotalEstimado != null ? formatarMoeda(s.valorTotalEstimado) : '-';

            let acoes = `<button class="btn btn-sm btn-outline-success border-0" title="Ver detalhes" onclick="SolicitacoesOS.verDetalhes(${s.id})"><i class="bi bi-eye"></i></button>`;
            if (podeAvaliar) {
                acoes += ` <button class="btn btn-sm btn-success border-0" title="Aprovar" onclick="SolicitacoesOS.verDetalhes(${s.id}, true)"><i class="bi bi-check-lg"></i></button>`;
                acoes += ` <button class="btn btn-sm btn-outline-danger border-0" title="Recusar" onclick="SolicitacoesOS.recusarRapido(${s.id})"><i class="bi bi-x-lg"></i></button>`;
            }

            return `<tr>
                <td class="fw-bold small">${s.projeto || '-'}</td>
                <td class="small">${s.segmento || '-'}</td>
                <td class="small">${s.gestorTim || '-'}</td>
                <td class="small">${s.osExistente || '<span class="text-muted fst-italic">Nova</span>'}</td>
                <td class="text-center"><span class="badge bg-secondary">${s.quantidadeItens || 0}</span></td>
                <td class="text-end small">${valorTotal}</td>
                <td class="small">${s.solicitante ? s.solicitante.nome : '-'}</td>
                <td class="small">${data}</td>
                <td class="text-center">${statusBadge}</td>
                <td class="text-center">${acoes}</td>
            </tr>`;
        }).join('');
    },

    // ========================
    // VER DETALHES
    // ========================
    verDetalhes: function (id, mostrarAcoes = false) {
        const s = (window.todasSolicitacoesOS || []).find(x => x.id === id);
        if (!s) { mostrarToast('Solicitação não encontrada.', 'error'); return; }

        document.getElementById('solOsDetProjeto').textContent = s.projeto || '-';
        document.getElementById('solOsDetSegmento').textContent = s.segmento || '-';
        document.getElementById('solOsDetGestorTim').textContent = s.gestorTim || '-';
        document.getElementById('solOsDetOsExistente').textContent = s.osExistente || 'Nova OS';
        document.getElementById('solOsDetSolicitante').textContent = s.solicitante ? s.solicitante.nome : '-';
        document.getElementById('solOsDetData').textContent = s.dataSolicitacao ? this._formatarData(s.dataSolicitacao) : '-';
        document.getElementById('solOsDetStatus').innerHTML = this._badgeStatus(s.status);
        document.getElementById('solOsDetIdHidden').value = s.id;

        // Itens
        const tbodyItens = document.getElementById('tbodyDetalheItensSolOS');
        let totalGeral = 0;
        if (s.itens && s.itens.length > 0) {
            tbodyItens.innerHTML = s.itens.map(item => {
                const valor = item.valor != null ? item.valor : 0;
                const qtd = item.quantidade || 0;
                const total = valor * qtd;
                totalGeral += total;
                return `<tr>
                    <td class="small">${item.lpuNome || item.lpuId || '-'}</td>
                    <td class="text-center">${qtd}</td>
                    <td class="small">${item.unidade || '-'}</td>
                    <td class="small">${item.site || '-'}</td>
                    <td class="small">${item.contrato || '-'}</td>
                    <td class="text-end small">${formatarMoeda(valor)}</td>
                    <td class="text-end small fw-bold">${formatarMoeda(total)}</td>
                    <td class="small text-muted">${item.observacoes || '-'}</td>
                </tr>`;
            }).join('');
        } else {
            tbodyItens.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-3">Sem itens.</td></tr>';
        }
        document.getElementById('solOsDetTotalGeral').textContent = formatarMoeda(totalGeral);

        // Motivo recusa
        const recusaContainer = document.getElementById('solOsDetRecusaContainer');
        if (s.status === 'RECUSADA' && s.motivoRecusa) {
            recusaContainer.classList.remove('d-none');
            document.getElementById('solOsDetMotivoRecusa').textContent = s.motivoRecusa;
            const avaliadorInfo = s.avaliador ? `Recusado por ${s.avaliador.nome} em ${s.dataAvaliacao ? this._formatarData(s.dataAvaliacao) : ''}` : '';
            document.getElementById('solOsDetAvaliadorRecusa').textContent = avaliadorInfo;
        } else {
            recusaContainer.classList.add('d-none');
        }

        // Footer ações
        const role = (localStorage.getItem('role') || '').trim().toUpperCase();
        const footerAcoes = document.getElementById('solOsDetFooterAcoes');
        const footerFechar = document.getElementById('solOsDetFooterFechar');

        if (s.status === 'PENDENTE' && ['CONTROLLER', 'ADMIN'].includes(role)) {
            footerAcoes.classList.remove('d-none');
            footerFechar.classList.add('d-none');
        } else {
            footerAcoes.classList.add('d-none');
            footerFechar.classList.remove('d-none');
        }

        const modal = new bootstrap.Modal(document.getElementById('modalDetalhesSolicitacaoOS'));
        modal.show();
    },

    // ========================
    // APROVAR
    // ========================
    aprovar: async function () {
        const id = document.getElementById('solOsDetIdHidden').value;
        if (!id) return;

        const confirm = await Swal.fire({
            icon: 'question',
            title: 'Aprovar Solicitação?',
            html: '<p>Ao aprovar, a OS será criada com os itens solicitados.</p><p class="text-danger small"><b>Atenção:</b> Esta ação é final.</p>',
            showCancelButton: true,
            confirmButtonText: 'Sim, aprovar e criar OS',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#198754'
        });
        if (!confirm.isConfirmed) return;

        const btnAprovar = document.getElementById('btnAprovarSolOS');
        if (typeof setButtonLoading === 'function' && btnAprovar) setButtonLoading(btnAprovar, true);
        toggleLoader(true, '#solicitacoes-os-pane');
        try {
            const avaliadorId = localStorage.getItem('usuarioId');
            const resp = await fetchComAuth(`${API_BASE_URL}/solicitacoes-os/${id}/aprovar`, {
                method: 'POST',
                body: JSON.stringify({ avaliadorId: parseInt(avaliadorId) })
            });

            const data = await resp.json().catch(() => ({}));

            // Fechar modal de detalhes
            const modalEl = document.getElementById('modalDetalhesSolicitacaoOS');
            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();

            if (resp.ok) {
                let msg = data.message || 'Solicitação aprovada com sucesso!';
                if (data.erros && data.erros.length > 0) {
                    msg += '\n\nErros: ' + data.erros.join(', ');
                }
                Swal.fire({
                    icon: 'success',
                    title: 'OS Criada!',
                    text: msg,
                    confirmButtonColor: '#198754'
                });
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'Erro',
                    text: data.message || 'Erro ao aprovar.',
                    confirmButtonColor: '#198754'
                });
            }

            await this.carregarDados();
            await carregarDashboardEBadges();

        } catch (e) {
            mostrarToast('Erro ao aprovar: ' + e.message, 'error');
        } finally {
            if (typeof setButtonLoading === 'function' && btnAprovar) setButtonLoading(btnAprovar, false);
            toggleLoader(false, '#solicitacoes-os-pane');
        }
    },

    // ========================
    // RECUSAR (via botão rápido da tabela)
    // ========================
    recusarRapido: function (id) {
        document.getElementById('solOsDetIdHidden').value = id;
        this.abrirRecusa();
    },

    // ========================
    // ABRIR MODAL RECUSA
    // ========================
    abrirRecusa: function () {
        document.getElementById('motivoRecusaSolicitacaoOS').value = '';
        const modal = new bootstrap.Modal(document.getElementById('modalRecusarSolicitacaoOS'));
        modal.show();
    },

    // ========================
    // CONFIRMAR RECUSA
    // ========================
    confirmarRecusa: async function () {
        const id = document.getElementById('solOsDetIdHidden').value;
        const motivo = document.getElementById('motivoRecusaSolicitacaoOS').value.trim();

        if (!motivo) {
            mostrarToast('Informe o motivo da recusa.', 'warning');
            return;
        }

        const btnRecusar = document.getElementById('btnConfirmarRecusaSolOS');
        if (typeof setButtonLoading === 'function' && btnRecusar) setButtonLoading(btnRecusar, true);
        toggleLoader(true, '#solicitacoes-os-pane');
        try {
            const avaliadorId = localStorage.getItem('usuarioId');
            const resp = await fetchComAuth(`${API_BASE_URL}/solicitacoes-os/${id}/recusar`, {
                method: 'POST',
                body: JSON.stringify({
                    avaliadorId: parseInt(avaliadorId),
                    motivo: motivo
                })
            });

            // Fechar modais
            const modalRecusa = bootstrap.Modal.getInstance(document.getElementById('modalRecusarSolicitacaoOS'));
            if (modalRecusa) modalRecusa.hide();
            const modalDetalhe = bootstrap.Modal.getInstance(document.getElementById('modalDetalhesSolicitacaoOS'));
            if (modalDetalhe) modalDetalhe.hide();

            if (resp.ok) {
                Swal.fire({
                    icon: 'success',
                    title: 'Solicitação Recusada',
                    text: 'A solicitação foi recusada. Os itens não serão criados.',
                    confirmButtonColor: '#198754'
                });
            } else {
                const data = await resp.json().catch(() => ({}));
                mostrarToast(data.message || 'Erro ao recusar.', 'error');
            }

            await this.carregarDados();
            await carregarDashboardEBadges();

        } catch (e) {
            mostrarToast('Erro ao recusar: ' + e.message, 'error');
        } finally {
            const btnRecusar2 = document.getElementById('btnConfirmarRecusaSolOS');
            if (typeof setButtonLoading === 'function' && btnRecusar2) setButtonLoading(btnRecusar2, false);
            toggleLoader(false, '#solicitacoes-os-pane');
        }
    },

    // ========================
    // CARREGAR CONTAGEM PENDENTES (para badge)
    // ========================
    carregarContagemPendentes: async function () {
        try {
            const resp = await fetchComAuth(`${API_BASE_URL}/solicitacoes-os/pendentes`);
            if (resp.ok) {
                const data = await resp.json();
                return data.length || 0;
            }
        } catch (e) {
            console.error('Erro contagem solicitações OS:', e);
        }
        return 0;
    },

    // ========================
    // HELPERS
    // ========================
    _badgeStatus: function (status) {
        const map = {
            'PENDENTE': '<span class="badge bg-warning text-dark"><i class="bi bi-hourglass-split me-1"></i>Pendente</span>',
            'APROVADA': '<span class="badge bg-success"><i class="bi bi-check-circle me-1"></i>Aprovada</span>',
            'RECUSADA': '<span class="badge bg-danger"><i class="bi bi-x-circle me-1"></i>Recusada</span>'
        };
        return map[status] || `<span class="badge bg-secondary">${status}</span>`;
    },

    _formatarData: function (dataStr) {
        if (!dataStr) return '-';
        // Formato pode ser ISO ou dd/MM/yyyy HH:mm:ss
        try {
            let d;
            if (dataStr.includes('T') || dataStr.includes('-')) {
                d = new Date(dataStr);
            } else if (dataStr.includes('/')) {
                const [data, hora] = dataStr.split(' ');
                const [dia, mes, ano] = data.split('/');
                d = new Date(`${ano}-${mes}-${dia}T${hora || '00:00:00'}`);
            } else {
                return dataStr;
            }
            return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        } catch (e) {
            return dataStr;
        }
    },

    // Inicializar - configurar radio buttons de filtro
    init: function () {
        const radios = document.querySelectorAll('input[name="filtroSolOs"]');
        radios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.filtrar(e.target.value);
            });
        });
        this.carregarDados();
    }
};

window.SolicitacoesOS = SolicitacoesOS;
