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
        await carregarCaches(); // Garante que os dados já chegaram da API

        selectElement.innerHTML = '<option value="" selected>Não se aplica</option>';
        documentosCache.forEach(doc => selectElement.add(new Option(doc.nome, doc.id)));

        if (valorSelecionado) {
            selectElement.value = valorSelecionado;
            // Força a atualização do select de documentista
            selectElement.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }

    // Configura os gatilhos para quando um documento é selecionado
    function configurarListenersGlobais() {
        document.body.addEventListener('change', (e) => {
            // Escuta tanto o select do modal único quanto os do lote
            if (e.target.id === 'documentoId' || e.target.classList.contains('documento-select-lote')) {
                const selectDocId = e.target.value;

                // Encontra o select de documentista correspondente
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

        // 1. Limpa o array de lançamentos (garante que extraia apenas números válidos)
        let idsLimpos = [];
        if (Array.isArray(lancamentoIds)) {
            idsLimpos = lancamentoIds
                .map(id => (typeof id === 'object' && id !== null ? id.id : id)) // Se for objeto, extrai o id
                .map(id => parseInt(id)) // Converte pra inteiro
                .filter(id => !isNaN(id)); // Remove NaNs
        }

        // 2. Monta o Payload com tratamento de nulos
        const payload = {
            osId: parseInt(osId) || null,
            documentoId: parseInt(documentoId) || null,
            actorUsuarioId: parseInt(localStorage.getItem('usuarioId')) || null,
            comentario: acao === 'enviar' ? "Iniciando processo de solicitação" : "Salvo como rascunho",
            documentistaId: documentistaId ? parseInt(documentistaId) : null, // Se vazio, manda null
            lancamentoIds: idsLimpos
        };

        console.log("PAYLOAD ENVIADO PARA DOC:", JSON.stringify(payload));

        // Trava de segurança no front-end
        if (!payload.osId || !payload.documentoId || payload.lancamentoIds.length === 0) {
            console.error("Tentativa de criar solicitação ignorada. Faltam dados no payload.");
            return; // Interrompe para não dar erro 400 atoa
        }

        try {
            const response = await fetchComAuth('/api/docs/solicitacoes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const erroTexto = await response.text();
                console.error("Retorno de erro do servidor:", erroTexto);
                try {
                    const erroJson = JSON.parse(erroTexto);
                    // Lança o erro com a mensagem exata do backend
                    throw new Error(erroJson.message || "Erro ao criar solicitação de documento.");
                } catch (e) {
                    throw new Error(erroTexto || "Erro ao criar solicitação de documento.");
                }
            }

            // Recarrega a aba de pendentes se der sucesso
            carregarAbaPendenteDoc();

        } catch (error) {
            console.error(error);
            // Mostra o erro do backend no Toast!
            mostrarToast(error.message, "warning");
        }
    }

    async function carregarAbaPendenteDoc() {
        const tbody = document.getElementById('tbody-pendente-doc');
        if (!tbody) return;

        try {
            const response = await fetchComAuth('/api/docs/solicitacoes');
            const data = await response.json();

            // Extrai a lista corretamente
            let solicitacoes = Array.isArray(data) ? data : (data.content || []);

            // LOG PARA DEBUG: Pressione F12 para ver se as solicitações estão chegando do backend
            console.log("Todas as solicitações de doc:", solicitacoes);

            // Filtra por status exato do Enum Java
            solicitacoes = solicitacoes.filter(sol => sol.status === 'AGUARDANDO_RECEBIMENTO');

            const role = (localStorage.getItem("role") || "").trim().toUpperCase();

            // === O GRANDE VILÃO ESTAVA AQUI ===
            // O microserviço não devolve sol.osSegmento. Então filtramos cruzando 
            // com os IDs das OSs que o usuário tem acesso (que ficam no select da tela)
            if (['MANAGER', 'COORDINATOR'].includes(role)) {
                // Procura o select de OS do seu formulário (ajuste o ID se necessário)
                const osDropdown = document.getElementById('selectOS') || document.querySelector('select[id*="os"]');

                if (osDropdown && osDropdown.options.length > 0) {
                    // Pega todos os IDs de OS que estão no select
                    const osPermitidas = Array.from(osDropdown.options).map(opt => parseInt(opt.value)).filter(val => !isNaN(val));

                    // Filtra as solicitações para mostrar apenas as que pertencem a essas OSs
                    solicitacoes = solicitacoes.filter(sol => osPermitidas.includes(sol.osId));
                }
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

    document.addEventListener('DOMContentLoaded', init);

    return {
        criarSolicitacao,
        carregarAbaPendenteDoc,
        popularSelectDocumento
    };

})();