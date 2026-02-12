document.addEventListener('DOMContentLoaded', () => {
    // --- CONFIGURAÇÃO E ELEMENTOS DO DOM ---
    const API_URL = 'http://localhost:8080';
    const TOKEN = localStorage.getItem('token');

    const kpiTotalValueEl = document.getElementById('kpi-total-value');
    const segmentGridContainer = document.getElementById('segment-grid-container');
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');
    const filterBtn = document.getElementById('btn-filter');
    const tableTabs = document.getElementById('table-tabs');
    const tableHead = document.getElementById('table-head');
    const modalAlterarValorEl = document.getElementById('modalAlterarValor');
    const modalAlterarValor = new bootstrap.Modal(modalAlterarValorEl);
    const tableBody = document.getElementById('table-body');
    const segmentSelectFilter = document.getElementById('segment-select-filter');
    
    // NOVO: Elementos do filtro de prestador
    const prestadorSelectFilter = document.getElementById('prestador-select-filter');
    let choicesPrestador = null;

    const modalAdiantamentoEl = document.getElementById('modalAdiantamento');
    const modalAdiantamento = new bootstrap.Modal(modalAdiantamentoEl);

    // Elementos da funcionalidade de importação
    const importContainer = document.getElementById('import-container');
    const btnImportarLegado = document.getElementById('btn-importar-legado');
    const importLegadoInput = document.getElementById('import-legado-input');
    const modalProgressoEl = document.getElementById('modalProgressoImportacao');
    const modalProgresso = new bootstrap.Modal(modalProgressoEl);
    const textoProgresso = document.getElementById('textoProgressoImportacao');
    const barraProgresso = document.getElementById('barraProgressoImportacao');
    const avisosContainer = document.getElementById('avisosImportacaoContainer');
    const listaAvisos = document.getElementById('listaAvisosImportacao');
    const btnFecharProgresso = document.getElementById('btnFecharProgresso');


    window.fullData = {};
    let currentTableView = 'prestadores';

    // --- FUNÇÕES DE RENDERIZAÇÃO ---
    function formatDateToISO(dateStr) {
        const [dia, mes, ano] = dateStr.split('/');
        return `${ano}-${mes}-${dia}`;
    }

    flatpickr("#startDate", {
        dateFormat: "d/m/Y",
        locale: "pt"
    });
    flatpickr("#endDate", {
        dateFormat: "d/m/Y",
        locale: "pt"
    });

    function toggleLoader(ativo = true) {
        const overlay = document.getElementById("overlay-loader");
        if (overlay) {
            overlay.classList.toggle("d-none", !ativo);
        }
    }

    function renderSegmentCards(segmentos) {
        segmentGridContainer.innerHTML = '';
        if (segmentos && segmentos.length > 0) {
            const segmentIcons = {
                'corporativo': 'bi-building', 'decomm': 'bi-tools', 'e2e': 'bi-diagram-3',
                'lojas tim': 'bi-shop', 'mw': 'bi-broadcast-pin', 'rede externa b2b': 'bi-hdd-network',
                'tim celular': 'bi-phone', 'tim celular - ihs': 'bi-phone-vibrate'
            };
            segmentos.forEach(seg => {
                const iconClass = segmentIcons[seg.segmentoNome.toLowerCase()] || 'bi-bar-chart-steps';
                segmentGridContainer.innerHTML += `
                    <div class="segment-card">
                        <i class="bi ${iconClass}"></i><br>${seg.segmentoNome}<br>
                        <span>${formatCurrency(seg.valorTotal)}</span>
                    </div>`;
            });
        } else {
            segmentGridContainer.innerHTML = '<p class="text-muted w-100 text-center">Nenhum valor por segmento no período.</p>';
        }
    }

    function renderSegmentFilter(segmentos) {
        // Guarda o valor atual se houver
        const valorAtual = segmentSelectFilter.value;
        
        segmentSelectFilter.innerHTML = '<option value="todos" selected>Todos os Segmentos</option>';
        if (segmentos) {
            const nomesSegmentos = new Set(segmentos.map(s => s.segmentoNome));
            nomesSegmentos.forEach(nome => {
                segmentSelectFilter.innerHTML += `<option value="${nome}">${nome}</option>`;
            });
        }
        
        // Restaura valor se ainda existir na lista
        if (valorAtual && valorAtual !== 'todos') {
             const optionExists = Array.from(segmentSelectFilter.options).some(o => o.value === valorAtual);
             if (optionExists) segmentSelectFilter.value = valorAtual;
        }
    }

    // --- NOVA FUNÇÃO: Inicializar Filtro de Prestador ---
    async function initPrestadorFilter() {
        if (!prestadorSelectFilter) return;

        try {
            const response = await fetchComAuth(`${API_URL}/index/prestadores`, { 
                headers: { 'Authorization': `Bearer ${TOKEN}` } 
            });
            
            if (response.ok) {
                const prestadores = await response.json();
                
                // Limpa e adiciona opção padrão
                prestadorSelectFilter.innerHTML = '<option value="todos" selected>Todos os Prestadores</option>';
                
                prestadores.forEach(p => {
                    const label = p.codigoPrestador ? `${p.codigoPrestador} - ${p.prestador}` : p.prestador;
                    // Usamos o nome do prestador no value para bater com l.prestador dos dados
                    prestadorSelectFilter.add(new Option(label, p.prestador)); 
                });

                // Inicializa o Choices.js
                if (choicesPrestador) choicesPrestador.destroy();
                
                choicesPrestador = new Choices(prestadorSelectFilter, {
                    searchEnabled: true,
                    itemSelectText: '',
                    placeholder: true,
                    placeholderValue: 'Buscar prestador...',
                    shouldSort: false,
                    // Garante que o dropdown não fique cortado
                    position: 'bottom'
                });
            }
        } catch (error) {
            console.error("Erro ao carregar prestadores:", error);
        }
    }

    function syncColumnWidths() {
        const headerTable = tableHead.closest('table');
        const bodyTable = tableBody.closest('table');

        if (tableBody.rows.length === 0) {
            return;
        }

        const headerCells = headerTable.querySelector('tr').cells;
        const bodyCells = tableBody.rows[0].cells;

        for (let i = 0; i < headerCells.length; i++) {
            if (bodyCells[i]) {
                const bodyCellWidth = bodyCells[i].offsetWidth;
                headerCells[i].style.width = `${bodyCellWidth}px`;
            }
        }
    }

    function renderTable() {
        // ATUALIZADO: Agora usa a função window.filterData que considera ambos os filtros
        const dataToRender = window.filterData(fullData);

        tableHead.innerHTML = '';
        tableBody.innerHTML = '';

        if (currentTableView === 'prestadores') {
            tableHead.innerHTML = `
                <tr>
                    <th>Código do Prestador</th>
                    <th>Prestador</th>
                    <th>Quantidade de Atividades</th>
                    <th>Valor Total</th>
                </tr>`;

            const prestadores = dataToRender.consolidadoPorPrestador || [];
            if (prestadores.length > 0) {
                prestadores.sort((a, b) => b.valorTotal - a.valorTotal);
                prestadores.forEach(prest => {
                    const tr = document.createElement('tr');
                    tr.style.cursor = 'pointer';
                    tr.dataset.codPrestador = prest.codPrestador;
                    tr.dataset.nomePrestador = prest.prestadorNome;
                    tr.innerHTML = `
                        <td>${prest.codPrestador || 'N/A'}</td>
                        <td>${prest.prestadorNome}</td>
                        <td class="text-center">${prest.quantidade || 0}</td>
                        <td>${formatCurrency(prest.valorTotal)}</td>
                    `;
                    tableBody.appendChild(tr);
                });
            } else {
                tableBody.innerHTML = `<tr><td colspan="4" class="text-center text-muted p-4">Nenhum prestador encontrado com os filtros atuais.</td></tr>`;
            }
        } else if (currentTableView === 'lancamentos') {
            renderLancamentosTable(dataToRender.lancamentosDetalhados || []);
        }

        syncColumnWidths();
    }

    function renderLancamentosTable(lancamentos) {
        const userRole = (localStorage.getItem("role") || "").trim().toUpperCase();
        let sortConfig = { key: 'dataAtividade', direction: 'desc' };

        function sortData() {
            lancamentos.sort((a, b) => {
                let valA = a[sortConfig.key];
                let valB = b[sortConfig.key];
                if (sortConfig.key === 'dataAtividade' || sortConfig.key.toLowerCase().includes('data')) {
                    valA = valA ? new Date(valA.split('/').reverse().join('-')) : new Date(0);
                    valB = valB ? new Date(valB.split('/').reverse().join('-')) : new Date(0);
                } else if (sortConfig.key === 'valorTotal' || sortConfig.key === 'valor' || sortConfig.key === 'valorAdiantamento') {
                    valA = a[sortConfig.key] || 0;
                    valB = b[sortConfig.key] || 0;
                }
                if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
                if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }

        function render() {
            sortData();
            const headers = [
                { key: 'dataAtividade', label: 'DATA ATIVIDADE' }, { key: 'os', label: 'OS' },
                { key: 'site', label: 'SITE' }, { key: 'contrato', label: 'CONTRATO' },
                { key: 'segmento', label: 'SEGMENTO' }, { key: 'valorTotal', label: 'VALOR TOTAL' },
                { key: 'prestador', label: 'PRESTADOR' }, { key: 'valor', label: 'VALOR PAGO' },
                { key: 'valorAdiantamento', label: 'ADIANTAMENTO' }
            ];

            tableHead.innerHTML = `<tr>
        ${headers.map(h => {
                const isSorted = sortConfig.key === h.key;
                const icon = isSorted ? (sortConfig.direction === 'asc' ? 'bi-sort-up' : 'bi-sort-down') : 'bi-arrow-down-up';
                return `<th class="sortable" data-sort-key="${h.key}">${h.label} <i class="bi ${icon}"></i></th>`;
            }).join('')}
    </tr>`;

            tableBody.innerHTML = '';
            if (lancamentos && lancamentos.length > 0) {
                lancamentos.forEach(lanc => {
                    const isPago = lanc.statusPagamento === 'FECHADO';
                    const isAdiantado = (parseFloat(lanc.valorAdiantamento) || 0) > 0;

                    let rowClass = '';
                    if (isPago) {
                        rowClass = 'table-success';
                    } else if (isAdiantado) {
                        rowClass = 'table-warning';
                    }

                    tableBody.innerHTML += `<tr class="${rowClass}">
                        <td>${lanc.dataAtividade || 'N/A'}</td> 
                        <td>${lanc.os || 'N/A'}</td> 
                        <td>${lanc.site || 'N/A'}</td>
                        <td>${lanc.contrato || 'N/A'}</td> 
                        <td>${lanc.segmento || 'N/A'}</td>
                        <td>${formatCurrency(lanc.valorTotal)}</td> 
                        <td>${lanc.prestador || 'N/A'}</td>
                        <td>${formatCurrency(lanc.valor)}</td> 
                        <td class="text-danger fw-bold">${formatCurrency(lanc.valorAdiantamento)}</td>
                    </tr>`;
                });
            } else {
                const colspan = headers.length;
                tableBody.innerHTML = `<tr><td colspan="${colspan}" class="text-center text-muted p-4">Nenhum lançamento encontrado.</td></tr>`;
            }
        }

        tableHead.addEventListener('click', (e) => {
            const header = e.target.closest('th.sortable');
            if (!header) return;
            const key = header.dataset.sortKey;
            if (sortConfig.key === key) {
                sortConfig.direction = sortConfig.direction === 'asc' ? 'desc' : 'asc';
            } else {
                sortConfig.key = key;
                sortConfig.direction = 'desc';
            }
            render();
        });
        render();
    }

    async function alterarValorLancamento(lancamentoId, novoValor) {
        toggleLoader(true);
        try {
            const response = await fetchComAuth(`${API_URL}/lancamentos/${lancamentoId}/valor`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
                body: JSON.stringify({ valor: novoValor })
            });
            if (!response.ok) {
                const erroData = await response.json();
                throw new Error(erroData.message || 'Falha ao atualizar o valor.');
            }
            mostrarToast('Valor alterado com sucesso!', 'success');
            await fetchComAuthData();
        } catch (error) {
            mostrarToast(error.message, 'error');
        } finally {
            toggleLoader(false);
        }
    }

    async function fetchComAuthData() {
        let startDate = startDateInput.value;
        let endDate = endDateInput.value;
        if (startDate.includes('/')) startDate = formatDateToISO(startDate);
        if (endDate.includes('/')) endDate = formatDateToISO(endDate);

        if (!startDate || !endDate) {
            mostrarToast('Por favor, selecione as datas de início e fim.', 'error');
            return;
        }

        toggleLoader(true);
        try {
            const response = await fetchComAuth(`${API_URL}/lancamentos/cps/relatorio?dataInicio=${startDate}&dataFim=${endDate}`, { headers: { 'Authorization': `Bearer ${TOKEN}` } });
            if (!response.ok) throw new Error(`Erro na API: ${response.status}`);
            window.fullData = await response.json();

            const totalBruto = fullData.valorTotalGeral || 0;
            const totalAdiantado = (fullData.lancamentosDetalhados || []).reduce((acc, lanc) => acc + (lanc.valorAdiantamento || 0), 0);
            const totalLiquido = totalBruto - totalAdiantado;

            const kpiTotalBrutoEl = document.getElementById('kpi-total-bruto');
            const kpiTotalAdiantadoEl = document.getElementById('kpi-total-adiantado');
            const kpiTotalLiquidoEl = document.getElementById('kpi-total-liquido');

            if (kpiTotalBrutoEl) kpiTotalBrutoEl.textContent = formatCurrency(totalBruto);
            if (kpiTotalAdiantadoEl) kpiTotalAdiantadoEl.textContent = formatCurrency(totalAdiantado);
            if (kpiTotalLiquidoEl) kpiTotalLiquidoEl.textContent = formatCurrency(totalLiquido);

            renderSegmentCards(fullData.valoresPorSegmento);
            renderSegmentFilter(fullData.valoresPorSegmento || []);
            
            // O filtro é aplicado dentro de renderTable
            renderTable();
            
        } catch (error) {
            console.error("Falha ao buscar dados do CPS:", error);
            mostrarToast('Não foi possível carregar os dados. Tente novamente mais tarde.', 'error');
        } finally {
            toggleLoader(false);
        }
    }

    async function fetchComAuthDetalhesPorPrestador(codPrestador) {
        toggleLoader(true);
        try {
            // Se já temos os dados filtrados em memória, podemos usá-los, mas a lógica original filtrava do fullData
            // Vamos manter filtrando do fullData para consistência
            const lancamentosDoPrestador = fullData.lancamentosDetalhados.filter(
                lanc => lanc.codPrestador === codPrestador
            );
            
            currentTableView = 'lancamentos';
            tableTabs.querySelector('.active').classList.remove('active');
            tableTabs.querySelector('[data-table-view="lancamentos"]').classList.add('active');
            
            // Aqui renderizamos apenas os dados daquele prestador específico
            renderLancamentosTable(lancamentosDoPrestador);
            syncColumnWidths();
        } catch (error) {
            console.error("Falha ao filtrar detalhes do prestador:", error);
            mostrarToast('Ocorreu um erro ao exibir os detalhes.', 'error');
        } finally {
            toggleLoader(false);
        }
    }

    // --- NOVA FUNÇÃO DE FILTRO UNIFICADA ---
    window.filterData = function (data) {
        const segmento = segmentSelectFilter.value;
        const prestadorNome = prestadorSelectFilter ? prestadorSelectFilter.value : 'todos';

        if (!data.lancamentosDetalhados) {
            return data;
        }

        const filteredLancamentos = data.lancamentosDetalhados.filter(l => {
            const matchSegmento = (segmento === 'todos' || !segmento) ? true : l.segmento === segmento;
            const matchPrestador = (prestadorNome === 'todos' || !prestadorNome) ? true : l.prestador === prestadorNome;
            return matchSegmento && matchPrestador;
        });

        const prestadorMap = new Map();
        filteredLancamentos.forEach(l => {
            const key = l.codPrestador;
            if (!key) return;
            const prestadorData = prestadorMap.get(key) || {
                codPrestador: l.codPrestador,
                prestadorNome: l.prestador || 'Não identificado',
                valorTotal: 0,
                quantidade: 0 // Mantém contagem correta
            };
            prestadorData.valorTotal += l.valor;
            prestadorData.quantidade += 1;
            prestadorMap.set(key, prestadorData);
        });

        return {
            ...data,
            lancamentosDetalhados: filteredLancamentos,
            consolidadoPorPrestador: Array.from(prestadorMap.values())
        };
    }

    // --- LÓGICA DE IMPORTAÇÃO ---
    function setupRoleBasedUI() {
        const userRole = (localStorage.getItem("role") || "").trim().toUpperCase();
        if (userRole === 'ADMIN' || userRole === 'ASSISTANT') {
            if (importContainer) importContainer.style.display = 'block';
        }
    }

    async function handleLegacyImport(file) {
        if (!file) return;
        textoProgresso.textContent = 'Enviando arquivo...';
        barraProgresso.style.width = '25%';
        barraProgresso.textContent = '25%';
        avisosContainer.classList.add('d-none');
        listaAvisos.innerHTML = '';
        btnFecharProgresso.disabled = true;
        modalProgresso.show();

        const formData = new FormData();
        formData.append('file', file);

        try {
            await new Promise(res => setTimeout(res, 500));
            barraProgresso.style.width = '50%';
            barraProgresso.textContent = '50%';
            textoProgresso.textContent = 'Processando no servidor...';

            const response = await fetchComAuth(`${API_URL}/lancamentos/importar-legado-cps`, {
                method: 'POST',
                body: formData
            });

            barraProgresso.style.width = '100%';
            barraProgresso.textContent = '100%';
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Erro desconhecido no servidor.');
            }

            textoProgresso.textContent = 'Importação concluída!';
            if (result.warnings && result.warnings.length > 0) {
                avisosContainer.classList.remove('d-none');
                listaAvisos.innerHTML = result.warnings.map(warn => `<li class="list-group-item">${warn}</li>`).join('');
            }
            await fetchComAuthData();
        } catch (error) {
            textoProgresso.textContent = 'Erro na importação!';
            avisosContainer.classList.remove('d-none');
            listaAvisos.innerHTML = `<li class="list-group-item list-group-item-danger">${error.message}</li>`;
            console.error("Erro na importação de legado:", error);
        } finally {
            btnFecharProgresso.disabled = false;
            importLegadoInput.value = '';
        }
    }

    function init() {
        const today = new Date();
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        const formatDate = (date) => {
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            return `${day}/${month}/${year}`;
        };
        startDateInput.value = formatDate(firstDay);
        endDateInput.value = formatDate(lastDay);

        filterBtn.addEventListener('click', fetchComAuthData);
        setupRoleBasedUI();

        if (btnImportarLegado) {
            btnImportarLegado.addEventListener('click', () => {
                importLegadoInput.click();
            });
        }

        if (importLegadoInput) {
            importLegadoInput.addEventListener('change', (e) => {
                handleLegacyImport(e.target.files[0]);
            });
        }

        tableTabs.addEventListener('click', (e) => {
            e.preventDefault();
            const link = e.target.closest('a.nav-link');
            if (link) {
                tableTabs.querySelector('.active').classList.remove('active');
                link.classList.add('active');
                currentTableView = link.dataset.tableView;
                renderTable(); // Chama renderTable sem argumentos, pois ele pega os filtros do DOM
            }
        });

        tableBody.addEventListener('click', (e) => {
            const btnAlterar = e.target.closest('.btn-alterar-valor');
            if (btnAlterar) {
                const lancamentoId = btnAlterar.dataset.id;
                const lancamento = window.fullData.lancamentosDetalhados.find(l => l.id == lancamentoId);
                if (lancamento) {
                    document.getElementById('lancamentoIdAlterar').value = lancamentoId;
                    document.getElementById('prestadorInfo').value = lancamento.prestador || 'N/A';
                    document.getElementById('valorAtual').value = formatCurrency(lancamento.valor);
                    document.getElementById('novoValor').value = '';
                    modalAlterarValor.show();
                } else {
                    mostrarToast('Não foi possível encontrar os detalhes para este lançamento.', 'error');
                }
                return;
            }

            const btnAdiantamento = e.target.closest('.btn-adiantamento');
            if (btnAdiantamento) {
                const lancamentoId = btnAdiantamento.dataset.id;
                const lancamento = window.fullData.lancamentosDetalhados.find(l => l.id == lancamentoId);
                if (lancamento) {
                    document.getElementById('lancamentoIdAdiantamento').value = lancamentoId;
                    document.getElementById('prestadorInfoAdiantamento').value = lancamento.prestador || 'N/A';
                    document.getElementById('valorAdiantamento').value = '';
                    modalAdiantamento.show();
                } else {
                    mostrarToast('Não foi possível encontrar os detalhes para este lançamento.', 'error');
                }
                return;
            }

            const linhaPrestador = e.target.closest('tr[data-cod-prestador]');
            if (linhaPrestador && currentTableView === 'prestadores') {
                fetchComAuthDetalhesPorPrestador(linhaPrestador.dataset.codPrestador);
            }
        });

        document.getElementById('formAdiantamento').addEventListener('submit', async (e) => {
            e.preventDefault();
            const lancamentoId = document.getElementById('lancamentoIdAdiantamento').value;
            const valorStr = document.getElementById('valorAdiantamento').value;
            if (valorStr) {
                const valor = parseFloat(valorStr.replace('.', '').replace(',', '.'));
                if (!isNaN(valor) && valor >= 0) {
                    toggleLoader(true);
                    try {
                        const response = await fetchComAuth(`${API_URL}/lancamentos/${lancamentoId}/adiantamento`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ valor: valor })
                        });
                        if (!response.ok) throw new Error('Falha ao registrar adiantamento.');
                        mostrarToast('Adiantamento registrado com sucesso!', 'success');
                        await fetchComAuthData();
                    } catch (error) {
                        mostrarToast(error.message, 'error');
                    } finally {
                        toggleLoader(false);
                        modalAdiantamento.hide();
                    }
                } else {
                    mostrarToast("Valor inválido.", 'error');
                }
            }
        });

        document.getElementById('formAlterarValor').addEventListener('submit', (e) => {
            e.preventDefault();
            const lancamentoId = document.getElementById('lancamentoIdAlterar').value;
            const novoValorStr = document.getElementById('novoValor').value;
            if (novoValorStr) {
                const novoValor = parseFloat(novoValorStr.replace('.', '').replace(',', '.'));
                if (!isNaN(novoValor) && novoValor >= 0) {
                    alterarValorLancamento(lancamentoId, novoValor);
                    modalAlterarValor.hide();
                } else {
                    alert("Valor inválido. Por favor, insira um número válido.");
                }
            }
        });

        // Listeners para os filtros
        segmentSelectFilter.addEventListener('change', () => {
            renderTable();
        });
        
        if (prestadorSelectFilter) {
            prestadorSelectFilter.addEventListener('change', () => {
                renderTable();
            });
        }

        // Inicializa dados e filtros
        initPrestadorFilter();
        fetchComAuthData();
    }

    const formatCurrency = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

    init();
});