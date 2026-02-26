/**
 * registros-render.js
 * Responsável por renderizar a tabela, os grupos e aplicar filtros visuais.
 */

const RegistrosRender = {
    // Definição das colunas
    colunasCompletas: ["OS", "SITE", "CONTRATO", "SEGMENTO", "PROJETO", "GESTOR TIM", "REGIONAL", "LPU", "LOTE", "BOQ", "PO", "ITEM", "OBJETO CONTRATADO", "UNIDADE", "QUANTIDADE", "VALOR TOTAL OS", "OBSERVAÇÕES", "DATA PO", "VISTORIA", "PLANO VISTORIA", "DESMOBILIZAÇÃO", "PLANO DESMOBILIZAÇÃO", "INSTALAÇÃO", "PLANO INSTALAÇÃO", "ATIVAÇÃO", "PLANO ATIVAÇÃO", "DOCUMENTAÇÃO", "PLANO DOCUMENTAÇÃO", "ETAPA GERAL", "ETAPA DETALHADA", "STATUS", "DETALHE DIÁRIO", "CÓD. PRESTADOR", "PRESTADOR", "VALOR", "GESTOR", "SITUAÇÃO", "DATA ATIVIDADE", "FATURAMENTO", "SOLICIT ID FAT", "RECEB ID FAT", "ID FATURAMENTO", "DATA FAT INPROUT", "SOLICIT FS PORTAL", "DATA FS", "NUM FS", "GATE", "GATE ID", "DATA CRIAÇÃO OS", "KEY", "STATUS REGISTRO"],

    colunasGestor: [
        "OS", "SITE", "CONTRATO", "SEGMENTO", "PROJETO", "GESTOR TIM", "REGIONAL",
        "LPU", "OBJETO CONTRATADO", "QUANTIDADE",
        "VISTORIA", "PLANO VISTORIA", "DESMOBILIZAÇÃO", "PLANO DESMOBILIZAÇÃO", "INSTALAÇÃO",
        "PLANO INSTALAÇÃO", "ATIVAÇÃO", "PLANO ATIVAÇÃO", "DOCUMENTAÇÃO", "PLANO DOCUMENTAÇÃO",
        "ETAPA GERAL", "ETAPA DETALHADA", "STATUS", "DETALHE DIÁRIO", "CÓD. PRESTADOR", "PRESTADOR",
        "VALOR", "GESTOR", "SITUAÇÃO", "DATA ATIVIDADE", "KEY", "STATUS REGISTRO"
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
        "STATUS": (linha) => RegistrosUtils.get(linha, 'ultimoLancamento.status'),
        "DETALHE DIÁRIO": (linha) => RegistrosUtils.get(linha, 'ultimoLancamento.detalheDiario'),
        "CÓD. PRESTADOR": (linha) => RegistrosUtils.get(linha, 'ultimoLancamento.prestador.codigo'), "PRESTADOR": (linha) => RegistrosUtils.get(linha, 'ultimoLancamento.prestador.nome'),
        "VALOR": (linha) => RegistrosUtils.formatarMoeda(RegistrosUtils.get(linha, 'ultimoLancamento.valor')), "GESTOR": (linha) => RegistrosUtils.get(linha, 'ultimoLancamento.manager.nome'),

        "SITUAÇÃO": (linha) => {
            if (RegistrosUtils.get(linha, 'detalhe.statusRegistro') === 'INATIVO') {
                return 'CANCELADO';
            }
            return RegistrosUtils.get(linha, 'ultimoLancamento.situacao');
        },

        "DATA ATIVIDADE": (linha) => RegistrosUtils.formatarData(RegistrosUtils.get(linha, 'ultimoLancamento.dataAtividade')),
        "FATURAMENTO": (linha) => RegistrosUtils.get(linha, 'detalhe.faturamento'), "SOLICIT ID FAT": (linha) => RegistrosUtils.get(linha, 'detalhe.solitIdFat'),
        "RECEB ID FAT": (linha) => RegistrosUtils.get(linha, 'detalhe.recebIdFat'), "ID FATURAMENTO": (linha) => RegistrosUtils.get(linha, 'detalhe.idFaturamento'),
        "DATA FAT INPROUT": (linha) => RegistrosUtils.formatarData(RegistrosUtils.get(linha, 'detalhe.dataFatInprout')), "SOLICIT FS PORTAL": (linha) => RegistrosUtils.get(linha, 'detalhe.solitFsPortal'),
        "DATA FS": (linha) => RegistrosUtils.formatarData(RegistrosUtils.get(linha, 'detalhe.dataFs')), "NUM FS": (linha) => RegistrosUtils.get(linha, 'detalhe.numFs'),
        "GATE": (linha) => RegistrosUtils.get(linha, 'detalhe.gate'), "GATE ID": (linha) => RegistrosUtils.get(linha, 'detalhe.gateId'),
        "DATA CRIAÇÃO OS": (linha) => RegistrosUtils.formatarDataHora(RegistrosUtils.get(linha, 'detalhe.dataCriacaoItem')), "KEY": (linha) => RegistrosUtils.get(linha, 'detalhe.key'),
        "VALOR CPS LEGADO": (linha) => RegistrosUtils.formatarMoeda(RegistrosUtils.get(linha, 'os.valorCpsLegado')),
        "STATUS REGISTRO": (linha) => RegistrosUtils.get(linha, 'detalhe.statusRegistro', 'ATIVO')
    },

    verificarSeOsFinalizada: (grupo) => {
        if (!grupo.linhas || grupo.linhas.length === 0) return false;
        return grupo.linhas.every(linha => {
            const situacao = RegistrosUtils.get(linha, 'ultimoLancamento.situacao');
            const isInativo = RegistrosUtils.get(linha, 'detalhe.statusRegistro') === 'INATIVO';
            if (isInativo) return true;
            return situacao && String(situacao).toUpperCase().trim() === 'FINALIZADO';
        });
    },

    gerarHtmlParaGrupo: (grupo) => {
        const uniqueId = grupo.id;
        if (!grupo.linhas || grupo.linhas.length === 0) return '';

        const role = RegistrosState.userRole;
        const dadosOS = grupo.linhas[0].os || {};
        const osIdReal = dadosOS.id;

        // --- CÁLCULO FINANCEIRO ATUALIZADO (BOQ) ---
        let valorTotalOS = 0;
        let valorEmAnalise = 0;

        // Filtra inativos para o Total OS (regra: INATIVO desabilita Total OS)
        const detalhesAtivos = RegistrosUtils.get(grupo.linhas[0], 'os.detalhes', [])
            .filter(d => d.statusRegistro !== 'INATIVO');

        detalhesAtivos.forEach(d => {
            // Garante que é string, remove espaços e verifica se é vazio ou hifen
            let boq = d.boq ? String(d.boq).trim() : '';
            if (boq === '') boq = '-';

            const valorItem = d.valorTotal || 0;

            if (boq === '-') {
                // Se BOQ for hifen ou vazio -> EM ANÁLISE
                valorEmAnalise += valorItem;
            } else {
                // Se tiver qualquer outra coisa no BOQ -> TOTAL OS
                valorTotalOS += valorItem;
            }
        });

        // CORREÇÃO AQUI: Removemos o filtro de INATIVO para o cálculo de CPS
        const valorTotalCPS = grupo.linhas.flatMap(linha => {
            // Se o registro for INATIVO, ainda assim contabilizamos os custos realizados (CPS)
            return RegistrosUtils.get(linha, 'detalhe.lancamentos', []);
        })
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
                <div class="header-kpi"><span class="kpi-label">Total OS</span><span class="kpi-value">${RegistrosUtils.formatarMoeda(valorTotalOS)}</span></div>
                <div class="header-kpi"><span class="kpi-label text-info">Em Análise</span><span class="kpi-value text-info">${RegistrosUtils.formatarMoeda(valorEmAnalise)}</span></div>`;

            if (valorCpsLegado > 0) {
                kpisInternosHTML += `<div class="header-kpi"><span class="kpi-label text-warning">Legado</span><span class="kpi-value text-warning">${RegistrosUtils.formatarMoeda(valorCpsLegado)}</span></div>`;
            }
            kpisInternosHTML += `
                <div class="header-kpi"><span class="kpi-label">CPS</span><span class="kpi-value">${RegistrosUtils.formatarMoeda(valorTotalCPS)}</span></div>
                <div class="header-kpi"><span class="kpi-label">Material</span><span class="kpi-value">${RegistrosUtils.formatarMoeda(custoTotalMateriais)}</span></div>
                <div class="header-kpi"><span class="kpi-label">Transp.</span><span class="kpi-value">${RegistrosUtils.formatarMoeda(valorTransporte)}</span></div>
                <div class="header-kpi"><span class="kpi-label">%</span><span class="kpi-value kpi-percentage">${percentual.toFixed(2)}%</span></div>`;
        }

        // --- Verificação de Status da OS e Ícone ---
        let temFinalizado = false;
        let temPendente = false;

        grupo.linhas.forEach(linha => {
            const situacao = RegistrosUtils.get(linha, 'ultimoLancamento.situacao');
            const isInativo = RegistrosUtils.get(linha, 'detalhe.statusRegistro') === 'INATIVO';

            if (!isInativo) {
                const situacaoNormalizada = situacao ? String(situacao).toUpperCase().trim() : 'PENDENTE';
                if (situacaoNormalizada === 'FINALIZADO') {
                    temFinalizado = true;
                } else {
                    temPendente = true;
                }
            }
        });

        const isTotalmenteFinalizada = RegistrosRender.verificarSeOsFinalizada(grupo);
        const headerStyle = isTotalmenteFinalizada ? 'style="background-color: #fff3cd !important;"' : '';

        let btnFinalizarOsHTML = '';
        if (['ADMIN', 'COORDINATOR', 'MANAGER'].includes(role)) {
            if (temFinalizado && temPendente) {
                btnFinalizarOsHTML = `
                    <div class="icon-hover-wrapper me-3" 
                         role="button"
                         data-os-id="${osIdReal}"
                         title="Finalizar atividades pendentes"
                         data-bs-toggle="tooltip"
                         style="cursor: pointer; transition: all 0.2s;">
                        <div class="d-flex align-items-center justify-content-center rounded-circle bg-success bg-opacity-10 text-success p-2" 
                             style="width: 38px; height: 38px;">
                            <i class="bi bi-clipboard-check-fill" style="font-size: 1.1rem;"></i>
                        </div>
                    </div>
                `;
            }
        }

        const headersVisiveis = [...RegistrosRender.getHeaders()];
        if (['ADMIN', 'ASSISTANT', 'MANAGER', 'COORDINATOR'].includes(role)) {
            headersVisiveis.push("AÇÕES");
        }
        headersVisiveis.unshift("HISTÓRICO"); // Adiciona o histórico aqui

        const bodyRowsHTML = grupo.linhas.map(linhaData => {
            const detalheId = RegistrosUtils.get(linhaData, 'detalhe.id', '');

            const statusRegistro = RegistrosUtils.get(linhaData, 'detalhe.statusRegistro', 'ATIVO');
            const isInativo = statusRegistro === 'INATIVO';
            const rowClass = isInativo ? 'row-inativo' : '';

            const cellsHTML = headersVisiveis.map(header => {
                if (header === "HISTÓRICO") {
                    const lancamentosCount = RegistrosUtils.get(linhaData, 'detalhe.lancamentos', []).length;
                    const isDisabled = !detalheId || lancamentosCount <= 1;
                    return `<td><button class="btn btn-sm btn-outline-info btn-historico" data-detalhe-id="${detalheId}" title="Ver Histórico" ${isDisabled ? 'disabled' : ''}><i class="bi bi-clock-history"></i></button></td>`;
                }

                if (header === "AÇÕES") {
                    let btnEditar = (['ADMIN', 'ASSISTANT', 'COORDINATOR', 'MANAGER'].includes(role) && detalheId)
                        ? `<button class="btn btn-sm btn-outline-primary btn-edit-detalhe" data-id="${detalheId}" title="Editar"><i class="bi bi-pencil-fill"></i></button>` : '';

                    let btnExcluir = (['ADMIN', 'ASSISTANT'].includes(role))
                        ? `<button class="btn btn-sm btn-outline-danger btn-delete-registro" data-id="${detalheId}" title="Excluir"><i class="bi bi-trash-fill"></i></button>` : '';

                    let btnInativar = '';
                    if (['ADMIN', 'ASSISTANT'].includes(role) && detalheId) {
                        if (isInativo) {
                            btnInativar = `<button class="btn btn-sm btn-success btn-toggle-status" data-id="${detalheId}" data-status="INATIVO" title="Reativar Registro"><i class="bi bi-check-circle"></i></button>`;
                        } else {
                            btnInativar = `<button class="btn btn-sm btn-outline-secondary btn-toggle-status" data-id="${detalheId}" data-status="ATIVO" title="Inativar/Cancelar"><i class="bi bi-x-circle"></i></button>`;
                        }
                    }

                    return `<td><div class="d-flex justify-content-center gap-2 btn-group-actions">${btnInativar} ${btnEditar} ${btnExcluir}</div></td>`;
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
            return `<tr class="${rowClass}">${cellsHTML}</tr>`;
        }).join('');

        const headerHTML = `
        <h2 class="accordion-header" id="heading-${uniqueId}">
            <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapse-${uniqueId}" ${headerStyle}>
                <div class="header-content w-100">
                    <div class="header-title-wrapper d-flex flex-row align-items-center">
                        ${btnFinalizarOsHTML}
                        <div class="d-flex flex-column text-start">
                             <span class="header-title-project fw-bold">${grupo.projeto || 'SEM PROJETO'}</span>
                             <span class="header-title-os text-muted small">${grupo.os || 'SEM OS'}</span>
                        </div>
                    </div>
                    <div class="header-kpi-wrapper ms-auto">
                        ${kpisInternosHTML}
                        <span class="header-badge badge bg-secondary ms-2">${grupo.linhas.length} itens</span>
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

        let grupos = RegistrosRender.transformarEmGrupos(RegistrosState.todasAsLinhas);

        if (grupos.length === 0) {
            accordionContainer.innerHTML = `<div class="text-center p-4 text-muted">Nenhum registro encontrado.</div>`;
            if (paginationInfo) paginationInfo.textContent = '0 registros';
            RegistrosRender.atualizarBotoesPaginacao();
            return;
        }

        if (['ADMIN', 'ASSISTANT'].includes(RegistrosState.userRole)) {
            grupos.sort((a, b) => {
                const aFinalizada = RegistrosRender.verificarSeOsFinalizada(a);
                const bFinalizada = RegistrosRender.verificarSeOsFinalizada(b);
                if (aFinalizada && !bFinalizada) return -1;
                if (!aFinalizada && bFinalizada) return 1;
                return 0;
            });
        }

        const frag = document.createDocumentFragment();
        grupos.forEach(grupo => {
            const html = RegistrosRender.gerarHtmlParaGrupo(grupo);
            frag.appendChild(document.createRange().createContextualFragment(html));
        });
        accordionContainer.appendChild(frag);

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

        if (infoBuscaContainer) infoBuscaContainer.innerHTML = '';

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
                    RegistrosUtils.get(linhaData, 'detalhe.key', ''),
                    RegistrosUtils.get(linhaData, 'detalhe.lote', '') // <--- ADICIONADO AQUI
                ].join(' ').toLowerCase();
                return textoPesquisavel.includes(termoBusca);
            })
            : listaBase;

        let grupos = RegistrosRender.transformarEmGrupos(linhasFiltradas);

        if (['ADMIN', 'ASSISTANT'].includes(RegistrosState.userRole)) {
            grupos.sort((a, b) => {
                const aFinalizada = RegistrosRender.verificarSeOsFinalizada(a);
                const bFinalizada = RegistrosRender.verificarSeOsFinalizada(b);
                if (aFinalizada && !bFinalizada) return -1;
                if (!aFinalizada && bFinalizada) return 1;
                return 0;
            });
        }

        const accordionContainer = document.getElementById('accordion-registros');
        accordionContainer.innerHTML = '';
        if (grupos.length === 0) {
            accordionContainer.innerHTML = `<div class="text-center p-4 text-muted">Nenhum registro encontrado na busca.</div>`;
            return;
        }
        const frag = document.createDocumentFragment();
        grupos.forEach(grupo => {
            const html = RegistrosRender.gerarHtmlParaGrupo(grupo);
            frag.appendChild(document.createRange().createContextualFragment(html));
        });
        accordionContainer.appendChild(frag);
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

    renderizarDashboardAnalise: () => {
        RegistrosApi.carregarDashboard();
    },

    renderizarCardsDoBackend: (dadosAgrupados) => {
        const container = document.getElementById('dashboard-analise-container');
        const loader = document.getElementById('dashboard-loader');

        if (!container) return;
        if (loader) loader.classList.add('d-none');
        container.innerHTML = '';

        if (!dadosAgrupados || Object.keys(dadosAgrupados).length === 0) {
            container.innerHTML = '<div class="col-12 text-center text-muted p-5">Nenhum dado encontrado.</div>';
            return;
        }

        // Renderiza cada Segmento utilizando a nova estrutura da API
        const html = Object.keys(dadosAgrupados).sort().map(segmentoNome => {
            const stats = dadosAgrupados[segmentoNome];
            return RegistrosRender.criarCardSegmento(segmentoNome, stats);
        }).join('');

        container.innerHTML = html;
    },

    criarCardSegmento: (nome, stats) => {
        const format = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const calcPct = (parcial, total) => total > 0 ? (parcial / total) * 100 : 0;

        // Bloco construtor interno para não repetir HTML 4 vezes
        const buildStatBlock = (title, icon, colorClass, data) => {
            return `
            <div class="stat-block">
                <div class="stat-title ${colorClass}">
                    <span><i class="bi ${icon} me-1"></i> ${title}</span>
                </div>
                <div class="stat-value">${format(data.total)}</div>
                ${data.total > 0 ? `
                    <div class="po-progress" title="Verde: Com PO | Laranja: Sem PO">
                        <div class="po-bar-ok" style="width: ${calcPct(data.comPo, data.total)}%"></div>
                        <div class="po-bar-warn" style="width: ${calcPct(data.semPo, data.total)}%"></div>
                    </div>
                    <div class="sub-info">
                        <span>Com PO: ${format(data.comPo)}</span>
                        <span class="${data.semPo > 0 ? 'text-danger fw-bold' : ''}">Sem PO: ${format(data.semPo)}</span>
                    </div>
                ` : ''}
            </div>
            `;
        };

        return `
        <div class="segmento-card">
            <div class="segmento-header">
                <span>${nome}</span>
                <span class="badge-segmento">Segmento</span>
            </div>
            <div class="segmento-body">
                
                ${buildStatBlock('Apto a Faturar', 'bi-check-circle-fill', 'text-finalizado', stats.finalizado)}
                ${buildStatBlock('Em Andamento', 'bi-play-circle', 'text-andamento', stats.emAndamento)}
                ${buildStatBlock('Paralisado', 'bi-pause-circle', 'text-paralisado', stats.paralisado)}
                ${buildStatBlock('Aguard. Doc', 'bi-file-earmark-text', 'text-warning', stats.aguardandoDoc)}

                <div class="stat-block" style="border:none; padding-top:12px;">
                    <div class="stat-title text-nao-iniciado">
                        <span><i class="bi bi-circle me-1"></i> Não Iniciado</span>
                    </div>
                    <div class="stat-value fs-6 text-muted">${format(stats.naoIniciado.total)}</div>
                    ${stats.naoIniciado.total > 0 ? `
                        <div class="sub-info mt-1">
                            <span class="text-muted">Com PO: ${format(stats.naoIniciado.comPo)}</span>
                            <span class="text-muted ms-2">Sem PO: ${format(stats.naoIniciado.semPo)}</span>
                        </div>
                    ` : ''}
                </div>

            </div>
        </div>
        `;
    }
};