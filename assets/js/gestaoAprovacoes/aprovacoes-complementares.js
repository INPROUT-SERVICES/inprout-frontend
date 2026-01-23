const AprovacoesComplementares = {

    MS_URL: "http://localhost:8082/v1/solicitacoes-complementares",

    currentSolicitacao: null,
    currentOsCompleta: null,
    
    // Buffer para armazenar edições (Novas ou Carregadas do Backend)
    alteracoesBuffer: {}, 

    listenersConfigurados: false,
    listaCompletaLpus: null,
    choicesMain: null,
    choicesEdit: null,

    init: () => {
        if (!AprovacoesComplementares.listenersConfigurados) {
            AprovacoesComplementares.listenersConfigurados = true;
            
            const style = document.createElement('style');
            style.innerHTML = `
                .swal2-container { z-index: 20000 !important; }
                .swal2-popup { font-size: 0.9rem !important; }
                .item-modificado { background-color: #fff8d1 !important; border-left: 4px solid #ffc107; }
                .valor-antigo { text-decoration: line-through; color: #dc3545; margin-right: 6px; font-size: 0.85em; }
                .valor-novo { color: #198754; font-weight: bold; }
            `;
            document.head.appendChild(style);
        }
    },

    // --- UTILS ---
    parseDataBR: (dataStr) => {
        if (!dataStr) return null;
        if (dataStr.includes('T')) return new Date(dataStr);
        const partes = dataStr.split(' ');
        const [dia, mes, ano] = partes[0].split('/');
        return new Date(ano, mes - 1, dia);
    },

    formatarMoeda: (valor) => {
        return parseFloat(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    },

    mostrarAlerta: (msg) => {
        document.getElementById('textoAlerta').innerText = msg;
        new bootstrap.Modal(document.getElementById('modalAlerta')).show();
    },

    // --- CARREGAMENTO ---
    carregarTodasLpus: async () => {
        if (AprovacoesComplementares.listaCompletaLpus) return AprovacoesComplementares.listaCompletaLpus;
        try {
            const response = await fetch(`${API_BASE_URL}/contrato`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const contratos = await response.json();
            let lpus = [];
            contratos.forEach(c => {
                if (c.lpus) c.lpus.forEach(l => {
                    if (l.ativo) lpus.push({ id: l.id, nome: `${c.nome} | ${l.codigoLpu} - ${l.nomeLpu}` });
                });
            });
            lpus.sort((a, b) => a.nome.localeCompare(b.nome));
            AprovacoesComplementares.listaCompletaLpus = lpus;
            return lpus;
        } catch (error) { return []; }
    },

    carregarPendencias: async () => {
        AprovacoesComplementares.init();
        const tbody = document.getElementById('tbodyAprovacoesComplementares');
        const loader = document.getElementById('loader-complementares');
        if (!tbody) return;

        loader.classList.remove('d-none');
        tbody.innerHTML = '';

        try {
            // CORREÇÃO: Enviamos a ROLE para filtrar a fila correta
            const userRole = localStorage.getItem('role') || 'COORDINATOR'; // Fallback se não tiver no storage
            const response = await fetch(`${AprovacoesComplementares.MS_URL}/pendentes?role=${userRole}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            
            if (!response.ok) throw new Error("Erro ao buscar pendências");
            
            const lista = await response.json();
            AprovacoesComplementares.renderizarTabelaPrincipal(lista);
        } catch (error) {
            console.error(error);
            tbody.innerHTML = `<tr><td colspan="8" class="text-center text-danger">Erro: ${error.message}</td></tr>`;
        } finally {
            loader.classList.add('d-none');
        }
    },

    renderizarTabelaPrincipal: (lista) => {
        const tbody = document.getElementById('tbodyAprovacoesComplementares');
        const msgVazio = document.getElementById('msg-sem-complementares');
        tbody.innerHTML = '';

        if (!lista || lista.length === 0) {
            msgVazio.classList.remove('d-none');
            msgVazio.classList.add('d-block');
            return;
        }
        msgVazio.classList.add('d-none');
        msgVazio.classList.remove('d-block');

        lista.forEach(item => {
            const tr = document.createElement('tr');
            const dataFmt = item.dataSolicitacao ? new Date(item.dataSolicitacao).toLocaleDateString('pt-BR') : '-';
            const valorFmt = (item.valorTotalEstimado || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            
            tr.innerHTML = `
                <td><div class="d-flex flex-column"><span class="fw-bold text-dark">OS #${item.osId}</span><small class="text-muted">Solic.: ${item.solicitanteNomeSnapshot || '...'}</small></div></td>
                <td><span class="small text-muted">LPU ID: ${item.lpuOriginalId}</span></td>
                <td class="text-center"><span class="badge bg-light text-dark border">${item.quantidadeOriginal}</span></td>
                <td class="text-end fw-bold text-success">${valorFmt}</td>
                <td><small class="text-muted text-truncate d-inline-block" style="max-width: 150px;">${item.justificativa || ''}</small></td>
                <td class="text-center small">${dataFmt}</td>
                <td class="text-center"><span class="badge bg-warning text-dark">${item.status}</span></td>
                <td class="text-center">
                    <button class="btn btn-sm btn-outline-primary" onclick="AprovacoesComplementares.abrirModalAnalise('${item.id}')" title="Analisar"><i class="bi bi-pencil-square"></i></button>
                    <button class="btn btn-sm btn-outline-danger" onclick="AprovacoesComplementares.prepararRejeicaoInicial('${item.id}')" title="Rejeitar"><i class="bi bi-x-lg"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    },

    // --- MODAL DE ANÁLISE ---
    abrirModalAnalise: async (id) => {
        try {
            Swal.fire({ title: 'Carregando...', didOpen: () => Swal.showLoading() });

            // 1. Zera o buffer
            AprovacoesComplementares.alteracoesBuffer = {};

            // 2. Busca dados
            const respSol = await fetch(`${AprovacoesComplementares.MS_URL}/${id}`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
            const solicitacao = await respSol.json();
            AprovacoesComplementares.currentSolicitacao = solicitacao;

            // 3. CORREÇÃO: Se houver JSON de propostas, carrega no buffer!
            // Assim o Controller vê o que o Coordenador editou.
            if (solicitacao.alteracoesPropostasJson) {
                try {
                    const propostas = JSON.parse(solicitacao.alteracoesPropostasJson);
                    // O backend devolve array, convertemos para objeto chaveado por ID
                    propostas.forEach(p => {
                        AprovacoesComplementares.alteracoesBuffer[p.itemId] = {
                            novaQtd: p.novaQtd,
                            novaLpuId: p.novaLpuId,
                            novoBoq: p.novoBoq,
                            novoStatus: p.novoStatus
                        };
                    });
                } catch (errJson) {
                    console.error("Erro ao ler propostas anteriores:", errJson);
                }
            }

            const respOs = await fetch(`${API_BASE_URL}/os/${solicitacao.osId}`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
            const osCompleta = respOs.ok ? await respOs.json() : null;
            AprovacoesComplementares.currentOsCompleta = osCompleta;

            Swal.close();

            if (osCompleta) {
                AprovacoesComplementares.renderizarDetalhesOs(osCompleta);
                // Renderiza, e como o buffer já foi populado acima, vai pintar de amarelo!
                AprovacoesComplementares.renderizarItensExistentesComBuffer();
            } else {
                document.getElementById('osDetailsContainer').innerHTML = '<div class="alert alert-warning">OS não encontrada.</div>';
            }

            // Preenche Formulário da Direita
            // Se já tiver aprovação (Controller vendo), mostra os dados aprovados pelo coordenador
            const isControllerView = solicitacao.status === 'PENDENTE_CONTROLLER';
            
            document.getElementById('viewLpuOriginal').value = `ID: ${solicitacao.lpuOriginalId}`;
            document.getElementById('viewQtdOriginal').value = solicitacao.quantidadeOriginal;
            document.getElementById('viewJustificativaManager').value = solicitacao.justificativa;
            
            document.getElementById('analiseSolicitacaoId').value = solicitacao.id;
            
            // Se for Controller, mostra o que o Coordenador aprovou. Se for Coord, mostra original.
            document.getElementById('editQuantidade').value = isControllerView ? solicitacao.quantidadeAprovada : (solicitacao.quantidadeAprovada || solicitacao.quantidadeOriginal);
            document.getElementById('editBoq').value = isControllerView ? solicitacao.boqAprovado : (solicitacao.boqAprovado || '');
            document.getElementById('editStatusRegistro').value = isControllerView ? solicitacao.statusRegistroAprovado : (solicitacao.statusRegistroAprovado || 'ATIVO');
            document.getElementById('editJustificativaCoordenador').value = solicitacao.justificativaCoordenador || '';

            // Carrega LPUs
            const lpuSelect = document.getElementById('editLpuSelect');
            const todasLpus = await AprovacoesComplementares.carregarTodasLpus();
            
            if (AprovacoesComplementares.choicesMain) { AprovacoesComplementares.choicesMain.destroy(); }
            
            let html = '<option value="">Selecione...</option>';
            // Seleciona a LPU correta (Aprovada se existir, ou Original)
            const selectedId = isControllerView ? solicitacao.lpuAprovadaId : (solicitacao.lpuAprovadaId || solicitacao.lpuOriginalId);
            
            todasLpus.forEach(l => {
                html += `<option value="${l.id}" ${l.id == selectedId ? 'selected' : ''}>${l.nome}</option>`;
            });
            lpuSelect.innerHTML = html;

            AprovacoesComplementares.choicesMain = new Choices(lpuSelect, { searchEnabled: true, itemSelectText: '', placeholderValue: 'Pesquisar...', shouldSort: false });

            new bootstrap.Modal(document.getElementById('modalAnaliseCoordenador')).show();

        } catch (e) {
            console.error(e);
            alert('Erro ao abrir');
        }
    },

    renderizarDetalhesOs: (os) => {
        document.getElementById('osDetailsContainer').innerHTML = `
            <div class="col-md-3"><strong>OS:</strong> <br>${os.os}</div>
            <div class="col-md-3"><strong>Projeto:</strong> <br>${os.projeto}</div>
            <div class="col-md-3"><strong>Regional:</strong> <br>${os.regional}</div>
            <div class="col-md-12"><strong>Descrição:</strong> <small>${os.descricao}</small></div>
        `;
    },

    renderizarItensExistentesComBuffer: () => {
        const itens = AprovacoesComplementares.currentOsCompleta.detalhes || [];
        const tbody = document.getElementById('tbodyItensExistentes');
        tbody.innerHTML = '';

        if(itens.length === 0) { 
            tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Vazio</td></tr>'; 
            return; 
        }

        itens.forEach(item => {
            const tr = document.createElement('tr');
            const alteracao = AprovacoesComplementares.alteracoesBuffer[item.id];
            
            const statusOriginal = item.statusRegistro || 'ATIVO';
            const qtdOriginal = item.quantidade;
            const lpuNomeOriginal = item.lpu ? item.lpu.nomeLpu : '-';

            const statusFinal = alteracao && alteracao.novoStatus ? alteracao.novoStatus : statusOriginal;
            const qtdFinal = alteracao && alteracao.novaQtd ? alteracao.novaQtd : qtdOriginal;
            const lpuAlterada = alteracao && alteracao.novaLpuId && alteracao.novaLpuId != (item.lpu?.id);

            if (alteracao) tr.classList.add('item-modificado');
            if (statusFinal === 'INATIVO') tr.classList.add('text-muted');

            const htmlQtd = (alteracao && alteracao.novaQtd != qtdOriginal) 
                ? `<span class="valor-antigo">${qtdOriginal}</span><span class="valor-novo">${qtdFinal}</span>` 
                : qtdOriginal;

            const htmlStatus = (alteracao && alteracao.novoStatus != statusOriginal)
                ? `<span class="badge bg-secondary text-decoration-line-through me-1">${statusOriginal}</span><span class="badge ${statusFinal === 'ATIVO' ? 'bg-success' : 'bg-danger'}">${statusFinal} (Prop.)</span>`
                : `<span class="badge ${statusOriginal === 'ATIVO' ? 'bg-success' : 'bg-secondary'}">${statusOriginal}</span>`;

            const htmlLpu = lpuAlterada 
                ? `<span class="valor-novo"><i class="bi bi-pencil-fill me-1"></i>(Editado)</span>` 
                : `<span class="text-truncate d-inline-block" style="max-width:150px;">${lpuNomeOriginal}</span>`;

            const btnIcon = statusFinal === 'ATIVO' ? 'bi-slash-circle' : 'bi-check-lg';
            const btnClass = statusFinal === 'ATIVO' ? 'btn-outline-danger' : 'btn-success';
            const btnTitle = statusFinal === 'ATIVO' ? 'Propor Inativação' : 'Propor Ativação';

            tr.innerHTML = `
                <td>${item.lpu ? item.lpu.codigoLpu : '-'}</td>
                <td>${htmlLpu}</td>
                <td class="text-center fw-bold">${htmlQtd}</td>
                <td class="text-end">${AprovacoesComplementares.formatarMoeda(item.lpu ? item.lpu.valor : 0)}</td>
                <td class="text-end fw-bold">${AprovacoesComplementares.formatarMoeda(item.valorTotal)}</td>
                <td class="text-center">${htmlStatus}</td>
                <td class="text-center">
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary" onclick="AprovacoesComplementares.abrirModalEdicaoItem(${item.id})" title="Propor Edição">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn ${btnClass}" onclick="AprovacoesComplementares.toggleStatusBuffer(${item.id}, '${statusFinal}')" title="${btnTitle}">
                            <i class="bi ${btnIcon}"></i>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    },

    toggleStatusBuffer: (id, statusAtual) => {
        const novoStatus = statusAtual === 'ATIVO' ? 'INATIVO' : 'ATIVO';
        if (!AprovacoesComplementares.alteracoesBuffer[id]) {
            AprovacoesComplementares.alteracoesBuffer[id] = {};
        }
        AprovacoesComplementares.alteracoesBuffer[id].novoStatus = novoStatus;
        AprovacoesComplementares.renderizarItensExistentesComBuffer();
    },

    abrirModalEdicaoItem: async (itemId) => {
        const item = AprovacoesComplementares.currentOsCompleta.detalhes.find(d => d.id === itemId);
        if (!item) return;

        const buffer = AprovacoesComplementares.alteracoesBuffer[itemId] || {};

        document.getElementById('editItemIdHidden').value = itemId;
        document.getElementById('modalEditQtd').value = buffer.novaQtd || item.quantidade;
        document.getElementById('modalEditBoq').value = buffer.novoBoq || item.boq || '';

        const select = document.getElementById('modalEditLpuSelect');
        const todasLpus = await AprovacoesComplementares.carregarTodasLpus();
        
        if (AprovacoesComplementares.choicesEdit) { AprovacoesComplementares.choicesEdit.destroy(); }

        let html = '<option value="">Selecione...</option>';
        const currentLpuId = buffer.novaLpuId || (item.lpu ? item.lpu.id : null);
        
        todasLpus.forEach(l => {
            html += `<option value="${l.id}" ${l.id == currentLpuId ? 'selected' : ''}>${l.nome}</option>`;
        });
        select.innerHTML = html;

        AprovacoesComplementares.choicesEdit = new Choices(select, { searchEnabled: true, itemSelectText: '', placeholderValue: 'Pesquisar...', shouldSort: false });

        new bootstrap.Modal(document.getElementById('modalEditarItemOs')).show();
    },

    salvarEdicaoBuffer: () => {
        const id = document.getElementById('editItemIdHidden').value;
        const lpuId = document.getElementById('modalEditLpuSelect').value;
        const qtd = document.getElementById('modalEditQtd').value;
        const boq = document.getElementById('modalEditBoq').value;

        if(!lpuId || !qtd) { AprovacoesComplementares.mostrarAlerta("Preencha LPU e Quantidade."); return; }

        if (!AprovacoesComplementares.alteracoesBuffer[id]) {
            AprovacoesComplementares.alteracoesBuffer[id] = {};
        }
        AprovacoesComplementares.alteracoesBuffer[id].novaLpuId = parseInt(lpuId);
        AprovacoesComplementares.alteracoesBuffer[id].novaQtd = parseInt(qtd);
        AprovacoesComplementares.alteracoesBuffer[id].novoBoq = boq;

        bootstrap.Modal.getInstance(document.getElementById('modalEditarItemOs')).hide();
        AprovacoesComplementares.renderizarItensExistentesComBuffer();
    },

    // --- ENVIAR PARA O SERVIDOR ---
    salvarAprovacao: async () => {
        const id = document.getElementById('analiseSolicitacaoId').value;
        const justificativa = document.getElementById('editJustificativaCoordenador').value;
        const lpuId = document.getElementById('editLpuSelect').value;

        // Detecta qual rota chamar com base no status da solicitação
        const isController = AprovacoesComplementares.currentSolicitacao.status === 'PENDENTE_CONTROLLER';
        // Se for Controller, a ação é "aprovar" (finalizar). Se for Coord, é "aprovar" (enviar para controller).
        // A rota é a mesma, mas a role de quem chama muda no token.
        
        // Verifica campos
        if (!justificativa || justificativa.trim().length < 3) {
            AprovacoesComplementares.mostrarAlerta('Preencha a Justificativa.');
            return;
        }
        if (!isController && !lpuId) { // Coordenador precisa definir LPU
            AprovacoesComplementares.mostrarAlerta('Selecione a LPU da decisão.');
            return;
        }

        const alteracoesArray = Object.keys(AprovacoesComplementares.alteracoesBuffer).map(itemId => {
            return {
                itemId: parseInt(itemId),
                ...AprovacoesComplementares.alteracoesBuffer[itemId]
            };
        });

        const payload = {
            aprovadorId: localStorage.getItem('usuarioId'),
            lpuId: lpuId ? parseInt(lpuId) : null,
            quantidade: parseInt(document.getElementById('editQuantidade').value),
            boq: document.getElementById('editBoq').value,
            statusRegistro: document.getElementById('editStatusRegistro').value,
            justificativa: justificativa,
            alteracoesItensExistentesJson: JSON.stringify(alteracoesArray)
        };

        const endpointAction = isController ? 'controller/aprovar' : 'coordenador/aprovar';

        try {
            Swal.fire({ title: 'Enviando...', didOpen: () => Swal.showLoading() });

            const resp = await fetch(`${AprovacoesComplementares.MS_URL}/${id}/${endpointAction}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (resp.ok) {
                bootstrap.Modal.getInstance(document.getElementById('modalAnaliseCoordenador')).hide();
                Swal.fire('Sucesso', isController ? 'Finalizado com Sucesso!' : 'Enviado para Controller!', 'success');
                AprovacoesComplementares.carregarPendencias();
            } else { throw new Error('Erro ao processar'); }
        } catch (e) { Swal.fire('Erro', e.message, 'error'); }
    },

    prepararRejeicaoInicial: (id) => {
        document.getElementById('analiseSolicitacaoId').value = id;
        AprovacoesComplementares.prepararRejeicao();
    },

    prepararRejeicao: () => {
        document.getElementById('textoMotivoRecusa').value = '';
        new bootstrap.Modal(document.getElementById('modalRejeitar')).show();
    },

    executarRejeicao: async () => {
        const id = document.getElementById('analiseSolicitacaoId').value;
        const motivo = document.getElementById('textoMotivoRecusa').value;

        if (!motivo || motivo.trim().length < 3) {
            alert("Digite o motivo."); return;
        }

        const isController = AprovacoesComplementares.currentSolicitacao?.status === 'PENDENTE_CONTROLLER';
        const endpointAction = isController ? 'controller/devolver' : 'coordenador/rejeitar';

        try {
            const usuarioId = localStorage.getItem('usuarioId');
            await fetch(`${AprovacoesComplementares.MS_URL}/${id}/${endpointAction}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ aprovadorId: usuarioId, motivo: motivo })
            });
            
            bootstrap.Modal.getInstance(document.getElementById('modalRejeitar')).hide();
            // Fecha modal principal se estiver aberto
            const mainModal = bootstrap.Modal.getInstance(document.getElementById('modalAnaliseCoordenador'));
            if(mainModal) mainModal.hide();

            Swal.fire('Sucesso', isController ? 'Devolvido para Coordenador!' : 'Rejeitado!', 'success');
            AprovacoesComplementares.carregarPendencias();
        } catch(e) {
            alert("Erro ao rejeitar");
        }
    }
};

window.AprovacoesComplementares = AprovacoesComplementares;
window.renderizarTabelaPendentesComplementares = AprovacoesComplementares.carregarPendencias;