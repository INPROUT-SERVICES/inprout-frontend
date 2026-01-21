/**
 * registros-api.js
 * Comunicação com a API usando paginação no servidor.
 */
const RegistrosApi = {

    // CORREÇÃO: Função adicionada para resolver o erro "is not a function"
    inicializarPagina: async () => {
        try {
            const segmentos = await RegistrosApi.fetchSegmentos();
            // Salva apenas os IDs para validação posterior no processarDadosPagina
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

    // Função principal que carrega os dados
    carregarDados: async (pagina = 0, busca = '') => {
        const accordionContainer = document.getElementById('accordion-registros');

        RegistrosState.isLoading = true;
        RegistrosState.paginaAtual = pagina;
        RegistrosState.termoBusca = busca;

        // Loader
        accordionContainer.innerHTML = `
            <div class="d-flex flex-column align-items-center justify-content-center py-5">
                <div class="spinner-border text-success" style="width: 3rem; height: 3rem;" role="status"></div>
                <p class="mt-3 text-muted">Carregando dados...</p>
            </div>`;

        try {
            // Configura parâmetros
            const size = RegistrosState.linhasPorPagina === 'all' ? 200 : RegistrosState.linhasPorPagina;
            const sort = `id,${RegistrosState.osSortDirection}`;
            const buscaEncoded = encodeURIComponent(busca);

            // Chama o endpoint com ?search=...
            const url = `${RegistrosState.API_BASE_URL}/os?page=${pagina}&size=${size}&sort=${sort}&search=${buscaEncoded}`;

            const response = await fetchComAuth(url); // fetchComAuth vem do global.js

            if (!response.ok) throw new Error('Falha ao comunicar com o servidor.');

            const data = await response.json();

            // Atualiza estado
            RegistrosState.totalPaginas = data.totalPages;
            RegistrosState.totalElementos = data.totalElements;

            // Processa para exibição
            RegistrosApi.processarDadosPagina(data.content || []);

            // Renderiza
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
        RegistrosState.todasAsLinhas = []; // Limpa memória local

        const userSegmentos = JSON.parse(localStorage.getItem('segmentos')) || [];
        const role = RegistrosState.userRole;

        listaDeOs.forEach(os => {
            // Filtro de permissão de visualização (Manager/Coord)
            if (['MANAGER', 'COORDINATOR'].includes(role)) {
                // Verifica se o ID do segmento da OS está na lista permitida do usuário
                if (!os.segmento || !userSegmentos.includes(os.segmento.id)) return;
            }

            if (os.detalhes && os.detalhes.length > 0) {
                const detalhesAtivos = os.detalhes.filter(d => d.statusRegistro !== 'INATIVO');

                detalhesAtivos.forEach(detalhe => {
                    // Lógica para definir qual lançamento mostrar na linha principal
                    let lancamentoParaExibir = detalhe.ultimoLancamento;

                    if (!lancamentoParaExibir && detalhe.lancamentos && detalhe.lancamentos.length > 0) {
                        const operacionais = detalhe.lancamentos.filter(l => l.situacaoAprovacao !== 'APROVADO_LEGADO');
                        if (operacionais.length > 0) {
                            lancamentoParaExibir = operacionais.reduce((prev, curr) => (prev.id > curr.id) ? prev : curr);
                        } else {
                            lancamentoParaExibir = detalhe.lancamentos.reduce((prev, curr) => (prev.id > curr.id) ? prev : curr);
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

    carregarDashboard: async () => {
        const loader = document.getElementById('dashboard-loader');
        const content = document.getElementById('dashboard-content');

        loader.classList.remove('d-none');
        content.classList.add('d-none');

        try {
            const response = await fetchComAuth(`${RegistrosState.API_BASE_URL}/os/dashboard-stats`);
            if (!response.ok) throw new Error('Erro ao carregar dashboard');

            const stats = await response.json();

            // Renderiza os valores
            RegistrosApi.preencherDashboard(stats);

            content.classList.remove('d-none');
        } catch (error) {
            console.error(error);
            content.innerHTML = `<div class="alert alert-danger">Erro ao carregar dados do dashboard.</div>`;
            content.classList.remove('d-none');
        } finally {
            loader.classList.add('d-none');
        }
    },

    preencherDashboard: (stats) => {
        // Helper para texto simples
        const setText = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.innerText = val || 0;
        };

        // Helper para moeda
        const setMoney = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.innerText = RegistrosUtils.formatarMoeda(val || 0);
        };

        // Quantidades
        setText('dash-nao-iniciado', stats.naoIniciado);
        setText('dash-paralisado', stats.paralisado);
        setText('dash-aguardando-doc', stats.aguardandoDoc);

        // -- NOVOS VALORES --
        setMoney('dash-valor-nao-iniciado', stats.valorNaoIniciado);
        setMoney('dash-valor-paralisado', stats.valorParalisado);
        setMoney('dash-valor-aguardando-doc', stats.valorAguardandoDoc);

        // Em Andamento
        if (stats.emAndamento) {
            setText('dash-andamento-total', stats.emAndamento.total);
            setText('dash-andamento-com-po', stats.emAndamento.comPo);
            setText('dash-andamento-sem-po', stats.emAndamento.semPo);

            // Valor total em andamento
            setMoney('dash-valor-andamento-total', stats.emAndamento.valorTotal);
        }

        // Finalizado
        if (stats.finalizado) {
            setText('dash-finalizado-total', stats.finalizado.total);
            setText('dash-finalizado-com-po', stats.finalizado.comPo);
            setText('dash-finalizado-sem-po', stats.finalizado.semPo);

            // Valor total finalizado
            setMoney('dash-valor-finalizado-total', stats.finalizado.valorTotal);
        }

        // Gate (Mantido igual)
        if (stats.gateAtual) {
            document.getElementById('dash-gate-nome').innerText = stats.gateAtual.nomeGate;
            const dataFim = stats.gateAtual.previsao ? stats.gateAtual.previsao.split('-').reverse().join('/') : '--';
            document.getElementById('dash-gate-previsao').innerText = dataFim;
            setText('dash-gate-solicitado', stats.gateAtual.idSolicitado);
            setText('dash-gate-ok', stats.gateAtual.idOk);
        } else {
            document.getElementById('dash-gate-nome').innerText = "Nenhum Gate Vigente";
        }
    }
};