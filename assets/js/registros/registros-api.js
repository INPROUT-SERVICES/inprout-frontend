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

        if(loader) loader.classList.remove('d-none');
        if(container) container.innerHTML = '';

        try {
            // 1. Lê as datas dos filtros (se existirem)
            const inputInicio = document.getElementById('dashboard-data-inicio');
            const inputFim = document.getElementById('dashboard-data-fim');
            const dataInicio = inputInicio ? inputInicio.value : null;
            const dataFim = inputFim ? inputFim.value : null;

            // 2. Busca todos os segmentos disponíveis
            const segmentos = await RegistrosApi.fetchSegmentos();

            // 3. Objeto para guardar os dados finais
            const statsAgrupados = {};

            // 4. Busca as informações de TODOS os segmentos simultaneamente
            await Promise.all(segmentos.map(async (segmento) => {
                const statsDoSegmento = await RegistrosApi.fetchValoresParaSegmento(segmento.id, dataInicio, dataFim);
                statsAgrupados[segmento.nome] = statsDoSegmento;
            }));

            // 5. Salva no state (para exportação) e manda renderizar
            RegistrosState.dashboardData = statsAgrupados;
            RegistrosRender.renderizarCardsDoBackend(statsAgrupados);

        } catch (error) {
            console.error(error);
            const totaisContainer = document.getElementById('dashboard-totais-container');
            if (totaisContainer) totaisContainer.innerHTML = '';
            if(container) container.innerHTML = `
                <div class="alert alert-danger text-center">
                    <i class="bi bi-exclamation-triangle-fill"></i> Erro: ${error.message}
                    <br><button class="btn btn-sm btn-outline-danger mt-2" onclick="RegistrosApi.carregarDashboard()">Tentar Novamente</button>
                </div>`;
        } finally {
            if(loader) loader.classList.add('d-none');
        }
    },

    fetchValoresParaSegmento: async (segmentoId, dataInicio, dataFim) => {

        // Função interna auxiliar para disparar o GET para a API
        const fetchValor = async (endpoint, filtroPo, usarDatas = true) => {
            try {
                let url = `${RegistrosState.API_BASE_URL}${endpoint}?segmentoId=${segmentoId}&filtroPo=${filtroPo}`;
                if (usarDatas && dataInicio) url += `&dataInicio=${dataInicio}`;
                if (usarDatas && dataFim) url += `&dataFim=${dataFim}`;
                const response = await fetchComAuth(url);
                if(response.ok) {
                    const data = await response.json();
                    return data.total || 0;
                }
            } catch (e) {
                console.error(`Erro ao buscar ${endpoint}:`, e);
            }
            return 0;
        };

        // Endpoints com suporte a datas
        const endpointsComData = [
            { key: 'finalizado', url: '/lancamentos/aprovados/finalizados' },
            { key: 'emAndamento', url: '/lancamentos/aprovados/em-andamento' },
            { key: 'paralisado', url: '/lancamentos/aprovados/paralisados' },
            { key: 'aguardandoDoc', url: '/lancamentos/aprovados/aguardando-documentacao' },
            { key: 'aptoAFaturar', url: '/os/detalhes/apto-a-faturar' },
            { key: 'faturados', url: '/os/detalhes/faturados' }
        ];

        // Endpoint sem suporte a datas
        const endpointsSemData = [
            { key: 'naoIniciado', url: '/os/detalhes/nao-iniciados' }
        ];

        const stats = {};

        // Dispara TODAS as requisições em paralelo (muito mais rápido)
        await Promise.all([
            ...endpointsComData.map(async (ep) => {
                const [total, comPo, semPo] = await Promise.all([
                    fetchValor(ep.url, 'TODOS', true),
                    fetchValor(ep.url, 'COM_PO', true),
                    fetchValor(ep.url, 'SEM_PO', true)
                ]);
                stats[ep.key] = { total, comPo, semPo };
            }),
            ...endpointsSemData.map(async (ep) => {
                const [total, comPo, semPo] = await Promise.all([
                    fetchValor(ep.url, 'TODOS', false),
                    fetchValor(ep.url, 'COM_PO', false),
                    fetchValor(ep.url, 'SEM_PO', false)
                ]);
                stats[ep.key] = { total, comPo, semPo };
            })
        ]);

        return stats;
    }
};