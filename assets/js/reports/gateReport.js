document.addEventListener('DOMContentLoaded', () => {
    const API_BASE_URL = 'http://localhost:8080';
    const gateSelect = document.getElementById('gateSelect');
    const btnFiltrarGate = document.getElementById('btnFiltrarGate');
    
    // KPIs principais
    const kpiValorFaturado = document.getElementById('kpi-valor-faturado');
    const kpiValorAntecipado = document.getElementById('kpi-valor-antecipado');
    
    // NOVO: Container do Acordeão
    const accordionContainer = document.getElementById('accordion-gate-report');

    // Função para formatar moeda
    const formatarMoeda = (valor) => {
        if (typeof valor !== 'number') valor = 0;
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
    };

    // Função para carregar os GATEs no select (sem alteração)
    async function carregarSelectGates() {
        try {
            const response = await fetchComAuth(`${API_BASE_URL}/gates`);
            if (!response.ok) throw new Error('Falha ao carregar GATEs.');
            const gates = await response.json();

            gateSelect.innerHTML = '<option value="" selected disabled>Selecione um GATE</option>';
            gates.forEach(gate => {
                const dataInicio = gate.dataInicio.split('-').reverse().join('/');
                const dataFim = gate.dataFim.split('-').reverse().join('/');
                const option = new Option(
                    `${gate.nome} (${dataInicio} - ${dataFim})`,
                    gate.id
                );
                gateSelect.add(option);
            });

        } catch (error) {
            console.error(error);
            mostrarToast(error.message, 'error');
            gateSelect.innerHTML = '<option value="" selected disabled>Erro ao carregar GATEs</option>';
        }
    }

    // ==================================================
    // FUNÇÃO DE GERAR RELATÓRIO (ATUALIZADA)
    // ==================================================
    async function gerarRelatorio() {
        const gateId = gateSelect.value;
        if (!gateId) {
            mostrarToast('Por favor, selecione um GATE.', 'error');
            return;
        }

        // toggleLoader (do global.js)
        toggleLoader(true); 
        
        accordionContainer.innerHTML = `
            <div class="text-center p-5">
                <div class="spinner-border text-success" role="status">
                    <span class="visually-hidden">Carregando...</span>
                </div>
            </div>`;
        
        kpiValorFaturado.textContent = '...';
        kpiValorAntecipado.textContent = '...';

        try {
            const response = await fetchComAuth(`${API_BASE_URL}/gates/${gateId}/report`);
            if (!response.ok) throw new Error('Falha ao gerar relatório.');
            const data = await response.json();

            // 1. Renderizar KPIs (sem alteração)
            kpiValorFaturado.textContent = formatarMoeda(data.valorTotalFaturado);
            kpiValorAntecipado.textContent = formatarMoeda(data.valorTotalAntecipado);

            // 2. Renderizar Corpo (agora como Acordeão)
            const linhas = data.linhasDoRelatorio;
            if (linhas.length === 0) {
                accordionContainer.innerHTML = `<div class="text-center p-4 text-muted">Nenhum dado encontrado para este GATE.</div>`;
                toggleLoader(false);
                return;
            }

            let accordionHtml = '';
            let totalGeral = {}; // Para o rodapé

            linhas.forEach((linha, index) => {
                const uniqueId = `gate-segmento-${index}`;

                // Soma para o rodapé (Tfoot)
                Object.keys(linha).forEach(key => {
                    if (key !== 'segmentoNome') {
                        totalGeral[key] = (totalGeral[key] || 0) + linha[key];
                    }
                });

                // HTML do Cabeçalho do Card (KPIs Principais)
                const kpiHeaderHtml = `
                    <div class="header-kpi-wrapper">
                        <div class="header-kpi">
                            <span class="kpi-label">Em Andamento</span>
                            <span class="kpi-value">${formatarMoeda(linha.totalEmAndamento)}</span>
                        </div>
                        <div class="header-kpi">
                            <span class="kpi-label">Finalizado</span>
                            <span class="kpi-value">${formatarMoeda(linha.totalFinalizado)}</span>
                        </div>
                        <div class="header-kpi">
                            <span class="kpi-label">Previsão Faturamento</span>
                            <span class="kpi-value">${formatarMoeda(linha.previsao)}</span>
                        </div>
                    </div>
                `;

                // HTML do Corpo do Card (Lista de Detalhes)
                const kpiBodyHtml = `
                    <ul class="kpi-list">
                        <li><span>Status: Não Iniciado</span> <span>${formatarMoeda(linha.naoIniciado)}</span></li>
                        <li><span>Status: Paralisado</span> <span>${formatarMoeda(linha.paralisado)}</span></li>
                    </ul>
                    <h6 class="section-title mt-3">Detalhes "Em Andamento"</h6>
                    <ul class="kpi-list">
                        <li><span>Sem PO</span> <span>${formatarMoeda(linha.emAndamentoSemPO)}</span></li>
                        <li><span>Com PO</span> <span>${formatarMoeda(linha.emAndamentoComPO)}</span></li>
                    </ul>
                    <h6 class="section-title mt-3">Detalhes "Finalizado"</h6>
                    <ul class="kpi-list">
                        <li><span>Sem PO</span> <span>${formatarMoeda(linha.finalizadoSemPO)}</span></li>
                        <li><span>Com PO</span> <span>${formatarMoeda(linha.finalizadoComPO)}</span></li>
                    </ul>
                    <h6 class="section-title mt-3">Detalhes "Faturamento"</h6>
                    <ul class="kpi-list">
                        <li><span>ID Solicitado</span> <span>${formatarMoeda(linha.idSolicitado)}</span></li>
                        <li><span>ID Recebido / Faturado</span> <span>${formatarMoeda(linha.idRecebido)}</span></li>
                    </ul>
                `;

                // Montagem do Item do Acordeão
                accordionHtml += `
                    <div class="accordion-item">
                        <h2 class="accordion-header" id="heading-${uniqueId}">
                            <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapse-${uniqueId}">
                                <div class="header-content">
                                    <div class="header-title-wrapper">
                                        <span class="header-title-segmento">${linha.segmentoNome}</span>
                                    </div>
                                    ${kpiHeaderHtml}
                                </div>
                            </button>
                        </h2>
                        <div id="collapse-${uniqueId}" class="accordion-collapse collapse" data-bs-parent="#accordion-gate-report">
                            <div class="accordion-body">
                                ${kpiBodyHtml}
                            </div>
                        </div>
                    </div>
                `;
            });

            // 3. Adiciona o Totalizador no final (fora do acordeão)
            if (linhas.length > 1) { // Só mostra o total se tiver mais de 1 segmento
                 totalGeral.totalEmAndamento = (totalGeral.emAndamentoSemPO || 0) + (totalGeral.emAndamentoComPO || 0);
                 totalGeral.totalFinalizado = (totalGeral.finalizadoSemPO || 0) + (totalGeral.finalizadoComPO || 0);
                 totalGeral.previsao = (totalGeral.idSolicitado || 0) + (totalGeral.idRecebido || 0);

                 accordionHtml += `
                    <div class="accordion-item mt-3 border-top border-2 border-success">
                        <h2 class="accordion-header">
                            <div class="accordion-button" style="cursor: default;">
                                <div class="header-content">
                                    <div class="header-title-wrapper">
                                        <span class="header-title-segmento">TOTAL GERAL</span>
                                    </div>
                                    <div class="header-kpi-wrapper">
                                        <div class="header-kpi"><span class="kpi-label">Em Andamento</span><span class="kpi-value">${formatarMoeda(totalGeral.totalEmAndamento)}</span></div>
                                        <div class="header-kpi"><span class="kpi-label">Finalizado</span><span class="kpi-value">${formatarMoeda(totalGeral.totalFinalizado)}</span></div>
                                        <div class="header-kpi"><span class="kpi-label">Previsão Faturamento</span><span class="kpi-value">${formatarMoeda(totalGeral.previsao)}</span></div>
                                    </div>
                                </div>
                            </div>
                        </h2>
                    </div>
                 `;
            }

            accordionContainer.innerHTML = accordionHtml;

        } catch (error) {
            console.error(error);
            mostrarToast(error.message, 'error');
            accordionContainer.innerHTML = `<div class="text-center p-4 text-danger">${error.message}</div>`;
        } finally {
            toggleLoader(false);
        }
    }

    // --- Inicialização ---
    btnFiltrarGate.addEventListener('click', gerarRelatorio);
    carregarSelectGates();
});