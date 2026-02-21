/**
 * documentacao.js
 * Módulo responsável por toda a lógica de Documentação (Nova API)
 */
const DocumentacaoModule = (function () {
    let documentosCache = [];
    let todosUsuariosCache = [];
    let cachesCarregados = false;

    // Garante que os dados sejam baixados da API
    async function carregarCaches() {
        if (cachesCarregados) return;
        await Promise.all([carregarDocumentos(), carregarUsuarios()]);
        cachesCarregados = true;
    }

    async function init() {
        await carregarCaches();
        configurarListenersGlobais();
        carregarAbaPendenteDoc();
    }

    async function carregarDocumentos() {
        try {
            const res = await fetchComAuth('/api/docs/documentos');
            if (res.ok) {
                const data = await res.json();
                documentosCache = Array.isArray(data) ? data : (data.content || []);
            }
        } catch (err) {
            console.error("Erro ao carregar documentos:", err);
        }
    }

    async function carregarUsuarios() {
        try {
            const res = await fetchComAuth('/api/usuarios/documentistas');
            if (res.ok) {
                const data = await res.json();
                todosUsuariosCache = Array.isArray(data) ? data : (data.content || []);
            }
        } catch (err) {
            console.error("Erro ao carregar usuários:", err);
        }
    }

    // NOVA FUNÇÃO: Preenche qualquer select passado para ela
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

    // Configura os gatilhos para quando um documento é selecionado
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

        if (!payload.osId || !payload.documentoId || payload.lancamentoIds.length === 0) {
            console.error("Tentativa de criar solicitação ignorada. Faltam dados.");
            return;
        }

        try {
            const response = await fetchComAuth('/api/docs/solicitacoes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const erroTexto = await response.text();
                try {
                    const erroJson = JSON.parse(erroTexto);
                    throw new Error(erroJson.message || "Erro ao criar solicitação de documento.");
                } catch (e) {
                    throw new Error(erroTexto || "Erro ao criar solicitação de documento.");
                }
            }

            carregarAbaPendenteDoc();

        } catch (error) {
            mostrarToast(error.message, "warning");
        }
    }

    async function carregarAbaPendenteDoc() {
        const tbody = document.getElementById('tbody-pendente-doc');
        if (!tbody) return;

        // =================================================================
        // CORREÇÃO DOS CABEÇALHOS GIGANTES DA TABELA HTML
        // =================================================================
        const table = tbody.closest('table');
        if (table) {
            const thead = table.querySelector('thead');
            if (thead) {
                // Substitui aquela imensidão de colunas de atividades apenas pelas que importam
                thead.innerHTML = `
                    <tr>
                        <th class="text-center" style="width: 120px;">Ação</th>
                        <th class="text-center">Status</th>
                        <th>Solicitante</th>
                        <th>Tipo Documento</th>
                        <th class="text-center">Responsável</th>
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

            // Filtragem cruzada para MANAGER e COORDINATOR verem apenas as de suas OSs
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
                
                // Mapeamento de dados
                const nomeSolicitante = sol.solicitanteNome || 'Sistema';
                const responsavelNome = sol.documentistaNome || (sol.documentistaId ? `ID: ${sol.documentistaId}` : 'Sem Responsável');
                const tipoDoc = sol.documento ? sol.documento.nome : '-';
                const osBadge = sol.osId ? `<br><span class="badge bg-secondary opacity-75 mt-1">OS: ${sol.osId}</span>` : '';

                tr.innerHTML = `
                    <td class="align-middle text-center">
                        <div class="d-flex align-items-center justify-content-center">
                            <input type="checkbox" class="form-check-input check-doc-lote me-2" value="${sol.id}" style="margin-top: 0;">
                            <button class="btn btn-sm btn-outline-secondary btn-comentar-doc" data-id="${sol.id}" title="Comentar">
                                <i class="bi bi-chat-dots"></i>
                            </button>
                        </div>
                    </td>
                    <td class="align-middle text-center">
                        <span class="badge bg-warning text-dark">Aguardando Recebimento</span>
                    </td>
                    <td class="align-middle">
                        <span class="fw-medium">${nomeSolicitante}</span>${osBadge}
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

            // Atualiza badge
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
            mostrarToast("Somente perfis de Gestão podem marcar como recebido.", "error");
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
            
            // Oculta a barra de ações em lote
            const barra = document.getElementById('acoes-lote-doc');
            if(barra) {
                barra.classList.add('d-none');
                barra.classList.remove('d-flex');
            }
            
            carregarAbaPendenteDoc();
        } catch (err) {
            console.error(err);
            mostrarToast("Erro ao processar lote.", "error");
        }
    }

    async function comentarSolicitacao(id, texto) {
        try {
            await fetchComAuth(`/api/docs/solicitacoes/${id}/comentar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    actorUsuarioId: parseInt(localStorage.getItem('usuarioId')),
                    comentario: texto
                })
            });
            mostrarToast("Comentário inserido!", "success");
        } catch (err) {
            console.error(err);
            mostrarToast("Erro ao comentar.", "error");
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        const btnReceberLoteDoc = document.getElementById('btnReceberLoteDoc');
        if (btnReceberLoteDoc) btnReceberLoteDoc.addEventListener('click', receberLoteDocumentos);

        document.body.addEventListener('click', (e) => {
            const btnComentar = e.target.closest('.btn-comentar-doc');
            if (btnComentar) {
                const texto = prompt("Digite o comentário para a equipe de documentos:");
                if (texto && texto.trim() !== '') {
                    comentarSolicitacao(btnComentar.dataset.id, texto);
                }
            }
        });

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