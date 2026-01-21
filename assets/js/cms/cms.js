document.addEventListener('DOMContentLoaded', () => {
    // ==========================================================
    // CONFIGURAÇÕES E CONSTANTES
    // ==========================================================
    const API_BASE_URL = 'http://localhost:8081';      // Microsserviço de Materiais (Backend Novo)
    const API_MONOLITO_URL = 'https://www.inproutservices.com.br/api';  // Monólito (Backend Antigo)

    // --- Seletores de Elementos Principais ---
    const containerMateriais = document.getElementById('materiais-container');
    const loaderMateriais = document.getElementById('loader-materiais');
    const btnNovoMaterial = document.getElementById('btnNovoMaterial');

    // Seletores de Seleção em Lote e Barra Flutuante
    const checkSelecionarTodos = document.getElementById('checkSelecionarTodos');
    const floatingActionBar = document.getElementById('floatingActionBar');
    const fabCount = floatingActionBar ? floatingActionBar.querySelector('.fab-count') : null;
    const btnCancelarSelecao = document.getElementById('btnCancelarSelecao');
    const btnExcluirLote = document.getElementById('btnExcluirLote');
    const btnSolicitarLote = document.getElementById('btnSolicitarMaterialLote'); // Botão do Carrinho

    // Seletores do Modal de Solicitação (Carrinho)
    const modalSolicitarLoteEl = document.getElementById('modalSolicitarLote');
    const modalSolicitarLote = modalSolicitarLoteEl ? new bootstrap.Modal(modalSolicitarLoteEl) : null;
    const formSolicitarLote = document.getElementById('formSolicitarLote');

    // Selects com Choices.js (Busca)
    const selectOsEl = document.getElementById('solicitacaoOs');
    const selectLpuEl = document.getElementById('solicitacaoLpu');
    let choicesOs = null;
    let choicesLpu = null;

    const tbodyItensSolicitacao = document.getElementById('tbodyItensSolicitacao');
    const btnConfirmarSolicitacao = document.getElementById('btnConfirmarSolicitacao');

    // Seletores do Modal de Detalhes
    const modalDetalhesEl = document.getElementById('modalDetalhesMaterial');
    const modalDetalhes = modalDetalhesEl ? new bootstrap.Modal(modalDetalhesEl) : null;
    const formEditarMaterial = document.getElementById('formEditarMaterial');
    const editMaterialIdInput = document.getElementById('editMaterialId');
    const btnEditarMaterialModal = document.getElementById('btnEditarMaterialModal');
    const btnSalvarEdicaoMaterial = document.getElementById('btnSalvarEdicaoMaterial');
    const btnCancelarEdicao = document.getElementById('btnCancelarEdicao');
    const viewModeFields = document.getElementById('view-mode-fields');
    const editModeFields = document.getElementById('edit-mode-fields');
    const footerActionsRightEl = document.getElementById('footer-actions-right');
    const footerActionsView = footerActionsRightEl ? footerActionsRightEl.querySelectorAll('.btn-view-mode') : [];
    const footerActionsEdit = footerActionsRightEl ? footerActionsRightEl.querySelectorAll('.btn-edit-mode') : [];
    const footerActionsLeft = document.getElementById('footer-actions-left');
    const materialTab = document.getElementById('materialTab');
    const tbodyHistoricoEntradas = document.getElementById('tbody-historico-entradas');

    // Seletores do Modal Novo Material
    const modalMaterialEl = document.getElementById('modalMaterial');
    const modalMaterial = modalMaterialEl ? new bootstrap.Modal(modalMaterialEl) : null;
    const formMaterial = document.getElementById('formMaterial');

    // Seletores do Modal Nova Entrada
    const modalNovaEntradaEl = document.getElementById('modalNovaEntrada');
    const modalNovaEntrada = modalNovaEntradaEl ? new bootstrap.Modal(modalNovaEntradaEl) : null;
    const formNovaEntrada = document.getElementById('formNovaEntrada');
    const entradaMaterialIdInput = document.getElementById('entradaMaterialId');

    // Seletores do Modal Excluir
    const modalExcluirEl = document.getElementById('modalExcluir');
    const modalExcluir = modalExcluirEl ? new bootstrap.Modal(modalExcluirEl) : null;
    const nomeMaterialExcluirSpan = document.getElementById('nomeMaterialExcluir');
    const btnConfirmarExclusao = document.getElementById('btnConfirmarExclusao');

    // Seletores de Filtros
    const inputBuscaMaterial = document.getElementById('inputBuscaMaterial');
    const selectCondicaoFiltro = document.getElementById('materiais_selectCondicaoFiltro');
    const inputValorFiltro = document.getElementById('materiais_inputValorFiltro');
    const btnAplicarFiltro = document.getElementById('materiais_btnAplicarFiltro');
    const btnLimparFiltro = document.getElementById('materiais_btnLimparFiltro');
    const checkUnitPC = document.getElementById('materiais_checkUnitPC');
    const checkUnitMT = document.getElementById('materiais_checkUnitMT');

    // Seletores de Importação
    const importContainer = document.getElementById('importar-materiais-container');
    const btnBaixarTemplate = document.getElementById('btnBaixarTemplateMaterial');
    const btnImportarLegado = document.getElementById('btnImportarLegadoMaterial');
    const importLegadoInput = document.getElementById('import-legado-material-input');
    const modalProgressoEl = document.getElementById('modalProgressoImportacao');
    const modalProgresso = modalProgressoEl ? new bootstrap.Modal(modalProgressoEl) : null;
    const textoProgresso = document.getElementById('textoProgressoImportacao');
    const barraProgresso = document.getElementById('barraProgressoImportacao');
    const avisosContainer = document.getElementById('avisosImportacaoContainer');
    const listaAvisos = document.getElementById('listaAvisosImportacao');
    const btnFecharProgresso = document.getElementById('btnFecharProgresso');

    // Estado da Aplicação
    let todosOsMateriais = [];
    let materiaisFiltradosCache = [];
    let idsSelecionados = new Set();
    let itensNoCarrinho = []; // Cache temporário para o modal de solicitação
    let paginaAtual = 1;
    let linhasPorPagina = 10;

    // Permissões
    const userRole = (localStorage.getItem("role") || "").trim().toUpperCase();
    const rolesComAcessoTotal = ['ADMIN', 'CONTROLLER'];
    const temAcessoTotal = rolesComAcessoTotal.includes(userRole);

    const formatarMoeda = (valor) => {
        if (typeof valor !== 'number') return 'R$ 0,00';
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
    };

    function setupRoleBasedUI_CMA() {
        // 1. Configuração da Importação (já existente)
        if (importContainer) {
            importContainer.classList.toggle('d-none', !temAcessoTotal);
            importContainer.classList.toggle('d-flex', temAcessoTotal);
        }

        // 2. NOVO: Ocultar botão de Novo Material se não tiver acesso total
        if (btnNovoMaterial) {
            // Se tem acesso total, mostra (display: flex), senão esconde (none)
            btnNovoMaterial.style.display = temAcessoTotal ? 'flex' : 'none';
        }
    }

    // ==========================================================
    // INICIALIZAÇÃO CHOICES.JS (SEARCHABLE SELECTS)
    // ==========================================================
    function initChoices() {
        if (selectOsEl && !choicesOs) {
            choicesOs = new Choices(selectOsEl, {
                searchEnabled: true,
                itemSelectText: '',
                placeholder: true,
                placeholderValue: 'Selecione a OS...',
                noResultsText: 'Nenhuma OS encontrada',
                searchPlaceholderValue: 'Digite o número ou nome...'
            });
        }
        if (selectLpuEl && !choicesLpu) {
            choicesLpu = new Choices(selectLpuEl, {
                searchEnabled: true,
                itemSelectText: '',
                placeholder: true,
                placeholderValue: 'Aguardando OS...',
                noResultsText: 'Nenhum item encontrado',
                searchPlaceholderValue: 'Digite o nome ou objeto...'
            });
        }
    }

    // ==========================================================
    // LÓGICA DE CARREGAMENTO E RENDERIZAÇÃO
    // ==========================================================

    async function carregarMateriais() {
        if (loaderMateriais) loaderMateriais.style.display = 'block';
        if (containerMateriais) containerMateriais.innerHTML = '';

        try {
            const response = await fetchComAuth(`${API_BASE_URL}/materiais`);
            if (!response.ok) throw new Error('Erro ao carregar materiais');
            todosOsMateriais = await response.json();
            todosOsMateriais.sort((a, b) => a.codigo.localeCompare(b.codigo));
            aplicarFiltrosErenderizar();
        } catch (error) {
            mostrarToast(error.message, 'error');
            if (containerMateriais) containerMateriais.innerHTML = '<p class="text-center text-danger w-100">Erro ao carregar dados.</p>';
        } finally {
            if (loaderMateriais) loaderMateriais.style.display = 'none';
        }
    }

    function aplicarFiltrosErenderizar() {
        let materiaisFiltrados = [...todosOsMateriais];

        if (inputBuscaMaterial) {
            const termoBusca = inputBuscaMaterial.value.toLowerCase().trim();
            if (termoBusca) {
                materiaisFiltrados = materiaisFiltrados.filter(material =>
                    material.codigo.toLowerCase().includes(termoBusca) ||
                    material.descricao.toLowerCase().includes(termoBusca) ||
                    (material.modelo && material.modelo.toLowerCase().includes(termoBusca))
                );
            }
        }

        if (selectCondicaoFiltro && inputValorFiltro) {
            const condicao = selectCondicaoFiltro.value;
            const valor = parseFloat(inputValorFiltro.value);
            if (!isNaN(valor)) {
                materiaisFiltrados = materiaisFiltrados.filter(material => {
                    const saldo = material.saldoFisico;
                    if (condicao === 'maior') return saldo > valor;
                    if (condicao === 'menor') return saldo < valor;
                    if (condicao === 'igual') return saldo === valor;
                    return true;
                });
            }
        }

        if (checkUnitPC && checkUnitMT) {
            const unidadesSelecionadas = [];
            if (checkUnitPC.checked) unidadesSelecionadas.push('PÇ');
            if (checkUnitMT.checked) unidadesSelecionadas.push('MT');
            if (unidadesSelecionadas.length > 0) {
                materiaisFiltrados = materiaisFiltrados.filter(material =>
                    unidadesSelecionadas.includes(material.unidadeMedida)
                );
            }
        }

        materiaisFiltradosCache = materiaisFiltrados;
        paginaAtual = 1;
        renderizarPagina();
        atualizarCheckSelecionarTodos();
    }

    function renderizarPagina() {
        const paginationInfo = document.getElementById('pagination-info');
        const materiais = materiaisFiltradosCache;

        if (materiais.length === 0) {
            renderizarCards([]);
            if (paginationInfo) paginationInfo.textContent = 'Mostrando 0 de 0 itens';
            atualizarBotoesPaginacao(1);
            return;
        }

        const totalItens = materiais.length;
        const totalPaginas = linhasPorPagina === 'all' ? 1 : Math.ceil(totalItens / linhasPorPagina);
        paginaAtual = Math.max(1, Math.min(paginaAtual, totalPaginas));

        const inicio = linhasPorPagina === 'all' ? 0 : (paginaAtual - 1) * linhasPorPagina;
        const fim = linhasPorPagina === 'all' ? totalItens : inicio + linhasPorPagina;
        const itensDaPagina = materiais.slice(inicio, fim);

        renderizarCards(itensDaPagina);
        if (paginationInfo) paginationInfo.textContent = `Página ${paginaAtual} de ${totalPaginas} (${totalItens} itens)`;
        atualizarBotoesPaginacao(totalPaginas);
    }

    function renderizarCards(listaMateriais) {
        if (!containerMateriais) return;
        containerMateriais.innerHTML = '';

        if (!listaMateriais || listaMateriais.length === 0) {
            containerMateriais.innerHTML = '<div class="col-12 text-center py-5"><i class="bi bi-box2 text-muted" style="font-size: 3rem;"></i><p class="text-muted mt-2">Nenhum material encontrado.</p></div>';
            return;
        }

        listaMateriais.forEach(material => {
            let classeSaldo = 'saldo-ok';
            if (material.saldoFisico == 0) classeSaldo = 'saldo-zerado';
            else if (material.saldoFisico < 10) classeSaldo = 'saldo-baixo';

            const custoFormatado = formatarMoeda(material.custoMedioPonderado || 0);
            const isSelected = idsSelecionados.has(String(material.id));
            const selectedClass = isSelected ? 'selected' : '';
            const checkedAttr = isSelected ? 'checked' : '';

            const empresa = material.empresa || 'N/A';
            const empresaClass = empresa === 'INPROUT' ? 'empresa-inprout' : 'empresa-cliente';

            // --- LÓGICA DE PERMISSÃO DOS BOTÕES ---
            // Se temAcessoTotal (Admin/Controller), gera o HTML do botão.
            // Se for Manager (false), gera uma string vazia.

            const btnEntradaHtml = temAcessoTotal
                ? `<button class="btn-card entry btn-acao" data-acao="entrada" data-id="${material.id}" title="Adicionar Estoque">
                     <i class="bi bi-plus-circle-fill"></i> Entrada
                   </button>`
                : '';

            const btnExcluirHtml = temAcessoTotal
                ? `<button class="btn-card delete btn-acao" data-acao="excluir" data-id="${material.id}" data-descricao="${material.descricao}" title="Excluir">
                     <i class="bi bi-trash"></i>
                   </button>`
                : '';

            // Ícone do botão de detalhes muda visualmente para "olho" se for apenas leitura (opcional, mas recomendado)
            const iconeDetalhes = temAcessoTotal ? 'bi-pencil-square' : 'bi-eye';
            const tituloDetalhes = temAcessoTotal ? 'Editar' : 'Visualizar';

            const cardHTML = `
                <div class="material-card ${selectedClass}" data-id="${material.id}">
                    <div class="card-check-wrapper">
                        <input class="form-check-input card-check-input" type="checkbox" value="${material.id}" ${checkedAttr}>
                    </div>

                    <div class="card-header">
                        <span class="material-code" title="Código">${material.codigo}</span>
                        <span class="empresa-badge ${empresaClass}">${empresa}</span>
                        <span class="material-unit">${material.unidadeMedida}</span>
                    </div>
                    
                    <div class="card-body">
                        <h3 class="material-title" title="${material.descricao}">${material.descricao}</h3>
                        
                        <div class="card-stats">
                            <div class="stat-item">
                                <span class="stat-label">Saldo</span>
                                <span class="stat-value ${classeSaldo}">${material.saldoFisico}</span>
                            </div>
                            <div class="stat-item text-end">
                                <span class="stat-label">Custo Médio</span>
                                <span class="stat-value" style="color: #666; font-size: 1rem;">${custoFormatado}</span>
                            </div>
                        </div>
                    </div>

                    <div class="card-actions">
                        ${btnEntradaHtml} 
                        
                        <button class="btn-card details btn-acao" data-acao="detalhes" data-id="${material.id}" title="${tituloDetalhes}">
                            <i class="bi ${iconeDetalhes}"></i>
                        </button>
                        
                        ${btnExcluirHtml}
                    </div>
                </div>
            `;

            containerMateriais.insertAdjacentHTML('beforeend', cardHTML);
        });
    }

    // ==========================================================
    // LÓGICA DE SELEÇÃO EM LOTE & BARRA FLUTUANTE
    // ==========================================================

    function atualizarUISelecao() {
        const count = idsSelecionados.size;
        if (fabCount) fabCount.textContent = `${count} selecionado(s)`;

        if (count > 0 && floatingActionBar) {
            floatingActionBar.classList.add('visible');
        } else if (floatingActionBar) {
            floatingActionBar.classList.remove('visible');
        }
        atualizarCheckSelecionarTodos();
    }

    function atualizarCheckSelecionarTodos() {
        if (!checkSelecionarTodos) return;
        const totalVisivel = materiaisFiltradosCache.length;
        if (totalVisivel === 0) {
            checkSelecionarTodos.checked = false;
            return;
        }
        const todosSelecionados = materiaisFiltradosCache.every(m => idsSelecionados.has(String(m.id)));
        checkSelecionarTodos.checked = todosSelecionados;
    }

    if (checkSelecionarTodos) {
        checkSelecionarTodos.addEventListener('change', (e) => {
            const isChecked = e.target.checked;
            materiaisFiltradosCache.forEach(m => {
                if (isChecked) idsSelecionados.add(String(m.id));
                else idsSelecionados.delete(String(m.id));
            });
            renderizarPagina();
            atualizarUISelecao();
        });
    }

    if (btnCancelarSelecao) {
        btnCancelarSelecao.addEventListener('click', () => {
            idsSelecionados.clear();
            renderizarPagina();
            atualizarUISelecao();
        });
    }

    // ==========================================================
    // SOLICITAÇÃO EM LOTE (CARRINHO)
    // ==========================================================

    if (btnSolicitarLote) {
        btnSolicitarLote.addEventListener('click', async () => {
            if (idsSelecionados.size === 0) return;

            itensNoCarrinho = todosOsMateriais.filter(m => idsSelecionados.has(String(m.id)));
            renderizarTabelaModalSolicitacao();

            if (modalSolicitarLote) modalSolicitarLote.show();

            // Inicia os Choices se ainda não foram iniciados
            initChoices();

            // Limpa opções anteriores
            choicesOs.clearStore();
            choicesOs.setChoices([{ value: '', label: 'Carregando OSs...', disabled: true, selected: true }], 'value', 'label', true);
            choicesOs.disable();

            await carregarOSsParaSelect();

            choicesOs.enable();
        });
    }

    function renderizarTabelaModalSolicitacao() {
        if (!tbodyItensSolicitacao) return;
        tbodyItensSolicitacao.innerHTML = '';

        if (itensNoCarrinho.length === 0) {
            tbodyItensSolicitacao.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Nenhum item selecionado.</td></tr>';
            return;
        }

        itensNoCarrinho.forEach((material, index) => {
            const tr = document.createElement('tr');

            // Verifica se já não tem saldo (estoque <= 0)
            const semSaldo = material.saldoFisico <= 0;
            const classeSaldo = semSaldo ? 'text-danger fw-bold' : '';
            const textoSaldo = semSaldo ? `${material.saldoFisico} (Indisponível)` : material.saldoFisico;

            tr.innerHTML = `
            <td>
                <div class="fw-bold text-dark">${material.descricao}</div>
                <small class="text-muted">${material.codigo}</small>
            </td>
            <td><span class="badge bg-light text-dark border">${material.unidadeMedida}</span></td>
            <td class="${classeSaldo}">${textoSaldo}</td>
            <td>
                <input type="number" class="form-control form-control-sm input-qtd-solicitacao" 
                       data-index="${index}" 
                       data-saldo="${material.saldoFisico}"
                       min="0.01" step="0.01" value="1" required>
                <div class="invalid-feedback" style="font-size: 0.75rem;">Saldo insuficiente (ficará negativo)</div>
            </td>
            <td class="text-end">
                <button type="button" class="btn btn-sm btn-outline-danger btn-remover-item-carrinho" data-index="${index}" title="Remover">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        `;
            tbodyItensSolicitacao.appendChild(tr);
        });

        // Adiciona listener para mostrar alerta visual em tempo real
        document.querySelectorAll('.input-qtd-solicitacao').forEach(input => {
            input.addEventListener('input', (e) => {
                const qtd = parseFloat(e.target.value);
                const saldo = parseFloat(e.target.dataset.saldo);
                if (qtd > saldo) {
                    e.target.classList.add('is-invalid'); // Borda vermelha e mostra msg
                    e.target.classList.add('text-danger');
                } else {
                    e.target.classList.remove('is-invalid');
                    e.target.classList.remove('text-danger');
                }
            });
            // Dispara uma vez para validar o valor inicial (1)
            input.dispatchEvent(new Event('input'));
        });

        document.querySelectorAll('.btn-remover-item-carrinho').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.currentTarget.dataset.index);
                const materialRemovido = itensNoCarrinho[idx];
                idsSelecionados.delete(String(materialRemovido.id));

                itensNoCarrinho.splice(idx, 1);

                renderizarTabelaModalSolicitacao();
                renderizarPagina();
                atualizarUISelecao();

                if (itensNoCarrinho.length === 0) {
                    if (modalSolicitarLote) modalSolicitarLote.hide();
                    mostrarToast('Solicitação cancelada: todos os itens foram removidos.', 'warning');
                }
            });
        });
    }

    // --- CARREGAMENTO DA OS (Atualizado com Choices.js e Formatação) ---
    async function carregarOSsParaSelect() {
        try {
            let usuarioId = localStorage.getItem('usuarioId');
            if (!usuarioId) {
                try {
                    const usuarioLogado = JSON.parse(localStorage.getItem('usuario'));
                    if (usuarioLogado && usuarioLogado.id) usuarioId = usuarioLogado.id;
                } catch (e) {
                    console.warn('Não foi possível ler objeto usuario, usando fallback.');
                }
            }

            let url = `${API_MONOLITO_URL}/os/export/completo`;
            if (usuarioId) {
                url = `${API_MONOLITO_URL}/os/por-usuario/${usuarioId}`;
            }

            const response = await fetchComAuth(url);
            if (!response.ok) throw new Error('Falha ao buscar OSs');

            const listaOS = await response.json();

            // Formatação para o Choices.js
            const opcoes = listaOS.map(os => {
                // Busca número da OS
                const numeroOS = os.numero || os.os || os.numeroOS || os.codOs || os.codigo || os.id;
                const nomeProjeto = os.projeto || (os.segmento ? os.segmento.nome : '') || 'Sem Descrição';

                // Formato: "Número da OS - Projeto"
                const label = `${numeroOS} - ${nomeProjeto}`;

                return { value: os.id, label: label };
            });

            // Atualiza o Choices da OS
            choicesOs.clearStore();
            choicesOs.setChoices(opcoes, 'value', 'label', true);

            // Reseta o LPU
            choicesLpu.clearStore();
            choicesLpu.setChoices([{ value: '', label: 'Selecione uma OS primeiro', disabled: true, selected: true }], 'value', 'label', true);
            choicesLpu.disable();

        } catch (error) {
            console.error(error);
            choicesOs.setChoices([{ value: '', label: 'Erro ao carregar', disabled: true }], 'value', 'label', true);
            mostrarToast('Não foi possível carregar as Ordens de Serviço.', 'error');
        }
    }

    // --- CARREGAMENTO DE LPU (Atualizado com Choices.js e Formatação) ---
    if (selectOsEl) {
        selectOsEl.addEventListener('change', async (e) => {
            const osId = e.target.value;
            if (!choicesLpu) return;

            // Estado de carregamento
            choicesLpu.clearStore();
            choicesLpu.setChoices([{ value: '', label: 'Carregando itens...', disabled: true, selected: true }], 'value', 'label', true);
            choicesLpu.disable();

            if (!osId) {
                choicesLpu.setChoices([{ value: '', label: 'Selecione uma OS', disabled: true, selected: true }], 'value', 'label', true);
                return;
            }

            try {
                const response = await fetchComAuth(`${API_MONOLITO_URL}/os/${osId}/lpus`);

                if (response.status === 404) {
                    choicesLpu.clearStore();
                    choicesLpu.setChoices([{ value: '0', label: 'Geral / Sem Item LPU' }], 'value', 'label', true);
                    choicesLpu.enable();
                    return;
                }

                if (!response.ok) throw new Error('Falha ao buscar itens da LPU');

                const listaLpu = await response.json();

                const opcoesLpu = listaLpu.map(item => {
                    // Nome da LPU
                    const nome = item.nome || item.nomeLpu || item.codigo || 'Item LPU';
                    // Objeto Contratado
                    const objeto = item.objeto || item.descricao || item.itemLpuDescricao || '';

                    // Formato Solicitado: "Nome LPU - Objeto Contratado"
                    let label = nome;
                    if (objeto && objeto.trim() !== '-' && objeto.trim() !== '') {
                        label = `${nome} - ${objeto}`;
                    }

                    return { value: item.id, label: label };
                });

                choicesLpu.clearStore();
                choicesLpu.setChoices(opcoesLpu, 'value', 'label', true);
                choicesLpu.enable();

            } catch (error) {
                console.error(error);
                choicesLpu.setChoices([{ value: '', label: 'Erro ao carregar itens', disabled: true }], 'value', 'label', true);
            }
        });
    }

    if (formSolicitarLote) {
        if (formSolicitarLote) {
            formSolicitarLote.addEventListener('submit', async (e) => {
                e.preventDefault();

                if (!btnConfirmarSolicitacao) return;
                const originalBtnText = btnConfirmarSolicitacao.innerHTML;
                btnConfirmarSolicitacao.disabled = true;
                btnConfirmarSolicitacao.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Processando...`;

                const inputsQtd = document.querySelectorAll('.input-qtd-solicitacao');
                const itensPayload = [];
                let erroValidacao = false;

                inputsQtd.forEach(input => {
                    const index = input.dataset.index;
                    const material = itensNoCarrinho[index];
                    const qtd = parseFloat(input.value);

                    if (!qtd || qtd <= 0) {
                        mostrarToast(`Quantidade inválida para o material: ${material.codigo}`, 'warning');
                        erroValidacao = true;
                        return;
                    }
                    // REMOVIDA A TRAVA DE SALDO AQUI. O usuário pode pedir (ficará negativo).

                    itensPayload.push({
                        materialId: material.id,
                        quantidade: qtd
                    });
                });

                if (erroValidacao) {
                    btnConfirmarSolicitacao.disabled = false;
                    btnConfirmarSolicitacao.innerHTML = originalBtnText;
                    return;
                }

                // --- CORREÇÃO DO ID DO USUÁRIO ---
                let solicitanteId = null;

                // 1. Tenta buscar se existe um ID salvo isoladamente (comum em alguns sistemas)
                const idIsolado = localStorage.getItem('usuarioId') || localStorage.getItem('idUsuario') || localStorage.getItem('id');
                if (idIsolado) {
                    solicitanteId = parseInt(idIsolado);
                }

                // 2. Se não achou, tenta ler o objeto 'usuario' com segurança
                if (!solicitanteId) {
                    try {
                        const usuarioStr = localStorage.getItem('usuario');
                        console.log("Conteúdo do localStorage 'usuario':", usuarioStr);

                        // Verifica se parece um JSON (começa com { ou [) antes de tentar parsear
                        if (usuarioStr && (usuarioStr.trim().startsWith('{') || usuarioStr.trim().startsWith('['))) {
                            const usuarioLogado = JSON.parse(usuarioStr);
                            if (usuarioLogado.id) {
                                solicitanteId = usuarioLogado.id;
                            }
                        } else {
                            console.warn("A chave 'usuario' não contém um JSON, contém apenas texto. Tentando usar id padrão 1 para teste.");
                        }
                    } catch (e) {
                        console.error('Erro ao tentar ler JSON de usuario:', e);
                    }
                }

                if (!solicitanteId) {
                    mostrarToast('Erro de Sessão: Não foi possível identificar o usuário. Faça login novamente.', 'error');
                    btnConfirmarSolicitacao.disabled = false;
                    btnConfirmarSolicitacao.innerHTML = originalBtnText;
                    return;
                }
                // ---------------------------------

                const payload = {
                    osId: parseInt(selectOsEl.value),
                    lpuItemId: parseInt(selectLpuEl.value) || null,
                    solicitanteId: solicitanteId,
                    observacoes: document.getElementById('solicitacaoObservacao').value,
                    itens: itensPayload
                };

                try {
                    // URL corrigida conforme sua estrutura de pastas (/api/materiais...)
                    const response = await fetchComAuth(`${API_BASE_URL}/api/materiais/solicitacoes/lote`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });

                    if (!response.ok) {
                        const err = await response.json();
                        throw new Error(err.message || 'Erro ao processar solicitação.');
                    }

                    mostrarToast('Solicitação realizada com sucesso!', 'success');
                    if (modalSolicitarLote) modalSolicitarLote.hide();

                    idsSelecionados.clear();
                    itensNoCarrinho = [];
                    atualizarUISelecao();
                    await carregarMateriais();

                } catch (error) {
                    console.error(error);
                    mostrarToast(error.message, 'error');
                } finally {
                    btnConfirmarSolicitacao.disabled = false;
                    btnConfirmarSolicitacao.innerHTML = originalBtnText;
                }
            });
        }
    }

    if (btnExcluirLote) {
        btnExcluirLote.addEventListener('click', async () => {
            if (idsSelecionados.size === 0) return;
            if (!confirm(`Tem certeza que deseja excluir ${idsSelecionados.size} materiais?`)) return;

            const idsParaExcluir = Array.from(idsSelecionados);
            btnExcluirLote.disabled = true;
            btnExcluirLote.innerHTML = `<span class="spinner-border spinner-border-sm"></span>`;

            try {
                const promises = idsParaExcluir.map(id =>
                    fetchComAuth(`${API_BASE_URL}/materiais/${id}`, { method: 'DELETE' })
                );

                await Promise.all(promises);
                mostrarToast('Materiais excluídos com sucesso!', 'success');
                idsSelecionados.clear();
                await carregarMateriais();
                atualizarUISelecao();

            } catch (error) {
                mostrarToast('Erro ao excluir alguns itens. Verifique se eles possuem dependências.', 'error');
                await carregarMateriais();
            } finally {
                btnExcluirLote.disabled = false;
                btnExcluirLote.innerHTML = `<i class="bi bi-trash-fill"></i>`;
            }
        });
    }

    if (containerMateriais) {
        containerMateriais.addEventListener('click', (e) => {
            const target = e.target;

            if (target.classList.contains('card-check-input')) {
                const id = target.value;
                const card = target.closest('.material-card');

                if (target.checked) {
                    idsSelecionados.add(id);
                    card.classList.add('selected');
                } else {
                    idsSelecionados.delete(id);
                    card.classList.remove('selected');
                }
                atualizarUISelecao();
                return;
            }

            const btnAcao = target.closest('.btn-acao');
            if (btnAcao) {
                const acao = btnAcao.dataset.acao;
                const id = btnAcao.dataset.id;

                if (acao === 'entrada') abrirModalNovaEntrada(id);
                else if (acao === 'detalhes') abrirModalDetalhes(id);
                else if (acao === 'excluir') {
                    const descricao = btnAcao.dataset.descricao;
                    abrirModalExcluir(id, descricao);
                }
            }
        });
    }

    function abrirModalNovaEntrada(id) {
        if (entradaMaterialIdInput) entradaMaterialIdInput.value = id;
        if (formNovaEntrada) formNovaEntrada.reset();
        if (modalNovaEntrada) modalNovaEntrada.show();
    }

    function abrirModalExcluir(id, descricao) {
        if (nomeMaterialExcluirSpan) nomeMaterialExcluirSpan.textContent = `"${descricao}"`;
        if (btnConfirmarExclusao) btnConfirmarExclusao.dataset.id = id;
        if (modalExcluir) modalExcluir.show();
    }

    function atualizarBotoesPaginacao(totalPaginas) {
        if (document.getElementById('btnPrimeiraPagina')) document.getElementById('btnPrimeiraPagina').disabled = paginaAtual <= 1;
        if (document.getElementById('btnPaginaAnterior')) document.getElementById('btnPaginaAnterior').disabled = paginaAtual <= 1;
        if (document.getElementById('btnProximaPagina')) document.getElementById('btnProximaPagina').disabled = paginaAtual >= totalPaginas;
        if (document.getElementById('btnUltimaPagina')) document.getElementById('btnUltimaPagina').disabled = paginaAtual >= totalPaginas;
    }

    function adicionarListenersPaginacao() {
        const rowsPerPageEl = document.getElementById('rowsPerPage');
        if (rowsPerPageEl) {
            rowsPerPageEl.addEventListener('change', (e) => {
                const valor = e.target.value;
                linhasPorPagina = valor === 'all' ? 'all' : parseInt(valor, 10);
                paginaAtual = 1;
                renderizarPagina();
            });
        }
        document.getElementById('btnPrimeiraPagina')?.addEventListener('click', () => { paginaAtual = 1; renderizarPagina(); });
        document.getElementById('btnPaginaAnterior')?.addEventListener('click', () => { if (paginaAtual > 1) { paginaAtual--; renderizarPagina(); } });
        document.getElementById('btnProximaPagina')?.addEventListener('click', () => {
            const total = linhasPorPagina === 'all' ? 1 : Math.ceil(materiaisFiltradosCache.length / linhasPorPagina);
            if (paginaAtual < total) { paginaAtual++; renderizarPagina(); }
        });
        document.getElementById('btnUltimaPagina')?.addEventListener('click', () => {
            const total = linhasPorPagina === 'all' ? 1 : Math.ceil(materiaisFiltradosCache.length / linhasPorPagina);
            paginaAtual = total; renderizarPagina();
        });
    }

    function alternarModoModalDetalhes(modoEdicao) {
        if (viewModeFields) viewModeFields.classList.toggle('d-none', modoEdicao);
        if (editModeFields) editModeFields.classList.toggle('d-none', !modoEdicao);
        if (materialTab) materialTab.style.display = modoEdicao ? 'none' : '';
        if (footerActionsLeft) footerActionsLeft.style.display = modoEdicao ? 'none' : 'block';
        footerActionsView.forEach(btn => btn.style.display = modoEdicao ? 'none' : 'inline-block');
        footerActionsEdit.forEach(btn => btn.style.display = modoEdicao ? 'inline-block' : 'none');
        if (modoEdicao) new bootstrap.Tab(document.getElementById('detalhes-tab')).show();
    }

    async function abrirModalDetalhes(id) {
        alternarModoModalDetalhes(false);
        try {
            const response = await fetchComAuth(`${API_BASE_URL}/materiais/${id}`);
            if (!response.ok) throw new Error('Material não encontrado');
            const material = await response.json();

            if (editMaterialIdInput) editMaterialIdInput.value = material.id;

            if (viewModeFields) {
                viewModeFields.querySelector('[data-field="codigo"]').textContent = material.codigo;
                viewModeFields.querySelector('[data-field="descricao"]').textContent = material.descricao;
                viewModeFields.querySelector('[data-field="modelo"]').textContent = material.modelo || 'N/A';
                viewModeFields.querySelector('[data-field="numeroDeSerie"]').textContent = material.numeroDeSerie || 'N/A';
                viewModeFields.querySelector('[data-field="unidadeMedida"]').textContent = material.unidadeMedida;
                viewModeFields.querySelector('[data-field="empresa"]').textContent = material.empresa;
                viewModeFields.querySelector('[data-field="saldoFisico"]').textContent = material.saldoFisico;
                viewModeFields.querySelector('[data-field="custoMedioPonderado"]').textContent = formatarMoeda(material.custoMedioPonderado);
                viewModeFields.querySelector('[data-field="custoTotal"]').textContent = formatarMoeda(material.custoTotal);
                viewModeFields.querySelector('[data-field="observacoes"]').textContent = material.observacoes || 'N/A';
            }

            if (editModeFields) {
                document.getElementById('materialCodigoEditar').value = material.codigo;
                document.getElementById('materialDescricaoEditar').value = material.descricao;
                document.getElementById('materialModeloEditar').value = material.modelo || '';
                document.getElementById('materialNumeroDeSerieEditar').value = material.numeroDeSerie || '';
                document.getElementById('materialSaldoEditar').value = material.saldoFisico;
                document.getElementById('materialObservacoesEditar').value = material.observacoes || '';
            }

            const tabHistorico = document.getElementById('historico-tab');
            const btnExcluir = modalDetalhesEl.querySelector('.btn-excluir-modal');
            const btnRegistrarEntrada = modalDetalhesEl.querySelector('.btn-registrar-entrada-modal');
            const btnEditar = modalDetalhesEl.querySelector('#btnEditarMaterialModal');

            [tabHistorico, btnExcluir, btnRegistrarEntrada, btnEditar].forEach(el => el.style.display = 'none');

            if (temAcessoTotal) {
                [tabHistorico, btnExcluir, btnRegistrarEntrada, btnEditar].forEach(el => el.style.display = 'inline-block');
            } else {
                tabHistorico.style.display = 'block';
            }

            preencherHistorico(material.entradas);

            if (btnExcluir) {
                btnExcluir.dataset.id = id;
                btnExcluir.dataset.descricao = material.descricao;
            }
            if (btnRegistrarEntrada) btnRegistrarEntrada.dataset.id = id;
            if (btnEditar) btnEditar.dataset.id = id;

            if (document.getElementById('detalhes-tab')) new bootstrap.Tab(document.getElementById('detalhes-tab')).show();
            if (modalDetalhes) modalDetalhes.show();
        } catch (error) {
            mostrarToast(error.message, 'error');
        }
    }

    function preencherHistorico(entradas) {
        if (!tbodyHistoricoEntradas) return;
        tbodyHistoricoEntradas.innerHTML = (entradas || []).map(e => `
            <tr>
                <td>${new Date(e.dataEntrada).toLocaleString('pt-BR')}</td>
                <td>${e.quantidade}</td>
                <td>${formatarMoeda(e.custoUnitario)}</td>
                <td>${e.observacoes || ''}</td>
            </tr>
        `).join('') || '<tr><td colspan="4" class="text-center">Nenhuma entrada registrada.</td></tr>';
    }

    if (modalDetalhesEl) {
        modalDetalhesEl.addEventListener('click', (e) => {
            const target = e.target;
            if (target.closest('.btn-excluir-modal')) {
                const btn = target.closest('.btn-excluir-modal');
                abrirModalExcluir(btn.dataset.id, btn.dataset.descricao);
                if (modalDetalhes) modalDetalhes.hide();
            }
            if (target.closest('.btn-registrar-entrada-modal')) {
                const btn = target.closest('.btn-registrar-entrada-modal');
                abrirModalNovaEntrada(btn.dataset.id);
                if (modalDetalhes) modalDetalhes.hide();
            }
            if (target.id === 'btnEditarMaterialModal' || target.closest('#btnEditarMaterialModal')) {
                alternarModoModalDetalhes(true);
            }
            if (target.id === 'btnCancelarEdicao' || target.closest('#btnCancelarEdicao')) {
                alternarModoModalDetalhes(false);
            }
        });
    }

    if (formMaterial) {
        formMaterial.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btnSubmit = modalMaterialEl.querySelector('button[type="submit"]');
            btnSubmit.disabled = true;
            btnSubmit.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Salvando...`;

            const materialData = {
                codigo: document.getElementById('materialCodigo').value,
                descricao: document.getElementById('materialDescricao').value,
                modelo: document.getElementById('materialModelo').value,
                numeroDeSerie: document.getElementById('materialNumeroDeSerie').value,
                unidadeMedida: document.getElementById('materialUnidade').value,
                saldoFisicoInicial: document.getElementById('materialSaldo').value,
                custoUnitarioInicial: parseFloat(document.getElementById('materialCustoUnitario').value.replace(/\./g, '').replace(',', '.')),
                observacoes: document.getElementById('materialObservacoes').value,
                empresa: document.getElementById('materialEmpresa').value
            };

            try {
                const response = await fetchComAuth(`${API_BASE_URL}/materiais`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(materialData)
                });
                if (!response.ok) throw new Error((await response.json()).message);
                mostrarToast('Material criado com sucesso!', 'success');
                if (modalMaterial) modalMaterial.hide();
                await carregarMateriais();
            } catch (error) {
                mostrarToast(error.message, 'error');
            } finally {
                btnSubmit.disabled = false;
                btnSubmit.innerHTML = "Salvar";
            }
        });
    }

    if (formEditarMaterial) {
        formEditarMaterial.addEventListener('submit', async (e) => {
            e.preventDefault();
            const materialId = editMaterialIdInput.value;
            if (!materialId) return;

            btnSalvarEdicaoMaterial.disabled = true;
            btnSalvarEdicaoMaterial.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Salvando...`;

            const payload = {
                codigo: document.getElementById('materialCodigoEditar').value,
                descricao: document.getElementById('materialDescricaoEditar').value,
                modelo: document.getElementById('materialModeloEditar').value,
                numeroDeSerie: document.getElementById('materialNumeroDeSerieEditar').value,
                observacoes: document.getElementById('materialObservacoesEditar').value,
                saldoFisico: parseFloat(document.getElementById('materialSaldoEditar').value.replace(/\./g, '').replace(',', '.')) || 0
            };

            try {
                const response = await fetchComAuth(`${API_BASE_URL}/materiais/${materialId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) throw new Error((await response.json()).message || 'Erro ao salvar.');
                mostrarToast('Material atualizado com sucesso!', 'success');
                if (modalDetalhes) modalDetalhes.hide();
                await carregarMateriais();
            } catch (error) {
                mostrarToast(error.message, 'error');
            } finally {
                btnSalvarEdicaoMaterial.disabled = false;
                btnSalvarEdicaoMaterial.innerHTML = '<i class="bi bi-check-circle"></i> Salvar Alterações';
                alternarModoModalDetalhes(false);
            }
        });
    }

    if (formNovaEntrada) {
        formNovaEntrada.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btnSubmit = document.getElementById('btnSalvarEntrada');
            btnSubmit.disabled = true;
            btnSubmit.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Salvando...`;

            const entradaData = {
                materialId: entradaMaterialIdInput.value,
                quantidade: document.getElementById('entradaQuantidade').value,
                custoUnitario: parseFloat(document.getElementById('entradaCustoUnitario').value.replace(/\./g, '').replace(',', '.')),
                observacoes: document.getElementById('entradaObservacoes').value
            };

            try {
                const response = await fetchComAuth(`${API_BASE_URL}/materiais/entradas`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(entradaData)
                });
                if (!response.ok) throw new Error((await response.json()).message);
                mostrarToast('Entrada registrada com sucesso!', 'success');
                if (modalNovaEntrada) modalNovaEntrada.hide();
                await carregarMateriais();
            } catch (error) {
                mostrarToast(error.message, 'error');
            } finally {
                btnSubmit.disabled = false;
                btnSubmit.innerHTML = "Salvar Entrada";
            }
        });
    }

    if (btnConfirmarExclusao) {
        btnConfirmarExclusao.addEventListener('click', async () => {
            const id = btnConfirmarExclusao.dataset.id;
            if (!id) return;

            btnConfirmarExclusao.disabled = true;
            btnConfirmarExclusao.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Excluindo...`;

            try {
                const response = await fetchComAuth(`${API_BASE_URL}/materiais/${id}`, { method: 'DELETE' });
                if (!response.ok) throw new Error((await response.json()).message || 'Erro ao excluir.');
                mostrarToast('Material excluído com sucesso!', 'success');
                if (modalExcluir) modalExcluir.hide();
                await carregarMateriais();
            } catch (error) {
                mostrarToast(error.message, 'error');
                if (modalExcluir) modalExcluir.hide();
            } finally {
                btnConfirmarExclusao.disabled = false;
                btnConfirmarExclusao.innerHTML = "Sim, Excluir";
            }
        });
    }

    if (inputBuscaMaterial) inputBuscaMaterial.addEventListener('input', aplicarFiltrosErenderizar);
    if (btnAplicarFiltro) btnAplicarFiltro.addEventListener('click', aplicarFiltrosErenderizar);
    if (btnLimparFiltro) {
        btnLimparFiltro.addEventListener('click', () => {
            selectCondicaoFiltro.selectedIndex = 0;
            inputValorFiltro.value = '';
            checkUnitPC.checked = false;
            checkUnitMT.checked = false;
            aplicarFiltrosErenderizar();
        });
    }

    if (btnBaixarTemplate) {
        btnBaixarTemplate.addEventListener('click', () => {
            const headers = ["ESTOQUE", "CÓDIGO", "DESCRIÇÃO", "MODELO", "Nº DE SÉRIE", "UNIDADE", "SALDO FISICO", "CUSTO UNITÁRIO"];
            const ws = XLSX.utils.aoa_to_sheet([headers]);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Modelo");
            XLSX.writeFile(wb, "modelo_importacao.xlsx");
        });
    }

    if (btnImportarLegado && importLegadoInput) {
        btnImportarLegado.addEventListener('click', () => importLegadoInput.click());
        importLegadoInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file || !modalProgresso) return;

            textoProgresso.textContent = 'Enviando arquivo...';
            barraProgresso.style.width = '25%';
            avisosContainer.classList.add('d-none');
            listaAvisos.innerHTML = '';
            btnFecharProgresso.disabled = true;
            modalProgresso.show();

            const formData = new FormData();
            formData.append('file', file);

            try {
                const response = await fetchComAuth(`${API_BASE_URL}/materiais/importar-legado`, { method: 'POST', body: formData });
                barraProgresso.style.width = '100%';

                const result = await response.json();
                if (!response.ok) throw new Error(result.message);

                textoProgresso.textContent = 'Importação concluída!';
                if (result.log && result.log.length > 0) {
                    avisosContainer.classList.remove('d-none');
                    listaAvisos.innerHTML = result.log.map(i => `<li class="list-group-item">${i}</li>`).join('');
                }
                await carregarMateriais();
            } catch (error) {
                textoProgresso.textContent = 'Erro na importação!';
                avisosContainer.classList.remove('d-none');
                listaAvisos.innerHTML = `<li class="list-group-item list-group-item-danger">${error.message}</li>`;
            } finally {
                btnFecharProgresso.disabled = false;
                importLegadoInput.value = '';
            }
        });
    }

    setupRoleBasedUI_CMA();
    adicionarListenersPaginacao();
    carregarMateriais();
});