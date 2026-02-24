// ==========================================================
// LÓGICA DA ABA: DOCUMENTAÇÃO (Nova API de Microsserviço)
// ==========================================================

let filtroDocAtual = 'TODOS';
let solicitacoesDocCache = [];

async function carregarDadosDocumentacao() {
    try {
        const userRole = (localStorage.getItem("role") || "").trim().toUpperCase();
        const userId = localStorage.getItem("usuarioId");

        let url = `/api/docs/solicitacoes?size=1000&usuarioId=${userId}`;
        if (userRole === 'DOCUMENTIST') {
            url += `&documentistaId=${userId}`;
        }

        const response = await fetchComAuth(url);
        const data = await response.json();

        let todasSolicitacoes = Array.isArray(data) ? data : (data.content || []);

        // FILTRO CLIENT-SIDE RIGOROSO DE SEGMENTO PARA MANAGER E COORDINATOR
        if (['MANAGER', 'COORDINATOR'].includes(userRole)) {
            const segmentosStr = localStorage.getItem('segmentos');
            if (segmentosStr) {
                try {
                    const meusSegmentos = JSON.parse(segmentosStr).map(s => s.nome.toUpperCase());
                    todasSolicitacoes = todasSolicitacoes.filter(sol => {
                        // Se existir segmento, bloqueia os que não pertencem ao Gestor
                        if (sol.segmentoNome && sol.segmentoNome !== '-') {
                            return meusSegmentos.includes(sol.segmentoNome.toUpperCase());
                        }
                        // Deixa passar documentos antigos (legados) que não tinham segmento
                        return true;
                    });
                } catch (e) { console.error("Erro ao filtrar segmentos no frontend", e); }
            }
        }

        solicitacoesDocCache = todasSolicitacoes;
        atualizarBadgeDocumentacao();
        aplicarFiltroDocumentacao(filtroDocAtual);
    } catch (error) {
        console.error("Erro ao carregar solicitações de documentação:", error);
    }
}

function atualizarBadgeDocumentacao() {
    // Pendência = tudo que NÃO é status de histórico/final
    const pendentes = (solicitacoesDocCache || []).filter(item => {
        const st = (item.status || '').toUpperCase();
        return ![
            'FINALIZADO',
            'FINALIZADO_FORA_PRAZO',
            'DEVOLVIDO',
            'REPROVADO'
        ].includes(st);
    });

    // Usa a mesma regra do menu (id do seu HTML)
    const badge = document.getElementById('badge-documentacao');
    if (!badge) return;

    const n = pendentes.length;
    if (n <= 0) {
        badge.textContent = '0';
        badge.classList.add('d-none');
        return;
    }

    badge.textContent = n > 99 ? '99+' : String(n);
    badge.classList.remove('d-none');

    // (Opcional) se você quiser também salvar para outras telas:
    window.minhasDocsPendentes = pendentes;
}

function initDocumentacaoTab() {
    console.log("Iniciando aba de documentação (Nova API)...");

    // REMOVER QUADRO DE EVOLUÇÃO (Esconde qualquer card/div que mencione evolucao)
    const quadroEvolucao = document.querySelector('[id*="evolucao"], [class*="evolucao"]');
    if (quadroEvolucao) quadroEvolucao.style.display = 'none';

    const radiosFiltro = document.querySelectorAll('input[name="filtroDocStatus"]');
    radiosFiltro.forEach(radio => {
        radio.addEventListener('change', (e) => {
            filtroDocAtual = e.target.value;
            aplicarFiltroDocumentacao(filtroDocAtual);
        });
    });

    const btnAtualizar = document.getElementById('btn-atualizar-docs');
    if (btnAtualizar) {
        btnAtualizar.onclick = async function () {
            if (typeof setButtonLoading === 'function') setButtonLoading(this, true);
            toggleLoader(true, '#minhas-docs-pane');
            await carregarDadosDocumentacao();
            toggleLoader(false, '#minhas-docs-pane');
            if (typeof setButtonLoading === 'function') setButtonLoading(this, false);
            mostrarToast("Lista atualizada.", "success");
        };
    }

    const filtroMarcado = document.querySelector('input[name="filtroDocStatus"]:checked');
    if (filtroMarcado) filtroDocAtual = filtroMarcado.value;

    carregarDadosDocumentacao();
}

function aplicarFiltroDocumentacao(tipoFiltro) {
    let dadosFiltrados = [];

    const thAssunto = document.getElementById('th-assunto-email');
    if (thAssunto) {
        if (tipoFiltro === 'HISTORICO') thAssunto.classList.remove('d-none');
        else thAssunto.classList.add('d-none');
    }

    switch (tipoFiltro) {
        case 'HISTORICO':
            dadosFiltrados = solicitacoesDocCache.filter(item =>
                item.status === 'FINALIZADO' || item.status === 'FINALIZADO_FORA_PRAZO' || item.status === 'DEVOLVIDO' || item.status === 'REPROVADO'
            );
            break;
        case 'PENDENTE_RECEBIMENTO':
            dadosFiltrados = solicitacoesDocCache.filter(item => item.status === 'AGUARDANDO_RECEBIMENTO');
            break;
        case 'EM_ANALISE':
            dadosFiltrados = solicitacoesDocCache.filter(item => item.status === 'RECEBIDO');
            break;
        case 'TODOS':
        default:
            dadosFiltrados = solicitacoesDocCache.filter(item =>
                item.status !== 'FINALIZADO' && item.status !== 'FINALIZADO_FORA_PRAZO' && item.status !== 'DEVOLVIDO' && item.status !== 'REPROVADO'
            );
            break;
    }

    renderizarTabelaDocsAgrupada(dadosFiltrados, tipoFiltro);
}

function renderizarTabelaDocsAgrupada(listaDeSolicitacoes, contextoFiltro) {
    const tbody = document.getElementById('tbody-minhas-docs');
    const msgVazio = document.getElementById('msg-sem-docs');

    const userRole = (localStorage.getItem("role") || "").trim().toUpperCase();
    const userId = String(localStorage.getItem('usuarioId') || "0");

    // KPIs Dashboard - Somando Valores Monetários
    const docsPendentes = solicitacoesDocCache.filter(i => i.status !== 'FINALIZADO' && i.status !== 'FINALIZADO_FORA_PRAZO' && i.status !== 'DEVOLVIDO' && i.status !== 'REPROVADO');
    const docsHistorico = solicitacoesDocCache.filter(i => i.status === 'FINALIZADO' || i.status === 'FINALIZADO_FORA_PRAZO' || i.status === 'DEVOLVIDO' || i.status === 'REPROVADO');

    const valorPendente = docsPendentes.reduce((acc, curr) => acc + (curr.valor || 0), 0);
    const valorHistorico = docsHistorico.reduce((acc, curr) => acc + (curr.valor || 0), 0);
    const valorTotal = valorPendente + valorHistorico;

    const formataMoeda = (val) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const elSaldo = document.getElementById('doc-carteira-previsto');
    const elFinalizado = document.getElementById('doc-carteira-finalizado');
    const elTotal = document.getElementById('doc-carteira-total');

    if (elSaldo) elSaldo.innerText = formataMoeda(valorPendente);
    if (elFinalizado) elFinalizado.innerText = formataMoeda(valorHistorico);
    if (elTotal) elTotal.innerText = formataMoeda(valorTotal);

    if (!tbody) return;
    tbody.innerHTML = '';

    if (!listaDeSolicitacoes || listaDeSolicitacoes.length === 0) {
        if (msgVazio) {
            msgVazio.classList.remove('d-none');
            const span = msgVazio.querySelector('span');
            if (span) span.textContent = contextoFiltro === 'HISTORICO' ? "Nenhum histórico encontrado." : "Nenhuma pendência encontrada.";
        }
        return;
    } else {
        if (msgVazio) msgVazio.classList.add('d-none');
    }

    listaDeSolicitacoes.forEach(item => {
        const status = item.status || 'RASCUNHO';
        const tipoDoc = item.documento ? item.documento.nome : '-';

        const nomeSolicitante = item.solicitanteNome || 'Sistema (Legado)';
        const osNomeStr = item.osNome || `OS Num. ${item.osId}`;

        const responsavelNome = item.documentistaNome || (item.documentistaId ? `ID: ${item.documentistaId}` : 'Sem Responsável');
        const valorFormatado = (item.valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        // Cálculo do Prazo
        let htmlPrazo = '-';
        if (contextoFiltro === 'HISTORICO') {
            const dataCriado = item.criadoEm ? new Date(item.criadoEm).toLocaleDateString('pt-BR') : '-';
            const dataFinalizado = item.finalizadoEm ? new Date(item.finalizadoEm).toLocaleDateString('pt-BR') : '-';
            htmlPrazo = `
                <div class="small">
                    <span class="text-muted d-block">Solicitado: <b>${dataCriado}</b></span>
                    <span class="text-success d-block">Finalizado: <b>${dataFinalizado}</b></span>
                </div>`;
        } else {
            if (item.recebidoEm) {
                const dataRecebimento = new Date(item.recebidoEm);
                dataRecebimento.setHours(dataRecebimento.getHours() + 48);
                const dataStr = dataRecebimento.toLocaleDateString('pt-BR');
                const horaStr = dataRecebimento.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

                const isVencido = dataRecebimento < new Date();
                const corPrazo = isVencido ? 'text-danger fw-bold' : 'text-muted';
                htmlPrazo = `<span class="${corPrazo}">${dataStr} às ${horaStr}</span>`;
            } else {
                htmlPrazo = '<span class="text-warning small"><i class="bi bi-clock"></i> Aguardando<br>Recebimento</span>';
            }
        }

        // Badges de Status
        let htmlStatus = `<span class="badge bg-secondary">${status}</span>`;
        if (status === 'AGUARDANDO_RECEBIMENTO') htmlStatus = `<span class="badge bg-warning text-dark">Aguardando Envio</span>`;
        else if (status === 'RECEBIDO') htmlStatus = `<span class="badge bg-primary">Em Análise</span>`;
        else if (status === 'FINALIZADO' || status === 'FINALIZADO_FORA_PRAZO') htmlStatus = `<span class="badge bg-success">Finalizado</span>`;
        else if (status === 'DEVOLVIDO' || status === 'REPROVADO') htmlStatus = `<span class="badge bg-danger">Recusado</span>`;

        // =====================================================================
        // CONTROLE CRÍTICO DE PERMISSÕES E BOTÕES
        // =====================================================================
        const isAdmin = userRole === 'ADMIN';
        const isManager = userRole === 'MANAGER';
        const isDocResponsavel = (userRole === 'DOCUMENTIST' && String(item.documentistaId) === userId);

        // BOTÃO UNIVERSAL (Todos veem)
        const btnComentarios = `<button class="btn btn-sm btn-outline-secondary" onclick="abrirModalComentarios('${item.id}', false)" title="Ver Histórico/Comentários"><i class="bi bi-clock-history"></i></button>`;

        let acoesHtml = '';
        const isHistoricoOuFinalizado = contextoFiltro === 'HISTORICO' || status.includes('FINALIZADO') || status === 'DEVOLVIDO' || status === 'REPROVADO';

        if (!isHistoricoOuFinalizado) {
            if (status === 'AGUARDANDO_RECEBIMENTO') {
                // REGRA: MARCAR RECEBIDO APENAS PARA ADMIN E MANAGER
                if (isAdmin || isManager) {
                    acoesHtml += `<button class="btn btn-sm btn-outline-primary me-1" onclick="receberDocumentacao(this, '${item.id}')" title="Confirmar Recebimento"><i class="bi bi-box-arrow-in-down"></i></button>`;
                }
            } else if (status === 'RECEBIDO') {
                // REGRA: APROVAR E RECUSAR APENAS PARA ADMIN E DOCUMENTISTA (Dono)
                if (isAdmin || isDocResponsavel) {
                    acoesHtml += `
                        <button class="btn btn-sm btn-success btn-finalizar-doc me-1" data-id="${item.id}" title="Aprovar e Finalizar"><i class="bi bi-check-lg"></i></button>
                        <button class="btn btn-sm btn-outline-danger me-1" onclick="iniciarRecusa('${item.id}')" title="Recusar Documento"><i class="bi bi-x-lg"></i></button>
                    `;
                }
            }
        }

        // Monta o grupo final de botões juntando as ações permitidas com o botão de comentários
        let botoesFinal = '';
        if (acoesHtml !== '') {
            botoesFinal = `<div class="d-flex justify-content-center align-items-center">${acoesHtml}${btnComentarios}</div>`;
        } else {
            botoesFinal = btnComentarios; // Se não tiver ações, exibe só os comentários
        }

        // Exibição da Prova de Envio (Tabela)
        const displayAssunto = contextoFiltro === 'HISTORICO' ? '' : 'd-none';
        const provaEnvioTexto = item.provaEnvio ? `<span class="text-truncate d-inline-block text-primary fw-bold" style="max-width: 150px;" title="${item.provaEnvio}"><i class="bi bi-link-45deg"></i> ${item.provaEnvio}</span>` : '-';

        const tr = `
            <tr>
                <td class="align-middle text-center">${botoesFinal}</td>
                <td class="align-middle text-center">${htmlStatus}</td>
                <td class="align-middle">
                    <span class="fw-medium d-block text-dark">${nomeSolicitante}</span>
                    <span class="small text-muted"><i class="bi bi-tag-fill me-1"></i>${osNomeStr}</span>
                </td>
                <td class="align-middle fw-medium text-wrap" style="max-width:200px;">${tipoDoc}</td>
                <td class="align-middle text-center">${htmlPrazo}</td>
                <td class="align-middle text-success fw-bold">${valorFormatado}</td>
                <td class="align-middle text-center small">${responsavelNome}</td>
                <td class="align-middle text-center small ${displayAssunto}">${provaEnvioTexto}</td>
            </tr>
        `;
        tbody.innerHTML += tr;
    });
}

// =====================================================================
// FLUXO DE AÇÕES E INTEGRAÇÕES
// =====================================================================

async function receberDocumentacao(btnElement, id) {
    if (!confirm('Confirmar o recebimento do documento? O prazo de 48h começará a contar agora.')) return;

    if (typeof setButtonLoading === 'function') setButtonLoading(btnElement, true);
    toggleLoader(true, '#minhas-docs-pane');

    try {
        const userId = parseInt(localStorage.getItem('usuarioId'));
        await fetchComAuth(`/api/docs/solicitacoes/${id}/receber`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ actorUsuarioId: userId, comentario: 'Documento marcado como recebido pelo Gestor/Admin.' })
        });

        mostrarToast("Documentos recebidos com sucesso!", "success");
        await carregarDadosDocumentacao();
    } catch (e) {
        mostrarToast("Erro ao confirmar recebimento: " + e.message, 'error');
    } finally {
        toggleLoader(false, '#minhas-docs-pane');
        if (typeof setButtonLoading === 'function') setButtonLoading(btnElement, false);
    }
}

// =====================================================================
// MODAL DE HISTÓRICO / COMENTÁRIOS E RECUSA
// =====================================================================

function iniciarRecusa(id) {
    abrirModalComentarios(id, true);
}

async function carregarHistoricoNoModal(id) {
    const container = document.getElementById('listaComentariosContainer');
    container.innerHTML = '<div class="text-center p-4"><div class="spinner-border text-primary" role="status"></div><br><span class="mt-2 text-muted">Carregando histórico...</span></div>';

    try {
        const res = await fetchComAuth(`/api/docs/solicitacoes/${id}/historico`);
        if (!res.ok) throw new Error("Falha na API de histórico");
        const historico = await res.json();

        if (!historico || historico.length === 0) {
            container.innerHTML = '<div class="text-center p-4 text-muted"><i class="bi bi-inbox fs-1 d-block mb-2"></i>Nenhum registro encontrado.</div>';
            return;
        }

        let htmlTimeline = '<div class="timeline-container position-relative mt-2" style="border-left: 2px solid #dee2e6; margin-left: 15px; padding-left: 20px;">';

        historico.forEach(ev => {
            const dataForm = new Date(ev.criadoEm).toLocaleString('pt-BR');
            const eventoNome = ev.tipoEvento ? ev.tipoEvento.replace(/_/g, ' ') : 'ATUALIZAÇÃO';
            const atorNome = ev.actorNome || `ID: ${ev.actorUsuarioId}`;

            let iconClass = 'bg-primary';
            if (eventoNome.includes('RECUSA')) iconClass = 'bg-danger';
            else if (eventoNome.includes('FINALIZADO')) iconClass = 'bg-success';
            else if (eventoNome.includes('COMENTARIO')) iconClass = 'bg-secondary';

            htmlTimeline += `
                <div class="mb-4 position-relative">
                    <span class="position-absolute translate-middle rounded-circle border border-white border-2 ${iconClass}" 
                          style="width: 16px; height: 16px; left: -21px; top: 15px;"></span>
                    <div class="card border-0 shadow-sm bg-light">
                        <div class="card-body p-3">
                            <div class="d-flex justify-content-between align-items-center mb-2">
                                <h6 class="mb-0 text-dark fw-bold">${atorNome}</h6>
                                <span class="badge ${iconClass} bg-opacity-10 text-dark" style="font-size: 0.70rem;">${eventoNome}</span>
                            </div>
                            <p class="mb-2 text-secondary small" style="white-space: pre-wrap;">${ev.comentario || 'Ação registrada no sistema.'}</p>
                            <small class="text-muted" style="font-size: 0.75rem;"><i class="bi bi-calendar3 me-1"></i>${dataForm}</small>
                        </div>
                    </div>
                </div>
            `;
        });
        htmlTimeline += '</div>';
        container.innerHTML = htmlTimeline;

    } catch (e) {
        container.innerHTML = '<div class="text-center p-3 text-danger"><i class="bi bi-exclamation-triangle"></i> Não foi possível carregar o histórico.</div>';
    }
}

function abrirModalComentarios(id, isRecusa = false) {
    const modalEl = document.getElementById('modalComentarios');
    const modal = new bootstrap.Modal(modalEl);

    carregarHistoricoNoModal(id);

    const btnEnviar = document.getElementById('btnEnviarComentarioModal');
    const txtArea = document.getElementById('novoComentarioTexto');
    if (txtArea) txtArea.value = '';

    const novoBtn = btnEnviar.cloneNode(true);
    btnEnviar.parentNode.replaceChild(novoBtn, btnEnviar);

    if (isRecusa) {
        document.getElementById('modalComentariosLabel').innerHTML = '<i class="bi bi-x-circle text-danger"></i> Recusar Documento';
        novoBtn.className = 'btn btn-danger';
        novoBtn.innerHTML = '<i class="bi bi-x-lg"></i> Confirmar Recusa';
        txtArea.placeholder = "Motivo da recusa (obrigatório para recusar)...";

        novoBtn.addEventListener('click', () => processarRecusa(id, txtArea.value, novoBtn, modal));
    } else {
        document.getElementById('modalComentariosLabel').innerHTML = '<i class="bi bi-chat-dots text-primary"></i> Histórico e Comentários';
        novoBtn.className = 'btn btn-primary';
        novoBtn.innerHTML = '<i class="bi bi-send"></i> Enviar Comentário';
        txtArea.placeholder = "Adicionar um comentário...";

        novoBtn.addEventListener('click', async () => {
            if (!txtArea.value.trim()) {
                mostrarToast("O comentário não pode ser vazio.", "warning");
                return;
            }
            if (typeof setButtonLoading === 'function') setButtonLoading(novoBtn, true);

            try {
                const userId = parseInt(localStorage.getItem('usuarioId'));
                await fetchComAuth(`/api/docs/solicitacoes/${id}/comentar`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ actorUsuarioId: userId, comentario: txtArea.value })
                });
                mostrarToast("Comentário adicionado!", "success");
                txtArea.value = '';
                carregarHistoricoNoModal(id);
            } catch (e) {
                mostrarToast("Erro ao comentar.", "error");
            } finally {
                if (typeof setButtonLoading === 'function') setButtonLoading(novoBtn, false);
            }
        });
    }

    modal.show();
}

async function processarRecusa(id, motivo, btnElement, modalInstance) {
    if (!motivo.trim()) {
        mostrarToast("O motivo da recusa é obrigatório.", "warning");
        return;
    }

    if (typeof setButtonLoading === 'function') setButtonLoading(btnElement, true);
    toggleLoader(true, '#minhas-docs-pane');

    try {
        const userId = parseInt(localStorage.getItem('usuarioId'));
        await fetchComAuth(`/api/docs/solicitacoes/${id}/recusar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ actorUsuarioId: userId, comentario: motivo })
        });

        mostrarToast("Documentação recusada com sucesso.", "success");
        modalInstance.hide();
        limparBackdropModal();
        await carregarDadosDocumentacao();
    } catch (e) {
        mostrarToast("Erro na recusa: " + e.message, 'error');
        if (typeof setButtonLoading === 'function') setButtonLoading(btnElement, false);
    } finally {
        toggleLoader(false, '#minhas-docs-pane');
    }
}

// =====================================================================
// FINALIZAR (Aprovar e inserir prova de envio)
// =====================================================================

document.addEventListener('click', async function (e) {
    const btn = e.target.closest('.btn-finalizar-doc');
    if (btn) {
        e.stopPropagation();
        const id = btn.dataset.id;

        const modalFinalizar = new bootstrap.Modal(document.getElementById('modalFinalizarDoc'));
        const inputId = document.getElementById('finalizarDocId');
        if (inputId) inputId.value = id;

        document.getElementById('assuntoEmailDoc').value = '';
        modalFinalizar.show();
    }
});

const btnConfirmarFinalizar = document.getElementById('btnConfirmarFinalizarDoc');
if (btnConfirmarFinalizar) {
    const novoBtn = btnConfirmarFinalizar.cloneNode(true);
    btnConfirmarFinalizar.parentNode.replaceChild(novoBtn, btnConfirmarFinalizar);

    novoBtn.addEventListener('click', async function () {
        const id = document.getElementById('finalizarDocId').value;
        const assunto = document.getElementById('assuntoEmailDoc').value;

        if (!assunto.trim()) {
            mostrarToast("O envio da prova/link é obrigatório para aprovar.", "warning");
            return;
        }

        if (typeof setButtonLoading === 'function') setButtonLoading(novoBtn, true);
        toggleLoader(true, '#minhas-docs-pane');

        try {
            const userId = parseInt(localStorage.getItem('usuarioId'));
            const payload = {
                actorUsuarioId: userId,
                comentario: "Documento Aprovado e Finalizado.",
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
                } catch (e) { }
                throw new Error(erroMsg);
            }

            mostrarToast("Aprovado e Finalizado com sucesso!", "success");

            const modalEl = document.getElementById('modalFinalizarDoc');
            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();
            limparBackdropModal();

            await carregarDadosDocumentacao();

        } catch (e) {
            console.error(e);
            mostrarToast(e.message, 'error');
        } finally {
            if (typeof setButtonLoading === 'function') setButtonLoading(novoBtn, false);
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