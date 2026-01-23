document.addEventListener('DOMContentLoaded', () => {

    const API_BASE_URL = 'http://localhost:8080';
    verificarMensagemAnoNovo();
    const toastElement = document.getElementById('toastMensagem');
    const toastBody = document.getElementById('toastTexto');
    const toast = toastElement ? new bootstrap.Toast(toastElement) : null;
    const searchInput = document.getElementById('searchInput');
    let indexDataFim = new Date();
    let indexDataInicio = new Date();
    indexDataInicio.setDate(indexDataFim.getDate() - 30);
    let tiposDocumentacaoCache = [];

    let sortConfig = {
        key: 'dataAtividade',
        direction: 'desc'
    };

    const formatarMoeda = (valor) => (valor || valor === 0) ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor) : '';
    const formatarData = (data) => data ? data.split('-').reverse().join('/') : '';

    const dataMapping = {
        "STATUS APROVAÇÃO": (lancamento) => (lancamento.situacaoAprovacao || '').replace(/_/g, ' '),
        "DATA ATIVIDADE": (lancamento) => lancamento.dataAtividade || '',
        "OS": (lancamento) => getNestedValue(lancamento, 'os.os'),
        "SITE": (lancamento) => getNestedValue(lancamento, 'detalhe.site'),
        "SEGMENTO": (lancamento) => getNestedValue(lancamento, 'os.segmento.nome'),
        "PROJETO": (lancamento) => getNestedValue(lancamento, 'os.projeto'),
        "LPU": (lancamento) => labelLpu(getNestedValue(lancamento, 'detalhe.lpu')),
        "GESTOR TIM": (lancamento) => getNestedValue(lancamento, 'os.gestorTim'),
        "REGIONAL": (lancamento) => getNestedValue(lancamento, 'detalhe.regional'),
        "VISTORIA": (lancamento) => lancamento.vistoria || 'N/A',
        "PLANO DE VISTORIA": (lancamento) => formatarData(lancamento.planoVistoria),
        "DESMOBILIZAÇÃO": (lancamento) => lancamento.desmobilizacao || 'N/A',
        "PLANO DE DESMOBILIZAÇÃO": (lancamento) => formatarData(lancamento.planoDesmobilizacao),
        "INSTALAÇÃO": (lancamento) => lancamento.instalacao || 'N/A',
        "PLANO DE INSTALAÇÃO": (lancamento) => formatarData(lancamento.planoInstalacao),
        "ATIVAÇÃO": (lancamento) => lancamento.ativacao || 'N/A',
        "PLANO DE ATIVAÇÃO": (lancamento) => formatarData(lancamento.planoAtivacao),
        "DOCUMENTAÇÃO": (lancamento) => lancamento.documentacao || 'N/A',
        "PLANO DE DOCUMENTAÇÃO": (lancamento) => formatarData(lancamento.planoDocumentacao),
        "ETAPA GERAL": (lancamento) => (getNestedValue(lancamento, 'etapa.codigoGeral') && getNestedValue(lancamento, 'etapa.nomeGeral')) ? `${getNestedValue(lancamento, 'etapa.codigoGeral')} - ${getNestedValue(lancamento, 'etapa.nomeGeral')}` : '',
        "ETAPA DETALHADA": (lancamento) => (getNestedValue(lancamento, 'etapa.indiceDetalhado') && getNestedValue(lancamento, 'etapa.nomeDetalhado')) ? `${getNestedValue(lancamento, 'etapa.indiceDetalhado')} - ${getNestedValue(lancamento, 'etapa.nomeDetalhado')}` : '',
        "STATUS": (lancamento) => lancamento.status || '',
        "SITUAÇÃO": (lancamento) => lancamento.situacao || '',
        "DETALHE DIÁRIO": (lancamento) => lancamento.detalheDiario || '',
        "CÓD. PRESTADOR": (lancamento) => getNestedValue(lancamento, 'prestador.codigo'),
        "PRESTADOR": (lancamento) => getNestedValue(lancamento, 'prestador.nome'),
        "VALOR": (lancamento) => formatarMoeda(lancamento.valor),
        "GESTOR": (lancamento) => getNestedValue(lancamento, 'manager.nome'),
        "TIPO DOC.": (lancamento) => lancamento.tipoDocumentacaoNome || '-',
        "DOCUMENTISTA": (lancamento) => lancamento.documentistaNome || '-',
        "STATUS DOC.": (lancamento) => lancamento.statusDocumentacao ? lancamento.statusDocumentacao.replace(/_/g, ' ') : '-',
        "AÇÃO": () => ''
    };

    function converterDataParaDDMMYYYY(isoDate) {
        if (!isoDate || !isoDate.includes('-')) return isoDate;
        const [ano, mes, dia] = isoDate.split('-');
        return `${dia}/${mes}/${ano}`;
    }

    const columnKeyMap = {
        "DATA ATIVIDADE": "dataAtividade",
        "OS": "os.os",
        "SITE": "detalhe.site",
        "SEGMENTO": "os.segmento.nome",
        "PROJETO": "os.projeto",
        "PRESTADOR": "prestador.nome",
        "VALOR": "valor",
        "GESTOR": "manager.nome",
        "SITUAÇÃO": "situacao",
        "STATUS APROVAÇÃO": "situacaoAprovacao"
    };

    const getNestedValue = (obj, path) => {
        if (!path) return undefined;
        return path.split('.').reduce((acc, part) => acc && acc[part], obj);
    };

    function mostrarToast(mensagem, tipo = 'success') {
        if (!toast || !toastBody) return;
        toastElement.classList.remove('text-bg-success', 'text-bg-danger');
        if (tipo === 'success') toastElement.classList.add('text-bg-success');
        else if (tipo === 'error') toastElement.classList.add('text-bg-danger');
        toastBody.textContent = mensagem;
        toast.show();
    }

    function parseDataBrasileira(dataString) {
        if (!dataString) return null;
        const [data, hora] = dataString.split(' ');
        if (!data) return null;
        const [dia, mes, ano] = data.split('/');
        if (!dia || !mes || !ano) return null;
        return new Date(`${ano}-${mes}-${dia}T${hora || '00:00:00'}`);
    }

    function labelLpu(lpu) {
        if (!lpu) return '';
        const codigo = lpu.codigo ?? lpu.codigoLpu ?? '';
        const nome = lpu.nome ?? lpu.nomeLpu ?? '';
        return `${codigo}${codigo && nome ? ' - ' : ''}${nome}`;
    }

    function toggleLoader(ativo = true) {
        const container = document.querySelector('.content-loader-container');
        if (container) {
            const overlay = container.querySelector("#overlay-loader");
            if (overlay) overlay.classList.toggle("d-none", !ativo);
        }
    }

    function toggleModalLoader(ativo = true) {
        const modalLoader = document.getElementById('modal-overlay-loader');
        if (modalLoader) modalLoader.classList.toggle('d-none', !ativo);
    }

    // ==========================================================
    // CONFIGURAÇÃO DE VISIBILIDADE POR ROLE
    // ==========================================================
    function configurarVisibilidadePorRole() {
        const userRole = (localStorage.getItem("role") || "").trim().toUpperCase();

        const navMinhasPendencias = document.getElementById('nav-item-minhas-pendencias');
        const navLancamentos = document.getElementById('nav-item-lancamentos');
        const navPendentes = document.getElementById('nav-item-pendentes');
        const navParalisados = document.getElementById('nav-item-paralisados');
        const navHistorico = document.getElementById('nav-item-historico');
        const navPendenteDoc = document.getElementById('nav-item-pendente-doc');

        const btnNovoLancamento = document.getElementById('btnNovoLancamento');
        const btnSolicitarMaterial = document.getElementById('btnSolicitarMaterial');
        const btnSolicitarComplementar = document.getElementById('btnSolicitarComplementar');
        const btnExportar = document.getElementById('btnExportar');

        const kpiPendenteContainer = document.getElementById('kpi-pendente-container');

        [navMinhasPendencias, navLancamentos, navPendentes, navParalisados, navHistorico].forEach(el => {
            if (el) el.style.display = 'block';
        });

        [btnNovoLancamento, btnSolicitarMaterial, btnSolicitarComplementar, btnExportar].forEach(el => {
            if (el) el.style.display = 'none';
        });

        if (kpiPendenteContainer) {
            kpiPendenteContainer.classList.remove('d-flex');
            kpiPendenteContainer.classList.add('d-none');
        }

        if (['COORDINATOR', 'ADMIN', 'CONTROLLER'].includes(userRole)) {
            if (kpiPendenteContainer) {
                kpiPendenteContainer.classList.remove('d-none');
                kpiPendenteContainer.classList.add('d-flex');
            }
        }

        const allowedRoles = ['MANAGER', 'ADMIN'];

        // --- CORREÇÃO: Visibilidade da Aba Docs. Pendentes ---
        if (!allowedRoles.includes(userRole)) {
            // Tenta achar pelo ID (caso você adicione no HTML)
            let tabDocs = document.getElementById('tab-docs-pendentes');

            // Se não achar pelo ID, procura pelo texto dentro das abas
            if (!tabDocs) {
                const allTabs = document.querySelectorAll('.nav-tabs .nav-link');
                allTabs.forEach(tab => {
                    const text = tab.textContent.trim().toLowerCase();
                    // Verifica variações do nome
                    if (text.includes('docs. pendentes') || text.includes('pendentes doc') || text.includes('documentação')) {
                        tabDocs = tab;
                    }
                });
            }

            // Remove a aba (o botão) e o painel correspondente se existirem
            if (tabDocs) {
                // Esconde o botão da aba (li ou button)
                const liParent = tabDocs.closest('li');
                if (liParent) liParent.style.display = 'none';
                else tabDocs.style.display = 'none';
            }
        }

        if (navPendenteDoc) {
            if (['ADMIN', 'MANAGER', 'COORDINATOR', 'CONTROLLER', 'DOCUMENTIST'].includes(userRole)) {
                navPendenteDoc.style.display = 'block';
            }
        }

        switch (userRole) {
            case 'MANAGER':
                [btnNovoLancamento, btnSolicitarMaterial, btnSolicitarComplementar].forEach(el => {
                    if (el) el.style.display = 'block';
                });
                break;

            case 'COORDINATOR':
                if (navLancamentos) navLancamentos.style.display = 'none';
                break;

            case 'CONTROLLER':
                if (btnExportar) btnExportar.style.display = 'block';
                if (btnSolicitarMaterial) btnSolicitarMaterial.style.display = 'block';
                break;

            case 'ADMIN':
            case 'ASSISTANT':
                [btnNovoLancamento, btnSolicitarMaterial, btnSolicitarComplementar, btnExportar].forEach(el => {
                    if (el) el.style.display = 'block';
                });
                break;
        }

        const tabAtiva = document.querySelector('#lancamentosTab .nav-link.active');
        if (!tabAtiva || tabAtiva.parentElement.style.display === 'none') {
            const primeiraAbaVisivel = document.querySelector('#lancamentosTab .nav-item[style*="block"] .nav-link');
            if (primeiraAbaVisivel) new bootstrap.Tab(primeiraAbaVisivel).show();
        }
    }

    const collapseElement = document.getElementById('collapseDashboardCards');
    const collapseIcon = document.querySelector('a[href="#collapseDashboardCards"] i');
    if (collapseElement && collapseIcon) {
        collapseElement.addEventListener('show.bs.collapse', () => collapseIcon.classList.replace('bi-chevron-down', 'bi-chevron-up'));
        collapseElement.addEventListener('hide.bs.collapse', () => collapseIcon.classList.replace('bi-chevron-up', 'bi-chevron-down'));
    }

    const tbodyLancamentos = document.getElementById('tbody-lancamentos');
    const tbodyPendentes = document.getElementById('tbody-pendentes');
    const tbodyHistorico = document.getElementById('tbody-historico');
    const tbodyMinhasPendencias = document.getElementById('tbody-minhas-pendencias');
    const tbodyParalisados = document.getElementById('tbody-paralisados');
    const notificacaoPendencias = document.getElementById('notificacao-pendencias');
    let filtrosAtivos = { periodo: null, status: null, osId: null };
    let todosLancamentos = [];

    const colunasPrincipais = ["STATUS APROVAÇÃO", "DATA ATIVIDADE", "OS", "SITE", "SEGMENTO", "PROJETO", "LPU", "GESTOR TIM", "REGIONAL", "VISTORIA", "PLANO DE VISTORIA", "DESMOBILIZAÇÃO", "PLANO DE DESMOBILIZAÇÃO", "INSTALAÇÃO", "PLANO DE INSTALAÇÃO", "ATIVAÇÃO", "PLANO DE ATIVAÇÃO", "DOCUMENTAÇÃO", "PLANO DE DOCUMENTAÇÃO", "ETAPA GERAL", "ETAPA DETALHADA", "STATUS", "SITUAÇÃO", "DETALHE DIÁRIO", "CÓD. PRESTADOR", "PRESTADOR", "VALOR", "GESTOR"];
    const colunasLancamentos = [...colunasPrincipais.filter(c => c !== "STATUS APROVAÇÃO"), "AÇÃO"];
    const colunasMinhasPendencias = colunasLancamentos;
    const colunasHistorico = [...colunasPrincipais, "AÇÃO"];
    const colunasPendenteDoc = [
        "SELEÇÃO",
        "AÇÃO",
        ...colunasPrincipais.filter(coluna => coluna !== "STATUS APROVAÇÃO")
    ];

    function renderizarCabecalho(colunas, theadElement) {
        if (!theadElement) return;
        let headerHTML = '<tr>';
        colunas.forEach(textoColuna => {
            if (textoColuna === 'SELEÇÃO') {
                // Checkbox mestre
                headerHTML += `<th class="text-center" style="width: 40px;"><input type="checkbox" class="form-check-input" id="check-all-doc"></th>`;
            } else {
                // ... (código existente de ordenação) ...
                const sortKey = columnKeyMap[textoColuna];
                if (sortKey) {
                    // ... logica de sort ...
                    const isSorted = sortConfig.key === sortKey;
                    const iconClass = isSorted ? (sortConfig.direction === 'asc' ? 'bi-sort-up' : 'bi-sort-down') : 'bi-arrow-down-up';
                    headerHTML += `<th class="sortable" data-sort-key="${sortKey}">${textoColuna} <i class="bi ${iconClass}"></i></th>`;
                } else {
                    headerHTML += `<th>${textoColuna}</th>`;
                }
            }
        });
        headerHTML += '</tr>';
        theadElement.innerHTML = headerHTML;

        // Listener para o "Selecionar Todos"
        if (theadElement.querySelector('#check-all-doc')) {
            setTimeout(() => { // Timeout para garantir que o DOM renderizou
                const checkAll = document.getElementById('check-all-doc');
                if (checkAll) {
                    checkAll.addEventListener('change', (e) => toggleSelecionarTodosDoc(e.target.checked));
                }
            }, 0);
        }
    }

    function renderizarCardsDashboard(lancamentos) {
        const hoje = new Date().toLocaleDateString('pt-BR');
        const statusPendenteAprovacao = ['PENDENTE_COORDENADOR', 'AGUARDANDO_EXTENSAO_PRAZO', 'PENDENTE_CONTROLLER'];
        const statusRecusado = ['RECUSADO_COORDENADOR', 'RECUSADO_CONTROLLER'];

        const totalLancamentosHoje = lancamentos.filter(l => l.situacaoAprovacao === 'RASCUNHO' && l.dataAtividade === hoje).length;
        const totalPendentesAprovacao = lancamentos.filter(l => statusPendenteAprovacao.includes(l.situacaoAprovacao)).length;
        const totalRecusados = lancamentos.filter(l => statusRecusado.includes(l.situacaoAprovacao)).length;
        const projetosAtivos = new Set();
        lancamentos.forEach(l => {
            if (l.situacao !== 'Paralisado' && l.situacao !== 'Finalizado' && l.os && l.detalhe && l.detalhe.lpu) {
                const chaveProjeto = `${l.os.id}-${l.detalhe.lpu.id}`;
                projetosAtivos.add(chaveProjeto);
            }
        });
        const totalEmAndamento = projetosAtivos.size;
        const totalParalisadas = getProjetosParalisados().length;
        const totalFinalizadasHoje = lancamentos.filter(l => l.situacao === 'Finalizado' && l.dataAtividade === hoje).length;

        document.getElementById('card-lancamentos-hoje').textContent = totalLancamentosHoje;
        document.getElementById('card-pendentes-aprovacao').textContent = totalPendentesAprovacao;
        document.getElementById('card-recusados').textContent = totalRecusados;
        document.getElementById('card-em-andamento').textContent = totalEmAndamento;
        document.getElementById('card-paralisadas').textContent = totalParalisadas;
        document.getElementById('card-finalizadas-hoje').textContent = totalFinalizadasHoje;
    }

    function aplicarEstiloStatus(cell, statusText) {
        if (!statusText) return;
        cell.classList.add('status-cell');
        const statusUpper = statusText.toUpperCase();
        if (statusUpper === 'OK') cell.classList.add('status-ok');
        else if (statusUpper === 'NOK') cell.classList.add('status-nok');
        else if (statusUpper === 'N/A') cell.classList.add('status-na');
    }

    function renderizarTabela(dados, tbodyElement, colunas) {
        if (!tbodyElement) return;
        tbodyElement.innerHTML = '';

        if (!dados || dados.length === 0) {
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = colunas.length;
            td.textContent = 'Nenhum lançamento encontrado.';
            td.className = 'text-center text-muted p-4';
            tr.appendChild(td);
            tbodyElement.appendChild(tr);
            return;
        }

        const projetosFinalizados = new Set();
        todosLancamentos.forEach(l => {
            if (l.situacao === 'Finalizado' && l.os && l.detalhe && l.detalhe.lpu) {
                const chaveProjeto = `${l.os.id}-${l.detalhe.lpu.id}`;
                projetosFinalizados.add(chaveProjeto);
            }
        });

        const userRole = (localStorage.getItem("role") || "").trim().toUpperCase();
        const frag = document.createDocumentFragment();

        dados.forEach(lancamento => {
            const tr = document.createElement('tr');
            const detalhe = lancamento.detalhe || {};
            const os = lancamento.os || {};
            const lpu = detalhe.lpu || {};
            const etapa = lancamento.etapa || {};
            const prestador = lancamento.prestador || {};
            const manager = lancamento.manager || {};

            const mapaDeCelulas = {
                "DATA ATIVIDADE": lancamento.dataAtividade || '', "OS": os.os || '', "SITE": detalhe.site || '',
                "SEGMENTO": os.segmento ? os.segmento.nome : '', "PROJETO": os.projeto || '', "LPU": labelLpu(lpu),
                "GESTOR TIM": os.gestorTim || '', "REGIONAL": detalhe.regional || '', "VISTORIA": lancamento.vistoria || 'N/A',
                "PLANO DE VISTORIA": formatarData(lancamento.planoVistoria), "DESMOBILIZAÇÃO": lancamento.desmobilizacao || 'N/A',
                "PLANO DE DESMOBILIZAÇÃO": formatarData(lancamento.planoDesmobilizacao), "INSTALAÇÃO": lancamento.instalacao || 'N/A',
                "PLANO DE INSTALAÇÃO": formatarData(lancamento.planoInstalacao), "ATIVAÇÃO": lancamento.ativacao || 'N/A',
                "PLANO DE ATIVAÇÃO": formatarData(lancamento.planoAtivacao), "DOCUMENTAÇÃO": lancamento.documentacao || 'N/A',
                "PLANO DE DOCUMENTAÇÃO": formatarData(lancamento.planoDocumentacao),
                "ETAPA GERAL": (etapa.codigoGeral && etapa.nomeGeral) ? `${etapa.codigoGeral} - ${etapa.nomeGeral}` : '',
                "ETAPA DETALHADA": (etapa.indiceDetalhado && etapa.nomeDetalhado) ? `${etapa.indiceDetalhado} - ${etapa.nomeDetalhado}` : '',
                "STATUS": lancamento.status || '', "SITUAÇÃO": lancamento.situacao || '', "DETALHE DIÁRIO": lancamento.detalheDiario || '',
                "CÓD. PRESTADOR": prestador.codigo || '', "PRESTADOR": prestador.nome || '', "VALOR": formatarMoeda(lancamento.valor),
                "GESTOR": manager.nome || '',
                "STATUS APROVAÇÃO": `<span class="badge rounded-pill text-bg-secondary">${(lancamento.situacaoAprovacao || '').replace(/_/g, ' ')}</span>`
            };

            colunas.forEach(nomeColuna => {
                const td = document.createElement('td');
                td.dataset.label = nomeColuna;

                if (nomeColuna === 'SELEÇÃO') {
                    td.className = "text-center";
                    td.innerHTML = `<input type="checkbox" class="form-check-input check-doc-item" value="${lancamento.id}">`;
                } else if (nomeColuna === 'AÇÃO') {
                    let buttonsHtml = '';

                    if (tbodyElement.id === 'tbody-pendente-doc') {
                        buttonsHtml += `<button class="btn btn-sm btn-primary btn-receber-doc" data-id="${lancamento.id}" title="Confirmar Recebimento"><i class="bi bi-file-earmark-check"></i></button>`;
                    }

                    if (userRole === 'ADMIN' || userRole === 'MANAGER') {
                        if (tbodyElement.id === 'tbody-minhas-pendencias') {
                            buttonsHtml += `<button class="btn btn-sm btn-success btn-reenviar" data-id="${lancamento.id}" title="Corrigir e Reenviar"><i class="bi bi-pencil-square"></i></button>`;
                            if (!lancamento.statusPagamento && lancamento.situacaoAprovacao !== 'RECUSADO_CONTROLLER') {
                                buttonsHtml += ` <button class="btn btn-sm btn-danger btn-excluir-lancamento" data-id="${lancamento.id}" title="Excluir Lançamento"><i class="bi bi-trash"></i></button>`;
                            }
                        } else if (tbodyElement.id === 'tbody-lancamentos') {
                            buttonsHtml += `<button class="btn btn-sm btn-secondary btn-editar-rascunho" data-id="${lancamento.id}" title="Editar Rascunho"><i class="bi bi-pencil"></i></button>`;
                            buttonsHtml += ` <button class="btn btn-sm btn-danger btn-excluir-lancamento" data-id="${lancamento.id}" title="Excluir Lançamento"><i class="bi bi-trash"></i></button>`;
                        } else if (tbodyElement.id === 'tbody-paralisados' || tbodyElement.id === 'tbody-historico') {
                            const chaveProjetoAtual = `${os.id}-${lpu.id}`;
                            if (typeof projetosFinalizados !== 'undefined' && !projetosFinalizados.has(chaveProjetoAtual)) {
                                buttonsHtml += `<button class="btn btn-sm btn-warning btn-retomar" data-id="${lancamento.id}" title="Retomar Lançamento"><i class="bi bi-play-circle"></i></button>`;
                            }
                        }
                    }

                    buttonsHtml += ` <button class="btn btn-sm btn-info btn-ver-comentarios" data-id="${lancamento.id}" title="Ver Comentários" data-bs-toggle="modal" data-bs-target="#modalComentarios"><i class="bi bi-chat-left-text"></i></button>`;

                    td.innerHTML = `<div class="btn-group" role="group">${buttonsHtml}</div>`;
                } else {
                    td.innerHTML = mapaDeCelulas[nomeColuna] || '';
                    if (["VISTORIA", "INSTALAÇÃO", "ATIVAÇÃO", "DOCUMENTAÇÃO", "DESMOBILIZAÇÃO"].includes(nomeColuna)) {
                        aplicarEstiloStatus(td, mapaDeCelulas[nomeColuna]);
                    }
                    if (nomeColuna === "DETALHE DIÁRIO") td.classList.add('detalhe-diario-cell');
                }
                tr.appendChild(td);
            });
            frag.appendChild(tr);
        });
        tbodyElement.appendChild(frag);
    }

    function getDadosFiltrados() {
        let dadosFiltrados = [...todosLancamentos];
        const termoBusca = searchInput.value.toLowerCase().trim();

        if (termoBusca) {
            dadosFiltrados = dadosFiltrados.filter(l => {
                const textoPesquisavel = [
                    l.os?.os, l.detalhe?.site, l.os?.segmento?.nome, l.os?.projeto,
                    l.detalhe?.lpu?.nomeLpu, l.detalhe?.lpu?.codigoLpu, l.prestador?.nome
                ].join(' ').toLowerCase();
                return textoPesquisavel.includes(termoBusca);
            });
        }

        if (filtrosAtivos.periodo) {
            const hoje = new Date();
            hoje.setHours(0, 0, 0, 0);
            dadosFiltrados = dadosFiltrados.filter(l => {
                const partesData = l.dataAtividade.split('/');
                const dataAtividade = new Date(partesData[2], partesData[1] - 1, partesData[0]);
                if (filtrosAtivos.periodo.start && filtrosAtivos.periodo.end) {
                    return dataAtividade >= filtrosAtivos.periodo.start && dataAtividade <= filtrosAtivos.periodo.end;
                }
                switch (filtrosAtivos.periodo) {
                    case 'hoje': return dataAtividade.getTime() === hoje.getTime();
                    case 'ontem': const ontem = new Date(hoje); ontem.setDate(hoje.getDate() - 1); return dataAtividade.getTime() === ontem.getTime();
                    case 'semana': const umaSemanaAtras = new Date(hoje); umaSemanaAtras.setDate(hoje.getDate() - 6); return dataAtividade >= umaSemanaAtras;
                    case 'mes': const umMesAtras = new Date(hoje); umMesAtras.setMonth(hoje.getMonth() - 1); return dataAtividade >= umMesAtras;
                    default: return true;
                }
            });
        }

        if (filtrosAtivos.status) {
            dadosFiltrados = dadosFiltrados.filter(l => l.situacaoAprovacao === filtrosAtivos.status);
        }

        if (filtrosAtivos.osId) {
            dadosFiltrados = dadosFiltrados.filter(l => l.os.id == filtrosAtivos.osId);
        }

        return dadosFiltrados;
    }

    function atualizarBarraAcoesDoc() {
        const checkboxes = document.querySelectorAll('.check-doc-item:checked');
        const count = checkboxes.length;
        const barra = document.getElementById('acoes-lote-doc');
        const contador = document.getElementById('contador-selecao-doc');

        if (barra && contador) {
            contador.textContent = count;
            if (count > 0) {
                barra.classList.remove('d-none');
                barra.classList.add('d-flex');
            } else {
                barra.classList.add('d-none');
                barra.classList.remove('d-flex');
            }
        }
    }

    function toggleSelecionarTodosDoc(checked) {
        const checkboxes = document.querySelectorAll('#tbody-pendente-doc .check-doc-item');
        checkboxes.forEach(cb => cb.checked = checked);
        atualizarBarraAcoesDoc();
    }

    // Listener para checkboxes individuais (Delegation)
    document.getElementById('tbody-pendente-doc')?.addEventListener('change', (e) => {
        if (e.target.classList.contains('check-doc-item')) {
            atualizarBarraAcoesDoc();

            // Atualiza o estado do "Check All" se todos forem desmarcados manualmente
            const all = document.querySelectorAll('#tbody-pendente-doc .check-doc-item');
            const checked = document.querySelectorAll('#tbody-pendente-doc .check-doc-item:checked');
            const checkAll = document.getElementById('check-all-doc');
            if (checkAll) {
                checkAll.checked = (all.length > 0 && all.length === checked.length);
                checkAll.indeterminate = (checked.length > 0 && checked.length < all.length);
            }
        }
    });

    // Botão de Abrir Modal para Lote
    const btnReceberLoteDoc = document.getElementById('btnReceberLoteDoc');
    if (btnReceberLoteDoc) {
        btnReceberLoteDoc.addEventListener('click', () => {
            // Usa o mesmo modal, mas limpa o ID oculto para sinalizar que é LOTE
            document.getElementById('idLancamentoReceberDoc').value = "LOTE";
            document.getElementById('comentarioRecebimento').value = "";

            // Atualiza o texto do modal para indicar lote
            const modalEl = document.getElementById('modalReceberDoc');
            const titulo = modalEl.querySelector('.modal-title');
            const corpo = modalEl.querySelector('.modal-body p');

            titulo.innerHTML = `<i class="bi bi-collection me-2"></i>Recebimento em Lote`;
            const qtd = document.getElementById('contador-selecao-doc').textContent;
            corpo.textContent = `Deseja confirmar o recebimento de documentação para os ${qtd} itens selecionados?`;

            new bootstrap.Modal(modalEl).show();
        });
    }

    async function carregarLancamentos(append = false) {
        if (!append) {
            indexDataFim = new Date();
            indexDataInicio = new Date();
            indexDataInicio.setDate(indexDataFim.getDate() - 30);
            todosLancamentos = [];
        }
        toggleLoader(true);
        try {
            const response = await fetchComAuth('http://localhost:8080/lancamentos');
            if (!response.ok) throw new Error(`Erro na rede: ${response.statusText}`);
            const lancamentosDaApi = await response.json();
            todosLancamentos = filtrarLancamentosParaUsuario(lancamentosDaApi);
            renderizarCardsDashboard(todosLancamentos);
            popularFiltroOS();
            renderizarTodasAsTabelas();
        } catch (error) {
            console.error('Falha ao buscar lançamentos:', error);
            mostrarToast('Falha ao carregar dados do servidor.', 'error');
        } finally {
            toggleLoader(false);
        }
    }

    function renderizarTodasAsTabelas() {
        const dadosParaExibir = getDadosFiltrados();

        // 1. Definição do Comparer (Deve vir antes de qualquer .sort(comparer))
        const comparer = (a, b) => {
            let valA = getNestedValue(a, sortConfig.key);
            let valB = getNestedValue(b, sortConfig.key);
            const isDate = sortConfig.key.toLowerCase().includes('data');
            const isValue = sortConfig.key.toLowerCase().includes('valor');
            if (isDate) { valA = valA ? parseDataBrasileira(valA) : new Date(0); valB = valB ? parseDataBrasileira(valB) : new Date(0); }
            else if (isValue) { valA = Number(valA) || 0; valB = Number(valB) || 0; }
            if (typeof valA === 'string') { return sortConfig.direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA); }
            else { return sortConfig.direction === 'asc' ? valA - valB : valB - valA; }
        };

        const statusPendentes = ['PENDENTE_COORDENADOR', 'AGUARDANDO_EXTENSAO_PRAZO', 'PENDENTE_CONTROLLER'];
        const statusRejeitados = ['RECUSADO_COORDENADOR', 'RECUSADO_CONTROLLER'];

        // 2. Filtragem e Ordenação
        const rascunhos = dadosParaExibir.filter(l => l.situacaoAprovacao === 'RASCUNHO').sort(comparer);
        const pendentesAprovacao = dadosParaExibir.filter(l => statusPendentes.includes(l.situacaoAprovacao)).sort(comparer);
        const minhasPendencias = dadosParaExibir.filter(l => statusRejeitados.includes(l.situacaoAprovacao)).sort(comparer);
        const historico = dadosParaExibir.filter(l => !['RASCUNHO', ...statusPendentes, ...statusRejeitados].includes(l.situacaoAprovacao)).sort(comparer);
        const paralisados = getProjetosParalisados().sort(comparer);

        // --- CORREÇÃO: Nova linha inserida AQUI, após o 'comparer' existir ---
        const pendentesDoc = dadosParaExibir.filter(l => l.statusDocumentacao === 'PENDENTE_RECEBIMENTO').sort(comparer);

        // 3. Atualização de KPIs
        const kpiValorEl = document.getElementById('kpi-valor-pendente');
        if (kpiValorEl) {
            const totalPendente = pendentesAprovacao.reduce((acc, curr) => acc + (curr.valor || 0), 0);
            kpiValorEl.textContent = formatarMoeda(totalPendente);
        }

        // 4. Renderização das Tabelas
        inicializarCabecalhos();
        renderizarTabela(rascunhos, tbodyLancamentos, colunasLancamentos);
        renderizarTabela(pendentesAprovacao, tbodyPendentes, colunasPrincipais);
        renderizarTabela(minhasPendencias, tbodyMinhasPendencias, colunasMinhasPendencias);
        renderizarTabela(historico, tbodyHistorico, colunasHistorico);
        renderizarTabela(paralisados, tbodyParalisados, colunasMinhasPendencias);

        // --- Renderiza a nova tabela de Documentação ---
        renderizarTabela(pendentesDoc, document.getElementById('tbody-pendente-doc'), colunasPendenteDoc);

        // 5. Atualização de Notificações e Badges
        if (notificacaoPendencias) {
            notificacaoPendencias.textContent = minhasPendencias.length;
            notificacaoPendencias.style.display = minhasPendencias.length > 0 ? '' : 'none';
        }

        const badgeDoc = document.getElementById('badge-pendente-doc');
        if (badgeDoc) {
            badgeDoc.textContent = pendentesDoc.length;
            badgeDoc.style.display = pendentesDoc.length > 0 ? '' : 'none';
        }

        atualizarContadorKpi();
    }

    function atualizarContadorKpi() {
        const abaAtivaBtn = document.querySelector('#lancamentosTab .nav-link.active');
        if (!abaAtivaBtn) return;
        const targetId = abaAtivaBtn.getAttribute('data-bs-target');
        const painelAtivo = document.querySelector(targetId);
        if (painelAtivo) {
            const linhas = painelAtivo.querySelectorAll('tbody tr');
            let total = linhas.length;
            if (total === 1 && linhas[0].textContent.includes('Nenhum')) total = 0;
            const elValor = document.getElementById('kpi-qtd-valor');
            const elLabel = document.getElementById('kpi-qtd-label');
            if (elValor) elValor.textContent = total;
            if (elLabel) elLabel.textContent = abaAtivaBtn.innerText.trim().split('\n')[0];
        }
    }

    const tabEls = document.querySelectorAll('button[data-bs-toggle="tab"]');
    tabEls.forEach(tabEl => {
        tabEl.addEventListener('shown.bs.tab', atualizarContadorKpi);
    });

    function adicionarListenersDeOrdenacao() {
        const theads = document.querySelectorAll('.tab-pane thead');
        theads.forEach(thead => {
            thead.addEventListener('click', (e) => {
                const header = e.target.closest('th.sortable');
                if (!header) return;
                const key = header.dataset.sortKey;
                if (sortConfig.key === key) sortConfig.direction = sortConfig.direction === 'asc' ? 'desc' : 'asc';
                else { sortConfig.key = key; sortConfig.direction = 'desc'; }
                renderizarTodasAsTabelas();
            });
        });
    }

    function criarHtmlLinhaItem() {
        return `
        <div class="item-row border-bottom pb-3 mb-3">
            <div class="row g-2 align-items-center">
                <div class="col-md">
                    <label class="form-label visually-hidden">Material</label>
                    <select class="form-select material-select" required>
                        <option selected disabled value="">Selecione o material...</option>
                    </select>
                </div>
                <div class="col-md-3">
                    <label class="form-label visually-hidden">Quantidade</label>
                    <input type="number" class="form-control quantidade-input" placeholder="Qtde." min="0.01" step="0.01" value="1" required>
                </div>
                <div class="col-md-auto">
                    <button type="button" class="btn btn-outline-danger btn-sm btn-remover-item" title="Remover Item">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </div>
            
            <div class="material-info-card">
                <div class="material-info-grid">
                    </div>
            </div>
        </div>`;
    }

    const modalAdicionarEl = document.getElementById('modalAdicionar');
    const modalAdicionar = modalAdicionarEl ? new bootstrap.Modal(modalAdicionarEl) : null;

    if (modalAdicionarEl) {
        const formAdicionar = document.getElementById('formAdicionar');
        const modalTitle = document.getElementById('modalAdicionarLabel');
        const btnSubmitPadrao = document.getElementById('btnSubmitAdicionar');
        const btnSalvarRascunho = document.getElementById('btnSalvarRascunho');
        const btnSalvarEEnviar = document.getElementById('btnSalvarEEnviar');
        const dataAtividadeInput = document.getElementById('dataAtividade');
        const lpuContainer = document.getElementById('lpuContainer');
        const selectProjeto = document.getElementById('projetoId');
        const selectOS = document.getElementById('osId');
        const selectLPU = document.getElementById('lpuId');
        const selectEtapaGeral = document.getElementById('etapaGeralSelect');
        const selectEtapaDetalhada = document.getElementById('etapaDetalhadaId');
        const selectStatus = document.getElementById('status');

        let todasAsOS = [];
        let todasAsEtapas = [];
        let todosOsPrestadores = [];

        formAdicionar.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitter = e.submitter || document.activeElement;
            const acao = submitter.dataset.acao;
            const editingId = formAdicionar.dataset.editingId;
            const osLpuDetalheIdCorreto = formAdicionar.dataset.osLpuDetalheId || document.getElementById('lpuId').value;
            const tipoDocValue = document.getElementById('tipoDocumentacaoId').value;
            const documentistaValue = document.getElementById('documentistaId').value;

            const payload = {
                managerId: localStorage.getItem('usuarioId'),
                osId: selectOS.value,
                tipoDocumentacaoId: tipoDocValue ? parseInt(tipoDocValue) : null,
                documentistaId: documentistaValue ? parseInt(documentistaValue) : null,
                prestadorId: document.getElementById('prestadorId').value,
                etapaDetalhadaId: selectEtapaDetalhada.value,
                dataAtividade: converterDataParaDDMMYYYY(document.getElementById('dataAtividade').value),
                vistoria: document.getElementById('vistoria').value,
                planoVistoria: converterDataParaDDMMYYYY(document.getElementById('planoVistoria').value) || null,
                desmobilizacao: document.getElementById('desmobilizacao').value,
                planoDesmobilizacao: converterDataParaDDMMYYYY(document.getElementById('planoDesmobilizacao').value) || null,
                instalacao: document.getElementById('instalacao').value,
                planoInstalacao: converterDataParaDDMMYYYY(document.getElementById('planoInstalacao').value) || null,
                ativacao: document.getElementById('ativacao').value,
                planoAtivacao: converterDataParaDDMMYYYY(document.getElementById('planoAtivacao').value) || null,
                documentacao: document.getElementById('documentacao').value,
                planoDocumentacao: converterDataParaDDMMYYYY(document.getElementById('planoDocumentacao').value) || null,
                status: selectStatus.value,
                situacao: document.getElementById('situacao').value,
                detalheDiario: document.getElementById('detalheDiario').value,
                valor: parseFloat(document.getElementById('valor').value.replace(/\./g, '').replace(',', '.')) || 0,
                situacaoAprovacao: acao === 'enviar' ? 'PENDENTE_COORDENADOR' : 'RASCUNHO',
                osLpuDetalheId: osLpuDetalheIdCorreto
            };

            const url = editingId ? `http://localhost:8080/lancamentos/${editingId}` : 'http://localhost:8080/lancamentos';
            const method = editingId ? 'PUT' : 'POST';

            try {
                toggleModalLoader(true);
                const response = await fetchComAuth(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                if (!response.ok) {
                    let errorMsg = 'Erro desconhecido no servidor.';
                    try { const errorData = await response.json(); errorMsg = errorData.message || JSON.stringify(errorData); }
                    catch (e) { errorMsg = await response.text(); }
                    throw new Error(errorMsg);
                }
                mostrarToast('Lançamento salvo com sucesso!', 'success');
                modalAdicionar.hide();
                await carregarLancamentos();
            } catch (error) {
                mostrarToast(error.message, 'error');
            } finally {
                toggleModalLoader(false);
            }
        });

        async function carregarEPopularLPU(osId) {
            const selectLPU = document.getElementById('lpuId');
            if (!osId) {
                lpuContainer.classList.add('d-none');
                selectLPU.innerHTML = '';
                return;
            }
            lpuContainer.classList.remove('d-none');
            selectLPU.innerHTML = '<option>Carregando LPUs...</option>';
            selectLPU.disabled = true;
            try {
                selectLPU.innerHTML = '<option value="" selected disabled>Selecione a LPU...</option>';
                const response = await fetchComAuth(`http://localhost:8080/os/${osId}`);
                if (!response.ok) throw new Error('Falha ao buscar detalhes da OS.');
                const osData = await response.json();
                const lpusParaExibir = osData.detalhes;
                if (lpusParaExibir && lpusParaExibir.length > 0) {
                    lpusParaExibir.forEach(item => {
                        const lpu = item.lpu || item;
                        const quantidade = item.quantidade || 'N/A';
                        const key = item.key || 'N/A';
                        const codigo = lpu.codigoLpu || lpu.codigo || '';
                        const nome = lpu.nomeLpu || lpu.nome || '';
                        const label = `${codigo} - ${nome} | Qtd: ${quantidade} | Key: ${key}`;
                        selectLPU.add(new Option(label, item.id));
                    });
                }
                if (selectLPU.options.length <= 1) selectLPU.innerHTML = '<option value="" disabled>Nenhuma LPU encontrada.</option>';
                else selectLPU.disabled = false;
            } catch (error) {
                mostrarToast(error.message, 'error');
                lpuContainer.classList.add('d-none');
            }
        }

        selectOS.addEventListener('change', async (e) => {
            const osId = e.target.value;
            const os = todasAsOS.find(os => os.id == osId);
            if (os && selectProjeto.value !== os.projeto) selectProjeto.value = os.projeto;
            preencherCamposOS(os);
            await carregarEPopularLPU(osId);
        });

        selectProjeto.addEventListener('change', async (e) => {
            const projeto = e.target.value;
            const primeiraOSDoProjeto = todasAsOS.find(os => os.projeto === projeto);
            if (primeiraOSDoProjeto) {
                selectOS.value = primeiraOSDoProjeto.id;
                selectOS.dispatchEvent(new Event('change'));
            }
        });

        async function popularSelect(selectElement, url, valueField, textFieldFormatter) {
            try {
                const response = await fetchComAuth(url);
                if (!response.ok) throw new Error(`Falha ao carregar dados: ${response.statusText}`);
                const data = await response.json();
                if (selectElement.id.includes('prestadorId') && typeof Choices !== 'undefined') {
                    if (selectElement.choices) selectElement.choices.destroy();
                    selectElement.innerHTML = '';
                    const choices = new Choices(selectElement, { searchEnabled: true, placeholder: true, placeholderValue: 'Busque pelo nome ou código...', itemSelectText: '', noResultsText: 'Nenhum resultado' });
                    const choicesData = data.map(item => ({ value: item[valueField], label: textFieldFormatter(item) }));
                    choices.setChoices(choicesData, 'value', 'label', false);
                    selectElement.choices = choices;
                } else {
                    selectElement.innerHTML = `<option value="" selected disabled>Selecione...</option>`;
                    data.forEach(item => {
                        const option = document.createElement('option');
                        option.value = item[valueField];
                        option.textContent = textFieldFormatter(item);
                        selectElement.appendChild(option);
                    });
                }
                return data;
            } catch (error) {
                console.error(`Erro ao popular o select #${selectElement.id}:`, error);
                selectElement.innerHTML = `<option value="" selected disabled>Erro ao carregar</option>`;
                return [];
            }
        }

        function preencherCamposOS(osSelecionada) {
            if (osSelecionada) {
                document.getElementById('site').value = osSelecionada.detalhes?.[0]?.site || '';
                document.getElementById('segmento').value = osSelecionada.segmento?.nome || '';
                document.getElementById('projeto').value = osSelecionada.projeto || '';
                document.getElementById('contrato').value = osSelecionada.detalhes?.[0]?.contrato || '';
                document.getElementById('gestorTim').value = osSelecionada.gestorTim || '';
                document.getElementById('regional').value = osSelecionada.detalhes?.[0]?.regional || '';
            } else {
                document.getElementById('site').value = '';
                document.getElementById('segmento').value = '';
                document.getElementById('projeto').value = '';
                document.getElementById('contrato').value = '';
                document.getElementById('gestorTim').value = '';
                document.getElementById('regional').value = '';
            }
        }

        async function carregarDadosParaModal() {
            // Carrega OS (se ainda não carregou)
            if (todasAsOS.length === 0) {
                try {
                    const usuarioId = localStorage.getItem('usuarioId');
                    if (!usuarioId) throw new Error('ID do usuário não encontrado.');
                    const response = await fetchComAuth(`http://localhost:8080/os/por-usuario/${usuarioId}`);
                    if (!response.ok) throw new Error('Falha ao carregar Ordens de Serviço.');
                    todasAsOS = await response.json();

                    const selectProjeto = document.getElementById('projetoId');
                    const selectOS = document.getElementById('osId');

                    if (selectProjeto) {
                        const projetosUnicos = [...new Set(todasAsOS.map(os => os.projeto))];
                        selectProjeto.innerHTML = `<option value="" selected disabled>Selecione...</option>`;
                        projetosUnicos.forEach(projeto => selectProjeto.add(new Option(projeto, projeto)));
                    }

                    if (selectOS) {
                        selectOS.innerHTML = `<option value="" selected disabled>Selecione...</option>`;
                        todasAsOS.forEach(item => selectOS.add(new Option(item.os, item.id)));
                    }
                } catch (error) {
                    console.error('Erro ao popular selects de OS/Projeto:', error);
                }
            }

            // Carrega Prestadores (se ainda não carregou)
            if (!todosOsPrestadores || todosOsPrestadores.length === 0) {
                todosOsPrestadores = await popularSelect(document.getElementById('prestadorId'), 'http://localhost:8080/index/prestadores/ativos', 'id', item => `${item.codigoPrestador} - ${item.prestador}`);
            }

            // Carrega Etapas (se ainda não carregou)
            if (todasAsEtapas.length === 0) {
                todasAsEtapas = await popularSelect(document.getElementById('etapaGeralSelect'), 'http://localhost:8080/index/etapas', 'id', item => `${item.codigo} - ${item.nome}`);
            }

            // --- CARREGAMENTO DE DOCUMENTAÇÃO (CORRIGIDO) ---
            const selectTipoDoc = document.getElementById('tipoDocumentacaoId');

            // Só carrega se a lista estiver vazia
            if (tiposDocumentacaoCache.length === 0) {
                try {
                    const res = await fetchComAuth('http://localhost:8080/tipos-documentacao');
                    if (res.ok) {
                        tiposDocumentacaoCache = await res.json();
                    }
                } catch (err) {
                    console.error("Erro ao carregar tipos de documentação:", err);
                }
            }

            // Popula o select usando o cache
            if (selectTipoDoc && tiposDocumentacaoCache.length > 0) {
                // Salva o valor selecionado atual (caso esteja editando e rechamou a função)
                const valorAtual = selectTipoDoc.value;

                selectTipoDoc.innerHTML = '<option value="" selected>Não se aplica</option>';
                tiposDocumentacaoCache.forEach(tipo => {
                    selectTipoDoc.add(new Option(tipo.nome, tipo.id));
                });

                // Restaura o valor se ainda for válido
                if (valorAtual) selectTipoDoc.value = valorAtual;
            }
            // ------------------------------------------------
        }

        function filtrarDocumentistasPorTipo(tipoId) {
            const selectDocumentista = document.getElementById('documentistaId');
            if (!selectDocumentista) return;

            // Limpa e adiciona placeholder
            selectDocumentista.innerHTML = '<option value="" selected disabled>Selecione...</option>';

            if (!tipoId || tipoId === "") {
                // Se "Não se aplica" ou vazio, opcional: carregar todos ou deixar vazio
                // Aqui vamos carregar todos os documentistas como fallback
                fetchComAuth('http://localhost:8080/usuarios/documentistas')
                    .then(r => r.json())
                    .then(docs => {
                        docs.forEach(d => selectDocumentista.add(new Option(d.nome, d.id)));
                    });
                return;
            }

            // Encontra o tipo selecionado no cache
            const tipoSelecionado = tiposDocumentacaoCache.find(t => t.id == tipoId);

            if (tipoSelecionado && tipoSelecionado.documentistas && tipoSelecionado.documentistas.length > 0) {
                // Se houver restrição, mostra apenas os permitidos
                tipoSelecionado.documentistas.forEach(doc => {
                    selectDocumentista.add(new Option(doc.nome, doc.id));
                });
            } else {
                // Se não houver restrição (lista vazia), busca todos
                fetchComAuth('http://localhost:8080/usuarios/documentistas')
                    .then(r => r.json())
                    .then(docs => {
                        docs.forEach(d => selectDocumentista.add(new Option(d.nome, d.id)));
                    });
            }
        }

        // Adiciona o listener ao select
        const selectTipoDocEl = document.getElementById('tipoDocumentacaoId');
        if (selectTipoDocEl) {
            selectTipoDocEl.addEventListener('change', (e) => {
                filtrarDocumentistasPorTipo(e.target.value);
            });
        }

        async function abrirModalParaEdicao(lancamento, editingId) {
            const btnSubmitPadrao = document.getElementById('btnSubmitAdicionar');
            const btnSalvarRascunho = document.getElementById('btnSalvarRascunho');
            const btnSalvarEEnviar = document.getElementById('btnSalvarEEnviar');

            // 1. PRIMEIRO: Carrega as opções dos selects (LPU, Prestadores, Tipos Doc)
            await carregarDadosParaModal();

            // 2. SEGUNDO: Limpa o formulário de resquícios anteriores
            formAdicionar.reset();

            // 3. TERCEIRO: Configurações de IDs e botões
            if (editingId) formAdicionar.dataset.editingId = editingId;
            else delete formAdicionar.dataset.editingId;

            if (lancamento.detalhe && lancamento.detalhe.id) formAdicionar.dataset.osLpuDetalheId = lancamento.detalhe.id;
            else delete formAdicionar.dataset.osLpuDetalheId;

            if (lpuContainer) lpuContainer.classList.add('d-none');
            if (btnSubmitPadrao) btnSubmitPadrao.style.display = 'none';
            if (btnSalvarRascunho) btnSalvarRascunho.style.display = 'none';
            if (btnSalvarEEnviar) btnSalvarEEnviar.style.display = 'none';

            if (editingId) {
                if (lancamento.situacaoAprovacao === 'RASCUNHO') {
                    if (modalTitle) modalTitle.innerHTML = `<i class="bi bi-pencil"></i> Editar Rascunho #${lancamento.id}`;
                    if (btnSalvarRascunho) btnSalvarRascunho.style.display = 'inline-block';
                    if (btnSalvarEEnviar) btnSalvarEEnviar.style.display = 'inline-block';
                } else {
                    if (modalTitle) modalTitle.innerHTML = `<i class="bi bi-pencil-square"></i> Editar Lançamento #${editingId}`;
                    if (btnSubmitPadrao) {
                        btnSubmitPadrao.style.display = 'inline-block';
                        btnSubmitPadrao.innerHTML = `<i class="bi bi-send-check"></i> Salvar e Reenviar`;
                    }
                }
                if (dataAtividadeInput) dataAtividadeInput.value = lancamento.dataAtividade ? lancamento.dataAtividade.split('/').reverse().join('-') : '';
            } else {
                if (modalTitle) modalTitle.innerHTML = `<i class="bi bi-play-circle"></i> Retomar Lançamento (Novo)`;
                if (btnSubmitPadrao) {
                    btnSubmitPadrao.style.display = 'inline-block';
                    btnSubmitPadrao.innerHTML = `<i class="bi bi-check-circle"></i> Criar Lançamento`;
                }
                if (dataAtividadeInput) dataAtividadeInput.value = new Date().toISOString().split('T')[0];
            }

            // 4. QUARTO: Preencher os campos de Documentação (AGORA NA ORDEM CERTA)
            const elTipoDoc = document.getElementById('tipoDocumentacaoId');
            const elDocumentista = document.getElementById('documentistaId');

            if (elTipoDoc) {
                // Seleciona o Tipo de Documentação
                elTipoDoc.value = lancamento.tipoDocumentacaoId || "";

                // IMPORTANTE: Dispara o filtro para carregar o select de documentistas corretamente
                if (typeof filtrarDocumentistasPorTipo === 'function') {
                    filtrarDocumentistasPorTipo(elTipoDoc.value);
                }
            }

            if (elDocumentista) {
                // Agora que o filtro rodou e populou o select, selecionamos o valor
                elDocumentista.value = lancamento.documentistaId || "";
            }

            // 5. QUINTO: Preenchimento dos demais dados (OS, Valores, etc.)
            if (lancamento.os) {
                if (selectProjeto && lancamento.os.projeto) {
                    if (!selectProjeto.querySelector(`option[value="${lancamento.os.projeto}"]`)) {
                        selectProjeto.add(new Option(lancamento.os.projeto, lancamento.os.projeto, true, true));
                    }
                    selectProjeto.value = lancamento.os.projeto;
                }
                if (selectOS && lancamento.os.id) {
                    if (!selectOS.querySelector(`option[value="${lancamento.os.id}"]`)) {
                        selectOS.add(new Option(lancamento.os.os, lancamento.os.id, true, true));
                    }
                    selectOS.value = lancamento.os.id;
                }
                try {
                    // Busca dados completos da OS para preencher campos read-only
                    const response = await fetchComAuth(`http://localhost:8080/os/${lancamento.os.id}`);
                    if (!response.ok) throw new Error('Falha ao recarregar dados da OS para edição.');
                    const osDataCompleta = await response.json();
                    preencherCamposOS(osDataCompleta);
                } catch (error) {
                    console.error(error);
                    mostrarToast('Erro ao carregar dados da OS.', 'error');
                }
            }

            document.getElementById('detalheDiario').value = lancamento.detalheDiario || '';
            document.getElementById('valor').value = (lancamento.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
            document.getElementById('situacao').value = lancamento.situacao || '';

            ['vistoria', 'desmobilizacao', 'instalacao', 'ativacao', 'documentacao'].forEach(k => {
                const el = document.getElementById(k);
                if (el) el.value = lancamento[k] || 'N/A';
            });
            ['planoVistoria', 'planoDesmobilizacao', 'planoInstalacao', 'planoAtivacao', 'planoDocumentacao'].forEach(k => {
                const el = document.getElementById(k);
                if (el && lancamento[k]) el.value = lancamento[k].split('/').reverse().join('-');
            });

            if (selectLPU) selectLPU.innerHTML = '';
            if (lancamento.detalhe && lancamento.detalhe.lpu) {
                const lpu = lancamento.detalhe.lpu;
                if (selectLPU) {
                    selectLPU.add(new Option(labelLpu(lpu), lpu.id));
                    selectLPU.value = lpu.id;
                }
                if (lpuContainer) lpuContainer.classList.remove('d-none');
            }

            if (selectOS) selectOS.disabled = true;
            if (selectLPU) selectLPU.disabled = true;
            if (selectProjeto) selectProjeto.disabled = true;

            const selectPrestadorEl = document.getElementById('prestadorId');
            if (selectPrestadorEl) {
                if (selectPrestadorEl.choices) selectPrestadorEl.choices.destroy();
                const prestadores = await fetchComAuth('http://localhost:8080/index/prestadores/ativos').then(res => res.json());
                const choices = new Choices(selectPrestadorEl, { searchEnabled: true, placeholder: true, placeholderValue: 'Digite para buscar o prestador...', itemSelectText: '', noResultsText: 'Nenhum resultado', });
                const choicesData = prestadores.map(item => ({ value: item.id, label: `${item.codigoPrestador} - ${item.prestador}` }));
                choices.setChoices(choicesData, 'value', 'label', false);
                selectPrestadorEl.choices = choices;
                if (lancamento.prestador?.id) setTimeout(() => { selectPrestadorEl.choices.setChoiceByValue(String(lancamento.prestador.id)); }, 100);
            }

            if (lancamento.etapa && lancamento.etapa.id && selectEtapaGeral) {
                const etapaGeralPai = todasAsEtapas.find(eg => eg.codigo === lancamento.etapa.codigoGeral);
                if (etapaGeralPai) {
                    selectEtapaGeral.value = etapaGeralPai.id;
                    await popularDropdownsDependentes(etapaGeralPai.id, lancamento.etapa.id, lancamento.status);
                }
            } else if (selectEtapaGeral) {
                selectEtapaGeral.value = '';
                await popularDropdownsDependentes('', null, null);
            }
            modalAdicionar.show();
        }

        const btnConfirmarRecebimentoDoc = document.getElementById('btnConfirmarRecebimentoDoc');
        if (btnConfirmarRecebimentoDoc) {
            btnConfirmarRecebimentoDoc.addEventListener('click', async function () {
                const btn = this;
                const idValue = document.getElementById('idLancamentoReceberDoc').value; // Pode ser um ID ou "LOTE"
                const comentario = document.getElementById('comentarioRecebimento').value;
                const usuarioId = localStorage.getItem('usuarioId');
                const modalEl = document.getElementById('modalReceberDoc');
                const modalInstance = bootstrap.Modal.getInstance(modalEl);

                const isLote = idValue === "LOTE";

                let url, body;

                if (isLote) {
                    // Coleta os IDs selecionados
                    const checkboxes = document.querySelectorAll('.check-doc-item:checked');
                    const ids = Array.from(checkboxes).map(cb => parseInt(cb.value));

                    if (ids.length === 0) return;

                    url = `${API_BASE_URL}/lancamentos/lote/documentacao/receber`;
                    body = JSON.stringify({ ids: ids, usuarioId: usuarioId, comentario: comentario });
                } else {
                    // Processo individual (Legado)
                    if (!idValue) return;
                    url = `${API_BASE_URL}/lancamentos/${idValue}/documentacao/receber`;
                    body = JSON.stringify({ usuarioId: usuarioId, comentario: comentario });
                }

                try {
                    btn.disabled = true;
                    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Processando...';

                    const response = await fetchComAuth(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: body
                    });

                    if (!response.ok) throw new Error("Erro ao processar recebimento.");

                    mostrarToast(isLote ? "Lote processado com sucesso!" : "Documentação recebida!", "success");

                    if (modalInstance) modalInstance.hide();

                    // Reseta a barra de lote
                    document.getElementById('acoes-lote-doc').classList.add('d-none');
                    document.getElementById('acoes-lote-doc').classList.remove('d-flex');

                    await carregarLancamentos();

                } catch (error) {
                    console.error(error);
                    mostrarToast(error.message, "error");
                } finally {
                    btn.disabled = false;
                    btn.innerHTML = '<i class="bi bi-check-lg"></i> Confirmar';

                    // Restaura textos originais do modal (caso tenha mudado para lote)
                    const titulo = modalEl.querySelector('.modal-title');
                    const corpo = modalEl.querySelector('.modal-body p');
                    titulo.innerHTML = `<i class="bi bi-file-earmark-check me-2"></i>Confirmar Recebimento`;
                    corpo.textContent = `Deseja confirmar o recebimento da documentação física/digital para este lançamento?`;
                }
            });
        }

        modalAdicionarEl.addEventListener('show.bs.modal', async () => {
            if (!formAdicionar.dataset.editingId) {
                await carregarDadosParaModal();
                modalTitle.innerHTML = '<i class="bi bi-plus-circle"></i> Adicionar Nova Atividade';
                document.getElementById('btnSubmitAdicionar').style.display = 'none';
                document.getElementById('btnSalvarRascunho').style.display = 'inline-block';
                btnSalvarRascunho.dataset.acao = 'rascunho';
                document.getElementById('btnSalvarEEnviar').style.display = 'inline-block';
                btnSalvarEEnviar.dataset.acao = 'enviar';
                selectOS.disabled = false;
                selectProjeto.disabled = false;
                document.getElementById('dataAtividade').disabled = false;
            }
        });

        modalAdicionarEl.addEventListener('hidden.bs.modal', () => {
            formAdicionar.reset();
            delete formAdicionar.dataset.editingId;
            delete formAdicionar.dataset.osLpuDetalheId;
            selectEtapaDetalhada.innerHTML = '<option value="" selected disabled>Primeiro, selecione a etapa geral</option>';
            selectEtapaDetalhada.disabled = true;
            selectStatus.innerHTML = '<option value="" selected disabled>Primeiro, selecione a etapa detalhada</option>';
            selectStatus.disabled = true;
            selectOS.disabled = false;
            selectProjeto.disabled = false;
            lpuContainer.classList.add('d-none');
            document.getElementById('lpuId').innerHTML = '';
        });

        document.body.addEventListener('click', async (e) => {
            const reenviarBtn = e.target.closest('.btn-reenviar, .btn-editar-rascunho, .btn-retomar');
            const comentariosBtn = e.target.closest('.btn-ver-comentarios');
            const submeterBtn = e.target.closest('.btn-submeter-agora');
            const btnReceberDoc = e.target.closest('.btn-receber-doc');

            if (reenviarBtn) {
                const originalContent = reenviarBtn.innerHTML;
                try {
                    reenviarBtn.disabled = true;
                    reenviarBtn.innerHTML = `<span class="spinner-border spinner-border-sm"></span>`;
                    const lancamentoId = reenviarBtn.dataset.id;
                    const lancamento = todosLancamentos.find(l => l.id == lancamentoId);
                    if (lancamento) {
                        const isRetomar = reenviarBtn.classList.contains('btn-retomar');
                        await abrirModalParaEdicao(lancamento, isRetomar ? null : lancamento.id);
                    } else throw new Error('Lançamento não encontrado.');
                } catch (error) {
                    console.error("Erro ao preparar modal:", error);
                    mostrarToast(error.message, 'error');
                } finally {
                    reenviarBtn.disabled = false;
                    reenviarBtn.innerHTML = originalContent;
                }
            } else if (comentariosBtn) {
                const lancamento = todosLancamentos.find(l => l.id == comentariosBtn.dataset.id);
                if (lancamento) exibirComentarios(lancamento);
                else mostrarToast('Lançamento não encontrado.', 'error');
            } else if (submeterBtn) {
                const lancamentoId = submeterBtn.dataset.id;
                const btnConfirmar = document.getElementById('btnConfirmarSubmissao');
                btnConfirmar.dataset.lancamentoId = lancamentoId;
                new bootstrap.Modal(document.getElementById('modalConfirmarSubmissao')).show();
            } else if (btnReceberDoc) {
                const id = btnReceberDoc.dataset.id;
                document.getElementById('idLancamentoReceberDoc').value = id;
                document.getElementById('comentarioRecebimento').value = ''; // Limpa comentário anterior
                new bootstrap.Modal(document.getElementById('modalReceberDoc')).show();
            } else if (e.target.closest('.btn-excluir-lancamento')) {
                const lancamentoId = e.target.closest('.btn-excluir-lancamento').dataset.id;
                document.getElementById('deleteLancamentoId').value = lancamentoId;
                new bootstrap.Modal(document.getElementById('modalConfirmarExclusaoLancamento')).show();
            }
        });

        function getProjetosParalisados() {
            const ultimosLancamentosPorProjeto = new Map();
            todosLancamentos.forEach(l => {
                if (l.detalhe && l.detalhe.id) {
                    const chaveProjeto = l.detalhe.id;
                    if (!ultimosLancamentosPorProjeto.has(chaveProjeto) || l.id > ultimosLancamentosPorProjeto.get(chaveProjeto).id) {
                        ultimosLancamentosPorProjeto.set(chaveProjeto, l);
                    }
                }
            });
            const lancamentosParalisados = [];
            for (const ultimoLancamento of ultimosLancamentosPorProjeto.values()) {
                if (ultimoLancamento.situacao === 'Paralisado') lancamentosParalisados.push(ultimoLancamento);
            }
            return lancamentosParalisados;
        }

        document.getElementById('btnConfirmarExclusaoLancamentoDefinitiva')?.addEventListener('click', async function (e) {
            const confirmButton = e.currentTarget;
            const id = document.getElementById('deleteLancamentoId').value;
            if (!id) return;
            const originalContent = confirmButton.innerHTML;
            const modalInstance = bootstrap.Modal.getInstance(document.getElementById('modalConfirmarExclusaoLancamento'));
            try {
                confirmButton.disabled = true;
                confirmButton.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Excluindo...`;
                const resposta = await fetchComAuth(`${API_BASE_URL}/lancamentos/${id}`, { method: 'DELETE' });
                if (!resposta.ok) throw new Error('Erro ao excluir o lançamento.');
                mostrarToast('Lançamento excluído com sucesso!', 'success');
                await carregarLancamentos();
            } catch (error) {
                console.error(error);
                mostrarToast(error.message, 'error');
            } finally {
                confirmButton.disabled = false;
                confirmButton.innerHTML = originalContent;
                if (modalInstance) modalInstance.hide();
            }
        });

        document.getElementById('btnConfirmarSubmissao').addEventListener('click', async function (e) {
            const confirmButton = e.currentTarget;
            const id = confirmButton.dataset.lancamentoId;
            if (!id) return;
            const originalContent = confirmButton.innerHTML;
            const modalInstance = bootstrap.Modal.getInstance(document.getElementById('modalConfirmarSubmissao'));
            try {
                confirmButton.disabled = true;
                confirmButton.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Enviando...`;
                const resposta = await fetchComAuth(`http://localhost:8080/lancamentos/${id}/submeter`, { method: 'POST' });
                if (!resposta.ok) throw new Error('Erro ao submeter.');
                mostrarToast('Lançamento submetido com sucesso!', 'success');
                await carregarLancamentos();
                renderizarTodasAsTabelas();
            } catch (error) {
                mostrarToast(error.message, 'error');
            } finally {
                confirmButton.disabled = false;
                confirmButton.innerHTML = originalContent;
                if (modalInstance) modalInstance.hide();
            }
        });

        async function popularDropdownsDependentes(etapaGeralId, etapaDetalhadaIdSelecionada = null, statusSelecionado = null) {
            const selectEtapaDetalhada = document.getElementById('etapaDetalhadaId');
            const selectStatus = document.getElementById('status');
            const etapaSelecionada = todasAsEtapas.find(etapa => etapa.id == etapaGeralId);

            selectEtapaDetalhada.innerHTML = '<option value="" selected disabled>Selecione...</option>';
            selectStatus.innerHTML = '<option value="" selected disabled>Selecione...</option>';
            selectEtapaDetalhada.disabled = true;
            selectStatus.disabled = true;

            if (etapaSelecionada && etapaSelecionada.etapasDetalhadas && etapaSelecionada.etapasDetalhadas.length > 0) {
                etapaSelecionada.etapasDetalhadas.forEach(detalhe => selectEtapaDetalhada.add(new Option(`${detalhe.indice} - ${detalhe.nome}`, detalhe.id)));
                selectEtapaDetalhada.disabled = false;
                if (etapaDetalhadaIdSelecionada) {
                    selectEtapaDetalhada.value = etapaDetalhadaIdSelecionada;
                    const etapaDetalhada = etapaSelecionada.etapasDetalhadas.find(ed => ed.id == etapaDetalhadaIdSelecionada);
                    if (etapaDetalhada && etapaDetalhada.status && etapaDetalhada.status.length > 0) {
                        etapaDetalhada.status.forEach(statusValue => selectStatus.add(new Option(statusValue, statusValue)));
                        selectStatus.disabled = false;
                        if (statusSelecionado) selectStatus.value = statusSelecionado;
                    }
                }
            }
        }

        selectEtapaGeral.addEventListener('change', (e) => popularDropdownsDependentes(e.target.value, null, null));
        selectEtapaDetalhada.addEventListener('change', (e) => popularDropdownsDependentes(selectEtapaGeral.value, e.target.value, null));
    }

    function exibirComentarios(lancamento) {
        const modalBody = document.getElementById('modalComentariosBody');
        const modalTitle = document.getElementById('modalComentariosLabel');
        const inputTexto = document.getElementById('novoComentarioTexto');
        const btnSalvar = document.getElementById('btnSalvarComentario');

        // Configura o ID no botão para saber onde salvar depois
        if (btnSalvar) {
            btnSalvar.dataset.id = lancamento.id;
        }
        // Limpa o campo de texto
        if (inputTexto) {
            inputTexto.value = '';
        }

        modalTitle.innerHTML = `<i class="bi bi-chat-left-text-fill me-2"></i> Comentários - OS: ${getNestedValue(lancamento, 'os.os') || 'N/A'}`;
        modalBody.innerHTML = '';

        if (!lancamento.comentarios || lancamento.comentarios.length === 0) {
            modalBody.innerHTML = '<div class="text-center text-muted mt-4"><i class="bi bi-chat-square-dots fs-1"></i><p>Nenhum comentário registrado.</p></div>';
            return;
        }

        const comentariosOrdenados = [...lancamento.comentarios].sort((a, b) => {
            // Converter datas DD/MM/YYYY HH:mm:ss para timestamp
            const parseDate = (str) => {
                const [date, time] = str.split(' ');
                const [day, month, year] = date.split('/');
                const [hour, minute] = time.split(':');
                return new Date(year, month - 1, day, hour, minute);
            };
            return parseDate(b.dataHora) - parseDate(a.dataHora);
        });

        comentariosOrdenados.forEach(comentario => {
            const isMe = comentario.autor.id == localStorage.getItem('usuarioId');
            const alignClass = isMe ? 'ms-auto text-end' : 'me-auto';
            const colorClass = isMe ? 'bg-primary-subtle border-primary-subtle' : 'bg-white border';

            const comentarioCard = document.createElement('div');
            comentarioCard.className = `d-flex flex-column mb-3 ${alignClass}`;
            comentarioCard.style.maxWidth = "80%";

            comentarioCard.innerHTML = `
                <div class="card shadow-sm ${colorClass}">
                    <div class="card-body p-2">
                        <div class="d-flex justify-content-between align-items-center mb-1 small text-muted">
                            <strong class="${isMe ? 'text-primary' : 'text-dark'}">${comentario.autor.nome}</strong>
                            <span class="ms-2" style="font-size: 0.75rem;">${comentario.dataHora}</span>
                        </div>
                        <p class="card-text mb-0" style="white-space: pre-wrap;">${comentario.texto}</p>
                    </div>
                </div>
            `;
            modalBody.appendChild(comentarioCard);
        });

        // Rola para o topo (ou fundo se preferir)
        modalBody.scrollTop = 0;
    }

    // LISTENER PARA SALVAR NOVO COMENTÁRIO
    const btnSalvarComentario = document.getElementById('btnSalvarComentario');
    if (btnSalvarComentario) {
        btnSalvarComentario.addEventListener('click', async function () {
            const btn = this;
            const lancamentoId = btn.dataset.id;
            const texto = document.getElementById('novoComentarioTexto').value.trim();
            const usuarioId = localStorage.getItem('usuarioId');

            if (!texto) {
                mostrarToast('Digite um comentário para enviar.', 'warning');
                return;
            }

            const originalHtml = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';

            try {
                const response = await fetchComAuth(`${API_BASE_URL}/lancamentos/${lancamentoId}/comentarios`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ usuarioId: usuarioId, texto: texto })
                });

                if (!response.ok) throw new Error('Erro ao salvar comentário.');

                // Atualiza a lista de comentários sem fechar o modal
                // Busca o lançamento atualizado individualmente para ser mais rápido
                const resLancamento = await fetchComAuth(`${API_BASE_URL}/lancamentos/${lancamentoId}`);
                if (resLancamento.ok) {
                    const lancamentoAtualizado = await resLancamento.json();

                    // Atualiza o objeto na lista global (todosLancamentos) para manter a consistência se fechar e abrir de novo
                    const index = todosLancamentos.findIndex(l => l.id == lancamentoId);
                    if (index !== -1) {
                        todosLancamentos[index] = lancamentoAtualizado;
                    }

                    // Re-renderiza o modal
                    exibirComentarios(lancamentoAtualizado);
                    mostrarToast('Comentário enviado!', 'success');
                }

            } catch (error) {
                console.error(error);
                mostrarToast('Falha ao enviar comentário.', 'error');
            } finally {
                btn.disabled = false;
                btn.innerHTML = originalHtml;
            }
        });
    }

    const filtroDataCustomEl = document.getElementById('filtroDataCustom');
    const filtroStatusEl = document.getElementById('filtroStatusAprovacao');
    const filtroOsEl = document.getElementById('filtroOS');
    const btnLimparFiltros = document.getElementById('limparFiltros');

    const calendario = flatpickr(filtroDataCustomEl, {
        mode: "range", dateFormat: "d/m/Y", locale: "pt",
        onClose: function (selectedDates) {
            if (selectedDates.length === 2) {
                filtrosAtivos.periodo = { start: selectedDates[0], end: selectedDates[1] };
                renderizarTodasAsTabelas();
            }
        }
    });

    function popularFiltroOS() {
        const osUnicas = [...new Map(todosLancamentos.map(l => [l.os.id, l.os])).values()]
            .sort((a, b) => a.os.localeCompare(b.os));
        osUnicas.forEach(os => filtroOsEl.add(new Option(os.os, os.id)));
    }

    document.querySelector('.dropdown-menu.p-3').addEventListener('click', (e) => {
        if (e.target.matches('[data-filter="periodo"]')) {
            filtrosAtivos.periodo = e.target.dataset.value;
            calendario.clear();
            renderizarTodasAsTabelas();
        }
    });

    filtroStatusEl.addEventListener('change', (e) => {
        filtrosAtivos.status = e.target.value;
        renderizarTodasAsTabelas();
    });

    filtroOsEl.addEventListener('change', (e) => {
        filtrosAtivos.osId = e.target.value;
        renderizarTodasAsTabelas();
    });

    btnLimparFiltros.addEventListener('click', () => {
        filtrosAtivos = { periodo: null, status: null, osId: null };
        calendario.clear();
        filtroStatusEl.value = "";
        filtroOsEl.value = "";
        searchInput.value = "";
        renderizarTodasAsTabelas();
    });

    searchInput.addEventListener('input', () => {
        renderizarTodasAsTabelas();
    });

    // ==========================================================
    // LÓGICA DO MODAL DE SOLICITAÇÃO DE MATERIAL (COM TRANSPORTE)
    // ==========================================================
    const modalSolicitarMaterialEl = document.getElementById('modalSolicitarMaterial');
    if (modalSolicitarMaterialEl) {
        const modalSolicitarMaterial = new bootstrap.Modal(modalSolicitarMaterialEl);
        const formSolicitacao = document.getElementById('formSolicitarMaterial');
        const selectOS = document.getElementById('osSolicitacao');
        const selectLPU = document.getElementById('lpuSolicitacao');
        const listaItensContainer = document.getElementById('listaItens');
        const btnAdicionarItem = document.getElementById('btnAdicionarItem');

        // Elementos de Transporte
        const containerTransporte = document.getElementById('containerTransporte');
        const listaTransporte = document.getElementById('listaTransporte');
        const btnAdicionarTransporte = document.getElementById('btnAdicionarTransporte');
        const displayTotalTransporte = document.getElementById('displayTotalTransporte');

        let todosOsMateriais = [];
        let totalTransporteCalculado = 0;

        function popularSelectMateriais(selectElement) {
            if (todosOsMateriais.length === 0) {
                selectElement.innerHTML = '<option value="" selected disabled>Carregando materiais...</option>';
                fetchComAuth('http://localhost:8080/materiais')
                    .then(res => res.json())
                    .then(data => {
                        todosOsMateriais = data;
                        aplicarChoicesNoSelect(selectElement);
                    })
                    .catch(err => {
                        console.error("Erro ao buscar materiais:", err);
                        selectElement.innerHTML = '<option value="">Erro ao carregar</option>';
                    });
            } else {
                aplicarChoicesNoSelect(selectElement);
            }
        }

        function aplicarChoicesNoSelect(selectElement) {
            if (selectElement.choices) selectElement.choices.destroy();
            selectElement.innerHTML = '';
            const opcoes = [
                { value: '', label: 'Selecione ou pesquise o material...', selected: true, disabled: true },
                ...todosOsMateriais.map(m => ({
                    value: m.codigo,
                    label: `${m.empresa} - ${m.codigo} - ${m.descricao} ${m.modelo ? '| ' + m.modelo : ''} ${m.numeroDeSerie ? '| SN:' + m.numeroDeSerie : ''}`,
                    customProperties: m
                }))
            ];

            // CORREÇÃO AQUI: Alterado renderChoiceLimit de 50 para -1 (mostrar todos)
            const choices = new Choices(selectElement, {
                choices: opcoes,
                searchEnabled: true,
                searchPlaceholderValue: 'Pesquisar material...',
                itemSelectText: '',
                noResultsText: 'Nenhum material encontrado',
                position: 'bottom',
                renderChoiceLimit: -1 // Alterado de 50 para -1
            });

            selectElement.choices = choices;
        }

        function criarHtmlLinhaTransporte() {
            return `
                <div class="row g-2 align-items-center mb-2 transporte-row">
                    <div class="col-md">
                        <input type="text" class="form-control transporte-select" placeholder="Digite o tipo e dê Enter..." required>
                    </div>
                    <div class="col-md-3">
                        <div class="input-group">
                            <span class="input-group-text">R$</span>
                            <input type="text" class="form-control transporte-valor" placeholder="0,00" required>
                        </div>
                    </div>
                    <div class="col-md-auto">
                        <button type="button" class="btn btn-outline-danger btn-sm btn-remover-transporte" title="Remover">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </div>`;
        }

        function inicializarChoicesTransporte(element) {
            new Choices(element, {
                allowHTML: true,
                addItems: true,      // Permite criar novos
                editItems: true,     // Permite editar (backspace)
                maxItemCount: 1,     // IMPORTANTE: Só aceita 1 valor por campo
                removeItemButton: true,
                searchEnabled: false, // Desliga busca pois é input livre
                placeholder: true,
                placeholderValue: "Digite (ex: Uber) e dê Enter",
                addItemText: (value) => `Pressione Enter para adicionar <b>"${value}"</b>`,
                uniqueItemText: 'Este item já foi adicionado'
            });

            // CORREÇÃO EXTRA: Impede que o Enter envie o formulário ao criar o item
            element.addEventListener('keydown', function (event) {
                if (event.key === 'Enter') {
                    event.preventDefault();
                }
            });
        }
        function atualizarTotalTransporte() {
            let total = 0;
            document.querySelectorAll('.transporte-valor').forEach(input => {
                const valorLimpo = input.value.replace(/\./g, '').replace(',', '.');
                const valor = parseFloat(valorLimpo);
                if (!isNaN(valor)) {
                    total += valor;
                }
            });
            totalTransporteCalculado = total;
            displayTotalTransporte.textContent = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total);
        }

        function configurarEventoChangeMaterial(selectElement) {
            selectElement.addEventListener('change', function () {
                const codigoSelecionado = this.value;
                const material = todosOsMateriais.find(m => m.codigo === codigoSelecionado);
                const row = this.closest('.item-row');
                const card = row.querySelector('.material-info-card');
                const grid = card.querySelector('.material-info-grid');

                if (material) {
                    const custoMedio = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(material.custoMedioPonderado || 0);
                    const custoTotal = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(material.custoTotal || 0);
                    grid.innerHTML = `
                        <div class="info-item"><span class="info-label">Modelo</span><span class="info-value">${material.modelo || '-'}</span></div>
                        <div class="info-item"><span class="info-label">Nº Série</span><span class="info-value">${material.numeroDeSerie || '-'}</span></div>
                        <div class="info-item"><span class="info-label">Unidade</span><span class="info-value">${material.unidadeMedida}</span></div>
                        <div class="info-item"><span class="info-label">Estoque</span><span class="info-value">${material.saldoFisico}</span></div>
                        <div class="info-item"><span class="info-label">Custo Médio</span><span class="info-value text-primary">${custoMedio}</span></div>
                        <div class="info-item"><span class="info-label">Custo Total</span><span class="info-value">${custoTotal}</span></div>
                        <div class="info-item" style="grid-column: 1 / -1;"><span class="info-label">Descrição</span><span class="info-value small">${material.descricao}</span></div>
                    `;
                    card.classList.add('show');
                    const inputQtd = row.querySelector('.quantidade-input');
                    if (inputQtd) inputQtd.max = material.saldoFisico;
                } else {
                    card.classList.remove('show');
                }
            });
        }

        modalSolicitarMaterialEl.addEventListener('show.bs.modal', async () => {
            formSolicitacao.reset();
            listaItensContainer.innerHTML = criarHtmlLinhaItem();
            listaTransporte.innerHTML = '';
            totalTransporteCalculado = 0;
            displayTotalTransporte.textContent = 'R$ 0,00';

            selectLPU.innerHTML = '<option value="" selected disabled>Selecione a OS primeiro...</option>';
            selectLPU.disabled = true;
            selectOS.innerHTML = '<option value="" selected disabled>Carregando OSs...</option>';

            const userRole = (localStorage.getItem("role") || "").trim().toUpperCase();
            const isAdminOrController = ['ADMIN', 'CONTROLLER'].includes(userRole);

            if (isAdminOrController) containerTransporte.classList.remove('d-none');
            else containerTransporte.classList.add('d-none');

            const firstMaterialSelect = listaItensContainer.querySelector('.material-select');
            popularSelectMateriais(firstMaterialSelect);
            configurarEventoChangeMaterial(firstMaterialSelect);

            try {
                let urlOS = '';
                if (isAdminOrController) urlOS = `http://localhost:8080/os?completo=true`;
                else {
                    const usuarioId = localStorage.getItem('usuarioId');
                    urlOS = `http://localhost:8080/os/por-usuario/${usuarioId}`;
                }

                const response = await fetchComAuth(urlOS);
                const data = await response.json();
                const listaOS = Array.isArray(data) ? data : (data.content || []);

                selectOS.innerHTML = '<option value="" selected disabled>Selecione a OS...</option>';
                listaOS.sort((a, b) => a.os.localeCompare(b.os));
                listaOS.forEach(os => selectOS.add(new Option(`${os.os} - ${os.projeto || ''}`, os.id)));
            } catch (error) {
                console.error("Erro ao buscar OSs:", error);
                selectOS.innerHTML = '<option value="">Erro ao carregar</option>';
            }
        });

        btnAdicionarTransporte.addEventListener('click', () => {
            const div = document.createElement('div');
            div.innerHTML = criarHtmlLinhaTransporte();
            const novaLinha = div.firstElementChild;
            listaTransporte.appendChild(novaLinha);

            const select = novaLinha.querySelector('.transporte-select');
            inicializarChoicesTransporte(select);

            const inputValor = novaLinha.querySelector('.transporte-valor');
            inputValor.addEventListener('input', (e) => {
                let v = e.target.value.replace(/\D/g, '');
                v = (v / 100).toFixed(2) + '';
                v = v.replace('.', ',');
                v = v.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
                e.target.value = v;
                atualizarTotalTransporte();
            });
        });

        listaTransporte.addEventListener('click', (e) => {
            const btn = e.target.closest('.btn-remover-transporte');
            if (btn) {
                const row = btn.closest('.transporte-row');
                const select = row.querySelector('.transporte-select');
                if (select.choices) select.choices.destroy();
                row.remove();
                atualizarTotalTransporte();
            }
        });

        selectOS.addEventListener('change', async (e) => {
            const osId = e.target.value;
            selectLPU.disabled = true;
            selectLPU.innerHTML = '<option>Carregando LPUs...</option>';
            if (!osId) {
                selectLPU.innerHTML = '<option value="" selected disabled>Selecione a OS primeiro...</option>';
                return;
            }
            try {
                const response = await fetchComAuth(`http://localhost:8080/os/${osId}/lpus`);
                if (!response.ok) throw new Error('Falha ao buscar LPUs.');
                const lpus = await response.json();
                selectLPU.innerHTML = '<option value="" selected disabled>Selecione a LPU...</option>';
                if (lpus && lpus.length > 0) {
                    lpus.forEach(lpu => {
                        const label = `${lpu.codigoLpu || lpu.codigo} - ${lpu.nomeLpu || lpu.nome}`;
                        selectLPU.add(new Option(label, lpu.id));
                    });
                    selectLPU.disabled = false;
                } else selectLPU.innerHTML = '<option value="" disabled>Nenhuma LPU encontrada</option>';
            } catch (error) {
                console.error("Erro LPUs:", error);
                selectLPU.innerHTML = '<option value="">Erro ao carregar</option>';
            }
        });

        btnAdicionarItem.addEventListener('click', () => {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = criarHtmlLinhaItem();
            const novoItemRow = tempDiv.firstElementChild;
            listaItensContainer.appendChild(novoItemRow);
            const newSelect = novoItemRow.querySelector('.material-select');
            popularSelectMateriais(newSelect);
            configurarEventoChangeMaterial(newSelect);
        });

        listaItensContainer.addEventListener('click', (e) => {
            const btnRemover = e.target.closest('.btn-remover-item');
            if (btnRemover) {
                if (listaItensContainer.querySelectorAll('.item-row').length > 1) {
                    const row = btnRemover.closest('.item-row');
                    const select = row.querySelector('.material-select');
                    if (select && select.choices) select.choices.destroy();
                    row.remove();
                } else mostrarToast('A solicitação deve ter pelo menos um material.', 'warning');
            }
        });

        formSolicitacao.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btnSubmit = document.getElementById('btnEnviarSolicitacao');
            btnSubmit.disabled = true;
            btnSubmit.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Enviando...`;

            const itens = [];
            document.querySelectorAll('#listaItens .item-row').forEach(row => {
                const codigoMaterial = row.querySelector('.material-select').value;
                const quantidade = row.querySelector('.quantidade-input').value;
                if (codigoMaterial && quantidade) itens.push({ codigoMaterial, quantidade: parseFloat(quantidade) });
            });

            if (itens.length === 0) {
                mostrarToast('Adicione pelo menos um material.', 'warning');
                btnSubmit.disabled = false;
                btnSubmit.innerHTML = '<i class="bi bi-send me-1"></i> Enviar Solicitação';
                return;
            }

            let valorTransporteFinal = 0;
            if (!containerTransporte.classList.contains('d-none')) {
                valorTransporteFinal = totalTransporteCalculado;
            }

            const payload = {
                idSolicitante: localStorage.getItem('usuarioId'),
                osId: selectOS.value,
                lpuId: selectLPU.value,
                justificativa: document.getElementById('justificativaSolicitacao').value,
                itens: itens,
                valorTransporte: valorTransporteFinal
            };

            try {
                const response = await fetchComAuth('http://localhost:8080/solicitacoes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(errorText || 'Falha ao criar solicitação.');
                }
                mostrarToast('Solicitação enviada com sucesso! Transporte atualizado.', 'success');
                modalSolicitarMaterial.hide();
            } catch (error) {
                mostrarToast(error.message || 'Erro ao enviar.', 'error');
            } finally {
                btnSubmit.disabled = false;
                btnSubmit.innerHTML = '<i class="bi bi-send me-1"></i> Enviar Solicitação';
            }
        });
    }

    const modalSolicitarComplementarEl = document.getElementById('modalSolicitarComplementar');

    if (modalSolicitarComplementarEl) {
        const modalSolicitarComplementar = new bootstrap.Modal(modalSolicitarComplementarEl);
        const form = document.getElementById('formSolicitarComplementar');
        const selectOSComplementar = document.getElementById('osIdComplementar');
        const selectProjetoComplementar = document.getElementById('projetoIdComplementar');
        const selectLPUComplementar = document.getElementById('lpuIdComplementar');
        let todasAsOSComplementar = [];
        let choicesLPU;

        // --- 1. Evento ao abrir o Modal ---
        modalSolicitarComplementarEl.addEventListener('show.bs.modal', async () => {
            form.reset();
            document.getElementById('siteComplementar').value = '';

            // Inicializa ou limpa o Choices.js
            if (!choicesLPU) {
                choicesLPU = new Choices(selectLPUComplementar, {
                    searchEnabled: true,
                    itemSelectText: '',
                    noResultsText: 'Nenhuma LPU encontrada',
                    placeholder: true,
                    placeholderValue: 'Busque ou selecione uma LPU'
                });
            }

            selectProjetoComplementar.innerHTML = '<option value="">Carregando...</option>';
            selectOSComplementar.innerHTML = '<option value="">Carregando...</option>';
            choicesLPU.clearStore();
            choicesLPU.disable();

            try {
                // Carrega OSs do usuário (Monólito)
                if (todasAsOSComplementar.length === 0) {
                    const usuarioId = localStorage.getItem('usuarioId');
                    if (!usuarioId) throw new Error('ID do usuário não encontrado.');

                    const response = await fetchComAuth(`${API_BASE_URL}/os/por-usuario/${usuarioId}`);
                    if (!response.ok) throw new Error('Falha ao carregar OSs do usuário.');

                    todasAsOSComplementar = await response.json();
                }

                // Popula Projetos
                const projetosUnicos = [...new Set(todasAsOSComplementar.map(os => os.projeto))];
                selectProjetoComplementar.innerHTML = '<option value="" selected disabled>Selecione o projeto...</option>';
                projetosUnicos.forEach(projeto => selectProjetoComplementar.add(new Option(projeto, projeto)));

                // Popula OSs
                selectOSComplementar.innerHTML = '<option value="" selected disabled>Selecione a OS...</option>';
                todasAsOSComplementar.forEach(os => {
                    const option = new Option(os.os, os.os);
                    option.dataset.id = os.id;
                    option.dataset.projeto = os.projeto;
                    // Salva o primeiro detalhe para pegar o site
                    if (os.detalhes && os.detalhes.length > 0) {
                        option.dataset.site = os.detalhes[0].site;
                    }
                    selectOSComplementar.add(option);
                });

            } catch (error) {
                mostrarToast(error.message, 'error');
                selectProjetoComplementar.innerHTML = '<option value="">Erro ao carregar</option>';
                selectOSComplementar.innerHTML = '<option value="">Erro ao carregar</option>';
            }
        });

        // --- 2. Filtro Cruzado: Projeto -> OS ---
        selectProjetoComplementar.addEventListener('change', () => {
            const projetoSelecionado = selectProjetoComplementar.value;
            if (!projetoSelecionado) return;

            // Tenta selecionar automaticamente a primeira OS do projeto
            const osCorrespondente = todasAsOSComplementar.find(os => os.projeto === projetoSelecionado);
            if (osCorrespondente && selectOSComplementar.value !== osCorrespondente.os) {
                selectOSComplementar.value = osCorrespondente.os;
                selectOSComplementar.dispatchEvent(new Event('change'));
            }
        });

        // --- 3. Ao selecionar OS: Preenche Site e Carrega LPUs ---
        selectOSComplementar.addEventListener('change', async () => {
            const osCodigo = selectOSComplementar.value;
            if (!osCodigo) return;

            const inputSite = document.getElementById('siteComplementar');
            const selectedOption = selectOSComplementar.options[selectOSComplementar.selectedIndex];

            // Preenche Site
            inputSite.value = selectedOption.dataset.site || '-';

            // Sincroniza Projeto
            const projetoDaOS = selectedOption.dataset.projeto;
            if (projetoDaOS && selectProjetoComplementar.value !== projetoDaOS) {
                selectProjetoComplementar.value = projetoDaOS;
            }

            // Prepara Load de LPUs
            choicesLPU.clearStore();
            choicesLPU.disable();
            choicesLPU.setChoices([{ value: '', label: 'Carregando LPUs...', disabled: true }]);

            try {
                // Busca Contratos/LPUs (Monólito)
                const response = await fetchComAuth(`${API_BASE_URL}/contrato`);
                if (!response.ok) throw new Error('Falha ao buscar LPUs.');

                const contratos = await response.json();
                const lpuChoices = [{ value: '', label: 'Selecione o item LPU...', selected: true, disabled: true }];

                contratos.forEach(contrato => {
                    if (contrato.lpus && contrato.lpus.length > 0) {
                        contrato.lpus.forEach(lpu => {
                            if (lpu.ativo) {
                                // Adiciona o valor unitário no customProperties para uso futuro se precisar
                                lpuChoices.push({
                                    value: lpu.id,
                                    label: `Contrato: ${contrato.nome} | ${lpu.codigoLpu} - ${lpu.nomeLpu}`,
                                    customProperties: { valor: lpu.valor }
                                });
                            }
                        });
                    }
                });

                choicesLPU.setChoices(lpuChoices, 'value', 'label', false);
                choicesLPU.enable();

            } catch (error) {
                mostrarToast('Erro ao carregar a lista de LPUs.', 'error');
                choicesLPU.setChoices([{ value: '', label: 'Erro ao carregar', disabled: true }]);
            }
        });

        // --- 4. Enviar Solicitação (CORRIGIDO PARA MICROSSERVIÇO) ---
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const btnSubmit = document.getElementById('btnEnviarSolicitacaoComplementar');
            const selectedOption = selectOSComplementar.options[selectOSComplementar.selectedIndex];
            const osIdParaApi = selectedOption ? selectedOption.dataset.id : null;

            if (!osIdParaApi) {
                mostrarToast('Erro: OS não identificada.', 'error');
                return;
            }

            // Monta o Payload
            const payload = {
                osId: parseInt(osIdParaApi),
                lpuId: parseInt(selectLPUComplementar.value),
                quantidade: parseInt(document.getElementById('quantidadeComplementar').value),
                justificativa: document.getElementById('justificativaComplementar').value,
                solicitanteId: parseInt(localStorage.getItem('usuarioId')),
                solicitanteNome: localStorage.getItem('usuarioNome') || 'Usuário'
            };

            // UI Loading
            btnSubmit.disabled = true;
            btnSubmit.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Enviando...`;

            // URL do Microsserviço (Porta 8082)
            const MS_URL = "http://localhost:8082/v1/solicitacoes-complementares";

            try {
                // Usa fetch nativo para garantir a URL absoluta (evita prefixo do fetchComAuth se houver)
                const response = await fetch(MS_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(errorText || 'Erro ao enviar solicitação.');
                }

                // Sucesso
                const data = await response.json(); // Só pra consumir o body
                mostrarToast('Solicitação de atividade complementar enviada com sucesso!', 'success');
                modalSolicitarComplementar.hide();

            } catch (error) {
                console.error(error);
                mostrarToast(`Erro: ${error.message}`, 'error');
            } finally {
                btnSubmit.disabled = false;
                btnSubmit.innerHTML = '<i class="bi bi-send me-1"></i> Enviar para Aprovação';
            }
        });
    }

    const btnExportar = document.getElementById('btnExportar');
    if (btnExportar) {
        btnExportar.addEventListener('click', () => {
            const dadosParaExportar = {
                "Pendências": {
                    dados: getDadosFiltrados().filter(l => ['RECUSADO_COORDENADOR', 'RECUSADO_CONTROLLER'].includes(l.situacaoAprovacao)),
                    colunas: colunasMinhasPendencias
                },
                "Lançamentos": {
                    dados: getDadosFiltrados().filter(l => l.situacaoAprovacao === 'RASCUNHO'),
                    colunas: colunasLancamentos
                },
                "Pendente Aprovação": {
                    dados: getDadosFiltrados().filter(l => ['PENDENTE_COORDENADOR', 'AGUARDANDO_EXTENSAO_PRAZO', 'PENDENTE_CONTROLLER'].includes(l.situacaoAprovacao)),
                    colunas: colunasPrincipais
                },
                "Paralisados": {
                    dados: getProjetosParalisados(),
                    colunas: colunasMinhasPendencias
                },
                "Histórico": {
                    dados: getDadosFiltrados().filter(l => !['RASCUNHO', 'PENDENTE_COORDENADOR', 'AGUARDANDO_EXTENSAO_PRAZO', 'PENDENTE_CONTROLLER', 'RECUSADO_COORDENADOR', 'RECUSADO_CONTROLLER'].includes(l.situacaoAprovacao)),
                    colunas: colunasHistorico
                }
            };
            const wb = XLSX.utils.book_new();
            for (const aba in dadosParaExportar) {
                const { dados, colunas } = dadosParaExportar[aba];
                const rows = dados.map(lancamento => {
                    return colunas.map(coluna => {
                        const func = dataMapping[coluna];
                        if (func) return func(lancamento);
                        return "";
                    });
                });
                const ws = XLSX.utils.aoa_to_sheet([colunas, ...rows]);
                const colWidths = colunas.map(col => ({ wch: Math.max(15, col.length + 2) }));
                ws['!cols'] = colWidths;
                XLSX.utils.book_append_sheet(wb, ws, aba);
            }
            XLSX.writeFile(wb, "lancamentos.xlsx");
        });
    }

    function verificarMensagemAnoNovo() {
        // 1. Verificação de Data (Trava de Segurança)
        const hoje = new Date();
        // getMonth() retorna 0 para Janeiro. 
        // Se não for Janeiro OU se o dia for maior que 7, interrompe.
        if (hoje.getMonth() !== 0 || hoje.getDate() > 7) {
            return;
        }

        const usuarioId = localStorage.getItem('usuarioId');
        if (!usuarioId) return;

        // Chave única por usuário para o ano
        const storageKey = `msgAnoNovo_2026_user_${usuarioId}`;

        // Pega quantas vezes já viu
        let visualizacoes = parseInt(localStorage.getItem(storageKey) || '0');

        // Se viu menos de 1 vez (ainda não viu), mostra o modal
        if (visualizacoes < 1) {
            const modalEl = document.getElementById('modalAnoNovo');
            if (modalEl) {
                const modal = new bootstrap.Modal(modalEl);
                modal.show();

                // Marca que já foi visualizado
                visualizacoes++;
                localStorage.setItem(storageKey, visualizacoes.toString());
            }
        }
    }

    function inicializarCabecalhos() {
        renderizarCabecalho(colunasLancamentos, document.querySelector('#lancamentos-pane thead'));
        renderizarCabecalho(colunasPrincipais, document.querySelector('#pendentes-pane thead'));
        renderizarCabecalho(colunasHistorico, document.querySelector('#historico-pane thead'));
        renderizarCabecalho(colunasMinhasPendencias, document.querySelector('#minhasPendencias-pane thead'));
        renderizarCabecalho(colunasMinhasPendencias, document.querySelector('#paralisados-pane thead'));
        renderizarCabecalho(colunasPendenteDoc, document.querySelector('#pendente-doc-pane thead'));
    }

    inicializarCabecalhos();
    adicionarListenersDeOrdenacao();
    carregarLancamentos();
    configurarVisibilidadePorRole();
    window.carregarLancamentos = carregarLancamentos;
});