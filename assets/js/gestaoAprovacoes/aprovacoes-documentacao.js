// ==========================================================
// LÓGICA DA ABA: DOCUMENTAÇÃO (Visualização Geral / Ações Restritas)
// ==========================================================

let filtroDocAtual = 'TODOS';

function initDocumentacaoTab() {
    console.log("Iniciando aba de documentação...");
    
    // Listeners dos Filtros
    const radiosFiltro = document.querySelectorAll('input[name="filtroDocStatus"]');
    radiosFiltro.forEach(radio => {
        radio.addEventListener('change', (e) => {
            filtroDocAtual = e.target.value;
            aplicarFiltroDocumentacao(filtroDocAtual);
        });
    });

    // Listener do Refresh
    const btnAtualizar = document.getElementById('btn-atualizar-docs');
    if (btnAtualizar) {
        btnAtualizar.onclick = async () => {
            toggleLoader(true, '#minhas-docs-pane');
            await carregarDashboardEBadges(); 
            aplicarFiltroDocumentacao(filtroDocAtual); 
            toggleLoader(false, '#minhas-docs-pane');
            mostrarToast("Lista atualizada.");
        };
    }

    // Filtro inicial
    const filtroMarcado = document.querySelector('input[name="filtroDocStatus"]:checked');
    if (filtroMarcado) filtroDocAtual = filtroMarcado.value;
    aplicarFiltroDocumentacao(filtroDocAtual);
}

function aplicarFiltroDocumentacao(tipoFiltro) {
    const dadosPendentes = window.minhasDocsPendentes || [];
    const dadosHistorico = window.minhasDocsHistorico || [];
    
    let dadosFiltrados = [];
    
    // Controle da Coluna Assunto (Só aparece no Histórico)
    const thAssunto = document.getElementById('th-assunto-email');
    if(thAssunto) {
        if(tipoFiltro === 'HISTORICO') thAssunto.classList.remove('d-none');
        else thAssunto.classList.add('d-none');
    }

    switch (tipoFiltro) {
        case 'HISTORICO':
            // Filtra histórico para exibir apenas itens realmente finalizados/processados
            dadosFiltrados = dadosHistorico.filter(item => 
                item.statusDocumentacao.includes('FINALIZADO') || 
                item.statusDocumentacao === 'DEVOLVIDO' || 
                item.statusDocumentacao === 'REPROVADO'
            );
            break;
        case 'PENDENTE_RECEBIMENTO':
            dadosFiltrados = dadosPendentes.filter(item => item.statusDocumentacao === 'PENDENTE_RECEBIMENTO');
            break;
        case 'EM_ANALISE':
            dadosFiltrados = dadosPendentes.filter(item => item.statusDocumentacao === 'EM_ANALISE');
            break;
        case 'TODOS':
        default:
            dadosFiltrados = dadosPendentes;
            break;
    }

    renderizarTabelaDocsAgrupada(dadosFiltrados, tipoFiltro);
}

function renderizarTabelaDocsAgrupada(listaDeOsAgrupada, contextoFiltro) {
    const tbody = document.getElementById('tbody-minhas-docs');
    const msgVazio = document.getElementById('msg-sem-docs');

    // Identifica o papel do usuário para controlar as ações
    const userRole = (localStorage.getItem("role") || "").trim().toUpperCase();
    const podeExecutarAcao = userRole === 'DOCUMENTIST' || userRole === 'ADMIN';

    // Atualiza KPIs
    if (window.minhasDocsPendentes && window.minhasDocsHistorico) {
        const totalPendente = window.minhasDocsPendentes.reduce((acc, i) => acc + (i.valorTotalOS || 0), 0);
        const totalHistorico = window.minhasDocsHistorico
            .filter(i => i.statusDocumentacao.includes('FINALIZADO'))
            .reduce((acc, i) => acc + (i.valorTotalOS || 0), 0);
        
        const elSaldo = document.getElementById('doc-carteira-previsto');
        const elFinalizado = document.getElementById('doc-carteira-finalizado');
        const elTotal = document.getElementById('doc-carteira-total');

        if(elSaldo) elSaldo.innerText = formatarMoeda(totalPendente);
        if(elFinalizado) elFinalizado.innerText = formatarMoeda(totalHistorico);
        if(elTotal) elTotal.innerText = formatarMoeda(totalPendente + totalHistorico);
    }

    if (!tbody) return;
    tbody.innerHTML = '';

    if (!listaDeOsAgrupada || listaDeOsAgrupada.length === 0) {
        if (msgVazio) {
            msgVazio.classList.remove('d-none');
            const span = msgVazio.querySelector('span');
            if(span) span.textContent = contextoFiltro === 'HISTORICO' ? "Nenhum histórico encontrado." : "Nenhuma pendência encontrada.";
        }
        return;
    } else {
        if (msgVazio) msgVazio.classList.add('d-none');
    }

    listaDeOsAgrupada.forEach(item => {
        const osObj = item.os || {}; 
        const status = item.statusDocumentacao || 'PENDENTE';
        
        const solicitanteNome = item.manager ? item.manager.nome : 'N/D';
        const responsavelNome = item.documentistaNome || '-';
        const tipoDoc = item.tipoDocumentacaoNome || '-';
        const prazo = item.dataPrazoDoc;
        const valor = item.valorTotalOS || 0;
        const numOs = osObj.os || 'N/D';
        const assunto = item.assuntoEmail || '-';
        
        // Badges Visuais
        let htmlStatus = `<span class="badge bg-secondary">${status}</span>`;
        if (status === 'PENDENTE_RECEBIMENTO') htmlStatus = `<span class="badge bg-warning text-dark">Aguardando Envio</span>`;
        else if (status === 'EM_ANALISE') htmlStatus = `<span class="badge bg-primary">Em Análise</span>`;
        else if (status.includes('FINALIZADO')) htmlStatus = `<span class="badge bg-success">Finalizado</span>`;
        else if (status === 'DEVOLVIDO' || status === 'REPROVADO') htmlStatus = `<span class="badge bg-danger">Devolvido</span>`;

        // Cálculo de Prazo
        let htmlPrazo = '-';
        if (prazo && !status.includes('FINALIZADO')) {
            const d = new Date(prazo); const h = new Date(); h.setHours(0,0,0,0); d.setHours(0,0,0,0);
            let cls = 'bg-success';
            if (d < h) cls = 'bg-danger';
            else if (d.getTime() === h.getTime()) cls = 'bg-warning text-dark';
            htmlPrazo = `<span class="badge ${cls}">${formatarData(prazo)}</span>`;
        } else if (prazo) {
            htmlPrazo = `<small class="text-muted">${formatarData(prazo)}</small>`;
        }

        // =====================================================================
        // LÓGICA DE BOTÕES (PERMISSÕES)
        // =====================================================================
        let botoes = '';
        
        // Se for histórico, ou finalizado, ou se o usuário NÃO tiver permissão de ação, mostra apenas "Ver"
        if (contextoFiltro === 'HISTORICO' || status.includes('FINALIZADO') || status === 'DEVOLVIDO' || !podeExecutarAcao) {
             botoes = `
                <button class="btn btn-sm btn-outline-secondary" onclick="abrirModalComentarios('${item.id}', false)" title="Ver Histórico/Detalhes">
                    <i class="bi bi-eye"></i>
                </button>
             `;
        } else {
            // Se tem permissão (ADMIN ou DOCUMENTIST) e o status permite ação:
            if (status === 'EM_ANALISE') {
                botoes = `
                    <div class="btn-group" role="group">
                        <button class="btn btn-sm btn-success btn-finalizar-doc" 
                                data-id="${item.id}" 
                                title="Aprovar">
                            <i class="bi bi-check-lg"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" 
                                onclick="iniciarRecusa('${item.id}')" title="Devolver">
                            <i class="bi bi-x-lg"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-secondary" 
                                onclick="abrirModalComentarios('${item.id}', false)" title="Comentários">
                            <i class="bi bi-chat-left-text"></i>
                        </button>
                    </div>
                `;
            } else if (status === 'PENDENTE_RECEBIMENTO') {
                 // Botão de receber (geralmente ADMIN ou se o fluxo permitir)
                 botoes = `
                    <button class="btn btn-sm btn-outline-primary" 
                            onclick="receberDocumentacao('${item.id}')" 
                            title="Confirmar Recebimento">
                        <i class="bi bi-box-arrow-in-down"></i>
                    </button>
                `;
            }
        }

        const displayAssunto = contextoFiltro === 'HISTORICO' ? '' : 'd-none';

        const tr = `
            <tr>
                <td class="align-middle text-center">${botoes}</td>
                <td class="align-middle text-center">${htmlStatus}</td>
                <td class="align-middle text-truncate" style="max-width:150px;" title="${solicitanteNome}">
                    ${solicitanteNome}
                </td>
                <td class="align-middle">
                    <span class="fw-medium">${tipoDoc}</span>
                    <div class="small text-muted" style="font-size: 0.75rem;">OS: ${numOs}</div>
                </td>
                <td class="align-middle text-center">${htmlPrazo}</td>
                <td class="align-middle text-end fw-bold text-secondary">
                    ${formatarMoeda(valor)}
                </td>
                <td class="align-middle text-center small">
                    ${responsavelNome}
                </td>
                <td class="align-middle small ${displayAssunto}">
                    ${assunto}
                </td>
            </tr>
        `;
        tbody.innerHTML += tr;
    });
}

// 1. RECEBER
async function receberDocumentacao(osId) {
    if (!confirm('Confirmar o recebimento?')) return;
    
    const btn = document.activeElement;
    if(btn) btn.disabled = true;
    toggleLoader(true, '#minhas-docs-pane');

    try {
        const userId = localStorage.getItem('usuarioId');
        await fetchComAuth(`${API_BASE_URL}/lancamentos/${osId}/documentacao/receber`, {
            method: 'POST',
            body: JSON.stringify({ usuarioId: userId, comentario: 'Recebido via painel web' })
        });
        
        mostrarToast("Documentos recebidos!", "success");
        await carregarDashboardEBadges();
        aplicarFiltroDocumentacao(filtroDocAtual);

    } catch (e) {
        mostrarToast(e.message, 'error');
    } finally {
        toggleLoader(false, '#minhas-docs-pane');
    }
}

// 2. RECUSAR
function iniciarRecusa(id) {
    abrirModalComentarios(id, true);
}

// 3. MODAL E BACKDROP FIX
function abrirModalComentarios(id, isRecusa = false) {
    const modalEl = document.getElementById('modalComentarios');
    const modal = new bootstrap.Modal(modalEl);
    
    const lista = document.getElementById('listaComentariosContainer');
    if(lista) lista.innerHTML = '<div class="text-center p-3"><span class="spinner-border text-primary"></span></div>';
    
    const btnEnviar = document.getElementById('btnEnviarComentarioModal'); 
    const txtArea = document.getElementById('novoComentarioTexto');
    if(txtArea) txtArea.value = '';

    const novoBtn = btnEnviar.cloneNode(true);
    btnEnviar.parentNode.replaceChild(novoBtn, btnEnviar);

    if (isRecusa) {
        document.getElementById('modalComentariosLabel').innerHTML = '<i class="bi bi-x-circle text-danger"></i> Devolver Documentação';
        novoBtn.className = 'btn btn-danger';
        novoBtn.innerHTML = '<i class="bi bi-x-lg"></i> Confirmar Devolução';
        txtArea.placeholder = "Motivo da devolução (obrigatório)...";
        novoBtn.addEventListener('click', () => processarRecusa(id, txtArea.value, modal));
    } else {
        document.getElementById('modalComentariosLabel').innerHTML = '<i class="bi bi-chat-left-text"></i> Histórico & Comentários';
        novoBtn.className = 'btn btn-primary';
        novoBtn.innerHTML = '<i class="bi bi-send"></i> Enviar Comentário';
        txtArea.placeholder = "Digite um comentário...";
        novoBtn.addEventListener('click', () => {
            if(window.enviarComentarioPeloModal) window.enviarComentarioPeloModal(id, txtArea.value);
            txtArea.value = ''; 
        });
    }

    modal.show();
    if(window.verComentarios) window.verComentarios(id);
}

async function processarRecusa(id, motivo, modalInstance) {
    if (!motivo.trim()) {
        alert("O motivo é obrigatório.");
        return;
    }
    
    modalInstance.hide();
    limparBackdropModal();
    toggleLoader(true, '#minhas-docs-pane');
    
    try {
        const userId = localStorage.getItem('usuarioId');
        await fetchComAuth(`${API_BASE_URL}/lancamentos/${id}/documentacao/devolver`, {
            method: 'POST',
            body: JSON.stringify({ usuarioId: userId, motivo: motivo })
        });
        
        mostrarToast("Documentação devolvida.", "warning");
        await carregarDashboardEBadges();
        aplicarFiltroDocumentacao(filtroDocAtual);
    } catch (e) {
        mostrarToast("Erro: " + e.message, 'error');
    } finally {
        toggleLoader(false, '#minhas-docs-pane');
    }
}

// 4. APROVAR (Listener Global do Botão)
document.addEventListener('click', async function(e) {
    const btn = e.target.closest('.btn-finalizar-doc');
    if(btn) {
        e.stopPropagation();
        const id = btn.dataset.id; // ID da OS!
        
        const modalFinalizar = new bootstrap.Modal(document.getElementById('modalFinalizarDoc'));
        const inputId = document.getElementById('finalizarDocId');
        if(inputId) {
            inputId.value = id; 
        }
        document.getElementById('assuntoEmailDoc').value = '';
        modalFinalizar.show();
    }
});

// Botão Confirmar no Modal de Aprovação
const btnConfirmarFinalizar = document.getElementById('btnConfirmarFinalizarDoc');
if(btnConfirmarFinalizar) {
    const novoBtn = btnConfirmarFinalizar.cloneNode(true);
    btnConfirmarFinalizar.parentNode.replaceChild(novoBtn, btnConfirmarFinalizar);

    novoBtn.addEventListener('click', async function() {
        const idOs = document.getElementById('finalizarDocId').value;
        const assunto = document.getElementById('assuntoEmailDoc').value;

        if (!assunto.trim()) {
            mostrarToast("O assunto do e-mail é obrigatório.", "warning");
            return;
        }

        const modalEl = document.getElementById('modalFinalizarDoc');
        const modal = bootstrap.Modal.getInstance(modalEl);
        if(modal) modal.hide();
        
        limparBackdropModal();
        toggleLoader(true, '#minhas-docs-pane');
        
        try {
            const response = await fetchComAuth(`${API_BASE_URL}/lancamentos/${idOs}/documentacao/finalizar`, {
                method: 'POST',
                body: JSON.stringify({ assuntoEmail: assunto })
            });

            if (!response.ok) {
                let erroMsg = `Erro ${response.status}`;
                try {
                    const errJson = await response.json();
                    erroMsg = errJson.message || errJson.error || erroMsg;
                } catch(e) {}
                throw new Error(erroMsg);
            }

            mostrarToast("Documentação finalizada com sucesso!", "success");
            
            await carregarDashboardEBadges();
            aplicarFiltroDocumentacao(filtroDocAtual);

        } catch (e) {
            console.error(e);
            mostrarToast(e.message, 'error');
        } finally {
            toggleLoader(false, '#minhas-docs-pane');
        }
    });
}

function limparBackdropModal() {
    const backdrops = document.querySelectorAll('.modal-backdrop');
    backdrops.forEach(b => b.remove());
    document.body.classList.remove('modal-open');
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';
}