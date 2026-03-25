/**
 * registros-api.js
 * Comunicação com a API usando paginação no servidor.
 */
const RegistrosApi = {

    inicializarPagina: async () => {
        try {
            const segmentos = await RegistrosApi.fetchSegmentos();
            if (segmentos && segmentos.length > 0) {
                const idsSegmentos = segmentos.map(s => s.id);
                localStorage.setItem('segmentos', JSON.stringify(idsSegmentos));
            }
        } catch (error) {
            console.error("Erro ao inicializar página:", error);
        }
    },

    finalizarOsRestante: async (osId) => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${RegistrosState.API_BASE_URL}/os/${osId}/finalizar-restante`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                let errorMsg = 'Erro ao finalizar itens restantes.';
                try {
                    const errorData = await response.json();
                    if (errorData.message) errorMsg = errorData.message;
                } catch (e) {
                    const text = await response.text();
                    if (text) errorMsg = text;
                }
                throw new Error(errorMsg);
            }
            return true;
        } catch (error) {
            console.error(error);
            throw error;
        }
    },

    // --- NOVA FUNÇÃO: ALTERAR STATUS (ATIVO/INATIVO) ---
    alternarStatusDetalhe: async (detalheId, novoStatus) => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${RegistrosState.API_BASE_URL}/os/detalhe/${detalheId}/status`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status: novoStatus })
            });

            if (!response.ok) throw new Error('Erro ao atualizar status do registro.');
            return true;
        } catch (error) {
            console.error(error);
            throw error;
        }
    },

    carregarDados: async (pagina = 0, busca = '') => {
        const accordionContainer = document.getElementById('accordion-registros');

        RegistrosState.isLoading = true;
        RegistrosState.paginaAtual = pagina;
        RegistrosState.termoBusca = busca;

        accordionContainer.innerHTML = `
            <div class="d-flex flex-column align-items-center justify-content-center py-5">
                <div class="spinner-border text-success" style="width: 3rem; height: 3rem;" role="status"></div>
                <p class="mt-3 text-muted">Carregando dados...</p>
            </div>`;

        try {
            const size = RegistrosState.linhasPorPagina === 'all' ? 200 : RegistrosState.linhasPorPagina;
            const sort = `id,${RegistrosState.osSortDirection}`;
            const buscaEncoded = encodeURIComponent(busca);
            const url = `${RegistrosState.API_BASE_URL}/os?page=${pagina}&size=${size}&sort=${sort}&search=${buscaEncoded}`;

            const response = await fetchComAuth(url);

            if (!response.ok) throw new Error('Falha ao comunicar com o servidor.');

            const data = await response.json();
            RegistrosState.totalPaginas = data.totalPages;
            RegistrosState.totalElementos = data.totalElements;

            RegistrosApi.processarDadosPagina(data.content || []);
            RegistrosRender.renderizarTabela();

        } catch (error) {
            console.error('Erro:', error);
            accordionContainer.innerHTML = `
                <div class="alert alert-danger text-center">
                    <i class="bi bi-exclamation-triangle-fill"></i> Erro: ${error.message}
                    <br><button class="btn btn-sm btn-outline-danger mt-2" onclick="location.reload()">Tentar Novamente</button>
                </div>`;
        } finally {
            RegistrosState.isLoading = false;
        }
    },

    processarDadosPagina: (listaDeOs) => {
        RegistrosState.todasAsLinhas = []; 
        const userSegmentos = JSON.parse(localStorage.getItem('segmentos')) || [];
        const role = RegistrosState.userRole;

        listaDeOs.forEach(os => {
            // Filtro de Permissão por Segmento (Mantido)
            if (['MANAGER', 'COORDINATOR'].includes(role)) {
                if (!os.segmento || !userSegmentos.includes(os.segmento.id)) return;
            }

            const detalhesParaMostrar = os.detalhes || [];

            if (detalhesParaMostrar.length > 0) {
                detalhesParaMostrar.forEach(detalhe => {
                    
                    let lancamentoParaExibir = null;

                    if (detalhe.lancamentos && detalhe.lancamentos.length > 0) {
                        
                        // 1. Filtra APENAS os lançamentos com status APROVADO (ou legado)
                        const historicoAprovado = detalhe.lancamentos.filter(l => 
                            l.situacaoAprovacao === 'APROVADO' || 
                            l.situacaoAprovacao === 'APROVADO_LEGADO'
                        );

                        // 2. Se houver algum aprovado no histórico, pegamos o mais recente (Maior ID)
                        if (historicoAprovado.length > 0) {
                            lancamentoParaExibir = historicoAprovado.reduce((prev, curr) => 
                                (prev.id > curr.id) ? prev : curr
                            );
                        }
                    }

                    RegistrosState.todasAsLinhas.push({
                        os: os,
                        detalhe: detalhe,
                        ultimoLancamento: lancamentoParaExibir
                    });
                });
            }
        });
    },

    fetchSegmentos: async () => {
        try {
            const response = await fetchComAuth(`${RegistrosState.API_BASE_URL}/segmentos`);
            if (response.ok) return await response.json();
            return [];
        } catch (e) {
            console.error(e);
            return [];
        }
    },

    fetchGates: async () => {
        try {
            const response = await fetchComAuth(`${RegistrosState.API_BASE_URL}/faturamento/gates`);
            if (response.ok) return await response.json();
            return [];
        } catch (e) {
            console.error('Erro ao buscar gates:', e);
            return [];
        }
    },

    carregarDashboard: async () => {
        const loader = document.getElementById('dashboard-loader');
        const container = document.getElementById('dashboard-analise-container');

        if (loader) loader.classList.remove('d-none');
        if (container) container.innerHTML = '';

        try {
            // 1. Lê o gate selecionado (agora manda o NOME do gate, não o ID)
            const gateSelect = document.getElementById('dashboard-gate-select');
            const gateSelecionado = gateSelect ? gateSelect.value : '';

            // 2. Chama o endpoint que faz toda a agregação no backend
            let url = `${RegistrosState.API_BASE_URL}/os/dashboard-por-gate`;
            if (gateSelecionado) {
                url += `?gate=${encodeURIComponent(gateSelecionado)}`;
            }

            const response = await fetchComAuth(url);
            if (!response.ok) throw new Error('Falha ao buscar dados do dashboard.');

            const statsAgrupados = await response.json();

            // 3. Salva no state (para exportação) e renderiza
            RegistrosState.dashboardData = statsAgrupados;
            RegistrosRender.renderizarCardsDoBackend(statsAgrupados);

        } catch (error) {
            console.error(error);
            const totaisContainer = document.getElementById('dashboard-totais-container');
            if (totaisContainer) totaisContainer.innerHTML = '';
            if (container) container.innerHTML = `
                <div class="alert alert-danger text-center">
                    <i class="bi bi-exclamation-triangle-fill"></i> Erro: ${error.message}
                    <br><button class="btn btn-sm btn-outline-danger mt-2" onclick="RegistrosApi.carregarDashboard()">Tentar Novamente</button>
                </div>`;
        } finally {
            if (loader) loader.classList.add('d-none');
        }
    }
};