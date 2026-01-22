const AprovacoesComplementares = {

    MS_URL: "http://localhost:8082/v1/solicitacoes-complementares",

    currentSolicitacao: null,
    currentOsCompleta: null,
    alteracoesBuffer: {}, 
    listenersConfigurados: false,
    listaCompletaLpus: null,
    choicesMain: null,
    choicesEdit: null,

    init: () => {
        if (!AprovacoesComplementares.listenersConfigurados) {
            AprovacoesComplementares.listenersConfigurados = true;
            
            // CSS Apenas para cores da tabela (Amarelo/Riscado)
            // Z-Index agora é gerenciado pelos modais Bootstrap
            const style = document.createElement('style');
            style.innerHTML = `
                .item-modificado { background-color: #fff8d1 !important; border-left: 4px solid #ffc107; }
                .valor-antigo { text-decoration: line-through; color: #dc3545; margin-right: 6px; font-size: 0.85em; }
                .valor-novo { color: #198754; font-weight: bold; }
            `;
            document.head.appendChild(style);
            console.log("Módulo Complementares Iniciado.");
        }
    },

    // --- UTILITÁRIOS ---
    mostrarAlerta: (mensagem) => {
        document.getElementById('textoAlerta').innerText = mensagem;
        new bootstrap.Modal(document.getElementById('modalAlerta')).show();
    },

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
        } catch (error) {
            console.error("Erro LPUs:", error);
            return [];
        }
    },

    carregarPendencias: async () => {
        AprovacoesComplementares.init();
        const tbody = document.getElementById('tbodyAprovacoesComplementares');
        const loader = document.getElementById('loader-complementares');
        if (!tbody) return;

        loader.classList.remove('d-none');
        tbody.innerHTML = '';

        try {
            const response = await fetch(`${AprovacoesComplementares.MS_URL}/pendentes`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (!response.ok) throw new Error("Erro ao buscar pendências");
            const lista = await response.json();
            AprovacoesComplementares.renderizarTabelaPrincipal(lista);
        } catch (error) {
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

            AprovacoesComplementares.alteracoesBuffer = {};

            const respSol = await fetch(`${AprovacoesComplementares.MS_URL}/${id}`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
            const solicitacao = await respSol.json();
            AprovacoesComplementares.currentSolicitacao = solicitacao;

            const respOs = await fetch(`${API_BASE_URL}/os/${solicitacao.osId}`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
            const osCompleta = respOs.ok ? await respOs.json() : null;
            AprovacoesComplementares.currentOsCompleta = osCompleta;

            Swal.close();

            if (osCompleta) {
                AprovacoesComplementares.renderizarDetalhesOs(osCompleta);
                AprovacoesComplementares.renderizarItensExistentesComBuffer();
            } else {
                document.getElementById('osDetailsContainer').innerHTML = '<div class="alert alert-warning">OS não encontrada.</div>';
            }

            document.getElementById('viewLpuOriginal').value = `ID: ${solicitacao.lpuOriginalId}`;
            document.getElementById('viewQtdOriginal').value = solicitacao.quantidadeOriginal;
            document.getElementById('viewJustificativaManager').value = solicitacao.justificativa;
            
            document.getElementById('analiseSolicitacaoId').value = solicitacao.id;
            document.getElementById('editQuantidade').value = solicitacao.quantidadeAprovada || solicitacao.quantidadeOriginal;
            document.getElementById('editBoq').value = solicitacao.boqAprovado || '';
            document.getElementById('editStatusRegistro').value = solicitacao.statusRegistroAprovado || 'ATIVO';
            document.getElementById('editJustificativaCoordenador').value = solicitacao.justificativaCoordenador || '';

            const lpuSelect = document.getElementById('editLpuSelect');
            const todasLpus = await AprovacoesComplementares.carregarTodasLpus();
            
            if (AprovacoesComplementares.choicesMain) { AprovacoesComplementares.choicesMain.destroy(); }
            
            let html = '<option value="">Selecione...</option>';
            const selectedId = solicitacao.lpuAprovadaId || solicitacao.lpuOriginalId;
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
                ? `<span class="valor-novo"><i class="bi bi-pencil-fill me-1"></i>Editado</span>` 
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

        if(!lpuId || !qtd) { 
            // Substituímos o Swal por um modal Bootstrap aqui também
            AprovacoesComplementares.mostrarAlerta("Preencha LPU e Quantidade.");
            return; 
        }

        if (!AprovacoesComplementares.alteracoesBuffer[id]) {
            AprovacoesComplementares.alteracoesBuffer[id] = {};
        }
        AprovacoesComplementares.alteracoesBuffer[id].novaLpuId = parseInt(lpuId);
        AprovacoesComplementares.alteracoesBuffer[id].novaQtd = parseInt(qtd);
        AprovacoesComplementares.alteracoesBuffer[id].novoBoq = boq;

        bootstrap.Modal.getInstance(document.getElementById('modalEditarItemOs')).hide();
        AprovacoesComplementares.renderizarItensExistentesComBuffer();
    },

    salvarAprovacao: async () => {
        const id = document.getElementById('analiseSolicitacaoId').value;
        const justificativa = document.getElementById('editJustificativaCoordenador').value;
        const lpuId = document.getElementById('editLpuSelect').value;

        // SUBSTITUIÇÃO DO SWAL POR MODAL BOOTSTRAP
        if (!justificativa || justificativa.trim().length < 3) {
            AprovacoesComplementares.mostrarAlerta('A justificativa é obrigatória e deve conter detalhes.');
            return;
        }
        if (!lpuId) {
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
            lpuId: parseInt(lpuId),
            quantidade: parseInt(document.getElementById('editQuantidade').value),
            boq: document.getElementById('editBoq').value,
            statusRegistro: document.getElementById('editStatusRegistro').value,
            justificativa: justificativa,
            alteracoesItensExistentesJson: JSON.stringify(alteracoesArray)
        };

        try {
            Swal.fire({ title: 'Enviando...', didOpen: () => Swal.showLoading() });

            const resp = await fetch(`${AprovacoesComplementares.MS_URL}/${id}/coordenador/aprovar`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (resp.ok) {
                bootstrap.Modal.getInstance(document.getElementById('modalAnaliseCoordenador')).hide();
                Swal.fire('Sucesso', 'Proposta enviada!', 'success');
                AprovacoesComplementares.carregarPendencias();
            } else { throw new Error('Erro ao enviar'); }
        } catch (e) { Swal.fire('Erro', e.message, 'error'); }
    },

    // --- REJEIÇÃO (NOVO FLUXO COM BOOTSTRAP MODAL) ---
    prepararRejeicao: () => {
        // Abre o modal de rejeição em cima do modal principal
        document.getElementById('textoMotivoRecusa').value = '';
        new bootstrap.Modal(document.getElementById('modalRejeitar')).show();
    },

    prepararRejeicaoInicial: (id) => {
        // Caso clique em rejeitar direto da tabela
        document.getElementById('analiseSolicitacaoId').value = id;
        document.getElementById('textoMotivoRecusa').value = '';
        new bootstrap.Modal(document.getElementById('modalRejeitar')).show();
    },

    executarRejeicao: async () => {
        const id = document.getElementById('analiseSolicitacaoId').value;
        const motivo = document.getElementById('textoMotivoRecusa').value;

        if (!motivo || motivo.trim().length < 3) {
            alert("Digite o motivo da recusa."); // Alert simples para esse modal
            return;
        }

        try {
            const usuarioId = localStorage.getItem('usuarioId');
            await fetch(`${AprovacoesComplementares.MS_URL}/${id}/coordenador/rejeitar`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ aprovadorId: usuarioId, motivo: motivo })
            });
            
            // Fecha modais
            const modalRej = bootstrap.Modal.getInstance(document.getElementById('modalRejeitar'));
            if(modalRej) modalRej.hide();
            
            const modalMain = bootstrap.Modal.getInstance(document.getElementById('modalAnaliseCoordenador'));
            if(modalMain) modalMain.hide();

            Swal.fire('Recusado!', '', 'success');
            AprovacoesComplementares.carregarPendencias();
        } catch(e) {
            alert("Erro ao rejeitar");
        }
    }
};

window.AprovacoesComplementares = AprovacoesComplementares;
window.renderizarTabelaPendentesComplementares = AprovacoesComplementares.carregarPendencias;