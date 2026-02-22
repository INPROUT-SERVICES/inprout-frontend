/**
 * documentacao.js
 * Módulo responsável por toda a lógica de Documentação (Nova API) para a tela Index
 */
const DocumentacaoModule = (function () {
    let documentosCache = [];
    let todosUsuariosCache = [];
    let osCache = []; // Cache para armazenar os nomes reais das OSs
    let cachesCarregados = false;

    // Garante que os dados sejam baixados das APIs (Documentos e Monolito)
    async function carregarCaches() {
        if (cachesCarregados) return;
        await Promise.all([
            carregarDocumentos(), 
            carregarUsuarios(),
            carregarOsCache() // Vai no monolito buscar os nomes das OSs
        ]);
        cachesCarregados = true;
    }

    async function init() {
        injetarModalSeNecessario(); 
        await carregarCaches();
        configurarListenersGlobais();
        carregarAbaPendenteDoc();

        // GATILHO ANTI-BUG: Força a re-renderização correta toda vez que a aba for clicada
        // Isso impede que o index.js antigo sobrescreva as nossas colunas
        const tabDocTrigger = document.querySelector('button[data-bs-target="#pendente-doc-pane"], a[href="#pendente-doc-pane"]');
        if (tabDocTrigger) {
            tabDocTrigger.addEventListener('shown.bs.tab', carregarAbaPendenteDoc);
        }
    }

    async function carregarDocumentos() {
        try {
            const res = await fetchComAuth('/api/docs/documentos');
            if (res.ok) {
                const data = await res.json();
                documentosCache = Array.isArray(data) ? data : (data.content || []);
            }
        } catch (err) { console.error("Erro ao carregar documentos:", err); }
    }

    async function carregarUsuarios() {
        try {
            const res = await fetchComAuth('/api/usuarios/documentistas');
            if (res.ok) {
                const data = await res.json();
                todosUsuariosCache = Array.isArray(data) ? data : (data.content || []);
            }
        } catch (err) { console.error("Erro ao carregar usuários:", err); }
    }

    async function carregarOsCache() {
        try {
            const res = await fetchComAuth('/api/os');
            if (res.ok) {
                const data = await res.json();
                // CORREÇÃO DO ERRO .find is not a function (Trata Page ou Array)
                osCache = Array.isArray(data) ? data : (data.content || []);
            }
        } catch (err) { console.error("Erro ao carregar lista de OSs:", err); }
    }

    async function popularSelectDocumento(selectElement, valorSelecionado = null) {
        if (!selectElement) return;
        await carregarCaches(); 

        selectElement.innerHTML = '<option value="" selected>Não se aplica</option>';
        documentosCache.forEach(doc => selectElement.add(new Option(doc.nome, doc.id)));

        if (valorSelecionado) {
            selectElement.value = valorSelecionado;
            selectElement.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }

    function configurarListenersGlobais() {
        document.body.addEventListener('change', (e) => {
            if (e.target.id === 'documentoId' || e.target.classList.contains('documento-select-lote')) {
                const selectDocId = e.target.value;

                let selectDocumentista;
                if (e.target.id === 'documentoId') {
                    selectDocumentista = document.getElementById('documentistaId');
                } else {
                    const sufixo = e.target.id.replace('documentoId-lpu-', '');
                    selectDocumentista = document.getElementById(`documentistaId-lpu-${sufixo}`);
                }

                if (!selectDocumentista) return;

                selectDocumentista.innerHTML = '<option value="" selected disabled>Selecione...</option>';

                if (!selectDocId) {
                    selectDocumentista.disabled = true;
                    return;
                }

                selectDocumentista.disabled = false;
                const docSelecionado = documentosCache.find(d => d.id == selectDocId);

                if (docSelecionado && docSelecionado.documentistaIds) {
                    const permitidos = todosUsuariosCache.filter(u => docSelecionado.documentistaIds.includes(u.id));
                    permitidos.forEach(p => selectDocumentista.add(new Option(p.nome, p.id)));
                }
            }
        });
    }

    async function criarSolicitacao({ osId, documentoId, documentistaId, lancamentoIds, acao }) {
        let idsLimpos = [];
        if (Array.isArray(lancamentoIds)) {
            idsLimpos = lancamentoIds
                .map(id => (typeof id === 'object' && id !== null ? id.id : id))
                .map(id => parseInt(id))
                .filter(id => !isNaN(id)); 
        }

        const payload = {
            osId: parseInt(osId) || null,
            documentoId: parseInt(documentoId) || null,
            actorUsuarioId: parseInt(localStorage.getItem('usuarioId')) || null,
            comentario: acao === 'enviar' ? "Iniciando processo de solicitação" : "Salvo como rascunho",
            documentistaId: documentistaId ? parseInt(documentistaId) : null,
            lancamentoIds: idsLimpos
        };

        if (!payload.osId || !payload.documentoId || payload.lancamentoIds.length === 0) return;

        try {
            const response = await fetchComAuth('/api/docs/solicitacoes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error("Erro ao criar solicitação de documento.");
            carregarAbaPendenteDoc();
        } catch (error) {
            mostrarToast(error.message, "warning");
        }
    }

    // INTEGRAÇÃO REAL: Pega o ID devolvido e converte para o Nome da OS (Site)
    function obterNomeOS(osId) {
        if (!osId) return '-';
        
        // 1. Tenta buscar no Cache da API de OS primeiro
        if (Array.isArray(osCache)) {
            const osEncontrada = osCache.find(o => parseInt(o.id) === parseInt(osId));
            if (osEncontrada) {
                return `OS ${osEncontrada.id} - ${osEncontrada.site || 'S/ Site'}`;
            }
        }
        
        // 2. Fallback: Tenta buscar no select da tela (caso a OS não esteja na página 0 do cache)
        const osDropdown = document.getElementById('selectOS') || document.querySelector('select[id*="os"]');
        if (osDropdown && osDropdown.options.length > 0) {
            const opcaoEncontrada = Array.from(osDropdown.options).find(opt => parseInt(opt.value) === parseInt(osId));
            if (opcaoEncontrada) {
                return opcaoEncontrada.text; 
            }
        }

        return `OS Num. ${osId}`; 
    }

    async function carregarAbaPendenteDoc() {
        const tbody = document.getElementById('tbody-pendente-doc');
        if (!tbody) return;

        // =================================================================
        // DESTRÓI O CABEÇALHO ANTIGO E CRIA O NOVO (PADRÃO DO SISTEMA)
        // Retirei as classes forçadas para o CSS do sistema agir naturalmente
        // =================================================================
        const table = tbody.closest('table');
        if (table) {
            const thead = table.querySelector('thead');
            if (thead) {
                thead.innerHTML = `
                    <tr>
                        <th class="text-center align-middle" style="width: 120px;">AÇÃO</th>
                        <th class="text-center align-middle">STATUS</th>
                        <th class="align-middle">SOLICITANTE</th>
                        <th class="align-middle">TIPO DOCUMENTO</th>
                        <th class="text-center align-middle">RESPONSÁVEL</th>
                    </tr>
                `;
            }
        }

        try {
            const response = await fetchComAuth('/api/docs/solicitacoes');
            const data = await response.json();

            let solicitacoes = Array.isArray(data) ? data : (data.content || []);
            solicitacoes = solicitacoes.filter(sol => sol.status === 'AGUARDANDO_RECEBIMENTO');

            const role = (localStorage.getItem("role") || "").trim().toUpperCase();

            // MANAGER e COORDINATOR veem apenas as de suas OSs
            if (['MANAGER', 'COORDINATOR'].includes(role)) {
                const osDropdown = document.getElementById('selectOS') || document.querySelector('select[id*="os"]');
                if (osDropdown && osDropdown.options.length > 0) {
                    const osPermitidas = Array.from(osDropdown.options).map(opt => parseInt(opt.value)).filter(val => !isNaN(val));
                    solicitacoes = solicitacoes.filter(sol => osPermitidas.includes(sol.osId));
                }
            }

            tbody.innerHTML = '';
            
            if(solicitacoes.length === 0) {
                 tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted p-4">Nenhuma pendência de documento encontrada.</td></tr>';
            }

            solicitacoes.forEach(sol => {
                const tr = document.createElement('tr');
                
                const nomeSolicitante = sol.solicitanteNome || 'Sistema';
                const responsavelNome = sol.documentistaNome || (sol.documentistaId ? `ID: ${sol.documentistaId}` : 'Sem Responsável');
                const tipoDoc = sol.documento ? sol.documento.nome : '-';
                
                // Mapeia o nome completo da OS via Cache ou Select
                const stringOs = obterNomeOS(sol.osId);
                const osHtml = `<br><small class="text-secondary mt-1" style="font-size: 0.75rem;"><i class="bi bi-hdd-network"></i> ${stringOs}</small>`;

                tr.innerHTML = `
                    <td class="align-middle text-center">
                        <div class="d-flex align-items-center justify-content-center">
                            <input type="checkbox" class="form-check-input check-doc-lote me-2" value="${sol.id}" style="margin-top: 0;">
                            <button class="btn btn-sm btn-outline-secondary btn-comentar-doc" onclick="abrirModalComentariosIndex('${sol.id}')" title="Ver Histórico/Comentários">
                                <i class="bi bi-clock-history"></i>
                            </button>
                        </div>
                    </td>
                    <td class="align-middle text-center">
                        <span class="badge bg-warning text-dark">Aguardando Recebimento</span>
                    </td>
                    <td class="align-middle">
                        <span class="fw-medium">${nomeSolicitante}</span>${osHtml}
                    </td>
                    <td class="align-middle fw-medium">
                        ${tipoDoc}
                    </td>
                    <td class="align-middle text-center small">
                        ${responsavelNome}
                    </td>
                `;
                tbody.appendChild(tr);
            });

            const badgeDoc = document.getElementById('badge-pendente-doc');
            if (badgeDoc) {
                badgeDoc.textContent = solicitacoes.length;
                badgeDoc.style.display = solicitacoes.length > 0 ? '' : 'none';
            }

        } catch (error) {
            console.error("Erro ao carregar pendências de documentação:", error);
        }
    }

    async function receberLoteDocumentos() {
        const role = (localStorage.getItem("role") || "").trim().toUpperCase();
        if (role !== 'MANAGER' && role !== 'ADMIN') {
            mostrarToast("Somente perfis de Gestão (Admin/Manager) podem marcar como recebido.", "error");
            return;
        }

        const selecionados = Array.from(document.querySelectorAll('.check-doc-lote:checked')).map(cb => cb.value);
        if (selecionados.length === 0) {
            mostrarToast("Selecione ao menos um item.", "warning");
            return;
        }

        const comentario = prompt("Comentário (Opcional):", "Documento marcado como recebido (Em Lote).");
        if (comentario === null) return;

        try {
            for (let id of selecionados) {
                await fetchComAuth(`/api/docs/solicitacoes/${id}/receber`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        actorUsuarioId: parseInt(localStorage.getItem('usuarioId')),
                        comentario: comentario
                    })
                });
            }
            mostrarToast("Documentos marcados como recebidos com sucesso!", "success");
            
            const barra = document.getElementById('acoes-lote-doc');
            if(barra) {
                barra.classList.add('d-none');
                barra.classList.remove('d-flex');
            }
            
            carregarAbaPendenteDoc();
        } catch (err) {
            mostrarToast("Erro ao processar lote.", "error");
        }
    }

    // =====================================================================
    // LÓGICA DO MODAL DE COMENTÁRIOS (COM IDs ÚNICOS PARA O INDEX)
    // =====================================================================
    
    function injetarModalSeNecessario() {
        if (!document.getElementById('modalComentariosDocIndex')) {
            const modalHtml = `
            <div class="modal fade" id="modalComentariosDocIndex" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable">
                    <div class="modal-content border-0 shadow">
                        <div class="modal-header text-white" style="background-color: #f8f9fa;">
                            <h5 class="modal-title fs-6" style="color: #212529;">
                                <i class="bi bi-clock-history text-primary"></i> Histórico e Comentários
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body p-0">
                            <div id="listaComentariosContainerDocIndex" class="p-3" style="max-height: 350px; overflow-y: auto; background-color: #f8f9fa;">
                            </div>
                            <div class="p-3 bg-white border-top">
                                <label class="form-label small fw-bold text-secondary mb-1">Novo Comentário</label>
                                <textarea id="novoComentarioTextoDocIndex" class="form-control mb-2" rows="2" placeholder="Adicionar um comentário..."></textarea>
                                <button type="button" class="btn btn-primary btn-sm w-100 fw-medium" id="btnEnviarComentarioModalDocIndex">
                                    <i class="bi bi-send"></i> Enviar Comentário
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;
            document.body.insertAdjacentHTML('beforeend', modalHtml);
        }
    }

    async function carregarHistoricoNoModalIndex(id) {
        const container = document.getElementById('listaComentariosContainerDocIndex');
        if (!container) return;
        
        container.innerHTML = '<div class="text-center p-4"><div class="spinner-border text-primary" role="status"></div><br><span class="mt-2 text-muted">Carregando histórico...</span></div>';
        
        try {
            const res = await fetchComAuth(`/api/docs/solicitacoes/${id}/historico`);
            if (!res.ok) throw new Error("Falha na API");
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
                if(eventoNome.includes('RECUSA')) iconClass = 'bg-danger';
                else if(eventoNome.includes('FINALIZADO')) iconClass = 'bg-success';
                else if(eventoNome.includes('COMENTARIO')) iconClass = 'bg-secondary';
                
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
                                <p class="mb-2 text-secondary small" style="white-space: pre-wrap;">${ev.comentario || 'Ação registrada.'}</p>
                                <small class="text-muted" style="font-size: 0.75rem;"><i class="bi bi-calendar3 me-1"></i>${dataForm}</small>
                            </div>
                        </div>
                    </div>
                `;
            });
            htmlTimeline += '</div>';
            container.innerHTML = htmlTimeline;
        } catch (e) {
            container.innerHTML = '<div class="text-center p-3 text-danger"><i class="bi bi-exclamation-triangle"></i> Erro ao carregar histórico.</div>';
        }
    }

    // Função Exposta (Global) para o onClick funcionar sem conflitos de NULL
    window.abrirModalComentariosIndex = function(id) {
        const modalEl = document.getElementById('modalComentariosDocIndex');
        if(!modalEl) {
            console.error("Modal de comentários não encontrado na DOM.");
            return;
        }
        
        const modal = new bootstrap.Modal(modalEl);
        carregarHistoricoNoModalIndex(id);
        
        const btnEnviar = document.getElementById('btnEnviarComentarioModalDocIndex'); 
        const txtArea = document.getElementById('novoComentarioTextoDocIndex');
        
        if(!btnEnviar || !txtArea) return;
        
        txtArea.value = '';

        // Clona o botão para remover EventListeners antigos (evita multi-envios)
        const novoBtn = btnEnviar.cloneNode(true);
        btnEnviar.parentNode.replaceChild(novoBtn, btnEnviar);

        novoBtn.addEventListener('click', async () => {
            if (!txtArea.value.trim()) {
                mostrarToast("O comentário não pode ser vazio.", "warning");
                return;
            }
            if(typeof setButtonLoading === 'function') setButtonLoading(novoBtn, true);
            
            try {
                const userId = parseInt(localStorage.getItem('usuarioId'));
                await fetchComAuth(`/api/docs/solicitacoes/${id}/comentar`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ actorUsuarioId: userId, comentario: txtArea.value })
                });
                mostrarToast("Comentário adicionado!", "success");
                txtArea.value = '';
                carregarHistoricoNoModalIndex(id);
            } catch(e) {
                mostrarToast("Erro ao comentar.", "error");
            } finally {
                if(typeof setButtonLoading === 'function') setButtonLoading(novoBtn, false);
            }
        });

        modal.show();
    };

    document.addEventListener('DOMContentLoaded', () => {
        const btnReceberLoteDoc = document.getElementById('btnReceberLoteDoc');
        if (btnReceberLoteDoc) btnReceberLoteDoc.addEventListener('click', receberLoteDocumentos);

        document.body.addEventListener('change', (e) => {
            if (e.target.classList.contains('check-doc-lote')) {
                const checkboxes = document.querySelectorAll('.check-doc-lote:checked');
                const count = checkboxes.length;
                const barra = document.getElementById('acoes-lote-doc');
                const contador = document.getElementById('contador-selecao-doc');

                if (barra && contador) {
                    contador.textContent = count;
                    if (count > 0) {
                        barra.classList.remove('d-none');
                        barra.classList.add('d-flex');
                    } else {
                        barra.classList.add('d-none');
                        barra.classList.remove('d-flex');
                    }
                }
            }
        });
    });

    document.addEventListener('DOMContentLoaded', init);

    return {
        criarSolicitacao,
        carregarAbaPendenteDoc,
        popularSelectDocumento
    };

})();