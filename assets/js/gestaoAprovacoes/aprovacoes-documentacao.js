// ==========================================================
// LÓGICA DA ABA: DOCUMENTAÇÃO (Nova API de Microsserviço)
// ==========================================================

let filtroDocAtual = 'TODOS';
let solicitacoesDocCache = []; // Substitui o window.minhasDocsPendentes

async function carregarDadosDocumentacao() {
    try {
        const response = await fetchComAuth('/api/docs/solicitacoes');
        const data = await response.json();
        solicitacoesDocCache = Array.isArray(data) ? data : (data.content || []);
        aplicarFiltroDocumentacao(filtroDocAtual);
    } catch (error) {
        console.error("Erro ao carregar solicitações de documentação:", error);
    }
}

function initDocumentacaoTab() {
    console.log("Iniciando aba de documentação (Nova API)...");
    
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
            await carregarDadosDocumentacao(); 
            toggleLoader(false, '#minhas-docs-pane');
            mostrarToast("Lista atualizada.");
        };
    }

    // Filtro inicial e carga de dados
    const filtroMarcado = document.querySelector('input[name="filtroDocStatus"]:checked');
    if (filtroMarcado) filtroDocAtual = filtroMarcado.value;
    
    carregarDadosDocumentacao();
}

function aplicarFiltroDocumentacao(tipoFiltro) {
    let dadosFiltrados = [];
    
    // Controle da Coluna Assunto (Só aparece no Histórico)
    const thAssunto = document.getElementById('th-assunto-email');
    if(thAssunto) {
        if(tipoFiltro === 'HISTORICO') thAssunto.classList.remove('d-none');
        else thAssunto.classList.add('d-none');
    }

    // Filtra baseado nos status do novo Enum Java (StatusSolicitacaoDocumento)
    switch (tipoFiltro) {
        case 'HISTORICO':
            dadosFiltrados = solicitacoesDocCache.filter(item => 
                item.status === 'FINALIZADO' || 
                item.status === 'REPROVADO' || 
                item.status === 'APROVADO'
            );
            break;
        case 'PENDENTE_RECEBIMENTO':
            dadosFiltrados = solicitacoesDocCache.filter(item => item.status === 'AGUARDANDO_RECEBIMENTO');
            break;
        case 'EM_ANALISE':
            dadosFiltrados = solicitacoesDocCache.filter(item => item.status === 'EM_ANALISE');
            break;
        case 'TODOS':
        default:
            // Exibe tudo que NÃO é histórico
            dadosFiltrados = solicitacoesDocCache.filter(item => 
                item.status !== 'FINALIZADO' && 
                item.status !== 'REPROVADO' && 
                item.status !== 'APROVADO'
            );
            break;
    }

    renderizarTabelaDocsAgrupada(dadosFiltrados, tipoFiltro);
}

function renderizarTabelaDocsAgrupada(listaDeSolicitacoes, contextoFiltro) {
    const tbody = document.getElementById('tbody-minhas-docs');
    const msgVazio = document.getElementById('msg-sem-docs');

    // Identifica o papel do usuário para controlar as ações
    const userRole = (localStorage.getItem("role") || "").trim().toUpperCase();
    const podeExecutarAcao = userRole === 'DOCUMENTIST' || userRole === 'ADMIN';

    // Atualiza KPIs (Agora baseados em contagem de documentos, já que o valor não vem na lista da nova API)
    const totalPendente = solicitacoesDocCache.filter(i => i.status !== 'FINALIZADO' && i.status !== 'REPROVADO').length;
    const totalHistorico = solicitacoesDocCache.filter(i => i.status === 'FINALIZADO' || i.status === 'REPROVADO').length;
    
    const elSaldo = document.getElementById('doc-carteira-previsto');
    const elFinalizado = document.getElementById('doc-carteira-finalizado');
    const elTotal = document.getElementById('doc-carteira-total');

    if(elSaldo) elSaldo.innerText = `${totalPendente} docs`;
    if(elFinalizado) elFinalizado.innerText = `${totalHistorico} docs`;
    if(elTotal) elTotal.innerText = `${totalPendente + totalHistorico} docs`;

    if (!tbody) return;
    tbody.innerHTML = '';

    if (!listaDeSolicitacoes || listaDeSolicitacoes.length === 0) {
        if (msgVazio) {
            msgVazio.classList.remove('d-none');
            const span = msgVazio.querySelector('span');
            if(span) span.textContent = contextoFiltro === 'HISTORICO' ? "Nenhum histórico encontrado." : "Nenhuma pendência encontrada.";
        }
        return;
    } else {
        if (msgVazio) msgVazio.classList.add('d-none');
    }

    listaDeSolicitacoes.forEach(item => {
        const status = item.status || 'RASCUNHO';
        const numOs = item.osId || 'N/D';
        const tipoDoc = item.documento ? item.documento.nome : '-';
        const dataCriacao = item.criadoEm;
        const respId = item.documentistaId ? `ID: ${item.documentistaId}` : '-';
        
        // Badges Visuais Mapeados pro Novo Enum
        let htmlStatus = `<span class="badge bg-secondary">${status}</span>`;
        if (status === 'AGUARDANDO_RECEBIMENTO') htmlStatus = `<span class="badge bg-warning text-dark">Aguardando Envio</span>`;
        else if (status === 'EM_ANALISE') htmlStatus = `<span class="badge bg-primary">Em Análise</span>`;
        else if (status === 'FINALIZADO' || status === 'APROVADO') htmlStatus = `<span class="badge bg-success">Finalizado</span>`;
        else if (status === 'REPROVADO') htmlStatus = `<span class="badge bg-danger">Reprovado</span>`;

        let htmlPrazo = dataCriacao ? `<small class="text-muted">${formatarData(dataCriacao)}</small>` : '-';

        // =====================================================================
        // LÓGICA DE BOTÕES (NOVA API)
        // =====================================================================
        let botoes = '';
        
        if (contextoFiltro === 'HISTORICO' || status === 'FINALIZADO' || status === 'REPROVADO' || !podeExecutarAcao) {
             botoes = `
                <button class="btn btn-sm btn-outline-secondary" onclick="abrirModalComentarios('${item.id}', false)" title="Ver Detalhes">
                    <i class="bi bi-eye"></i>
                </button>
             `;
        } else {
            if (status === 'EM_ANALISE') {
                botoes = `
                    <div class="btn-group" role="group">
                        <button class="btn btn-sm btn-success btn-finalizar-doc" 
                                data-id="${item.id}" 
                                title="Finalizar/Aprovar">
                            <i class="bi bi-check-lg"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" 
                                onclick="iniciarRecusa('${item.id}')" title="Reprovar">
                            <i class="bi bi-x-lg"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-secondary" 
                                onclick="abrirModalComentarios('${item.id}', false)" title="Comentários">
                            <i class="bi bi-chat-left-text"></i>
                        </button>
                    </div>
                `;
            } else if (status === 'AGUARDANDO_RECEBIMENTO') {
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
                <td class="align-middle text-truncate" style="max-width:150px;">
                    OS: ${numOs}
                </td>
                <td class="align-middle">
                    <span class="fw-medium">${tipoDoc}</span>
                </td>
                <td class="align-middle text-center">${htmlPrazo}</td>
                <td class="align-middle text-center small">
                    ${respId}
                </td>
                <td class="align-middle small ${displayAssunto}">
                    ${item.provaEnvio || '-'}
                </td>
            </tr>
        `;
        tbody.innerHTML += tr;
    });
}

// 1. RECEBER (Novo Endpoint)
async function receberDocumentacao(id) {
    if (!confirm('Confirmar o recebimento?')) return;
    
    const btn = document.activeElement;
    if(btn) btn.disabled = true;
    toggleLoader(true, '#minhas-docs-pane');

    try {
        const userId = parseInt(localStorage.getItem('usuarioId'));
        await fetchComAuth(`/api/docs/solicitacoes/${id}/receber`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ actorUsuarioId: userId, comentario: 'Recebido para análise' })
        });
        
        mostrarToast("Documentos recebidos com sucesso!", "success");
        await carregarDadosDocumentacao();

    } catch (e) {
        mostrarToast(e.message, 'error');
    } finally {
        toggleLoader(false, '#minhas-docs-pane');
    }
}

// 2. RECUSAR / REPROVAR (Novo Endpoint)
function iniciarRecusa(id) {
    abrirModalComentarios(id, true);
}

// 3. MODAL DE COMENTÁRIOS / REPROVAÇÃO
function abrirModalComentarios(id, isRecusa = false) {
    const modalEl = document.getElementById('modalComentarios');
    const modal = new bootstrap.Modal(modalEl);
    
    const lista = document.getElementById('listaComentariosContainer');
    if(lista) lista.innerHTML = '<div class="text-center p-3"><span class="text-muted">Visualização de histórico na nova API em construção.</span></div>';
    
    const btnEnviar = document.getElementById('btnEnviarComentarioModal'); 
    const txtArea = document.getElementById('novoComentarioTexto');
    if(txtArea) txtArea.value = '';

    const novoBtn = btnEnviar.cloneNode(true);
    btnEnviar.parentNode.replaceChild(novoBtn, btnEnviar);

    if (isRecusa) {
        document.getElementById('modalComentariosLabel').innerHTML = '<i class="bi bi-x-circle text-danger"></i> Reprovar Documentação';
        novoBtn.className = 'btn btn-danger';
        novoBtn.innerHTML = '<i class="bi bi-x-lg"></i> Confirmar Reprovação';
        txtArea.placeholder = "Motivo da reprovação (obrigatório)...";
        novoBtn.addEventListener('click', () => processarRecusa(id, txtArea.value, modal));
    } else {
        document.getElementById('modalComentariosLabel').innerHTML = '<i class="bi bi-chat-left-text"></i> Enviar Comentário';
        novoBtn.className = 'btn btn-primary';
        novoBtn.innerHTML = '<i class="bi bi-send"></i> Enviar Comentário';
        txtArea.placeholder = "Digite um comentário...";
        novoBtn.addEventListener('click', async () => {
             // Chamada de comentário para a nova API
             try {
                await fetchComAuth(`/api/docs/solicitacoes/${id}/comentar`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ actorUsuarioId: parseInt(localStorage.getItem('usuarioId')), comentario: txtArea.value })
                });
                mostrarToast("Comentário adicionado!", "success");
                modal.hide();
             } catch(e) {
                mostrarToast("Erro ao comentar", "error");
             }
        });
    }

    modal.show();
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
        const userId = parseInt(localStorage.getItem('usuarioId'));
        await fetchComAuth(`/api/docs/solicitacoes/${id}/reprovar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ actorUsuarioId: userId, comentario: motivo })
        });
        
        mostrarToast("Documentação reprovada.", "warning");
        await carregarDadosDocumentacao();
    } catch (e) {
        mostrarToast("Erro: " + e.message, 'error');
    } finally {
        toggleLoader(false, '#minhas-docs-pane');
    }
}

// 4. FINALIZAR (Novo Endpoint)
document.addEventListener('click', async function(e) {
    const btn = e.target.closest('.btn-finalizar-doc');
    if(btn) {
        e.stopPropagation();
        const id = btn.dataset.id; // ID da Solicitação
        
        const modalFinalizar = new bootstrap.Modal(document.getElementById('modalFinalizarDoc'));
        const inputId = document.getElementById('finalizarDocId');
        if(inputId) {
            inputId.value = id; 
        }
        document.getElementById('assuntoEmailDoc').value = '';
        modalFinalizar.show();
    }
});

const btnConfirmarFinalizar = document.getElementById('btnConfirmarFinalizarDoc');
if(btnConfirmarFinalizar) {
    const novoBtn = btnConfirmarFinalizar.cloneNode(true);
    btnConfirmarFinalizar.parentNode.replaceChild(novoBtn, btnConfirmarFinalizar);

    novoBtn.addEventListener('click', async function() {
        const id = document.getElementById('finalizarDocId').value;
        const assunto = document.getElementById('assuntoEmailDoc').value; // Usado como provaEnvio

        if (!assunto.trim()) {
            mostrarToast("O assunto/prova de envio é obrigatório.", "warning");
            return;
        }

        const modalEl = document.getElementById('modalFinalizarDoc');
        const modal = bootstrap.Modal.getInstance(modalEl);
        if(modal) modal.hide();
        
        limparBackdropModal();
        toggleLoader(true, '#minhas-docs-pane');
        
        try {
            const userId = parseInt(localStorage.getItem('usuarioId'));
            
            // Payload específico do FinalizarSolicitacaoRequest da nova API
            const payload = {
                actorUsuarioId: userId,
                comentario: "Processo finalizado",
                provaEnvio: assunto 
            };

            const response = await fetchComAuth(`/api/docs/solicitacoes/${id}/finalizar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
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
            await carregarDadosDocumentacao();

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