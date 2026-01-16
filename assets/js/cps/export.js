// guizs/inprout-services-system/Inprout-Services-System-Correcao_bo/Homologação/frontend/assets/js/cps/export.js

const API_URL = 'https://www.inproutservices.com.br/api';

// ==================================================================
// 1. FUNÇÃO QUE FALTAVA (RESOLVE O ERRO ReferenceError)
// ==================================================================
function filterDataBySegment(data, segmentName) {
    // Proteção contra dados nulos
    if (!data) return { lancamentosDetalhados: [], consolidadoPorPrestador: [] };

    // Se o filtro for "todos", vazio ou nulo, retorna os dados originais
    if (!segmentName || segmentName === 'todos' || segmentName === '' || segmentName === '0') {
        return data;
    }

    const result = {
        lancamentosDetalhados: [],
        consolidadoPorPrestador: []
    };

    // 1. Filtra os lançamentos pelo NOME do segmento (conforme lógica do cps.js)
    if (data.lancamentosDetalhados) {
        result.lancamentosDetalhados = data.lancamentosDetalhados.filter(l => 
            l.segmento === segmentName
        );
    }

    // 2. Recalcula o consolidado baseado nos lançamentos filtrados para manter consistência
    // (Isso evita mostrar prestadores que não têm itens no segmento selecionado)
    if (result.lancamentosDetalhados.length > 0) {
        const prestadorMap = new Map();
        
        result.lancamentosDetalhados.forEach(l => {
            // Usa codPrestador ou nome como chave
            const key = l.codPrestador || l.prestador;
            if (!key) return;

            const current = prestadorMap.get(key) || {
                codPrestador: l.codPrestador,
                prestadorNome: l.prestador,
                quantidade: 0,
                valorTotal: 0
            };

            current.quantidade += 1;
            current.valorTotal += (l.valorTotal || 0); // Soma o valor total
            prestadorMap.set(key, current);
        });

        result.consolidadoPorPrestador = Array.from(prestadorMap.values());
    }

    return result;
}

// ==================================================================
// 2. UTILITÁRIOS DE FORMATAÇÃO E EXPORTAÇÃO
// ==================================================================

// Função para formatar data para o Excel tratando UTC
const formatarDataParaExcel = (dataStr) => {
    if (!dataStr) return null;
    try {
        if (dataStr.includes('/')) { // Formato dd/mm/yyyy
            const [dia, mes, ano] = dataStr.split('/');
            return new Date(Date.UTC(ano, mes - 1, dia));
        } else if (dataStr.includes('-')) { // Formato yyyy-mm-dd
            const [ano, mes, dia] = dataStr.split('T')[0].split('-');
            return new Date(Date.UTC(ano, mes - 1, dia));
        }
        return null;
    } catch (e) {
        console.error(`Erro ao formatar data: ${dataStr}`, e);
        return null;
    }
};

// Converte 'dd/mm/yyyy' para 'yyyy-mm-dd' para uso na API
function formatDateToISO(dateStr) {
    if (!dateStr || !dateStr.includes('/')) return dateStr;
    const [dia, mes, ano] = dateStr.split('/');
    return `${ano}-${mes}-${dia}`;
}

// Função central para criar e baixar o arquivo .xlsx
function exportToExcel(rows, headers, fileName) {
    if (!rows || rows.length === 0) {
        alert('Não há dados para exportar neste relatório (o filtro retornou vazio).');
        return;
    }
    
    // Cria a planilha
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    
    // Ajusta largura das colunas
    const colWidths = headers.map((_, i) => ({ wch: Math.max(15, String(headers[i]).length + 5) }));
    ws['!cols'] = colWidths;
    
    // Cria o workbook e adiciona a aba
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Relatorio");
    
    // Salva o arquivo
    XLSX.writeFile(wb, `${fileName}.xlsx`);
}


// ==================================================================
// 3. LISTENERS DOS BOTÕES (COM LÓGICA INTEGRADA)
// ==================================================================
document.addEventListener('DOMContentLoaded', () => {

    // --- A. Listener para "Consolidado por Prestador" ---
    const btnConsolidado = document.getElementById('export-consolidado');
    if (btnConsolidado) {
        btnConsolidado.addEventListener('click', function() {
            // Verifica se os dados foram carregados
            if (!window.fullData) {
                alert('Aguarde o carregamento dos dados na tela.');
                return;
            }

            const segmentoSelecionado = document.getElementById('segment-select-filter') ? document.getElementById('segment-select-filter').value : 'todos';
            
            // Chama a função que criamos lá em cima
            const dadosFiltrados = filterDataBySegment(window.fullData, segmentoSelecionado).consolidadoPorPrestador || [];
            
            dadosFiltrados.sort((a, b) => b.valorTotal - a.valorTotal);

            const headers = ["Código do Prestador", "Prestador", "Quantidade de Atividades", "Valor Total"];
            const rows = dadosFiltrados.map(prest => [
                prest.codPrestador || '',
                prest.prestadorNome || '',
                prest.quantidade || 0,
                prest.valorTotal || 0
            ]);
            
            exportToExcel(rows, headers, "relatorio_cps_consolidado_prestador");
        });
    }

    // --- B. Listener para "Lançamentos Aprovados" (O principal erro estava aqui) ---
    const btnLancamentos = document.getElementById('export-lancamentos');
    if (btnLancamentos) {
        btnLancamentos.addEventListener('click', function() {
            if (!window.fullData) {
                alert('Aguarde o carregamento dos dados na tela.');
                return;
            }

            const segmentoSelecionado = document.getElementById('segment-select-filter') ? document.getElementById('segment-select-filter').value : 'todos';
            
            // Chama a função de filtro
            const dadosFiltrados = filterDataBySegment(window.fullData, segmentoSelecionado).lancamentosDetalhados || [];
            
            const headers = [
                "DATA ATIVIDADE", "OS", "SITE", "CONTRATO", "SEGMENTO", "PROJETO", "GESTOR TIM", 
                "REGIONAL", "LOTE", "BOQ", "PO", "ITEM", "OBJETO CONTRATADO", "UNIDADE", 
                "QUANTIDADE", "VALOR TOTAL OS", "OBSERVAÇÕES", "DATA PO", "LPU", "EQUIPE", 
                "VISTORIA", "PLANO DE VISTORIA", "DESMOBILIZAÇÃO", "PLANO DESMOB.", "INSTALAÇÃO", 
                "PLANO INST.", "ATIVAÇÃO", "PLANO ATIVAÇÃO", "DOCUMENTAÇÃO", "PLANO DOC.", 
                "ETAPA GERAL", "ETAPA DETALHADA", "STATUS", "SITUAÇÃO", "DETALHE DIÁRIO", 
                "CÓD PRESTADOR", "PRESTADOR", "VALOR PAGO", "KEY", "ADIANTAMENTO"
            ];
            
            const rows = dadosFiltrados.map(lanc => [
                formatarDataParaExcel(lanc.dataAtividade),
                lanc.os || '', lanc.site || '', lanc.contrato || '', lanc.segmento || '',
                lanc.projeto || '', lanc.gestorTim || '', lanc.regional || '', lanc.lote || '',
                lanc.boq || '', lanc.po || '', lanc.item || '', lanc.objetoContratado || '',
                lanc.unidade || '', lanc.quantidade || '', 
                lanc.valorTotal || 0,
                lanc.observacoes || '',
                formatarDataParaExcel(lanc.dataPo),
                lanc.lpu || '', lanc.equipe || '', lanc.vistoria || '',
                formatarDataParaExcel(lanc.planoDeVistoria),
                lanc.desmobilizacao || '',
                formatarDataParaExcel(lanc.planoDeDesmobilizacao),
                lanc.instalacao || '',
                formatarDataParaExcel(lanc.planoDeInstalacao),
                lanc.ativacao || '',
                formatarDataParaExcel(lanc.planoDeAtivacao),
                lanc.documentacao || '',
                formatarDataParaExcel(lanc.planoDeDocumentacao),
                lanc.etapaGeral || '', lanc.etapaDetalhada || '', lanc.status || '',
                lanc.situacao || '', lanc.detalheDiario || '', lanc.codPrestador || '',
                lanc.prestador || '',
                lanc.valor || 0,
                lanc.key || '',
                lanc.valorAdiantamento || 0
            ]);

            exportToExcel(rows, headers, "relatorio_cps_lancamentos_aprovados");
        });
    }

    // --- C. Listener para "Lançamentos Não Faturados" ---
    const btnNaoFaturado = document.getElementById('export-nao-faturado');
    if (btnNaoFaturado) {
        btnNaoFaturado.addEventListener('click', function() {
            if (!window.fullData || !window.fullData.lancamentosDetalhados) {
                alert('Não há dados carregados.');
                return;
            }

            const todosLancamentos = window.fullData.lancamentosDetalhados || [];

            const dadosNaoFaturados = todosLancamentos.filter(lanc => 
                !lanc.idFaturamento || lanc.idFaturamento.trim() === '' || lanc.idFaturamento.trim() === '-'
            );
            
            const headers = ["DATA ATIVIDADE", "OS", "SITE", "PROJETO", "PRESTADOR", "VALOR PAGO", "KEY"];
            const rows = dadosNaoFaturados.map(lanc => [
                formatarDataParaExcel(lanc.dataAtividade),
                lanc.os || '',
                lanc.site || '',
                lanc.projeto || '',
                lanc.prestador || '',
                lanc.valor || 0,
                lanc.key || ''
            ]);

            exportToExcel(rows, headers, "relatorio_cps_nao_faturados");
        });
    }

    // --- D. Listener para "Programação Diária" ---
    const btnProgramacao = document.getElementById('export-programacao');
    if (btnProgramacao) {
        btnProgramacao.addEventListener('click', async function() {
            const startDateEl = document.getElementById('startDate');
            const endDateEl = document.getElementById('endDate');
            
            if (!startDateEl || !endDateEl) return;

            const startDate = startDateEl.value;
            const endDate = endDateEl.value;

            if (!startDate || !endDate) {
                if(typeof mostrarToast === 'function') mostrarToast('Por favor, selecione as datas de início e fim.', 'error');
                else alert('Selecione as datas.');
                return;
            }

            const isoStartDate = formatDateToISO(startDate);
            const isoEndDate = formatDateToISO(endDate);

            try {
                if (typeof toggleLoader === 'function') toggleLoader(true);

                const response = await fetchComAuth(`${API_URL}/lancamentos/cps/programacao-diaria?dataInicio=${isoStartDate}&dataFim=${isoEndDate}`);
                if (!response.ok) {
                    throw new Error('Falha ao buscar dados do relatório de programação.');
                }

                const dadosProgramacao = await response.json();

                const headers = ["Data", "Gestor", "Quantidade de Lançamentos"];
                const rows = dadosProgramacao.map(item => [
                    formatarDataParaExcel(item.data), 
                    item.gestor,
                    item.quantidade
                ]);

                exportToExcel(rows, headers, "relatorio_cps_programacao_diaria");

            } catch (error) {
                console.error("Erro ao gerar relatório de programação:", error);
                if(typeof mostrarToast === 'function') mostrarToast(error.message, 'error');
                else alert(error.message);
            } finally {
                if (typeof toggleLoader === 'function') toggleLoader(false);
            }
        });
    }
});