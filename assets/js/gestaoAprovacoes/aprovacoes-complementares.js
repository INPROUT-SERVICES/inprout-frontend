const AprovacoesComplementares = {

    currentSolicitacao: null, // Armazena a solicitação sendo analisada no modal

    init: () => {
        AprovacoesComplementares.setupListeners();
    },

    // =========================================================================
    // UTILITÁRIOS
    // =========================================================================

    // Converte String Java "dd/MM/yyyy HH:mm:ss" para Date JS
    parseDataBR: (dataStr) => {
        if (!dataStr) return null;
        if (dataStr.includes('T')) return new Date(dataStr); // Já é ISO

        // Formato esperado: "21/01/2026 14:30:00"
        const partes = dataStr.split(' ');
        if (partes.length < 1) return null;

        const dataPartes = partes[0].split('/');
        const horaPartes = partes.length > 1 ? partes[1].split(':') : ['00', '00', '00'];

        // new Date(ano, mes-1, dia, hora, min, seg)
        return new Date(
            dataPartes[2],
            dataPartes[1] - 1,
            dataPartes[0],
            horaPartes[0],
            horaPartes[1],
            horaPartes[2] || 0
        );
    },

    // --- ABA DE PENDÊNCIAS ---
    carregarPendencias: async () => {
        const tbody = document.getElementById('tbodyAprovacoesComplementares');
        if (!tbody) return;

        // Loader Visual
        tbody.innerHTML = '<tr><td colspan="9" class="text-center py-5"><div class="spinner-border text-primary spinner-border-sm"></div><div class="mt-2 text-muted small">Carregando solicitações...</div></td></tr>';

        try {
            const response = await fetch(`${API_BASE_URL}/aprovacoes/complementares/pendentes`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });

            if (!response.ok) throw new Error('Erro ao buscar pendências');

            const lista = await response.json();
            window.todasPendenciasComplementares = lista || [];
            AprovacoesComplementares.renderizarTabela(lista);

        } catch (error) {
            console.error(error);
            tbody.innerHTML = `<tr><td colspan="9" class="text-center text-danger py-3">Erro: ${error.message}</td></tr>`;
        }
    },

    renderizarTabela: (lista) => {
        const tbody = document.getElementById('tbodyAprovacoesComplementares');
        const msgVazio = document.getElementById('msg-sem-complementares');
        tbody.innerHTML = '';

        // Controle de exibição de mensagem de vazio
        if (!lista || lista.length === 0) {
            if (msgVazio) {
                msgVazio.classList.remove('d-none');
                msgVazio.classList.add('d-block');
            }
            return;
        } else {
            if (msgVazio) {
                msgVazio.classList.add('d-none');
                msgVazio.classList.remove('d-block');
            }
        }

        lista.forEach(item => {
            const tr = document.createElement('tr');

            // Tratamento de Valores (Usa campo calculado do back ou calcula fallback)
            let valorTotal = item.valorTotalCalculado;
            if (valorTotal === undefined || valorTotal === null) {
                const valorUnit = (item.lpuOriginal && item.lpuOriginal.valor) ? item.lpuOriginal.valor : 0;
                valorTotal = (item.quantidade || 0) * valorUnit;
            }
            const valorFormatado = valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

            // Tratamento de Data
            const dataObj = AprovacoesComplementares.parseDataBR(item.dataSolicitacao);
            const dataFormatada = dataObj ? dataObj.toLocaleDateString('pt-BR') : '-';

            // Tratamento de Textos
            const nomeLpu = item.lpuAprovada ? item.lpuAprovada.nomeLpu : (item.lpuOriginal ? item.lpuOriginal.nomeLpu : (item.lpu ? item.lpu.nomeLpu : '-'));
            const codLpu = item.lpuAprovada ? item.lpuAprovada.codigoLpu : (item.lpuOriginal ? item.lpuOriginal.codigoLpu : (item.lpu ? item.lpu.codigoLpu : '-'));
            const qtd = item.quantidadeAprovada || item.quantidade || 0;
            const solicitante = item.solicitanteNome || 'Sistema';

            tr.innerHTML = `
                <td class="text-center">
                    <div class="form-check d-flex justify-content-center">
                        <input class="form-check-input check-item-comp" type="checkbox" value="${item.id}">
                    </div>
                </td>
                
                <td>
                    <div class="d-flex flex-column">
                        <span class="fw-bold text-dark">${item.os ? item.os.os : '-'}</span>
                        <span class="small text-muted" title="Solicitante: ${solicitante}">Solic.: ${solicitante}</span>
                    </div>
                </td>
                
                <td>
                    <div class="d-flex flex-column">
                         <span class="fw-bold text-secondary" style="font-size: 0.9rem;">${codLpu}</span>
                         <span class="small text-muted text-truncate" style="max-width: 250px;" title="${nomeLpu}">${nomeLpu}</span>
                    </div>
                </td>
                
                <td class="text-center">
                    <span class="badge bg-light text-dark border">${qtd}</span>
                </td>
                
                <td class="text-end">
                    <span class="fw-bold text-success">${valorFormatado}</span>
                </td>
                
                <td>
                    <div class="text-truncate" style="max-width: 180px;" title="${item.justificativa || ''}">
                        <small class="text-muted"><i class="bi bi-chat-left-text me-1"></i>${item.justificativa || '-'}</small>
                    </div>
                </td>
                
                <td class="text-center small text-muted">
                    <i class="bi bi-calendar3 me-1"></i>${dataFormatada}
                </td>
                
                <td class="text-center">
                    <span class="badge bg-warning text-dark"><i class="bi bi-clock me-1"></i>${item.status || 'Pendente'}</span>
                </td>
                
                <td class="text-center">
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary btn-analisar-comp" type="button" data-id="${item.id}" title="Analisar e Editar">
                            <i class="bi bi-pencil-square"></i>
                        </button>
                        <button class="btn btn-outline-danger btn-rejeitar-comp" type="button" data-id="${item.id}" title="Rejeitar">
                            <i class="bi bi-x-lg"></i>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    },

    setupListeners: () => {
        // Escuta cliques no documento inteiro (Delegação de Eventos)
        // Isso garante que os botões funcionem mesmo sendo criados dinamicamente
        document.addEventListener('click', (e) => {
            const target = e.target;

            // 1. AÇÃO DO COORDENADOR: Botão Aprovar em Massa
            // Verifica se clicou no botão ou no ícone dentro dele
            if (target.id === 'btnAprovarMassaComp' || target.closest('#btnAprovarMassaComp')) {
                e.preventDefault();
                console.log("Botão Aprovar Massa Clicado"); // Log para debug
                AprovacoesComplementares.processarLote('APROVAR');
            }

            // 2. AÇÃO DO COORDENADOR: Botão Rejeitar em Massa
            if (target.id === 'btnRejeitarMassaComp' || target.closest('#btnRejeitarMassaComp')) {
                e.preventDefault();
                AprovacoesComplementares.processarLote('REJEITAR');
            }

            // 3. Botão Analisar Individual (Lápis)
            const btnAnalisar = target.closest('.btn-analisar-comp');
            if (btnAnalisar) {
                e.preventDefault();
                const id = btnAnalisar.getAttribute('data-id');
                AprovacoesComplementares.abrirModalAnalise(id);
            }

            // 4. Botão Rejeitar Individual (X)
            const btnRejeitar = target.closest('.btn-rejeitar-comp');
            if (btnRejeitar) {
                e.preventDefault();
                const id = btnRejeitar.getAttribute('data-id');
                AprovacoesComplementares.abrirModalRejeicao(id);
            }

            // 5. Botão Buscar LPU (no Modal)
            if (target.id === 'btnBuscarLpu') {
                e.preventDefault();
                AprovacoesComplementares.buscarLpus();
            }
        });

        // Listener para o Checkbox "Selecionar Todos"
        document.addEventListener('change', (e) => {
            if (e.target && e.target.id === 'checkAllComp') {
                const isChecked = e.target.checked;
                document.querySelectorAll('.check-item-comp').forEach(checkbox => {
                    checkbox.checked = isChecked;
                });
                AprovacoesComplementares.atualizarBotoesMassa(); // Atualiza estado dos botões
            }

            // Listener para os Checkboxes individuais (para habilitar/desabilitar botões de massa)
            if (e.target && e.target.classList.contains('check-item-comp')) {
                AprovacoesComplementares.atualizarBotoesMassa();
            }
        });

        // Listener para o Enter no campo de busca de LPU
        document.addEventListener('keyup', (e) => {
            if (e.target && e.target.id === 'editLpuBusca' && e.key === 'Enter') {
                AprovacoesComplementares.buscarLpus();
            }
        });
    },

    // =========================================================================
    // MODAL DE ANÁLISE DETALHADA
    // =========================================================================

    abrirModalAnalise: async (id) => {
        try {
            Swal.fire({ title: 'Carregando dados...', didOpen: () => Swal.showLoading() });

            // 1. Busca dados da solicitação (AGORA COM ENDPOINT CORRETO)
            const respSol = await fetch(`${API_BASE_URL}/aprovacoes/complementares/${id}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (!respSol.ok) throw new Error("Erro ao carregar solicitação");
            const solicitacao = await respSol.json();
            AprovacoesComplementares.currentSolicitacao = solicitacao;

            // 2. Busca dados completos da OS
            const osId = solicitacao.os ? solicitacao.os.id : solicitacao.osId;
            const respOs = await fetch(`${API_BASE_URL}/os/${osId}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const osCompleta = respOs.ok ? await respOs.json() : null;

            Swal.close();

            // 3. Preenche Dados da OS no Modal
            if (osCompleta) AprovacoesComplementares.renderizarDetalhesOs(osCompleta);

            // 4. Preenche Dados Originais (Manager)
            const lpuOrig = solicitacao.lpuOriginal || solicitacao.lpu;
            const qtdOrig = solicitacao.quantidadeOriginal || solicitacao.quantidade;

            document.getElementById('viewLpuOriginal').value = lpuOrig ? `${lpuOrig.codigoLpu} - ${lpuOrig.nomeLpu}` : 'N/A';
            document.getElementById('viewQtdOriginal').value = qtdOrig;
            document.getElementById('viewJustificativaManager').value = solicitacao.justificativa || 'Sem justificativa.';

            // 5. Preenche Formulário de Edição
            document.getElementById('analiseSolicitacaoId').value = solicitacao.id;
            document.getElementById('editQuantidade').value = solicitacao.quantidadeAprovada || qtdOrig;
            document.getElementById('editBoq').value = solicitacao.boqAprovado || '';
            document.getElementById('editStatusRegistro').value = solicitacao.statusRegistroAprovado || 'ATIVO';
            document.getElementById('editJustificativaCoordenador').value = solicitacao.justificativaCoordenador || '';

            // 6. Setup do Select de LPU
            const lpuSelect = document.getElementById('editLpuSelect');
            const lpuFinal = solicitacao.lpuAprovada || lpuOrig;
            if (lpuFinal) {
                lpuSelect.innerHTML = `<option value="${lpuFinal.id}" selected>${lpuFinal.codigoLpu} - ${lpuFinal.nomeLpu}</option>`;
            }

            const modalEl = document.getElementById('modalAnaliseCoordenador');
            const modal = new bootstrap.Modal(modalEl);
            modal.show();

        } catch (error) {
            console.error(error);
            Swal.fire('Erro', 'Não foi possível carregar os detalhes.', 'error');
        }
    },

    renderizarDetalhesOs: (os) => {
        const container = document.getElementById('osDetailsContainer');
        if (!container) return;

        container.innerHTML = `
            <div class="col-md-3"><strong>OS:</strong> <br>${os.os || '-'}</div>
            <div class="col-md-3"><strong>Projeto:</strong> <br>${os.projeto || '-'}</div>
            <div class="col-md-3"><strong>Regional:</strong> <br>${os.regional || '-'}</div>
            <div class="col-md-3"><strong>Site:</strong> <br>${os.site || '-'}</div>
            
            <div class="col-md-3"><strong>Cidade/UF:</strong> <br>${os.cidade || '-'} / ${os.uf || '-'}</div>
            <div class="col-md-3"><strong>Segmento:</strong> <br>${os.segmento ? os.segmento.nome : '-'}</div>
            <div class="col-md-6"><strong>Descrição:</strong> <br><small>${os.descricao || '-'}</small></div>
        `;
    },

    buscarLpus: async () => {
        const termo = document.getElementById('editLpuBusca').value;
        if (!termo || termo.length < 3) {
            Swal.fire('Atenção', 'Digite pelo menos 3 caracteres para buscar.', 'warning');
            return;
        }

        const btn = document.getElementById('btnBuscarLpu');
        const originalHtml = btn.innerHTML;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
        btn.disabled = true;

        try {
            const response = await fetch(`${API_BASE_URL}/lpus/search?term=${encodeURIComponent(termo)}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const lpus = await response.json();

            const select = document.getElementById('editLpuSelect');

            if (lpus.length === 0) {
                Swal.fire('Info', 'Nenhuma LPU encontrada.', 'info');
            } else {
                let html = `<option value="" disabled>Selecione...</option>`;
                if (select.value && select.options[select.selectedIndex]) {
                    html += `<option value="${select.value}" selected class="fw-bold bg-light">${select.options[select.selectedIndex].text} (Atual)</option>`;
                    html += `<option disabled>──────────</option>`;
                }
                lpus.forEach(lpu => {
                    if (select.value != lpu.id) {
                        html += `<option value="${lpu.id}">${lpu.codigoLpu} - ${lpu.nomeLpu}</option>`;
                    }
                });
                select.innerHTML = html;
                const inputBusca = document.getElementById('editLpuBusca');
                inputBusca.classList.add('is-valid');
                setTimeout(() => inputBusca.classList.remove('is-valid'), 2000);
            }

        } catch (e) {
            console.error(e);
            Swal.fire('Erro', 'Erro ao buscar LPUs', 'error');
        } finally {
            btn.innerHTML = originalHtml;
            btn.disabled = false;
        }
    },

    salvarAprovacao: async () => {
        const id = document.getElementById('analiseSolicitacaoId').value;
        const justificativa = document.getElementById('editJustificativaCoordenador').value;
        const lpuId = document.getElementById('editLpuSelect').value;

        if (!justificativa || justificativa.trim().length < 3) {
            Swal.fire('Atenção', 'A justificativa é obrigatória.', 'warning');
            return;
        }
        if (!lpuId) {
            Swal.fire('Atenção', 'Selecione uma LPU válida.', 'warning');
            return;
        }

        const payload = {
            aprovadorId: localStorage.getItem('usuarioId'),
            lpuId: parseInt(lpuId),
            quantidade: parseInt(document.getElementById('editQuantidade').value),
            boq: document.getElementById('editBoq').value,
            statusRegistro: document.getElementById('editStatusRegistro').value,
            justificativa: justificativa
        };

        try {
            Swal.fire({ title: 'Salvando...', didOpen: () => Swal.showLoading() });

            const response = await fetch(`${API_BASE_URL}/aprovacoes/complementares/${id}/coordenador/aprovar`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                Swal.fire('Sucesso', 'Solicitação analisada e enviada ao Controller!', 'success');
                const modalEl = document.getElementById('modalAnaliseCoordenador');
                const modal = bootstrap.Modal.getInstance(modalEl);
                modal.hide();
                AprovacoesComplementares.carregarPendencias();
            } else {
                const err = await response.json();
                throw new Error(err.message || 'Falha ao aprovar');
            }
        } catch (error) {
            Swal.fire('Erro', error.message, 'error');
        }
    },

    confirmarRecusa: () => {
        const id = document.getElementById('analiseSolicitacaoId').value;
        const modalEl = document.getElementById('modalAnaliseCoordenador');
        const modal = bootstrap.Modal.getInstance(modalEl);
        modal.hide();
        AprovacoesComplementares.abrirModalRejeicao(id);
    },

    // --- AÇÕES GERAIS ---

    enviarDecisao: async (id, status, motivo = null) => {
        const confirmText = status === 'APROVADO' ? 'Aprovar esta solicitação?' : 'Rejeitar esta solicitação?';
        const result = await Swal.fire({
            title: 'Confirmação', text: confirmText, icon: 'question',
            showCancelButton: true, confirmButtonText: 'Sim', cancelButtonText: 'Cancelar'
        });
        if (!result.isConfirmed) return;

        Swal.fire({ title: 'Processando...', didOpen: () => Swal.showLoading() });
        try {
            let url, body;
            if (status === 'APROVADO') {
                url = `${API_BASE_URL}/aprovacoes/complementares/${id}/coordenador/aprovar`;
                body = {
                    aprovadorId: localStorage.getItem('usuarioId'),
                    lpuId: null,
                    quantidade: null,
                    boq: "-",
                    statusRegistro: "ATIVO",
                    justificativa: "Aprovação em lote/rápida pelo Coordenador"
                };
            } else {
                url = `${API_BASE_URL}/aprovacoes/complementares/${id}/rejeitar`;
                body = motivo ? { motivoRecusa: motivo } : {};
            }

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (!response.ok) throw new Error('Erro ao processar');

            Swal.fire('Sucesso', `Solicitação ${status.toLowerCase()}!`, 'success');
            AprovacoesComplementares.carregarPendencias();
        } catch (error) {
            Swal.fire('Erro', error.message, 'error');
        }
    },

    abrirModalRejeicao: async (id) => {
        const { value: motivo } = await Swal.fire({
            title: 'Motivo da Rejeição',
            input: 'textarea',
            inputLabel: 'Descreva o motivo',
            inputPlaceholder: 'Motivo...',
            showCancelButton: true,
            inputValidator: (value) => { if (!value) return 'Você precisa escrever um motivo!'; }
        });
        if (motivo) AprovacoesComplementares.enviarDecisao(id, 'REJEITADO', motivo);
    },

    processarLote: async (acao) => {
        const checked = document.querySelectorAll('.check-item-comp:checked');
        if (checked.length === 0) { Swal.fire('Atenção', 'Selecione pelo menos um item.', 'warning'); return; }
        const ids = Array.from(checked).map(c => parseInt(c.value));

        const confirmResult = await Swal.fire({
            title: `${acao === 'APROVAR' ? 'Aprovar' : 'Rejeitar'} em Lote`,
            text: `Confirmar ação para ${ids.length} itens?`,
            icon: 'warning', showCancelButton: true, confirmButtonText: 'Sim'
        });
        if (!confirmResult.isConfirmed) return;

        let motivo = null;
        if (acao === 'REJEITAR') {
            const { value: text } = await Swal.fire({
                title: 'Motivo da Rejeição em Lote', input: 'textarea',
                inputValidator: (value) => !value && 'Motivo obrigatório'
            });
            if (!text) return;
            motivo = text;
        }

        Swal.fire({ title: 'Processando...', didOpen: () => Swal.showLoading() });
        try {
            const endpoint = acao === 'APROVAR' ? 'aprovar-lote' : 'rejeitar-lote';
            const payload = { ids: ids, motivoRecusa: motivo, aprovadorId: localStorage.getItem('usuarioId') };

            const response = await fetch(`${API_BASE_URL}/aprovacoes/complementares/${endpoint}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error('Erro ao processar lote');
            Swal.fire('Sucesso', 'Lote processado!', 'success');
            AprovacoesComplementares.carregarPendencias();
        } catch (error) {
            Swal.fire('Erro', error.message, 'error');
        }
    },

    // ... Funções de histórico mantidas se existirem ...
};

window.AprovacoesComplementares = AprovacoesComplementares;
window.renderizarTabelaPendentesComplementares = AprovacoesComplementares.renderizarTabela;