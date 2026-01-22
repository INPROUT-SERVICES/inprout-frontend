const AprovacoesComplementares = {

    currentSolicitacao: null,
    currentOsCompleta: null,
    listenersConfigurados: false,
    listaCompletaLpus: null,
    choicesInstance: null, // Armazena instância do Choices para o modal principal

    init: () => {
        if (!AprovacoesComplementares.listenersConfigurados) {
            AprovacoesComplementares.setupListeners();
            AprovacoesComplementares.listenersConfigurados = true;
            console.log("Listeners de Aprovações Complementares ativados.");
        }
    },

    // =========================================================================
    // UTILITÁRIOS
    // =========================================================================

    parseDataBR: (dataStr) => {
        if (!dataStr) return null;
        if (dataStr.includes('T')) return new Date(dataStr);
        const partes = dataStr.split(' ');
        if (partes.length < 1) return null;
        const dataPartes = partes[0].split('/');
        const horaPartes = partes.length > 1 ? partes[1].split(':') : ['00', '00', '00'];
        return new Date(dataPartes[2], dataPartes[1] - 1, dataPartes[0], horaPartes[0], horaPartes[1], horaPartes[2] || 0);
    },

    formatarMoeda: (valor) => {
        return parseFloat(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    },

    // =========================================================================
    // CARREGAMENTO DE DADOS (LPU E PENDÊNCIAS)
    // =========================================================================

    carregarTodasLpus: async () => {
        if (AprovacoesComplementares.listaCompletaLpus) return AprovacoesComplementares.listaCompletaLpus;

        try {
            const response = await fetch(`${API_BASE_URL}/contrato`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const contratos = await response.json();

            let lpus = [];
            contratos.forEach(contrato => {
                if (contrato.lpus && contrato.lpus.length > 0) {
                    contrato.lpus.forEach(lpu => {
                        if (lpu.ativo) {
                            lpus.push({
                                id: lpu.id,
                                // CORREÇÃO AQUI: FORMATO CONTRATO | LPU
                                nome: `${contrato.nome} | ${lpu.codigoLpu} - ${lpu.nomeLpu}`,
                                codigo: lpu.codigoLpu,
                                contrato: contrato.nome
                            });
                        }
                    });
                }
            });

            // Ordena alfabeticamente
            lpus.sort((a, b) => a.nome.localeCompare(b.nome));

            AprovacoesComplementares.listaCompletaLpus = lpus;
            return lpus;
        } catch (error) {
            console.error("Erro ao carregar LPUs:", error);
            return [];
        }
    },

    carregarPendencias: async () => {
        AprovacoesComplementares.init();

        const tbody = document.getElementById('tbodyAprovacoesComplementares');
        const loader = document.getElementById('loader-complementares');

        if (!tbody) return;

        if (loader) loader.classList.remove('d-none');
        tbody.innerHTML = '';

        try {
            // CORREÇÃO AQUI: HEADERS ADICIONADOS PARA EVITAR ERRO 500
            const response = await fetch(`${API_BASE_URL}/aprovacoes/complementares/pendentes`, {
                headers: { 
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'X-User-Role': localStorage.getItem('userRole'),
                    'X-User-ID': localStorage.getItem('userId')
                }
            });

            if (!response.ok) throw new Error('Erro ao buscar pendências');

            const lista = await response.json();
            window.todasPendenciasComplementares = lista || [];
            AprovacoesComplementares.renderizarTabela(lista);

        } catch (error) {
            console.error(error);
            tbody.innerHTML = `<tr><td colspan="9" class="text-center text-danger py-3">Erro: ${error.message}</td></tr>`;
        } finally {
            if (loader) loader.classList.add('d-none');
        }
    },

    renderizarTabela: (lista) => {
        const tbody = document.getElementById('tbodyAprovacoesComplementares');
        const msgVazio = document.getElementById('msg-sem-complementares');
        tbody.innerHTML = '';

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

            let valorTotal = item.valorTotalCalculado;
            if (valorTotal === undefined || valorTotal === null) {
                const valorUnit = (item.lpuOriginal && item.lpuOriginal.valor) ? item.lpuOriginal.valor : 0;
                valorTotal = (item.quantidade || 0) * valorUnit;
            }
            const valorFormatado = valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

            const dataObj = AprovacoesComplementares.parseDataBR(item.dataSolicitacao);
            const dataFormatada = dataObj ? dataObj.toLocaleDateString('pt-BR') : '-';

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
                        <button class="btn btn-outline-primary btn-analisar-comp" type="button" 
                                onclick="AprovacoesComplementares.abrirModalAnalise('${item.id}')" 
                                title="Gerenciar OS e Analisar">
                            <i class="bi bi-pencil-square"></i>
                        </button>
                        <button class="btn btn-outline-danger btn-rejeitar-comp" type="button" 
                                onclick="AprovacoesComplementares.abrirModalRejeicao('${item.id}')" 
                                title="Rejeitar">
                            <i class="bi bi-x-lg"></i>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    },

    setupListeners: () => {
        document.addEventListener('click', (e) => {
            const target = e.target;

            if (target.closest('#btnAprovarMassaComp')) {
                e.preventDefault();
                AprovacoesComplementares.processarLote('APROVAR');
            }

            if (target.closest('#btnRejeitarMassaComp')) {
                e.preventDefault();
                AprovacoesComplementares.processarLote('REJEITAR');
            }
        });

        document.addEventListener('change', (e) => {
            if (e.target && e.target.id === 'checkAllComp') {
                const isChecked = e.target.checked;
                document.querySelectorAll('.check-item-comp').forEach(checkbox => {
                    checkbox.checked = isChecked;
                });
            }
        });
    },

    // =========================================================================
    // MODAL DE ANÁLISE DETALHADA E GERENCIAMENTO
    // =========================================================================

    abrirModalAnalise: async (id) => {
        try {
            Swal.fire({ title: 'A carregar dados da OS...', didOpen: () => Swal.showLoading() });

            // 1. Busca dados da solicitação
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
            AprovacoesComplementares.currentOsCompleta = osCompleta;

            Swal.close();

            if (osCompleta) {
                AprovacoesComplementares.renderizarDetalhesOs(osCompleta);
                AprovacoesComplementares.renderizarItensExistentes(osCompleta.detalhes || []);
            }

            // Preenche dados do Manager
            const lpuOrig = solicitacao.lpuOriginal || solicitacao.lpu;
            const qtdOrig = solicitacao.quantidadeOriginal || solicitacao.quantidade;
            document.getElementById('viewLpuOriginal').value = lpuOrig ? `${lpuOrig.codigoLpu} - ${lpuOrig.nomeLpu}` : 'N/A';
            document.getElementById('viewQtdOriginal').value = qtdOrig;
            document.getElementById('viewJustificativaManager').value = solicitacao.justificativa || 'Sem justificativa.';

            // Preenche formulário
            document.getElementById('analiseSolicitacaoId').value = solicitacao.id;
            document.getElementById('editQuantidade').value = solicitacao.quantidadeAprovada || qtdOrig;
            document.getElementById('editBoq').value = solicitacao.boqAprovado || '';
            document.getElementById('editStatusRegistro').value = solicitacao.statusRegistroAprovado || 'ATIVO';
            document.getElementById('editJustificativaCoordenador').value = solicitacao.justificativaCoordenador || '';

            // --- CONFIGURAÇÃO DO CHOICES.JS E CARREGAMENTO DE LPUS ---
            
            // Esconde a busca antiga se existir no HTML
            const searchInput = document.getElementById('editLpuBusca');
            if(searchInput) searchInput.parentElement.style.display = 'none';

            const lpuSelect = document.getElementById('editLpuSelect');
            
            // Carrega TODAS as LPUs
            const todasLpus = await AprovacoesComplementares.carregarTodasLpus();
            
            // Destroi instância anterior do Choices se existir
            if (AprovacoesComplementares.choicesInstance) {
                AprovacoesComplementares.choicesInstance.destroy();
                AprovacoesComplementares.choicesInstance = null;
            }

            // Monta as opções do select
            let optionsHtml = `<option value="">Selecione uma LPU...</option>`;
            const lpuFinal = solicitacao.lpuAprovada || lpuOrig;
            const lpuFinalId = lpuFinal ? lpuFinal.id : null;

            todasLpus.forEach(l => {
                const isSelected = lpuFinalId && l.id === lpuFinalId;
                optionsHtml += `<option value="${l.id}" ${isSelected ? 'selected' : ''}>${l.nome}</option>`;
            });
            lpuSelect.innerHTML = optionsHtml;

            // Inicializa Choices.js no select principal
            AprovacoesComplementares.choicesInstance = new Choices(lpuSelect, {
                searchEnabled: true,
                itemSelectText: '',
                placeholder: true,
                placeholderValue: 'Pesquise por código, nome ou contrato...',
                shouldSort: false
            });

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

    renderizarItensExistentes: (itens) => {
        const tbody = document.getElementById('tbodyItensExistentes');
        tbody.innerHTML = '';

        if (!itens || itens.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Nenhum item cadastrado nesta OS.</td></tr>';
            return;
        }

        itens.forEach(item => {
            const isInactive = item.statusRegistro === 'INATIVO';
            const rowClass = isInactive ? 'table-secondary text-muted text-decoration-line-through' : '';
            const statusBadge = isInactive
                ? '<span class="badge bg-secondary">INATIVO</span>'
                : '<span class="badge bg-success">ATIVO</span>';

            const lpuCodigo = item.lpu ? item.lpu.codigoLpu : '-';
            const lpuNome = item.lpu ? item.lpu.nomeLpu : '-';
            const valorUnit = item.lpu ? item.lpu.valor : 0;
            const valorTotal = item.valorTotal || (item.quantidade * valorUnit);

            const tr = document.createElement('tr');
            tr.className = rowClass;

            tr.innerHTML = `
                <td class="fw-bold">${lpuCodigo}</td>
                <td class="text-truncate" style="max-width: 200px;" title="${lpuNome}">${lpuNome}</td>
                <td class="text-center fw-bold">${item.quantidade}</td>
                <td class="text-end small text-muted">${AprovacoesComplementares.formatarMoeda(valorUnit)}</td>
                <td class="text-end fw-bold text-dark">${AprovacoesComplementares.formatarMoeda(valorTotal)}</td>
                <td class="text-center">${statusBadge}</td>
                <td class="text-center">
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary" type="button" 
                                onclick="AprovacoesComplementares.editarItemExistente(${item.id})" 
                                title="Editar Item Completo" ${isInactive ? 'disabled' : ''}>
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn ${isInactive ? 'btn-success' : 'btn-outline-secondary'}" type="button" 
                                onclick="AprovacoesComplementares.toggleStatusItem(${item.id}, '${item.statusRegistro}')" 
                                title="${isInactive ? 'Reativar' : 'Inativar'}">
                            <i class="bi ${isInactive ? 'bi-check-lg' : 'bi-slash-circle'}"></i>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    },

    toggleStatusItem: async (id, currentStatus) => {
        const novoStatus = currentStatus === 'INATIVO' ? 'ATIVO' : 'INATIVO';
        const result = await Swal.fire({
            title: `Confirmar`,
            text: `Deseja alterar para ${novoStatus}?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sim'
        });

        if (!result.isConfirmed) return;

        try {
            Swal.showLoading();
            const response = await fetch(`${API_BASE_URL}/os/detalhe/${id}/status`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status: novoStatus })
            });

            if (!response.ok) throw new Error("Erro ao atualizar status");

            Swal.fire('Sucesso', 'Status atualizado!', 'success');
            // Recarrega o modal para atualizar a tabela
            const solicitacaoId = document.getElementById('analiseSolicitacaoId').value;
            AprovacoesComplementares.abrirModalAnalise(solicitacaoId);

        } catch (error) {
            Swal.fire('Erro', error.message, 'error');
        }
    },

    // --- CORREÇÃO: EDIÇÃO DE ITEM COM CHOICES.JS E SELECT COMPLETO ---
    editarItemExistente: async (id) => {
        const item = AprovacoesComplementares.currentOsCompleta.detalhes.find(d => d.id === id);
        if (!item) return;

        const currentLpuId = item.lpu ? item.lpu.id : '';
        const currentQtd = item.quantidade || 0;
        const currentBoq = item.boq || '';

        // 1. Carrega TODAS as LPUs
        const todasLpus = await AprovacoesComplementares.carregarTodasLpus();

        let options = `<option value="">Selecione...</option>`;
        todasLpus.forEach(l => {
            const selected = l.id === currentLpuId ? 'selected' : '';
            options += `<option value="${l.id}" ${selected}>${l.nome}</option>`;
        });

        // 2. HTML do Modal (Apenas Select, sem busca manual)
        const htmlContent = `
            <div class="text-start">
                <label class="form-label fw-bold small">Item LPU</label>
                <select id="swal-edit-lpu-select" class="form-select form-select-sm mb-3">
                    ${options}
                </select>

                <div class="row g-2">
                    <div class="col-6">
                        <label class="form-label fw-bold small">Quantidade</label>
                        <input type="number" id="swal-edit-qtd" class="form-control form-control-sm" value="${currentQtd}" min="1">
                    </div>
                    <div class="col-6">
                        <label class="form-label fw-bold small">BOQ</label>
                        <input type="text" id="swal-edit-boq" class="form-control form-control-sm" value="${currentBoq}">
                    </div>
                </div>
            </div>
        `;

        // 3. Abre o SweetAlert com Choices.js
        const result = await Swal.fire({
            title: 'Editar Item da OS',
            html: htmlContent,
            showCancelButton: true,
            confirmButtonText: 'Salvar',
            cancelButtonText: 'Cancelar',
            width: '600px',
            // Inicializa o Choices dentro do Alert
            didOpen: () => {
                const selectEl = document.getElementById('swal-edit-lpu-select');
                new Choices(selectEl, {
                    searchEnabled: true,
                    itemSelectText: '',
                    placeholder: true,
                    placeholderValue: 'Pesquisar LPU...',
                    shouldSort: false,
                    position: 'bottom' // Abre para baixo
                });
                // Garante overflow visível no container do swal para o dropdown
                const content = selectEl.closest('.swal2-html-container');
                if(content) content.style.overflow = 'visible';
            },
            preConfirm: () => {
                const lpuId = document.getElementById('swal-edit-lpu-select').value;
                const qtd = document.getElementById('swal-edit-qtd').value;
                const boq = document.getElementById('swal-edit-boq').value;

                if (!lpuId) return Swal.showValidationMessage('Selecione uma LPU válida');
                if (!qtd || parseInt(qtd) <= 0) return Swal.showValidationMessage('Quantidade inválida');

                return { lpuId: parseInt(lpuId), quantidade: parseInt(qtd), boq: boq };
            }
        });

        // 4. Salva se confirmado
        if (result.isConfirmed) {
            const dados = result.value;

            if (dados.lpuId === currentLpuId && dados.quantidade === currentQtd && dados.boq === currentBoq) {
                return;
            }

            try {
                Swal.fire({ title: 'A atualizar...', didOpen: () => Swal.showLoading() });

                const response = await fetch(`${API_BASE_URL}/os/detalhe/${id}`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        quantidade: dados.quantidade,
                        boq: dados.boq,
                        lpu: { id: dados.lpuId }
                    })
                });

                if (!response.ok) throw new Error("Erro ao atualizar item");

                Swal.fire('Sucesso', 'Item atualizado!', 'success');
                const solicitacaoId = document.getElementById('analiseSolicitacaoId').value;
                AprovacoesComplementares.abrirModalAnalise(solicitacaoId);

            } catch (error) {
                Swal.fire('Erro', error.message, 'error');
            }
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
                Swal.fire('Sucesso', 'Solicitação enviada!', 'success');
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
                    justificativa: "Aprovação em lote/rápida"
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
    }
};

window.AprovacoesComplementares = AprovacoesComplementares;
window.renderizarTabelaPendentesComplementares = AprovacoesComplementares.renderizarTabela;