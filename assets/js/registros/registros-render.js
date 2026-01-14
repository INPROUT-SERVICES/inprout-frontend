/**
 * registros-render.js
 * Responsável por renderizar a tabela, os grupos e aplicar filtros visuais.
 */

const RegistrosRender = {
    // Definição das colunas
    colunasCompletas: ["OS", "SITE", "CONTRATO", "SEGMENTO", "PROJETO", "GESTOR TIM", "REGIONAL", "LPU", "LOTE", "BOQ", "PO", "ITEM", "OBJETO CONTRATADO", "UNIDADE", "QUANTIDADE", "VALOR TOTAL OS", "OBSERVAÇÕES", "DATA PO", "VISTORIA", "PLANO VISTORIA", "DESMOBILIZAÇÃO", "PLANO DESMOBILIZAÇÃO", "INSTALAÇÃO", "PLANO INSTALAÇÃO", "ATIVAÇÃO", "PLANO ATIVAÇÃO", "DOCUMENTAÇÃO", "PLANO DOCUMENTAÇÃO", "ETAPA GERAL", "ETAPA DETALHADA", "STATUS", "DETALHE DIÁRIO", "CÓD. PRESTADOR", "PRESTADOR", "VALOR", "GESTOR", "SITUAÇÃO", "DATA ATIVIDADE", "FATURAMENTO", "SOLICIT ID FAT", "RECEB ID FAT", "ID FATURAMENTO", "DATA FAT INPROUT", "SOLICIT FS PORTAL", "DATA FS", "NUM FS", "GATE", "GATE ID", "DATA CRIAÇÃO OS", "KEY"],

    colunasGestor: [
        "HISTÓRICO", "OS", "SITE", "CONTRATO", "SEGMENTO", "PROJETO", "GESTOR TIM", "REGIONAL",
        "LPU", "OBJETO CONTRATADO", "QUANTIDADE",
        "VISTORIA", "PLANO VISTORIA", "DESMOBILIZAÇÃO", "PLANO DESMOBILIZAÇÃO", "INSTALAÇÃO",
        "PLANO INSTALAÇÃO", "ATIVAÇÃO", "PLANO ATIVAÇÃO", "DOCUMENTAÇÃO", "PLANO DOCUMENTAÇÃO",
        "ETAPA GERAL", "ETAPA DETALHADA", "STATUS", "DETALHE DIÁRIO", "CÓD. PRESTADOR", "PRESTADOR",
        "VALOR", "GESTOR", "SITUAÇÃO", "DATA ATIVIDADE", "KEY"
    ],

    getHeaders: () => {
        const role = RegistrosState.userRole;
        if (role === 'MANAGER') return RegistrosRender.colunasGestor;
        return RegistrosRender.colunasCompletas;
    },

    dataMapping: {
        "OS": (linha) => RegistrosUtils.get(linha, 'os.os'), "SITE": (linha) => RegistrosUtils.get(linha, 'detalhe.site'),
        "CONTRATO": (linha) => RegistrosUtils.get(linha, 'detalhe.contrato'), "SEGMENTO": (linha) => RegistrosUtils.get(linha, 'os.segmento.nome'),
        "PROJETO": (linha) => RegistrosUtils.get(linha, 'os.projeto'), "GESTOR TIM": (linha) => RegistrosUtils.get(linha, 'os.gestorTim'),
        "REGIONAL": (linha) => RegistrosUtils.get(linha, 'detalhe.regional'), "LPU": (linha) => RegistrosUtils.get(linha, 'detalhe.lpu.codigoLpu'),
        "LOTE": (linha) => RegistrosUtils.get(linha, 'detalhe.lote'), "BOQ": (linha) => RegistrosUtils.get(linha, 'detalhe.boq'),
        "PO": (linha) => RegistrosUtils.get(linha, 'detalhe.po'), "ITEM": (linha) => RegistrosUtils.get(linha, 'detalhe.item'),
        "OBJETO CONTRATADO": (linha) => RegistrosUtils.get(linha, 'detalhe.lpu.nomeLpu'), "UNIDADE": (linha) => RegistrosUtils.get(linha, 'detalhe.unidade'),
        "QUANTIDADE": (linha) => RegistrosUtils.get(linha, 'detalhe.quantidade'), "VALOR TOTAL OS": (linha) => RegistrosUtils.formatarMoeda(RegistrosUtils.get(linha, 'detalhe.valorTotal')),
        "OBSERVAÇÕES": (linha) => RegistrosUtils.get(linha, 'detalhe.observacoes'), "DATA PO": (linha) => RegistrosUtils.formatarData(RegistrosUtils.get(linha, 'detalhe.dataPo')),
        "VISTORIA": (linha) => RegistrosUtils.get(linha, 'ultimoLancamento.vistoria'), "PLANO VISTORIA": (linha) => RegistrosUtils.formatarData(RegistrosUtils.get(linha, 'ultimoLancamento.planoVistoria')),
        "DESMOBILIZAÇÃO": (linha) => RegistrosUtils.get(linha, 'ultimoLancamento.desmobilizacao'), "PLANO DESMOBILIZAÇÃO": (linha) => RegistrosUtils.formatarData(RegistrosUtils.get(linha, 'ultimoLancamento.planoDesmobilizacao')),
        "INSTALAÇÃO": (linha) => RegistrosUtils.get(linha, 'ultimoLancamento.instalacao'), "PLANO INSTALAÇÃO": (linha) => RegistrosUtils.formatarData(RegistrosUtils.get(linha, 'ultimoLancamento.planoInstalacao')),
        "ATIVAÇÃO": (linha) => RegistrosUtils.get(linha, 'ultimoLancamento.ativacao'), "PLANO ATIVAÇÃO": (linha) => RegistrosUtils.formatarData(RegistrosUtils.get(linha, 'ultimoLancamento.planoAtivacao')),
        "DOCUMENTAÇÃO": (linha) => RegistrosUtils.get(linha, 'ultimoLancamento.documentacao'), "PLANO DOCUMENTAÇÃO": (linha) => RegistrosUtils.formatarData(RegistrosUtils.get(linha, 'ultimoLancamento.planoDocumentacao')),
        "ETAPA GERAL": (linha) => {
            const etapa = RegistrosUtils.get(linha, 'ultimoLancamento.etapa', null);
            return etapa ? `${etapa.codigoGeral} - ${etapa.nomeGeral}` : '-';
        },
        "ETAPA DETALHADA": (linha) => {
            const etapa = RegistrosUtils.get(linha, 'ultimoLancamento.etapa', null);
            return etapa ? `${etapa.indiceDetalhado} - ${etapa.nomeDetalhado}` : '-';
        },
        "STATUS": (linha) => RegistrosUtils.get(linha, 'ultimoLancamento.status'), "DETALHE DIÁRIO": (linha) => RegistrosUtils.get(linha, 'ultimoLancamento.detalheDiario'),
        "CÓD. PRESTADOR": (linha) => RegistrosUtils.get(linha, 'ultimoLancamento.prestador.codigo'), "PRESTADOR": (linha) => RegistrosUtils.get(linha, 'ultimoLancamento.prestador.nome'),
        "VALOR": (linha) => RegistrosUtils.formatarMoeda(RegistrosUtils.get(linha, 'ultimoLancamento.valor')), "GESTOR": (linha) => RegistrosUtils.get(linha, 'ultimoLancamento.manager.nome'),
        "SITUAÇÃO": (linha) => RegistrosUtils.get(linha, 'ultimoLancamento.situacao'), "DATA ATIVIDADE": (linha) => RegistrosUtils.formatarData(RegistrosUtils.get(linha, 'ultimoLancamento.dataAtividade')),
        "FATURAMENTO": (linha) => RegistrosUtils.get(linha, 'detalhe.faturamento'), "SOLICIT ID FAT": (linha) => RegistrosUtils.get(linha, 'detalhe.solitIdFat'),
        "RECEB ID FAT": (linha) => RegistrosUtils.get(linha, 'detalhe.recebIdFat'), "ID FATURAMENTO": (linha) => RegistrosUtils.get(linha, 'detalhe.idFaturamento'),
        "DATA FAT INPROUT": (linha) => RegistrosUtils.formatarData(RegistrosUtils.get(linha, 'detalhe.dataFatInprout')), "SOLICIT FS PORTAL": (linha) => RegistrosUtils.get(linha, 'detalhe.solitFsPortal'),
        "DATA FS": (linha) => RegistrosUtils.formatarData(RegistrosUtils.get(linha, 'detalhe.dataFs')), "NUM FS": (linha) => RegistrosUtils.get(linha, 'detalhe.numFs'),
        "GATE": (linha) => RegistrosUtils.get(linha, 'detalhe.gate'), "GATE ID": (linha) => RegistrosUtils.get(linha, 'detalhe.gateId'),
        "DATA CRIAÇÃO OS": (linha) => RegistrosUtils.formatarDataHora(RegistrosUtils.get(linha, 'detalhe.dataCriacaoItem')), "KEY": (linha) => RegistrosUtils.get(linha, 'detalhe.key'),
        "VALOR CPS LEGADO": (linha) => RegistrosUtils.formatarMoeda(RegistrosUtils.get(linha, 'os.valorCpsLegado'))
    },

    gerarHtmlParaGrupo: (grupo) => {
        const uniqueId = grupo.id;
        if (!grupo.linhas || grupo.linhas.length === 0) return '';

        const role = RegistrosState.userRole;
        const dadosOS = grupo.linhas[0].os || {};

        // Cálculos Financeiros
        const valorTotalOS = RegistrosUtils.get(grupo.linhas[0], 'os.detalhes', []).reduce((sum, d) => sum + (d.valorTotal || 0), 0);
        const valorTotalCPS = grupo.linhas.flatMap(linha => RegistrosUtils.get(linha, 'detalhe.lancamentos', []))
            .filter(lanc => ['APROVADO', 'APROVADO_CPS_LEGADO'].includes(lanc.situacaoAprovacao))
            .reduce((sum, lanc) => sum + (lanc.valor || 0), 0);

        const custoTotalMateriais = dadosOS.custoTotalMateriais || 0;
        const valorCpsLegado = dadosOS.valorCpsLegado || 0;
        const valorTransporte = dadosOS.transporte || 0;
        const totalGasto = valorTotalCPS + custoTotalMateriais + valorCpsLegado + valorTransporte;
        const percentual = valorTotalOS > 0 ? (totalGasto / valorTotalOS) * 100 : 0;

        // HTML dos KPIs
        let kpisInternosHTML = '';
        if (role !== 'MANAGER') {
            kpisInternosHTML += `
                <div class="header-kpi"><span class="kpi-label">Total OS</span><span class="kpi-value">${RegistrosUtils.formatarMoeda(valorTotalOS)}</span></div>`;
            if (valorCpsLegado > 0) {
                kpisInternosHTML += `<div class="header-kpi"><span class="kpi-label text-warning">Legado</span><span class="kpi-value text-warning">${RegistrosUtils.formatarMoeda(valorCpsLegado)}</span></div>`;
            }
            kpisInternosHTML += `
                <div class="header-kpi"><span class="kpi-label">CPS</span><span class="kpi-value">${RegistrosUtils.formatarMoeda(valorTotalCPS)}</span></div>
                <div class="header-kpi"><span class="kpi-label">Material</span><span class="kpi-value">${RegistrosUtils.formatarMoeda(custoTotalMateriais)}</span></div>
                <div class="header-kpi"><span class="kpi-label">Transp.</span><span class="kpi-value">${RegistrosUtils.formatarMoeda(valorTransporte)}</span></div>
                <div class="header-kpi"><span class="kpi-label">%</span><span class="kpi-value kpi-percentage">${percentual.toFixed(2)}%</span></div>`;
        }

        // Definição de Colunas
        const headersVisiveis = [...RegistrosRender.getHeaders()];
        if (['ADMIN', 'ASSISTANT', 'MANAGER', 'COORDINATOR'].includes(role)) {
            headersVisiveis.push("AÇÕES");
        }
        headersVisiveis.unshift("HISTÓRICO");

        // Geração das Linhas
        const bodyRowsHTML = grupo.linhas.map(linhaData => {
            const cellsHTML = headersVisiveis.map(header => {
                const detalheId = RegistrosUtils.get(linhaData, 'detalhe.id', '');

                if (header === "HISTÓRICO") {
                    const lancamentosCount = RegistrosUtils.get(linhaData, 'detalhe.lancamentos', []).length;
                    const isDisabled = !detalheId || lancamentosCount <= 1;
                    return `<td><button class="btn btn-sm btn-outline-info btn-historico" data-detalhe-id="${detalheId}" title="Ver Histórico" ${isDisabled ? 'disabled' : ''}><i class="bi bi-clock-history"></i></button></td>`;
                }

                if (header === "AÇÕES") {
                    let btnEditar = '';
                    if (['ADMIN', 'ASSISTANT', 'COORDINATOR', 'MANAGER'].includes(role)) {
                        btnEditar = detalheId ? `<button class="btn btn-sm btn-outline-primary btn-edit-detalhe" data-id="${detalheId}" title="Editar"><i class="bi bi-pencil-fill"></i></button>` : '';
                    }
                    let btnExcluir = '';
                    if (['ADMIN', 'ASSISTANT'].includes(role)) {
                        btnExcluir = `<button class="btn btn-sm btn-outline-danger btn-delete-registro" data-id="${detalheId}" title="Excluir"><i class="bi bi-trash-fill"></i></button>`;
                    }
                    return `<td><div class="d-flex justify-content-center gap-2">${btnEditar} ${btnExcluir}</div></td>`;
                }

                const func = RegistrosRender.dataMapping[header];
                const valor = func ? func(linhaData) : '-';
                let classes = '';
                if (["VISTORIA", "DESMOBILIZAÇÃO", "INSTALAÇÃO", "ATIVAÇÃO", "DOCUMENTAÇÃO"].includes(header)) {
                    classes += ' status-cell';
                    if (valor === 'OK') classes += ' status-ok'; else if (valor === 'NOK') classes += ' status-nok'; else if (valor === 'N/A') classes += ' status-na';
                }
                if (header === "DETALHE DIÁRIO") classes += ' detalhe-diario-cell';
                return `<td class="${classes}">${valor}</td>`;
            }).join('');
            return `<tr>${cellsHTML}</tr>`;
        }).join('');

        const headerHTML = `
        <h2 class="accordion-header" id="heading-${uniqueId}">
            <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapse-${uniqueId}">
                <div class="header-content">
                    <div class="header-title-wrapper">
                        <span class="header-title-project">${grupo.projeto || 'SEM PROJETO'}</span>
                        <span class="header-title-os">${grupo.os || 'SEM OS'}</span>
                    </div>
                    <div class="header-kpi-wrapper">
                        ${kpisInternosHTML}
                        <span class="header-badge">${grupo.linhas.length} itens</span>
                    </div>
                </div>
            </button>
        </h2>`;

        const bodyHTML = `
        <div id="collapse-${uniqueId}" class="accordion-collapse collapse" data-bs-parent="#accordion-registros">
            <div class="accordion-body">
                <div class="table-responsive">
                    <table class="table modern-table table-sm mb-0">
                        <thead><tr>${headersVisiveis.map(h => `<th>${h}</th>`).join('')}</tr></thead>
                        <tbody>${bodyRowsHTML}</tbody>
                    </table>
                </div>
            </div>
        </div>`;

        return `<div class="accordion-item" id="accordion-item-${uniqueId}">${headerHTML}${bodyHTML}</div>`;
    },

    renderizarTabela: () => {
        const accordionContainer = document.getElementById('accordion-registros');
        const paginationInfo = document.getElementById('pagination-info');
        accordionContainer.innerHTML = '';

        // Agrupa os dados que vieram do servidor
        const grupos = RegistrosRender.transformarEmGrupos(RegistrosState.todasAsLinhas);

        if (grupos.length === 0) {
            accordionContainer.innerHTML = `<div class="text-center p-4 text-muted">Nenhum registro encontrado.</div>`;
            if (paginationInfo) paginationInfo.textContent = '0 registros';
            RegistrosRender.atualizarBotoesPaginacao();
            return;
        }

        const frag = document.createDocumentFragment();
        grupos.forEach(grupo => {
            const html = RegistrosRender.gerarHtmlParaGrupo(grupo);
            frag.appendChild(document.createRange().createContextualFragment(html));
        });
        accordionContainer.appendChild(frag);

        // Atualiza info de paginação
        if (paginationInfo) {
            const inicio = (RegistrosState.paginaAtual * RegistrosState.linhasPorPagina) + 1;
            const fim = Math.min((RegistrosState.paginaAtual + 1) * RegistrosState.linhasPorPagina, RegistrosState.totalElementos);
            paginationInfo.textContent = `${inicio}-${fim} de ${RegistrosState.totalElementos} registros`;
        }

        RegistrosRender.atualizarBotoesPaginacao();
    },

    renderizarTabelaComFiltro: () => {
        const termoBusca = document.getElementById('searchInput').value.toLowerCase().trim();
        const infoBuscaContainer = document.getElementById('info-busca-container');

        // Limpa avisos de busca anteriores
        if (infoBuscaContainer) infoBuscaContainer.innerHTML = '';

        // Agora a lista base é SEMPRE a total, pois carregamos tudo no início
        let listaBase = RegistrosState.todasAsLinhas;

        const linhasFiltradas = termoBusca
            ? listaBase.filter(linhaData => {
                const textoPesquisavel = [
                    RegistrosUtils.get(linhaData, 'os.os', ''),
                    RegistrosUtils.get(linhaData, 'detalhe.site', ''),
                    RegistrosUtils.get(linhaData, 'detalhe.contrato', ''),
                    RegistrosUtils.get(linhaData, 'os.projeto', ''),
                    RegistrosUtils.get(linhaData, 'detalhe.lpu.nomeLpu', ''),
                    RegistrosUtils.get(linhaData, 'detalhe.lpu.codigoLpu', ''),
                    RegistrosUtils.get(linhaData, 'detalhe.key', '')
                ].join(' ').toLowerCase();
                return textoPesquisavel.includes(termoBusca);
            })
            : listaBase;

        const agrupado = RegistrosRender.transformarEmGrupos(linhasFiltradas);
        RegistrosState.gruposFiltradosCache = agrupado;
        RegistrosState.paginaAtual = 1;
        RegistrosRender.renderizarTabela();
    },

    transformarEmGrupos: (lista) => {
        if (!lista) return [];
        const agrupado = Object.values(lista.reduce((acc, linha) => {
            const chave = `${RegistrosUtils.get(linha, 'os.projeto', 'Sem Projeto')} / ${RegistrosUtils.get(linha, 'os.os', 'Sem OS')}`;
            if (!acc[chave]) {
                acc[chave] = {
                    linhas: [],
                    projeto: RegistrosUtils.get(linha, 'os.projeto', 'Sem Projeto'),
                    os: RegistrosUtils.get(linha, 'os.os', 'Sem OS'),
                    id: RegistrosUtils.get(linha, 'os.id', Math.random())
                };
            }
            acc[chave].linhas.push(linha);
            return acc;
        }, {}));

        // A ordenação já vem do banco, mas mantemos o agrupamento visual
        return agrupado;
    },

    atualizarBotoesPaginacao: () => {
        const btnPrimeira = document.getElementById('btnPrimeiraPagina');
        const btnAnterior = document.getElementById('btnPaginaAnterior');
        const btnProxima = document.getElementById('btnProximaPagina');
        const btnUltima = document.getElementById('btnUltimaPagina');

        const isFirst = RegistrosState.paginaAtual === 0;
        const isLast = (RegistrosState.paginaAtual + 1) >= RegistrosState.totalPaginas;

        if (btnPrimeira) btnPrimeira.disabled = isFirst;
        if (btnAnterior) btnAnterior.disabled = isFirst;
        if (btnProxima) btnProxima.disabled = isLast;
        if (btnUltima) btnUltima.disabled = isLast;
    },

    colunasCompletas: ["OS", "SITE", "CONTRATO", "SEGMENTO", "PROJETO", "GESTOR TIM", "REGIONAL", "LPU", "LOTE", "BOQ", "PO", "ITEM", "OBJETO CONTRATADO", "UNIDADE", "QUANTIDADE", "VALOR TOTAL OS", "OBSERVAÇÕES", "DATA PO", "VISTORIA", "PLANO VISTORIA", "DESMOBILIZAÇÃO", "PLANO DESMOBILIZAÇÃO", "INSTALAÇÃO", "PLANO INSTALAÇÃO", "ATIVAÇÃO", "PLANO ATIVAÇÃO", "DOCUMENTAÇÃO", "PLANO DOCUMENTAÇÃO", "ETAPA GERAL", "ETAPA DETALHADA", "STATUS", "DETALHE DIÁRIO", "CÓD. PRESTADOR", "PRESTADOR", "VALOR", "GESTOR", "SITUAÇÃO", "DATA ATIVIDADE", "FATURAMENTO", "SOLICIT ID FAT", "RECEB ID FAT", "ID FATURAMENTO", "DATA FAT INPROUT", "SOLICIT FS PORTAL", "DATA FS", "NUM FS", "GATE", "GATE ID", "DATA CRIAÇÃO OS", "KEY"],
    colunasGestor: ["HISTÓRICO", "OS", "SITE", "CONTRATO", "SEGMENTO", "PROJETO", "GESTOR TIM", "REGIONAL", "LPU", "OBJETO CONTRATADO", "QUANTIDADE", "VISTORIA", "PLANO VISTORIA", "DESMOBILIZAÇÃO", "PLANO DESMOBILIZAÇÃO", "INSTALAÇÃO", "PLANO INSTALAÇÃO", "ATIVAÇÃO", "PLANO ATIVAÇÃO", "DOCUMENTAÇÃO", "PLANO DOCUMENTAÇÃO", "ETAPA GERAL", "ETAPA DETALHADA", "STATUS", "DETALHE DIÁRIO", "CÓD. PRESTADOR", "PRESTADOR", "VALOR", "GESTOR", "SITUAÇÃO", "DATA ATIVIDADE", "KEY"],
    getHeaders: () => (RegistrosState.userRole === 'MANAGER' ? RegistrosRender.colunasGestor : RegistrosRender.colunasCompletas),
    dataMapping: {
        "OS": (linha) => RegistrosUtils.get(linha, 'os.os'), "SITE": (linha) => RegistrosUtils.get(linha, 'detalhe.site'),
        "CONTRATO": (linha) => RegistrosUtils.get(linha, 'detalhe.contrato'), "SEGMENTO": (linha) => RegistrosUtils.get(linha, 'os.segmento.nome'),
        "PROJETO": (linha) => RegistrosUtils.get(linha, 'os.projeto'), "GESTOR TIM": (linha) => RegistrosUtils.get(linha, 'os.gestorTim'),
        "REGIONAL": (linha) => RegistrosUtils.get(linha, 'detalhe.regional'), "LPU": (linha) => RegistrosUtils.get(linha, 'detalhe.lpu.codigoLpu'),
        "LOTE": (linha) => RegistrosUtils.get(linha, 'detalhe.lote'), "BOQ": (linha) => RegistrosUtils.get(linha, 'detalhe.boq'),
        "PO": (linha) => RegistrosUtils.get(linha, 'detalhe.po'), "ITEM": (linha) => RegistrosUtils.get(linha, 'detalhe.item'),
        "OBJETO CONTRATADO": (linha) => RegistrosUtils.get(linha, 'detalhe.lpu.nomeLpu'), "UNIDADE": (linha) => RegistrosUtils.get(linha, 'detalhe.unidade'),
        "QUANTIDADE": (linha) => RegistrosUtils.get(linha, 'detalhe.quantidade'), "VALOR TOTAL OS": (linha) => RegistrosUtils.formatarMoeda(RegistrosUtils.get(linha, 'detalhe.valorTotal')),
        "OBSERVAÇÕES": (linha) => RegistrosUtils.get(linha, 'detalhe.observacoes'), "DATA PO": (linha) => RegistrosUtils.formatarData(RegistrosUtils.get(linha, 'detalhe.dataPo')),
        "VISTORIA": (linha) => RegistrosUtils.get(linha, 'ultimoLancamento.vistoria'), "PLANO VISTORIA": (linha) => RegistrosUtils.formatarData(RegistrosUtils.get(linha, 'ultimoLancamento.planoVistoria')),
        "DESMOBILIZAÇÃO": (linha) => RegistrosUtils.get(linha, 'ultimoLancamento.desmobilizacao'), "PLANO DESMOBILIZAÇÃO": (linha) => RegistrosUtils.formatarData(RegistrosUtils.get(linha, 'ultimoLancamento.planoDesmobilizacao')),
        "INSTALAÇÃO": (linha) => RegistrosUtils.get(linha, 'ultimoLancamento.instalacao'), "PLANO INSTALAÇÃO": (linha) => RegistrosUtils.formatarData(RegistrosUtils.get(linha, 'ultimoLancamento.planoInstalacao')),
        "ATIVAÇÃO": (linha) => RegistrosUtils.get(linha, 'ultimoLancamento.ativacao'), "PLANO ATIVAÇÃO": (linha) => RegistrosUtils.formatarData(RegistrosUtils.get(linha, 'ultimoLancamento.planoAtivacao')),
        "DOCUMENTAÇÃO": (linha) => RegistrosUtils.get(linha, 'ultimoLancamento.documentacao'), "PLANO DOCUMENTAÇÃO": (linha) => RegistrosUtils.formatarData(RegistrosUtils.get(linha, 'ultimoLancamento.planoDocumentacao')),
        "ETAPA GERAL": (linha) => { const etapa = RegistrosUtils.get(linha, 'ultimoLancamento.etapa', null); return etapa ? `${etapa.codigoGeral} - ${etapa.nomeGeral}` : '-'; },
        "ETAPA DETALHADA": (linha) => { const etapa = RegistrosUtils.get(linha, 'ultimoLancamento.etapa', null); return etapa ? `${etapa.indiceDetalhado} - ${etapa.nomeDetalhado}` : '-'; },
        "STATUS": (linha) => RegistrosUtils.get(linha, 'ultimoLancamento.status'), "DETALHE DIÁRIO": (linha) => RegistrosUtils.get(linha, 'ultimoLancamento.detalheDiario'),
        "CÓD. PRESTADOR": (linha) => RegistrosUtils.get(linha, 'ultimoLancamento.prestador.codigo'), "PRESTADOR": (linha) => RegistrosUtils.get(linha, 'ultimoLancamento.prestador.nome'),
        "VALOR": (linha) => RegistrosUtils.formatarMoeda(RegistrosUtils.get(linha, 'ultimoLancamento.valor')), "GESTOR": (linha) => RegistrosUtils.get(linha, 'ultimoLancamento.manager.nome'),
        "SITUAÇÃO": (linha) => RegistrosUtils.get(linha, 'ultimoLancamento.situacao'), "DATA ATIVIDADE": (linha) => RegistrosUtils.formatarData(RegistrosUtils.get(linha, 'ultimoLancamento.dataAtividade')),
        "FATURAMENTO": (linha) => RegistrosUtils.get(linha, 'detalhe.faturamento'), "SOLICIT ID FAT": (linha) => RegistrosUtils.get(linha, 'detalhe.solitIdFat'),
        "RECEB ID FAT": (linha) => RegistrosUtils.get(linha, 'detalhe.recebIdFat'), "ID FATURAMENTO": (linha) => RegistrosUtils.get(linha, 'detalhe.idFaturamento'),
        "DATA FAT INPROUT": (linha) => RegistrosUtils.formatarData(RegistrosUtils.get(linha, 'detalhe.dataFatInprout')), "SOLICIT FS PORTAL": (linha) => RegistrosUtils.get(linha, 'detalhe.solitFsPortal'),
        "DATA FS": (linha) => RegistrosUtils.formatarData(RegistrosUtils.get(linha, 'detalhe.dataFs')), "NUM FS": (linha) => RegistrosUtils.get(linha, 'detalhe.numFs'),
        "GATE": (linha) => RegistrosUtils.get(linha, 'detalhe.gate'), "GATE ID": (linha) => RegistrosUtils.get(linha, 'detalhe.gateId'),
        "DATA CRIAÇÃO OS": (linha) => RegistrosUtils.formatarDataHora(RegistrosUtils.get(linha, 'detalhe.dataCriacaoItem')), "KEY": (linha) => RegistrosUtils.get(linha, 'detalhe.key'),
        "VALOR CPS LEGADO": (linha) => RegistrosUtils.formatarMoeda(RegistrosUtils.get(linha, 'os.valorCpsLegado'))
    },
    gerarHtmlParaGrupo: (grupo) => {
        const uniqueId = grupo.id;
        if (!grupo.linhas || grupo.linhas.length === 0) return '';
        const role = RegistrosState.userRole;
        const dadosOS = grupo.linhas[0].os || {};
        const valorTotalOS = RegistrosUtils.get(grupo.linhas[0], 'os.detalhes', []).reduce((sum, d) => sum + (d.valorTotal || 0), 0);
        const valorTotalCPS = grupo.linhas.flatMap(linha => RegistrosUtils.get(linha, 'detalhe.lancamentos', [])).filter(lanc => ['APROVADO', 'APROVADO_CPS_LEGADO'].includes(lanc.situacaoAprovacao)).reduce((sum, lanc) => sum + (lanc.valor || 0), 0);
        const custoTotalMateriais = dadosOS.custoTotalMateriais || 0;
        const valorCpsLegado = dadosOS.valorCpsLegado || 0;
        const valorTransporte = dadosOS.transporte || 0;
        const totalGasto = valorTotalCPS + custoTotalMateriais + valorCpsLegado + valorTransporte;
        const percentual = valorTotalOS > 0 ? (totalGasto / valorTotalOS) * 100 : 0;

        let kpisInternosHTML = '';
        if (role !== 'MANAGER') {
            kpisInternosHTML += `<div class="header-kpi"><span class="kpi-label">Total OS</span><span class="kpi-value">${RegistrosUtils.formatarMoeda(valorTotalOS)}</span></div>`;
            if (valorCpsLegado > 0) kpisInternosHTML += `<div class="header-kpi"><span class="kpi-label text-warning">Legado</span><span class="kpi-value text-warning">${RegistrosUtils.formatarMoeda(valorCpsLegado)}</span></div>`;
            kpisInternosHTML += `<div class="header-kpi"><span class="kpi-label">CPS</span><span class="kpi-value">${RegistrosUtils.formatarMoeda(valorTotalCPS)}</span></div><div class="header-kpi"><span class="kpi-label">Material</span><span class="kpi-value">${RegistrosUtils.formatarMoeda(custoTotalMateriais)}</span></div><div class="header-kpi"><span class="kpi-label">Transp.</span><span class="kpi-value">${RegistrosUtils.formatarMoeda(valorTransporte)}</span></div><div class="header-kpi"><span class="kpi-label">%</span><span class="kpi-value kpi-percentage">${percentual.toFixed(2)}%</span></div>`;
        }

        const headersVisiveis = [...RegistrosRender.getHeaders()];
        if (['ADMIN', 'ASSISTANT', 'MANAGER', 'COORDINATOR'].includes(role)) headersVisiveis.push("AÇÕES");
        headersVisiveis.unshift("HISTÓRICO");

        const bodyRowsHTML = grupo.linhas.map(linhaData => {
            const cellsHTML = headersVisiveis.map(header => {
                const detalheId = RegistrosUtils.get(linhaData, 'detalhe.id', '');
                if (header === "HISTÓRICO") {
                    const lancamentosCount = RegistrosUtils.get(linhaData, 'detalhe.lancamentos', []).length;
                    const isDisabled = !detalheId || lancamentosCount <= 1;
                    return `<td><button class="btn btn-sm btn-outline-info btn-historico" data-detalhe-id="${detalheId}" ${isDisabled ? 'disabled' : ''}><i class="bi bi-clock-history"></i></button></td>`;
                }
                if (header === "AÇÕES") {
                    let btnEditar = (['ADMIN', 'ASSISTANT', 'COORDINATOR', 'MANAGER'].includes(role) && detalheId) ? `<button class="btn btn-sm btn-outline-primary btn-edit-detalhe" data-id="${detalheId}"><i class="bi bi-pencil-fill"></i></button>` : '';
                    let btnExcluir = (['ADMIN', 'ASSISTANT'].includes(role)) ? `<button class="btn btn-sm btn-outline-danger btn-delete-registro" data-id="${detalheId}"><i class="bi bi-trash-fill"></i></button>` : '';
                    return `<td><div class="d-flex justify-content-center gap-2">${btnEditar} ${btnExcluir}</div></td>`;
                }
                const func = RegistrosRender.dataMapping[header];
                const valor = func ? func(linhaData) : '-';
                let classes = '';
                if (["VISTORIA", "DESMOBILIZAÇÃO", "INSTALAÇÃO", "ATIVAÇÃO", "DOCUMENTAÇÃO"].includes(header)) {
                    classes += ' status-cell ' + (valor === 'OK' ? 'status-ok' : valor === 'NOK' ? 'status-nok' : valor === 'N/A' ? 'status-na' : '');
                }
                if (header === "DETALHE DIÁRIO") classes += ' detalhe-diario-cell';
                return `<td class="${classes}">${valor}</td>`;
            }).join('');
            return `<tr>${cellsHTML}</tr>`;
        }).join('');

        const headerHTML = `<h2 class="accordion-header" id="heading-${uniqueId}"><button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapse-${uniqueId}"><div class="header-content"><div class="header-title-wrapper"><span class="header-title-project">${grupo.projeto || 'SEM PROJETO'}</span><span class="header-title-os">${grupo.os || 'SEM OS'}</span></div><div class="header-kpi-wrapper">${kpisInternosHTML}<span class="header-badge">${grupo.linhas.length} itens</span></div></div></button></h2>`;
        const bodyHTML = `<div id="collapse-${uniqueId}" class="accordion-collapse collapse" data-bs-parent="#accordion-registros"><div class="accordion-body"><div class="table-responsive"><table class="table modern-table table-sm mb-0"><thead><tr>${headersVisiveis.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${bodyRowsHTML}</tbody></table></div></div></div>`;
        return `<div class="accordion-item" id="accordion-item-${uniqueId}">${headerHTML}${bodyHTML}</div>`;
    }
};