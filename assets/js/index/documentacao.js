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

        let osNomeStr = '-';
        const selectOS = document.getElementById('osId');
        if (selectOS && selectOS.options.length > 0 && selectOS.selectedIndex >= 0) {
            osNomeStr = selectOS.options[selectOS.selectedIndex].text;
        }

        let segmentoNomeStr = '-';
        const inputSegmento = document.getElementById('segmento');
        if (inputSegmento) {
            segmentoNomeStr = inputSegmento.value;
        }

        const nomeUsuarioStr = localStorage.getItem('usuario') || 'Sistema';

        const payload = {
            osId: parseInt(osId) || null,
            documentoId: parseInt(documentoId) || null,
            actorUsuarioId: parseInt(localStorage.getItem('usuarioId')) || null,
            comentario: acao === 'enviar'
                ? "Iniciando processo de solicitação"
                : "Salvo como rascunho",
            documentistaId: documentistaId ? parseInt(documentistaId) : null,
            lancamentoIds: idsLimpos,
            osNome: osNomeStr,
            segmentoNome: segmentoNomeStr,
            solicitanteNome: nomeUsuarioStr
        };

        try {
            const response = await fetchComAuth('/api/docs/solicitacoes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                let errorBody = null;
                let errorText = null;

                try {
                    const contentType = (response.headers.get('content-type') || '').toLowerCase();

                    if (contentType.includes('application/json')) {
                        errorBody = await response.json();
                    } else {
                        errorText = await response.text();
                    }
                } catch (_) { }

                throw new Error(
                    errorBody?.message ||
                    errorBody?.error ||
                    errorText ||
                    `Erro ao criar solicitação (HTTP ${response.status})`
                );
            }

            await response.json().catch(() => null);

            carregarAbaPendenteDoc();
            mostrarToast("Solicitação criada com sucesso!", "success");

        } catch (error) {
            console.error("Erro ao criar solicitação:", error);
            mostrarToast(
                error.message || "Erro ao criar solicitação de documento.",
                "warning"
            );
        }
    }

    // INTEGRAÇÃO REAL: Pega o ID devolvido e converte para o Nome da OS (Site)
    function obterNomeOS(osId) {
        if (!osId) return '-';

        // 1. Tenta buscar no Cache da API de OS primeiro
        if (Array.isArray(osCache)) {
            const osEncontrada = osCache.find(o => parseInt(o.id) === parseInt(osId));
            if (osEncontrada) {
                const numeroOsStr = osEncontrada.os || osEncontrada.id;
                return `${numeroOsStr} - ${osEncontrada.site || 'S/ Site'}`;
            }
        }

        // 2. Fallback: Tenta buscar no select da tela
        const osDropdown = document.getElementById('selectOS') || document.querySelector('select[id*="os"]');
        if (osDropdown && osDropdown.options.length > 0) {
            const opcaoEncontrada = Array.from(osDropdown.options).find(opt => parseInt(opt.value) === parseInt(osId));
            // Evita retornar "Carregando..." se o select estiver carregando
            if (opcaoEncontrada && !opcaoEncontrada.text.toLowerCase().includes('carregando')) {
                return opcaoEncontrada.text;
            }
        }

        return `OS Num. ${osId}`;
    }

    async function carregarAbaPendenteDoc() {
        const tbody = document.getElementById('tbody-pendente-doc');
        if (!tbody) return;

        const table = tbody.closest('table');
        if (table) {
            const thead = table.querySelector('thead');
            if (thead) {
                thead.innerHTML = `
                    <tr>
                        <th class="text-center align-middle" style="width: 120px;">AÇÃO</th>
                        <th class="text-center align-middle">STATUS</th>
                        <th class="align-middle">DATA DA SOLICITAÇÃO</th>
                        <th class="align-middle">SOLICITANTE</th>
                        <th class="align-middle">TIPO DOCUMENTO</th>
                        <th class="text-center align-middle">RESPONSÁVEL</th>
                    </tr>
                `;
            }
        }

        try {
            const usuarioLogadoId = localStorage.getItem('usuarioId') || '';
            const response = await fetchComAuth(`/api/docs/solicitacoes?usuarioId=${usuarioLogadoId}`);
            const data = await response.json();

            let solicitacoes = Array.isArray(data) ? data : (data.content || []);
            solicitacoes = solicitacoes.filter(sol => sol.status === 'AGUARDANDO_RECEBIMENTO');

            const role = (localStorage.getItem("role") || "").trim().toUpperCase();

            // MANAGER e COORDINATOR veem apenas as de suas OSs
            if (['MANAGER', 'COORDINATOR'].includes(role)) {
                // Usa o cache de OS que o Monolito devolveu para esse usuário
                if (osCache && osCache.length > 0) {
                    const osPermitidas = osCache.map(o => parseInt(o.id));
                    solicitacoes = solicitacoes.filter(sol => osPermitidas.includes(sol.osId));
                }
            }

            tbody.innerHTML = '';

            if (solicitacoes.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted p-4">Nenhuma pendência de documento encontrada.</td></tr>';
            }

            solicitacoes.forEach(sol => {
                const tr = document.createElement('tr');

                const nomeSolicitante = sol.solicitanteNome || 'Sistema';
                // Pegando a OS gravada ou buscando do cache de OS do usuário
                let osNomeStr = obterNomeOS(sol.osId);

                // Fallback: se o cache falhar, tenta pegar do banco (desde que não seja a palavra Carregando)
                if (osNomeStr === `OS Num. ${sol.osId}` && sol.osNome && !sol.osNome.toLowerCase().includes("carregando")) {
                    osNomeStr = sol.osNome;
                }

                const responsavelNome = sol.documentistaNome || (sol.documentistaId ? `ID: ${sol.documentistaId}` : 'Sem Responsável');
                const tipoDoc = sol.documento ? sol.documento.nome : '-';
                const dataSolicitacao = sol.criadoEm ? new Date(sol.criadoEm).toLocaleDateString('pt-BR') : '-';

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
                        <span class="text-secondary fw-medium">${dataSolicitacao}</span>
                    </td>
                    <td class="align-middle">
                        <span class="fw-medium d-block text-dark">${nomeSolicitante}</span>
                        <span class="small text-muted"><i class="bi bi-tag-fill me-1"></i>${osNomeStr}</span>
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

        // Usando o SweetAlert2 para um modal "bonitinho" com loading
        const { value: comentario, isConfirmed } = await Swal.fire({
            title: 'Confirmar Recebimento',
            text: 'Deseja adicionar uma observação? (Opcional)',
            input: 'textarea',
            inputValue: 'Documento marcado como recebido (Em Lote).',
            inputPlaceholder: 'Digite seu comentário aqui...',
            showCancelButton: true,
            confirmButtonText: '<i class="bi bi-check-lg me-1"></i> Confirmar Recebimento',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#198754', // Verde padrão do sistema
            showLoaderOnConfirm: true, // Habilita o spinner de carregamento!
            allowOutsideClick: () => !Swal.isLoading(),
            preConfirm: async (comentarioValue) => {
                // Adiciona o loading visual também no botão da barra (por garantia)
                const btnBarra = document.getElementById('btnReceberLoteDoc');
                const btnBarraHtmlOrig = btnBarra ? btnBarra.innerHTML : '';
                if (btnBarra) {
                    btnBarra.disabled = true;
                    btnBarra.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Processando...';
                }

                try {
                    for (let id of selecionados) {
                        const response = await fetchComAuth(`/api/docs/solicitacoes/${id}/receber`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                actorUsuarioId: parseInt(localStorage.getItem('usuarioId')),
                                comentario: comentarioValue
                            })
                        });

                        if (!response.ok) {
                            throw new Error('Falha na comunicação com o servidor.');
                        }
                    }
                    return true;
                } catch (err) {
                    Swal.showValidationMessage(`Erro ao processar o lote: ${err.message}`);
                    return false;
                } finally {
                    // Restaura o botão original após acabar o loading
                    if (btnBarra) {
                        btnBarra.disabled = false;
                        btnBarra.innerHTML = btnBarraHtmlOrig;
                    }
                }
            }
        });

        // Só atualiza a tela e dá sucesso se a Promise terminou certinha!
        if (isConfirmed) {
            mostrarToast("Documentos marcados como recebidos com sucesso!", "success");

            const barra = document.getElementById('acoes-lote-doc');
            if (barra) {
                barra.classList.add('d-none');
                barra.classList.remove('d-flex');
            }

            carregarAbaPendenteDoc();
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
    window.abrirModalComentariosIndex = function (id) {
        const modalEl = document.getElementById('modalComentariosDocIndex');
        if (!modalEl) {
            console.error("Modal de comentários não encontrado na DOM.");
            return;
        }

        const modal = new bootstrap.Modal(modalEl);
        carregarHistoricoNoModalIndex(id);

        const btnEnviar = document.getElementById('btnEnviarComentarioModalDocIndex');
        const txtArea = document.getElementById('novoComentarioTextoDocIndex');

        if (!btnEnviar || !txtArea) return;

        txtArea.value = '';

        // Clona o botão para remover EventListeners antigos (evita multi-envios)
        const novoBtn = btnEnviar.cloneNode(true);
        btnEnviar.parentNode.replaceChild(novoBtn, btnEnviar);

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
                carregarHistoricoNoModalIndex(id);
            } catch (e) {
                mostrarToast("Erro ao comentar.", "error");
            } finally {
                if (typeof setButtonLoading === 'function') setButtonLoading(novoBtn, false);
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