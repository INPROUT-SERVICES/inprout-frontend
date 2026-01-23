document.addEventListener('DOMContentLoaded', () => {

    // 1. Seleciona todos os elementos do modal "Adicionar em Lote"
    const modalAdicionarEmLote = document.getElementById('modalAdicionarEmLote');
    if (!modalAdicionarEmLote) {
        // Se o modal não existe na página, não faz nada para evitar erros.
        return;
    }

    const formAdicionarEmLote = document.getElementById('formAdicionarEmLote');
    const selectOSLote = document.getElementById('osIdLote');
    const selectProjetoLote = document.getElementById('projetoIdLote');
    const lpuChecklistContainerLote = document.getElementById('lpuChecklistContainerLote');
    const btnAvancarParaPreenchimentoLote = document.getElementById('btnAvancarParaPreenchimentoLote');
    const formulariosContainerLote = document.getElementById('formulariosContainerLote');

    // Botões do rodapé do modal
    const btnSubmitAdicionarLote = document.getElementById('btnSubmitAdicionarLote');
    const btnSalvarRascunhoLote = document.getElementById('btnSalvarRascunhoLote');
    const btnSalvarEEnviarLote = document.getElementById('btnSalvarEEnviarLote');

    // Variáveis de cache para evitar múltiplas chamadas à API
    let todasAsEtapasLote = [];
    let todosOsPrestadoresLote = [];
    let todasAsOSLote = [];
    let todosTiposDocumentacaoLote = [];
    let todosDocumentistasLote = [];


    function inicializarFlatpickrComFormato(selector) {
        // Verifica se a biblioteca flatpickr está disponível
        if (typeof flatpickr === 'function') {
            flatpickr(selector, {
                locale: 'pt', // Usa a tradução para português
                dateFormat: 'd/m/Y', // Formato de data visível: 31/12/2025
                allowInput: true, // Permite que o usuário digite a data
                onOpen: function (selectedDates, dateStr, instance) {
                    // Limpa a data selecionada toda vez que o calendário é aberto
                    // se o campo de input estiver vazio.
                    if (instance.input.value === '') {
                        instance.clear();
                    }
                }
            });
        }
    }


    // ==========================================================
    // LÓGICA DO MODAL
    // ==========================================================

    // Evento disparado sempre que o modal de lote for aberto
    modalAdicionarEmLote.addEventListener('show.bs.modal', async () => {
        // Reseta o formulário para um estado limpo
        formAdicionarEmLote.reset();
        lpuChecklistContainerLote.innerHTML = '<p class="text-muted">Selecione uma OS para ver as LPUs.</p>';
        formulariosContainerLote.innerHTML = '';

        btnAvancarParaPreenchimentoLote.disabled = true;

        // Inicializa o flatpickr no campo de data principal do lote
        inicializarFlatpickrComFormato('#dataAtividadeLote');

        // Pré-carrega a lista de Ordens de Serviço
        await carregarProjetosEOSParaSelectLote();
    });

    // Função para carregar as OSs do usuário no select
    async function carregarProjetosEOSParaSelectLote() {
        try {
            const usuarioId = localStorage.getItem('usuarioId');
            if (!usuarioId) throw new Error('ID do usuário não encontrado.');

            const response = await fetchComAuth(`https://www.inproutservices.com.br/api/os/por-usuario/${usuarioId}`);
            if (!response.ok) throw new Error('Falha ao carregar Ordens de Serviço.');

            const osData = await response.json();
            todasAsOSLote = osData;

            // Pega todos os projetos unicos
            const projetos = [...new Set(osData.map(item => item.projeto))];

            // ===== INÍCIO DA CORREÇÃO =====
            // 1. Guarda os valores que o usuário PODE JÁ TER SELECIONADO
            const projetoSelecionado = selectProjetoLote.value;
            const osSelecionada = selectOSLote.value;
            // ===== FIM DA CORREÇÃO =====

            selectProjetoLote.innerHTML = `<option value="" selected disabled>Selecione um Projeto...</option>`;
            projetos.forEach(projeto => {
                const option = new Option(projeto, projeto);
                selectProjetoLote.add(option);
            });

            selectOSLote.innerHTML = `<option value="" selected disabled>Selecione uma OS...</option>`;
            todasAsOSLote.forEach(item => {
                const option = new Option(item.os, item.id);
                selectOSLote.add(option);
            });

            // ===== INÍCIO DA CORREÇÃO =====
            // 2. Restaura os valores se eles já existiam (e não eram o placeholder)
            if (projetoSelecionado) {
                selectProjetoLote.value = projetoSelecionado;
            }
            if (osSelecionada) {
                selectOSLote.value = osSelecionada;
            }
            // ===== FIM DA CORREÇÃO =====

        } catch (error) {
            console.error('Erro ao carregar OSs:', error);
            if (typeof mostrarToast === 'function') {
                mostrarToast('Erro ao carregar Ordens de Serviço.', 'error');
            }
        }
    }

    function preencherCamposOSLote(osData) {
        const siteInput = document.getElementById('siteLote');
        const segmentoInput = document.getElementById('segmentoLote');
        const projetoInput = document.getElementById('projetoLote');
        const contratoInput = document.getElementById('contratoLote');
        const gestorTimInput = document.getElementById('gestorTimLote');
        const regionalInput = document.getElementById('regionalLote');

        if (osData) {
            // Pega os dados que ainda são da OS principal
            segmentoInput.value = osData.segmento ? osData.segmento.nome : '';
            projetoInput.value = osData.projeto || '';
            gestorTimInput.value = osData.gestorTim || '';

            // Pega os dados do primeiro detalhe (OsLpuDetalhe)
            const primeiroDetalhe = osData.detalhes && osData.detalhes.length > 0 ? osData.detalhes[0] : {};
            siteInput.value = primeiroDetalhe.site || '';
            contratoInput.value = primeiroDetalhe.contrato || '';
            regionalInput.value = primeiroDetalhe.regional || '';
        } else {
            // Limpa todos os campos se não houver dados
            siteInput.value = '';
            segmentoInput.value = '';
            projetoInput.value = '';
            contratoInput.value = '';
            gestorTimInput.value = '';
            regionalInput.value = '';
        }
    }

    function gerarFormularioHTML(idSufixo, titulo, mostrarAberto = true) {
        return `
        <div class="accordion-item">
            <h2 class="accordion-header" id="heading-${idSufixo}">
                <button class="accordion-button ${!mostrarAberto ? 'collapsed' : ''}" type="button" data-bs-toggle="collapse" data-bs-target="#collapse-${idSufixo}" aria-expanded="${mostrarAberto}">
                    ${titulo}
                </button>
            </h2>
            <div id="collapse-${idSufixo}" class="accordion-collapse collapse ${mostrarAberto ? 'show' : ''}">
                <div class="accordion-body">
                    
                    <h6 class="section-title">Controle de Documentação</h6>
                    <div class="row g-3 mb-3">
                        <div class="col-md-6">
                            <label for="tipoDocumentacaoId-lpu-${idSufixo}" class="form-label">Tipo de Documentação</label>
                            <select class="form-select tipo-doc-select" id="tipoDocumentacaoId-lpu-${idSufixo}">
                                <option value="" selected>Não se aplica</option>
                            </select>
                        </div>
                        <div class="col-md-6">
                            <label for="documentistaId-lpu-${idSufixo}" class="form-label">Documentista Responsável</label>
                            <select class="form-select documentista-select" id="documentistaId-lpu-${idSufixo}">
                                <option value="" selected disabled>Selecione...</option>
                            </select>
                        </div>
                    </div>

                    <h6 class="section-title">Execução</h6>
                    <div class="etapas-scroll mb-3">
                        <div class="card etapa-card">
                            <h6>Vistoria</h6>
                            <select class="form-select" id="vistoria-lpu-${idSufixo}"><option>OK</option><option>NOK</option><option selected>N/A</option></select>
                            <input type="text" class="form-control flatpickr-date-lote mt-2" id="planoVistoria-lpu-${idSufixo}" placeholder="Plano (Data)">
                        </div>
                        <div class="card etapa-card">
                            <h6>Desmobilização</h6>
                            <select class="form-select" id="desmobilizacao-lpu-${idSufixo}"><option>OK</option><option>NOK</option><option selected>N/A</option></select>
                            <input type="text" class="form-control flatpickr-date-lote mt-2" id="planoDesmobilizacao-lpu-${idSufixo}" placeholder="Plano (Data)">
                        </div>
                        <div class="card etapa-card">
                            <h6>Instalação</h6>
                            <select class="form-select" id="instalacao-lpu-${idSufixo}"><option>OK</option><option>NOK</option><option selected>N/A</option></select>
                            <input type="text" class="form-control flatpickr-date-lote mt-2" id="planoInstalacao-lpu-${idSufixo}" placeholder="Plano (Data)">
                        </div>
                         <div class="card etapa-card">
                            <h6>Ativação</h6>
                            <select class="form-select" id="ativacao-lpu-${idSufixo}"><option>OK</option><option>NOK</option><option selected>N/A</option></select>
                            <input type="text" class="form-control flatpickr-date-lote mt-2" id="planoAtivacao-lpu-${idSufixo}" placeholder="Plano (Data)">
                        </div>
                        <div class="card etapa-card">
                            <h6>Documentação</h6>
                            <select class="form-select" id="documentacao-lpu-${idSufixo}"><option>OK</option><option>NOK</option><option selected>N/A</option></select>
                            <input type="text" class="form-control flatpickr-date-lote mt-2" id="planoDocumentacao-lpu-${idSufixo}" placeholder="Plano (Data)">
                        </div>
                    </div>
                    <h6 class="section-title">Detalhes da Atividade</h6>
                    <div class="row g-3 mb-3">
                        <div class="col-md-4">
                            <label for="etapaGeral-lpu-${idSufixo}" class="form-label">Etapa Geral</label>
                            <select class="form-select etapa-geral-select" id="etapaGeral-lpu-${idSufixo}" data-lpu-id="${idSufixo}" required><option value="" selected disabled>Selecione...</option></select>
                        </div>
                        <div class="col-md-4">
                            <label for="etapaDetalhadaId-lpu-${idSufixo}" class="form-label">Etapa Detalhada</label>
                            <select class="form-select etapa-detalhada-select" id="etapaDetalhadaId-lpu-${idSufixo}" required disabled></select>
                        </div>
                        <div class="col-md-4">
                            <label for="status-lpu-${idSufixo}" class="form-label">Status</label>
                            <select class="form-select status-select" id="status-lpu-${idSufixo}" required disabled></select>
                        </div>
                    </div>
                     <div class="mb-3">
                        <label for="situacao-lpu-${idSufixo}" class="form-label">Situação</label>
                        <select class="form-select" id="situacao-lpu-${idSufixo}">
                            <option value="" selected disabled>Selecione...</option>
                            <option>Não iniciado</option>
                            <option>Aguardando documentação</option>
                            <option>Paralisado</option>
                            <option selected>Em andamento</option>
                            <option>Finalizado</option>
                        </select>
                    </div>
                     <div class="mb-3">
                        <label for="detalheDiario-lpu-${idSufixo}" class="form-label">Detalhe Diário</label>
                        <textarea class="form-control" id="detalheDiario-lpu-${idSufixo}" rows="2" required></textarea>
                    </div>
                    <h6 class="section-title">Financeiro</h6>
                    <div class="row g-3 mb-3">
                         <div class="col-md-8">
                            <label for="prestadorId-lpu-${idSufixo}" class="form-label">Prestador</label>
                            <select class="form-select" id="prestadorId-lpu-${idSufixo}" required></select>
                        </div>
                        <div class="col-md-4">
                            <label for="valor-lpu-${idSufixo}" class="form-label">Valor</label>
                            <div class="input-group">
                                <span class="input-group-text">R$</span>
                                <input type="text" class="form-control" id="valor-lpu-${idSufixo}" inputmode="numeric" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;
    }

    /**
     * Inicializa componentes JS (como Choices.js e Flatpickr) em um formulário recém-criado.
     */
    function inicializarComponentesFormulario(idSufixo) {
        inicializarFlatpickrComFormato(`#collapse-${idSufixo} .flatpickr-date-lote`);

        const selectPrestador = document.getElementById(`prestadorId-lpu-${idSufixo}`);
        if (selectPrestador) {
            if (selectPrestador.choices) selectPrestador.choices.destroy();
            selectPrestador.innerHTML = '';
            const choicesInstance = new Choices(selectPrestador, { searchEnabled: true, placeholder: true, placeholderValue: 'Busque pelo nome ou código...', itemSelectText: '', noResultsText: 'Nenhum resultado' });

            // --- INÍCIO DA CORREÇÃO ---
            // 1. Adicionamos um item "placeholder"
            const placeholder = { value: '', label: 'Busque pelo nome ou código...', selected: true, disabled: true };
            const choicesData = todosOsPrestadoresLote.map(p => ({ value: p.id, label: `${p.codigoPrestador} - ${p.prestador}` }));

            // 2. Enviamos a lista completa (com placeholder)
            choicesInstance.setChoices([placeholder, ...choicesData], 'value', 'label', false);
            // --- FIM DA CORREÇÃO ---

            selectPrestador.choices = choicesInstance;
        }

        const selectEtapaGeral = document.getElementById(`etapaGeral-lpu-${idSufixo}`);
        if (selectEtapaGeral) {
            selectEtapaGeral.innerHTML = '<option value="" selected disabled>Selecione...</option>';
            todasAsEtapasLote.forEach(e => selectEtapaGeral.add(new Option(`${e.codigo} - ${e.nome}`, e.id)));
        }

        const selectTipoDoc = document.getElementById(`tipoDocumentacaoId-lpu-${idSufixo}`);
        if (selectTipoDoc && todosTiposDocumentacaoLote.length > 0) {
            todosTiposDocumentacaoLote.forEach(td => selectTipoDoc.add(new Option(td.nome, td.id)));
        }

        const selectDocumentista = document.getElementById(`documentistaId-lpu-${idSufixo}`);
        if (selectDocumentista && todosDocumentistasLote.length > 0) {
            todosDocumentistasLote.forEach(d => selectDocumentista.add(new Option(d.nome, d.id)));
        }
    }

    /**
    * Lê todos os valores de um formulário específico e retorna um objeto.
    */
    function lerDadosDeFormulario(idSufixo) {
        // 1. É necessário declarar as variáveis ANTES do return
        // O ?.value evita erro se o campo não existir por algum motivo
        const campoTipoDoc = document.getElementById(`tipoDocumentacaoId-lpu-${idSufixo}`);
        const campoDocumentista = document.getElementById(`documentistaId-lpu-${idSufixo}`);

        const tipoDocVal = campoTipoDoc ? campoTipoDoc.value : "";
        const documentistaVal = campoDocumentista ? campoDocumentista.value : "";

        // Captura os outros valores do formulário
        const vistoria = document.getElementById(`vistoria-lpu-${idSufixo}`).value;
        const planoVistoria = formatarDataParaAPI(document.getElementById(`planoVistoria-lpu-${idSufixo}`).value);
        const desmobilizacao = document.getElementById(`desmobilizacao-lpu-${idSufixo}`).value;
        const planoDesmobilizacao = formatarDataParaAPI(document.getElementById(`planoDesmobilizacao-lpu-${idSufixo}`).value);
        const instalacao = document.getElementById(`instalacao-lpu-${idSufixo}`).value;
        const planoInstalacao = formatarDataParaAPI(document.getElementById(`planoInstalacao-lpu-${idSufixo}`).value);
        const ativacao = document.getElementById(`ativacao-lpu-${idSufixo}`).value;
        const planoAtivacao = formatarDataParaAPI(document.getElementById(`planoAtivacao-lpu-${idSufixo}`).value);
        const documentacao = document.getElementById(`documentacao-lpu-${idSufixo}`).value;
        const planoDocumentacao = formatarDataParaAPI(document.getElementById(`planoDocumentacao-lpu-${idSufixo}`).value);

        const etapaDetalhadaId = document.getElementById(`etapaDetalhadaId-lpu-${idSufixo}`).value;
        const status = document.getElementById(`status-lpu-${idSufixo}`).value;
        const situacao = document.getElementById(`situacao-lpu-${idSufixo}`).value;
        const detalheDiario = document.getElementById(`detalheDiario-lpu-${idSufixo}`).value;
        const prestadorId = document.getElementById(`prestadorId-lpu-${idSufixo}`).value;

        // Tratamento do valor monetário
        const valorInput = document.getElementById(`valor-lpu-${idSufixo}`).value;
        const valor = parseFloat(valorInput.replace(/\./g, '').replace(',', '.')) || 0;

        return {
            vistoria: vistoria,
            planoVistoria: planoVistoria,
            desmobilizacao: desmobilizacao,
            planoDesmobilizacao: planoDesmobilizacao,
            instalacao: instalacao,
            planoInstalacao: planoInstalacao,
            ativacao: ativacao,
            planoAtivacao: planoAtivacao,
            documentacao: documentacao,
            planoDocumentacao: planoDocumentacao,

            tipoDocumentacaoId: tipoDocVal && tipoDocVal !== "" ? parseInt(tipoDocVal) : null,
            documentistaId: documentistaVal && documentistaVal !== "" ? parseInt(documentistaVal) : null,

            etapaDetalhadaId: etapaDetalhadaId,
            status: status,
            situacao: situacao,
            detalheDiario: detalheDiario,
            prestadorId: prestadorId,
            valor: valor
        };
    }

    // ##### CÓDIGO CORRIGIDO #####
    selectProjetoLote.addEventListener('change', async (e) => {
        const projeto = e.target.value;

        // Encontra a primeira OS que corresponde ao projeto selecionado
        const primeiraOSDoProjeto = todasAsOSLote.find(os => os.projeto === projeto);

        if (primeiraOSDoProjeto) {
            // Apenas define o valor da OS, sem filtrar a lista
            selectOSLote.value = primeiraOSDoProjeto.id;
            // Dispara o evento 'change' na OS para carregar seus dados
            selectOSLote.dispatchEvent(new Event('change'));
        } else {
            // Se não houver OSs, limpa todos os campos dependentes.
            selectOSLote.value = "";
            lpuChecklistContainerLote.innerHTML = '<p class="text-muted">Nenhuma OS encontrada para este projeto.</p>';
            preencherCamposOSLote(null);
            formulariosContainerLote.innerHTML = '';
            btnAvancarParaPreenchimentoLote.disabled = true;
        }
    });

    selectOSLote.addEventListener('change', async (e) => {
        const osId = e.target.value;
        const os = todasAsOSLote.find(os => os.id == osId);

        // --- INÍCIO DA CORREÇÃO ---
        // Garante que o select de projeto reflita a OS selecionada
        if (os && selectProjetoLote.value !== os.projeto) {
            selectProjetoLote.value = os.projeto;
        }
        // --- FIM DA CORREÇÃO ---

        formulariosContainerLote.innerHTML = '';
        btnAvancarParaPreenchimentoLote.disabled = true;

        if (!osId) {
            lpuChecklistContainerLote.innerHTML = '<p class="text-muted">Selecione uma OS para ver as LPUs.</p>';
            preencherCamposOSLote(null);
            return;
        }

        lpuChecklistContainerLote.innerHTML = '<div class="spinner-border spinner-border-sm" role="status"><span class="visually-hidden">Carregando...</span></div>';

        // ===== A CORREÇÃO PRINCIPAL ESTÁ AQUI =====
        // Em vez de limpar os campos com 'null', pré-preenchemos com os dados
        // que já temos em cache. Isso evita o efeito de "apagar".
        preencherCamposOSLote(os);
        // ==========================================

        try {
            const response = await fetchComAuth(`https://www.inproutservices.com.br/api/os/${osId}`);
            if (!response.ok) throw new Error('Falha ao buscar dados da OS.');
            const osData = await response.json();

            // Depois da busca, atualizamos com os dados mais completos da API.
            preencherCamposOSLote(osData);

            const lpus = osData.detalhes || [];

            if (lpus.length === 0) {
                lpuChecklistContainerLote.innerHTML = '<p class="text-muted">Nenhuma LPU encontrada para esta OS.</p>';
            } else {
                lpuChecklistContainerLote.innerHTML = lpus.map(item => {
                    const lpu = item.lpu;
                    if (!lpu) return '';

                    const quantidade = item.quantidade || 'N/A';
                    const key = item.key || 'N/A';
                    const codigo = lpu.codigo ?? lpu.codigoLpu ?? '';
                    const nome = lpu.nome ?? lpu.nomeLpu ?? '';
                    const label = `(${quantidade}) ${key} - ${codigo} - ${nome}`;

                    return `
                    <div class="form-check">
                        <input class="form-check-input lpu-checkbox" type="checkbox"
                            value="${lpu.id}"
                            data-os-lpu-detalhe-id="${item.id}"
                            id="lpu-lote-${lpu.id}" data-nome="${label}">
                        <label class="form-check-label" for="lpu-lote-${lpu.id}">
                            <div class="lpu-label-container">
                                <span class="lpu-label-main">${codigo} - ${nome}</span>
                                <span class="lpu-label-details">
                                    <span>Quantidade: ${quantidade}</span>
                                    <span>Key: ${key}</span>
                                </span>
                            </div>
                        </label>
                    </div>
                `;
                }).join('');
            }
        } catch (error) {
            console.error("Erro ao carregar dados da OS:", error);
            lpuChecklistContainerLote.innerHTML = '<p class="text-danger">Erro ao carregar dados.</p>';
            // preencherCamposOSLote(null); // <-- Esta é a linha do bug. Remova-a.
        }
    });


    lpuChecklistContainerLote.addEventListener('change', (e) => {
        if (e.target.classList.contains('lpu-checkbox')) {
            const algumCheckboxMarcado = lpuChecklistContainerLote.querySelector('.lpu-checkbox:checked');
            btnAvancarParaPreenchimentoLote.disabled = !algumCheckboxMarcado;
        }
    });

    btnAvancarParaPreenchimentoLote.addEventListener('click', async () => {
        const lpusSelecionadas = document.querySelectorAll('#lpuChecklistContainerLote .lpu-checkbox:checked');
        if (lpusSelecionadas.length === 0) return;

        formulariosContainerLote.innerHTML = '<div class="text-center p-4"><div class="spinner-border" role="status"><span class="visually-hidden">Gerando formulários...</span></div></div>';

        try {
            if (todasAsEtapasLote.length === 0) {
                todasAsEtapasLote = await fetchComAuth('https://www.inproutservices.com.br/api/index/etapas').then(res => res.json());
            }
            if (todosOsPrestadoresLote.length === 0) {
                todosOsPrestadoresLote = await fetchComAuth('https://www.inproutservices.com.br/api/index/prestadores/ativos').then(res => res.json());
            }
            if (todosTiposDocumentacaoLote.length === 0) {
                todosTiposDocumentacaoLote = await fetchComAuth('https://www.inproutservices.com.br/api/tipos-documentacao').then(res => res.json());
            }
            if (todosDocumentistasLote.length === 0) {
                todosDocumentistasLote = await fetchComAuth('https://www.inproutservices.com.br/api/usuarios/documentistas').then(res => res.json());
            }

            const replicarDados = document.getElementById('replicarDadosSwitchLote').checked;

            if (replicarDados) {
                // MODO REPLICAR: Gera um formulário único
                formulariosContainerLote.innerHTML = gerarFormularioHTML('unico', `Informações para ${lpusSelecionadas.length} itens selecionados`);
                inicializarComponentesFormulario('unico');
            } else {
                // MODO INDIVIDUAL: Gera um acordeão para cada LPU
                formulariosContainerLote.innerHTML = Array.from(lpusSelecionadas).map((checkbox, index) => {
                    return gerarFormularioHTML(checkbox.value, checkbox.dataset.nome, index === 0);
                }).join('');

                lpusSelecionadas.forEach(checkbox => {
                    inicializarComponentesFormulario(checkbox.value);
                });
            }

        } catch (error) {
            console.error("Erro ao gerar formulários:", error);
            formulariosContainerLote.innerHTML = '<p class="text-danger text-center">Ocorreu um erro ao gerar os formulários. Tente novamente.</p>';
        }
    });


    // 5. Adiciona listeners para os selects dinâmicos (cascading dropdowns)
    formulariosContainerLote.addEventListener('change', (e) => {
        const target = e.target;
        if (target.classList.contains('etapa-geral-select')) {
            const lpuId = target.dataset.lpuId;
            const etapaGeralId = target.value;
            const selectDetalhada = document.getElementById(`etapaDetalhadaId-lpu-${lpuId}`);
            const selectStatus = document.getElementById(`status-lpu-${lpuId}`);

            const etapaSelecionada = todasAsEtapasLote.find(etapa => etapa.id == etapaGeralId);

            selectDetalhada.innerHTML = '<option value="" selected disabled>Selecione...</option>';
            selectStatus.innerHTML = '<option value="" selected disabled>Selecione...</option>';
            selectDetalhada.disabled = true;
            selectStatus.disabled = true;

            if (etapaSelecionada && etapaSelecionada.etapasDetalhadas.length > 0) {
                etapaSelecionada.etapasDetalhadas.forEach(detalhe => {
                    selectDetalhada.add(new Option(`${detalhe.indice} - ${detalhe.nome}`, detalhe.id));
                });
                selectDetalhada.disabled = false;
            }
        }
        if (target.classList.contains('etapa-detalhada-select')) {
            const accordionBody = target.closest('.accordion-body');
            const lpuId = accordionBody.querySelector('.etapa-geral-select').dataset.lpuId;
            const etapaGeralId = accordionBody.querySelector('.etapa-geral-select').value;
            const etapaDetalhadaId = target.value;
            const selectStatus = document.getElementById(`status-lpu-${lpuId}`);

            const etapaGeral = todasAsEtapasLote.find(e => e.id == etapaGeralId);
            const etapaDetalhada = etapaGeral?.etapasDetalhadas.find(ed => ed.id == etapaDetalhadaId);

            selectStatus.innerHTML = '<option value="" selected disabled>Selecione...</option>';
            selectStatus.disabled = true;

            if (etapaDetalhada && etapaDetalhada.status.length > 0) {
                etapaDetalhada.status.forEach(status => selectStatus.add(new Option(status, status)));
                selectStatus.disabled = false;
            }
        }
        if (target.classList.contains('tipo-doc-select')) {
            const tipoId = target.value;
            const sufixoId = target.id.replace('tipoDocumentacaoId-', '');
            const selectDocumentista = document.getElementById(`documentistaId-${sufixoId}`);

            if (selectDocumentista) {
                selectDocumentista.innerHTML = '<option value="" selected disabled>Selecione...</option>';

                const tipoSelecionado = todosTiposDocumentacaoLote.find(t => t.id == tipoId);

                if (tipoSelecionado && tipoSelecionado.documentistas && tipoSelecionado.documentistas.length > 0) {
                    tipoSelecionado.documentistas.forEach(doc => {
                        selectDocumentista.add(new Option(doc.nome, doc.id));
                    });
                } else {
                    // Fallback: mostra todos se não houver restrição
                    todosDocumentistasLote.forEach(doc => {
                        selectDocumentista.add(new Option(doc.nome, doc.id));
                    });
                }
            }
        }
    });

    function formatarDataParaAPI(dataString) {
        if (!dataString) {
            return null; // Se não houver data, retorna nulo
        }
        return dataString;
    }

    async function handleFormSubmitLote(acao, submitButton) {
        if (!formAdicionarEmLote.checkValidity()) {
            formAdicionarEmLote.classList.add('was-validated');
            if (typeof mostrarToast === 'function') mostrarToast('Por favor, preencha todos os campos obrigatórios.', 'error');
            return;
        }

        const originalContent = submitButton.innerHTML;
        submitButton.disabled = true;
        submitButton.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Salvando...`;

        try {
            const lpusSelecionadas = document.querySelectorAll('#lpuChecklistContainerLote .lpu-checkbox:checked');
            if (lpusSelecionadas.length === 0) throw new Error("Nenhuma LPU foi selecionada para o lançamento.");

            const lancamentosEmLote = [];
            const osId = selectOSLote.value;
            const dataAtividade = document.getElementById('dataAtividadeLote').value;
            const replicarDados = document.getElementById('replicarDadosSwitchLote').checked;

            if (!dataAtividade) throw new Error('A Data da Atividade é obrigatória.');

            let dadosReplicados = {};
            if (replicarDados) {
                // Se for replicar, lê os dados do formulário único UMA VEZ
                dadosReplicados = lerDadosDeFormulario('unico');
            }

            for (const checkbox of lpusSelecionadas) {
                const lpuId = checkbox.value;
                const osLpuDetalheId = checkbox.dataset.osLpuDetalheId;

                // Se não estiver replicando, lê os dados do formulário específico desta LPU
                const dadosFormulario = replicarDados ? dadosReplicados : lerDadosDeFormulario(lpuId);

                const dadosLpu = {
                    ...dadosFormulario, // Usa os dados lidos (sejam eles únicos ou replicados)
                    managerId: localStorage.getItem('usuarioId'),
                    osId: osId,
                    lpuId: lpuId,
                    osLpuDetalheId: osLpuDetalheId, // Sempre usa o osLpuDetalheId
                    dataAtividade: formatarDataParaAPI(dataAtividade),
                    atividadeComplementar: false, // Hardcoded para false
                    quantidade: null, // Hardcoded para null
                    situacaoAprovacao: acao === 'enviar' ? 'PENDENTE_COORDENADOR' : 'RASCUNHO'
                };

                lancamentosEmLote.push(dadosLpu);
            }

            const response = await fetchComAuth('https://www.inproutservices.com.br/api/lancamentos/lote', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(lancamentosEmLote)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Erro ao salvar lançamentos em lote.');
            }

            if (typeof mostrarToast === 'function') mostrarToast('Lançamento(s) salvo(s) com sucesso!', 'success');
            bootstrap.Modal.getInstance(modalAdicionarEmLote).hide();
            await carregarLancamentos(); // Função do index.js

        } catch (error) {
            if (typeof mostrarToast === 'function') mostrarToast(error.message, 'error');
            console.error("Erro na submissão em lote:", error);
        } finally {
            submitButton.disabled = false;
            submitButton.innerHTML = originalContent;
        }
    }

    if (btnSalvarRascunhoLote) {
        btnSalvarRascunhoLote.addEventListener('click', (e) => {
            e.preventDefault();
            // A 'acao' aqui é 'salvarRascunho', que o backend vai entender como RASCUNHO
            handleFormSubmitLote('salvarRascunho', e.currentTarget);
        });
    }

    // Listener para o NOVO botão de "Salvar e Enviar"
    if (btnSalvarEEnviarLote) {
        btnSalvarEEnviarLote.addEventListener('click', (e) => {
            e.preventDefault();
            // A 'acao' aqui é 'enviar', que o backend vai entender como PENDENTE_COORDENADOR
            handleFormSubmitLote('enviar', e.currentTarget);
        });
    }

    const lpuSearchInputLote = document.getElementById('lpuSearchInputLote');
    if (lpuSearchInputLote) {
        lpuSearchInputLote.addEventListener('input', (e) => {
            const termoBusca = e.target.value.toLowerCase();
            const todosOsCheckboxes = lpuChecklistContainerLote.querySelectorAll('.form-check');

            todosOsCheckboxes.forEach(checkDiv => {
                const label = checkDiv.querySelector('label');
                if (label) {
                    const textoLabel = label.textContent.toLowerCase();
                    if (textoLabel.includes(termoBusca)) {
                        checkDiv.style.display = ''; // Mostra o item
                    } else {
                        checkDiv.style.display = 'none'; // Esconde o item
                    }
                }
            });
        });
    }
});