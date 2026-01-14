// guizs/inprout-services-system/Inprout-Services-System-Correcao_bo/Homologação/frontend/assets/js/cps/export.js

// --- VARIÁVEL QUE FALTAVA ---
const API_URL = 'http://localhost:8080';

// Função central para criar e baixar o arquivo .xlsx
function exportToExcel(rows, headers, fileName) {
    if (!rows || rows.length === 0) {
        alert('Não há dados para exportar neste relatório.');
        return;
    }
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const colWidths = headers.map((_, i) => ({ wch: Math.max(15, String(headers[i]).length + 2) }));
    ws['!cols'] = colWidths;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Relatorio");
    XLSX.writeFile(wb, `${fileName}.xlsx`);
}

// ==================================================================
// >>>>> INÍCIO DA CORREÇÃO DEFINITIVA <<<<<
// ==================================================================
// Função para formatar data para o Excel, agora tratando o fuso horário (UTC)
const formatarDataParaExcel = (dataStr) => {
    if (!dataStr) return null;

    try {
        if (dataStr.includes('/')) { // Formato dd/mm/yyyy
            const [dia, mes, ano] = dataStr.split('/');
            // Cria a data diretamente em UTC para evitar o deslocamento de fuso horário
            return new Date(Date.UTC(ano, mes - 1, dia));
        } else if (dataStr.includes('-')) { // Formato yyyy-mm-dd
            const [ano, mes, dia] = dataStr.split('T')[0].split('-');
            // Cria a data em UTC
            return new Date(Date.UTC(ano, mes - 1, dia));
        }
        return null; // Retorna nulo se o formato não for reconhecido
    } catch (e) {
        console.error(`Erro ao formatar data: ${dataStr}`, e);
        return null; // Retorna nulo em caso de erro
    }
};
// ==================================================================
// >>>>> FIM DA CORREÇÃO DEFINITIVA <<<<<
// ==================================================================


// Converte 'dd/mm/yyyy' para 'yyyy-mm-dd'
function formatDateToISO(dateStr) {
    if (!dateStr || !dateStr.includes('/')) return dateStr;
    const [dia, mes, ano] = dateStr.split('/');
    return `${ano}-${mes}-${dia}`;
}


// --- Listener para "Consolidado por Prestador" (UNIFICADO) ---
document.getElementById('export-consolidado').addEventListener('click', function() {
    const dadosFiltrados = filterDataBySegment(window.fullData, document.getElementById('segment-select-filter').value).consolidadoPorPrestador || [];
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

// --- Listener para "Lançamentos Aprovados" (COM TODAS AS COLUNAS) ---
document.getElementById('export-lancamentos').addEventListener('click', function() {
    const dadosFiltrados = filterDataBySegment(window.fullData, document.getElementById('segment-select-filter').value).lancamentosDetalhados || [];
    
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

// --- Listener para "Lançamentos Não Faturados" (LÓGICA CORRIGIDA) ---
document.getElementById('export-nao-faturado').addEventListener('click', function() {
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

document.getElementById('export-programacao').addEventListener('click', async function() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;

    if (!startDate || !endDate) {
        mostrarToast('Por favor, selecione as datas de início e fim.', 'error');
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
        mostrarToast(error.message, 'error');
    } finally {
        if (typeof toggleLoader === 'function') toggleLoader(false);
    }
});