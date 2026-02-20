/**
 * documentacao.js
 * Módulo responsável por toda a lógica de Documentação (Nova API)
 */
const DocumentacaoModule = (function () {
    let documentosCache = [];
    let todosUsuariosCache = [];

    // Inicializa o módulo
    async function init() {
        await carregarDocumentos();
        await carregarUsuarios();
        configurarListenersModalAdicionar();
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

    // Preenche o Select de Documentistas baseado no Documento selecionado
    function configurarListenersModalAdicionar() {
        // Para o Modal Único
        const selectDocumento = document.getElementById('documentoId');
        if (selectDocumento) {
            // Popula os documentos
            selectDocumento.innerHTML = '<option value="" selected>Não se aplica</option>';
            documentosCache.forEach(doc => selectDocumento.add(new Option(doc.nome, doc.id)));

            // Listener de mudança
            selectDocumento.addEventListener('change', (e) => {
                const selectDocId = e.target.value;
                const selectDocumentista = document.getElementById('documentistaId');

                selectDocumentista.innerHTML = '<option value="" selected disabled>Selecione...</option>';

                if (!selectDocId) {
                    selectDocumentista.disabled = true;
                    return;
                }

                selectDocumentista.disabled = false;
                const docSelecionado = documentosCache.find(d => d.id == selectDocId);

                if (docSelecionado && docSelecionado.documentistaIds) {
                    // Filtra os usuários que estão na lista de IDs permitidos para este documento
                    const permitidos = todosUsuariosCache.filter(u => docSelecionado.documentistaIds.includes(u.id));
                    permitidos.forEach(p => selectDocumentista.add(new Option(p.nome, p.id)));
                }
            });
        }

        document.body.addEventListener('change', (e) => {
            if (e.target.classList.contains('documento-select-lote')) {
                const selectDocId = e.target.value;
                // Extrai o sufixo (o ID da LPU) do ID do select
                const sufixo = e.target.id.replace('documentoId-lpu-', '');
                const selectDocumentista = document.getElementById(`documentistaId-lpu-${sufixo}`);

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

    // Chamada POST para a nova API de solicitações
    async function criarSolicitacao({ osId, documentoId, documentistaId, lancamentoIds, acao }) {
        const payload = {
            osId: parseInt(osId),
            documentoId: parseInt(documentoId),
            actorUsuarioId: parseInt(localStorage.getItem('usuarioId')),
            comentario: acao === 'enviar' ? "Iniciando processo de solicitação" : "Salvo como rascunho",
            documentistaId: parseInt(documentistaId),
            lancamentoIds: lancamentoIds
        };

        try {
            const response = await fetchComAuth('/api/docs/solicitacoes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error("Erro ao criar solicitação de documento.");

            // Recarrega a aba de pendentes
            carregarAbaPendenteDoc();

        } catch (error) {
            console.error(error);
            mostrarToast("Aviso: Falha ao gerar solicitação de documento.", "warning");
        }
    }

    // Renderiza aba "Pendente Doc"
    async function carregarAbaPendenteDoc() {
        const tbody = document.getElementById('tbody-pendente-doc');
        if (!tbody) return;

        try {
            const response = await fetchComAuth('/api/docs/solicitacoes');
            const data = await response.json();

            let solicitacoes = Array.isArray(data) ? data : (data.content || []);

            // Filtragem AGUARDANDO_RECEBIMENTO e Segmento
            const role = (localStorage.getItem("role") || "").trim().toUpperCase();
            const meuSegmento = localStorage.getItem("segmentoNome") || ""; // Ajuste conforme salva no login

            solicitacoes = solicitacoes.filter(sol => sol.status === 'AGUARDANDO_RECEBIMENTO');

            if (['MANAGER', 'COORDINATOR'].includes(role)) {
                solicitacoes = solicitacoes.filter(sol => sol.osSegmento === meuSegmento);
            }

            // Renderizar na Tabela
            tbody.innerHTML = '';
            solicitacoes.forEach(sol => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td class="text-center"><input type="checkbox" class="form-check-input check-doc-lote" value="${sol.id}"></td>
                    <td>
                        <button class="btn btn-sm btn-info btn-comentar-doc" data-id="${sol.id}" title="Comentar"><i class="bi bi-chat-dots"></i></button>
                    </td>
                    <td>OS: ${sol.osId || '-'}</td>
                    <td>${sol.documento ? sol.documento.nome : '-'}</td>
                    <td><span class="badge text-bg-warning">Aguardando Recebimento</span></td>
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

    // Receber em Lote (Somente Manager)
    async function receberLoteDocumentos() {
        const role = (localStorage.getItem("role") || "").trim().toUpperCase();
        if (role !== 'MANAGER') {
            mostrarToast("Somente perfis MANAGER podem marcar como recebido.", "error");
            return;
        }

        const selecionados = Array.from(document.querySelectorAll('.check-doc-lote:checked')).map(cb => cb.value);
        if (selecionados.length === 0) {
            mostrarToast("Selecione ao menos um item.", "warning");
            return;
        }

        const comentario = prompt("Comentário (Opcional):", "Documento recebido para análise");
        if (comentario === null) return; // Cancelou

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
            carregarAbaPendenteDoc();
        } catch (err) {
            console.error(err);
            mostrarToast("Erro ao processar lote.", "error");
        }
    }

    // Comentar
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

    // Bindings de Eventos Gerais
    document.addEventListener('DOMContentLoaded', () => {
        const btnReceberLoteDoc = document.getElementById('btnReceberLoteDoc');
        if (btnReceberLoteDoc) {
            btnReceberLoteDoc.addEventListener('click', receberLoteDocumentos);
        }

        document.body.addEventListener('click', (e) => {
            const btnComentar = e.target.closest('.btn-comentar-doc');
            if (btnComentar) {
                const texto = prompt("Digite o comentário:");
                if (texto) comentarSolicitacao(btnComentar.dataset.id, texto);
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

    // Iniciar módulo quando a página carrega
    document.addEventListener('DOMContentLoaded', init);

    return {
        criarSolicitacao,
        carregarAbaPendenteDoc
    };

})();