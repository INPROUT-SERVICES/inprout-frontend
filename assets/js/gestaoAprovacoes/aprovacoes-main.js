// ==========================================================
// 3. LÓGICA PRINCIPAL (aprovacoes-main.js)
// ==========================================================

document.addEventListener('DOMContentLoaded', async function () {

    await carregarComponentesHTML();

    configurarVisibilidadePorRole();
    initScrollAbas();

    // 1. Inicializa o Calendário (Flatpickr)
    const campoNovaData = document.getElementById('novaDataProposta');
    if (campoNovaData) {
        flatpickr(campoNovaData, {
            locale: "pt",
            dateFormat: "Y-m-d",
            altInput: true,
            altFormat: "d/m/Y",
            allowInput: false,
            minDate: "today"
        });
    }

    const userRole = localStorage.getItem('role') || localStorage.getItem('userRole');

    // Busca a aba pelo ID para ajustar texto conforme role
    const tabDocumentacao = document.getElementById('minhas-docs-tab');

    if (tabDocumentacao) {
        if (userRole === 'DOCUMENTIST') {
            // Documentista: Ícone + "Minhas documentações"
            tabDocumentacao.innerHTML = '<i class="bi bi-folder2-open me-1"></i> Minhas documentações';
        } else {
            // Outros: Ícone + "Documentação"
            tabDocumentacao.innerHTML = '<i class="bi bi-folder2-open me-1"></i> Documentação';
        }
    }

    // 2. Carregamento Inicial
    const abaInicial = document.querySelector('#aprovacoesTab .nav-link.active');
    if (abaInicial) {
        const idInicial = abaInicial.getAttribute('data-bs-target');
        toggleLoader(true, idInicial);
    }

    // Carrega dados e define o que renderizar
    carregarDashboardEBadges().finally(() => {
        const abaAtivaAgora = document.querySelector('#aprovacoesTab .nav-link.active');

        // Remove loader de todas as abas possíveis para garantir
        ['#atividades-pane', '#materiais-pane', '#complementares-pane', '#cps-pendencias-pane', '#minhas-docs-pane'].forEach(id => toggleLoader(false, id));

        if (abaAtivaAgora) {
            const painelAtivoId = abaAtivaAgora.getAttribute('data-bs-target');

            // Renderiza o conteúdo da aba que o usuário está vendo AGORA
            if (painelAtivoId === '#atividades-pane') {
                renderizarAcordeonPendencias(window.todasPendenciasAtividades);
            }
            else if (painelAtivoId === '#materiais-pane') {
                if (typeof carregarDadosMateriais === 'function') {
                    carregarDadosMateriais();
                } else {
                    renderizarCardsPedidos(window.todasPendenciasMateriais);
                }
            }
            else if (painelAtivoId === '#complementares-pane') {
                renderizarTabelaPendentesComplementares(window.todasPendenciasComplementares);
            }
            else if (painelAtivoId === '#cps-pendencias-pane') {
                initFiltrosCPS();
                carregarPendenciasCPS();
            }
            else if (painelAtivoId === '#minhas-docs-pane') {
                initDocumentacaoTab();
            }
        }
    });

    // 3. Listeners de Troca de Abas
    const tabElements = document.querySelectorAll('#aprovacoesTab .nav-link');
    tabElements.forEach(tabEl => {
        tabEl.addEventListener('show.bs.tab', function (event) {
            const targetPaneId = event.target.getAttribute('data-bs-target');
            const targetPane = document.querySelector(targetPaneId);

            // Abas de Pendências (usam dados globais já carregados)
            if (targetPaneId === '#atividades-pane') {
                renderizarAcordeonPendencias(window.todasPendenciasAtividades);
            }
            else if (targetPaneId === '#materiais-pane') {
                if (typeof carregarDadosMateriais === 'function') {
                    carregarDadosMateriais();
                }
            }
            else if (targetPaneId === '#complementares-pane') {
                if (window.AprovacoesComplementares && typeof window.AprovacoesComplementares.carregarPendencias === 'function') {
                    window.AprovacoesComplementares.carregarPendencias();
                } else {
                    renderizarTabelaPendentesComplementares(window.todasPendenciasComplementares);
                }
            }
            else if (targetPaneId === '#historico-atividades-pane' && targetPane.dataset.loaded !== 'true') {
                if (typeof carregarDadosHistoricoAtividades === 'function') {
                    carregarDadosHistoricoAtividades().finally(() => { targetPane.dataset.loaded = 'true'; });
                }
            }
            else if (targetPaneId === '#historico-materiais-pane' && targetPane.dataset.loaded !== 'true') {
                if (typeof window.carregarDadosHistoricoMateriais === 'function') {
                    carregarDadosHistoricoMateriais().finally(() => { targetPane.dataset.loaded = 'true'; });
                } else {
                    console.warn('A função carregarDadosHistoricoMateriais não está definida.');
                    targetPane.innerHTML = `<div class="text-center p-5 text-muted">Funcionalidade carregando... Tente atualizar a página.</div>`;
                }
            }
            else if (targetPaneId === '#historico-complementares-pane' && targetPane.dataset.loaded !== 'true') {
                if (typeof carregarDadosHistoricoComplementares === 'function') {
                    carregarDadosHistoricoComplementares().finally(() => { targetPane.dataset.loaded = 'true'; });
                }
            }
            else if (targetPaneId === '#cps-pendencias-pane') { initFiltrosCPS(); carregarPendenciasCPS(); }
            else if (targetPaneId === '#cps-historico-pane') { initFiltrosCPS(); carregarHistoricoCPS(); }
            else if (targetPaneId === '#minhas-docs-pane') {
                initDocumentacaoTab();
            }
        });
    });

    // 4. Lógica de Checkbox (Atividades)
    const accordionPendencias = document.getElementById('accordion-pendencias');
    if (accordionPendencias) {
        accordionPendencias.addEventListener('click', (e) => {
            if (e.target.closest('.check-container-header')) {
                e.stopPropagation();
            }
        });

        accordionPendencias.addEventListener('change', (e) => {
            const target = e.target;

            if (target.classList.contains('selecionar-todos-acordeon')) {
                const isChecked = target.checked;
                const targetBodyId = target.dataset.targetBody;
                const filhos = document.querySelectorAll(`#${targetBodyId} .linha-checkbox`);
                filhos.forEach(cb => {
                    cb.checked = isChecked;
                    const tr = cb.closest('tr');
                    if (tr) tr.classList.toggle('table-active', isChecked);
                });
                const btnAcordeon = target.closest('.accordion-header').querySelector('.accordion-button');
                if (btnAcordeon) {
                    isChecked ? btnAcordeon.classList.add('header-selected') : btnAcordeon.classList.remove('header-selected');
                }
                atualizarEstadoAcoesLote();
            }
            else if (target.classList.contains('linha-checkbox')) {
                const tr = target.closest('tr');
                if (tr) tr.classList.toggle('table-active', target.checked);
                atualizarEstadoAcoesLote();
            }
        });
    }

    // 5. Botões de Ação em Lote (Atividades)
    document.getElementById('btn-aprovar-selecionados')?.addEventListener('click', () => {
        if (modalAprovar) {
            modalAprovar._element.dataset.acaoEmLote = 'true';
            const checks = document.querySelectorAll('#accordion-pendencias .linha-checkbox:checked');
            const modalBody = modalAprovar._element.querySelector('.modal-body p');
            if (modalBody) modalBody.innerHTML = `Você está prestes a aprovar <b>${checks.length}</b> itens selecionados.<br>Deseja continuar?`;
            modalAprovar.show();
        }
    });

    document.getElementById('btn-recusar-selecionados')?.addEventListener('click', () => {
        const checkboxes = document.querySelectorAll('#accordion-pendencias .linha-checkbox:checked');
        if (checkboxes.length === 0) return;

        const firstId = checkboxes[0].dataset.id;
        const lanc = window.todosOsLancamentosGlobais.find(l => l.id == firstId);

        if ((userRole === 'CONTROLLER' || userRole === 'ADMIN') &&
            (lanc.situacaoAprovacao === 'AGUARDANDO_EXTENSAO_PRAZO' || lanc.situacaoAprovacao === 'PRAZO_VENCIDO')) {
            if (modalComentar) {
                modalComentar._element.dataset.acaoEmLote = 'true';
                const title = modalComentar._element.querySelector('.modal-title');
                if (title) title.innerHTML = '<i class="bi bi-calendar-x-fill text-danger me-2"></i>Recusar Prazo em Lote';
                modalComentar.show();
            }
        } else {
            if (modalRecusar) {
                modalRecusar._element.dataset.acaoEmLote = 'true';
                document.getElementById('motivoRecusa').value = '';
                const title = modalRecusar._element.querySelector('.modal-title');
                if (title) title.innerHTML = '<i class="bi bi-x-circle-fill text-danger me-2"></i>Recusar em Lote';
                modalRecusar.show();
            }
        }
    });

    document.getElementById('btn-solicitar-prazo-selecionados')?.addEventListener('click', () => {
        if (modalComentar) {
            modalComentar._element.dataset.acaoEmLote = 'true';
            document.getElementById('comentarioCoordenador').value = '';
            document.getElementById('novaDataProposta').value = '';
            const title = modalComentar._element.querySelector('.modal-title');
            if (title) title.innerHTML = '<i class="bi bi-clock-history text-warning me-2"></i>Solicitar Prazo em Lote';
            modalComentar.show();
        }
    });

    const container = document.getElementById('tabsScrollContainer');
    const btnLeft = document.getElementById('btnScrollLeft');
    const btnRight = document.getElementById('btnScrollRight');

    if (container && btnLeft && btnRight) {

        // Função para atualizar visibilidade das setas
        const atualizarSetas = () => {
            // Esconde esquerda se estiver no início (scroll <= 0)
            btnLeft.style.display = container.scrollLeft > 0 ? 'block' : 'none';

            // Lógica opcional para esconder a direita se chegar no fim (requer cálculo preciso)
            // btnRight.style.display = (container.scrollLeft + container.clientWidth >= container.scrollWidth - 1) ? 'none' : 'block';
        };

        // Scroll para Esquerda
        btnLeft.addEventListener('click', () => {
            container.scrollBy({ left: -200, behavior: 'smooth' });
            setTimeout(atualizarSetas, 300); // Atualiza após a animação
        });

        // Scroll para Direita
        btnRight.addEventListener('click', () => {
            container.scrollBy({ left: 200, behavior: 'smooth' });
            setTimeout(atualizarSetas, 300);
        });

        // Detecta scroll manual (trackpad/touch) para atualizar setas
        container.addEventListener('scroll', atualizarSetas);

        // Inicializa estado
        atualizarSetas();
    }

    // 6. Lógica de Checkbox (Complementares)
    const painelComplementar = document.getElementById('complementares-pane');
    if (painelComplementar) {
        painelComplementar.addEventListener('change', (e) => {
            const target = e.target;
            const cbTodos = document.getElementById('selecionar-todos-complementar');

            if (target.classList.contains('linha-checkbox-complementar')) {
                target.closest('tr')?.classList.toggle('table-active', target.checked);
                const total = document.querySelectorAll('.linha-checkbox-complementar').length;
                const checked = document.querySelectorAll('.linha-checkbox-complementar:checked').length;
                cbTodos.checked = total > 0 && checked === total;
                cbTodos.indeterminate = checked > 0 && checked < total;
            } else if (target.id === 'selecionar-todos-complementar') {
                document.querySelectorAll('.linha-checkbox-complementar').forEach(cb => {
                    cb.checked = target.checked;
                    cb.closest('tr')?.classList.toggle('table-active', target.checked);
                });
            }
            atualizarEstadoAcoesLoteComplementar();
        });
    }

    document.getElementById('btn-aprovar-selecionados-complementar')?.addEventListener('click', () => {
        if (modalAprovarComplementar) { modalAprovarComplementar._element.dataset.acaoEmLote = 'true'; modalAprovarComplementar.show(); }
    });
    document.getElementById('btn-recusar-selecionados-complementar')?.addEventListener('click', () => {
        if (modalRecusarComplementar) { modalRecusarComplementar._element.dataset.acaoEmLote = 'true'; recusarComplementar(null); }
    });

    // =================================================================
    // BOTÃO FINALIZAR DOC
    // =================================================================
    document.addEventListener('click', function (e) {
        const btn = e.target.closest('.btn-finalizar-doc');
        if (btn) {
            const id = btn.dataset.id;
            const idsLote = btn.dataset.idsLote;

            const modalFinalizar = new bootstrap.Modal(document.getElementById('modalFinalizarDoc'));
            document.getElementById('finalizarDocId').value = id;
            document.getElementById('finalizarDocId').dataset.idsLote = idsLote || id;

            document.getElementById('assuntoEmailDoc').value = '';
            modalFinalizar.show();
        }
    });

    document.getElementById('btnConfirmarFinalizarDoc')?.addEventListener('click', async function () {
        const idsString = document.getElementById('finalizarDocId').dataset.idsLote;
        const ids = idsString ? idsString.split(',') : [document.getElementById('finalizarDocId').value];

        const assunto = document.getElementById('assuntoEmailDoc').value;

        if (!assunto) {
            mostrarToast("O assunto do e-mail é obrigatório.", "warning");
            return;
        }

        const btn = this;
        setButtonLoading(btn, true);

        try {
            const promises = ids.map(id =>
                fetchComAuth(`${API_BASE_URL}/lancamentos/${id}/documentacao/finalizar`, {
                    method: 'POST',
                    body: JSON.stringify({ assuntoEmail: assunto })
                })
            );

            await Promise.all(promises);
            mostrarToast("Documentação finalizada para todos os itens da OS!", "success");

            const modalEl = document.getElementById('modalFinalizarDoc');
            const modal = bootstrap.Modal.getInstance(modalEl);
            modal.hide();

            await carregarDashboardEBadges();

        } catch (e) {
            mostrarToast(e.message || "Erro ao finalizar alguns itens.", 'error');
        } finally {
            setButtonLoading(btn, false);
        }
    });

    // =================================================================
    // HANDLERS DE SUBMIT (ATIVIDADES)
    // =================================================================

    document.getElementById('btnConfirmarAprovacao')?.addEventListener('click', async function () {
        const isLote = modalAprovar._element.dataset.acaoEmLote === 'true';
        const ids = isLote
            ? Array.from(document.querySelectorAll('#accordion-pendencias .linha-checkbox:checked')).map(cb => cb.dataset.id)
            : [document.getElementById('aprovarLancamentoId').value];

        if (ids.length === 0) return;

        let lanc = window.todosOsLancamentosGlobais.find(l => l.id == ids[0]);
        if (!lanc && window.todasPendenciasAtividades) lanc = window.todasPendenciasAtividades.find(l => l.id == ids[0]);
        if (!lanc && window.todosHistoricoAtividades) lanc = window.todosHistoricoAtividades.find(l => l.id == ids[0]);

        if (!lanc) {
            mostrarToast("Erro: Dados do lançamento não encontrados em memória.", "error");
            return;
        }

        let endpoint = '';
        if (lanc.situacaoAprovacao === 'PENDENTE_COORDENADOR') endpoint = '/lancamentos/lote/coordenador-aprovar';
        else if (lanc.situacaoAprovacao === 'AGUARDANDO_EXTENSAO_PRAZO') endpoint = '/lancamentos/lote/prazo/aprovar';
        else endpoint = '/lancamentos/lote/controller-aprovar';

        toggleLoader(true, '#atividades-pane');
        setButtonLoading(this, true);
        try {
            const res = await fetchComAuth(`${API_BASE_URL}${endpoint}`, { method: 'POST', body: JSON.stringify({ lancamentoIds: ids, aprovadorId: userId, controllerId: userId }) });
            if (!res.ok) throw new Error("Erro ao aprovar.");

            mostrarToast(`${ids.length} item(ns) aprovado(s) com sucesso!`, "success");
            modalAprovar.hide();
            const histPane = document.getElementById('historico-atividades-pane');
            if (histPane) histPane.dataset.loaded = 'false';
            await carregarDashboardEBadges();
            renderizarAcordeonPendencias(window.todasPendenciasAtividades);
        } catch (e) {
            mostrarToast(e.message, 'error');
        }
        finally { setButtonLoading(this, false); delete modalAprovar._element.dataset.acaoEmLote; toggleLoader(false, '#atividades-pane'); }
    });

    document.getElementById('formRecusarLancamento')?.addEventListener('submit', async function (event) {
        if (this.dataset.tipoRecusa === 'DOCUMENTACAO') return;
        event.preventDefault();

        const btn = document.getElementById('btnConfirmarRecusa');
        const isAcaoEmLote = modalRecusar._element.dataset.acaoEmLote === 'true';
        const ids = isAcaoEmLote
            ? Array.from(document.querySelectorAll('#accordion-pendencias .linha-checkbox:checked')).map(cb => cb.dataset.id)
            : [document.getElementById('recusarLancamentoId').value];

        if (ids.length === 0) {
            mostrarToast("Nenhum item selecionado.", "warning");
            return;
        }

        const motivo = document.getElementById('motivoRecusa').value.trim();
        if (!motivo) {
            mostrarToast("O motivo da recusa é obrigatório.", "warning");
            return;
        }

        if (!userId) {
            mostrarToast("Erro de sessão: ID do usuário não encontrado. Faça login novamente.", "error");
            return;
        }

        let endpoint = '';
        let payload = {};

        if (userRole === 'CONTROLLER' || userRole === 'ADMIN') {
            endpoint = '/lancamentos/lote/controller-rejeitar';
            payload = { lancamentoIds: ids, controllerId: userId, motivoRejeicao: motivo };
        } else {
            endpoint = '/lancamentos/lote/coordenador-rejeitar';
            payload = { lancamentoIds: ids, aprovadorId: userId, comentario: motivo };
        }

        toggleLoader(true, '#atividades-pane');
        setButtonLoading(btn, true);

        try {
            const res = await fetchComAuth(`${API_BASE_URL}${endpoint}`, {
                method: 'POST',
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.message || `Erro ao recusar (Status: ${res.status})`);
            }

            mostrarToast(`${ids.length} item(ns) recusado(s) com sucesso!`, "success");
            modalRecusar.hide();

            const histPane = document.getElementById('historico-atividades-pane');
            if (histPane) histPane.dataset.loaded = 'false';
            await carregarDashboardEBadges();
            renderizarAcordeonPendencias(window.todasPendenciasAtividades);

        } catch (e) {
            console.error("Erro na recusa:", e);
            mostrarToast(e.message, 'error');
        } finally {
            setButtonLoading(btn, false);
            if (modalRecusar._element) delete modalRecusar._element.dataset.acaoEmLote;
            toggleLoader(false, '#atividades-pane');
        }
    });

    document.getElementById('formComentarPrazo')?.addEventListener('submit', async function (event) {
        event.preventDefault();
        const btn = document.getElementById('btnEnviarComentario');
        const isAcaoEmLote = modalComentar._element.dataset.acaoEmLote === 'true';
        const ids = isAcaoEmLote ? Array.from(document.querySelectorAll('#accordion-pendencias .linha-checkbox:checked')).map(cb => cb.dataset.id) : [document.getElementById('comentarLancamentoId').value];

        const comentario = document.getElementById('comentarioCoordenador').value;
        const novaData = document.getElementById('novaDataProposta').value;

        if (['CONTROLLER', 'ADMIN'].includes(userRole)) {
            if (!novaData && document.querySelector('label[for="novaDataProposta"]').textContent.includes('Obrigatório')) {
                mostrarToast("Por favor, defina o novo prazo.", "warning"); return;
            }
        } else {
            if (!novaData) { mostrarToast("Por favor, selecione uma data para o prazo.", "warning"); return; }
        }

        let endpoint = '';
        let payload = {};
        if (userRole === 'CONTROLLER' || userRole === 'ADMIN') {
            endpoint = '/lancamentos/lote/prazo/rejeitar';
            payload = { lancamentoIds: ids, controllerId: userId, motivoRejeicao: comentario, novaDataPrazo: novaData };
        } else {
            endpoint = '/lancamentos/lote/coordenador-solicitar-prazo';
            payload = { lancamentoIds: ids, coordenadorId: userId, comentario: comentario, novaDataSugerida: novaData };
        }

        toggleLoader(true, '#atividades-pane');
        setButtonLoading(btn, true);
        try {
            const res = await fetchComAuth(`${API_BASE_URL}${endpoint}`, { method: 'POST', body: JSON.stringify(payload) });
            if (!res.ok) throw new Error("Erro ao processar solicitação de prazo.");

            mostrarToast("Ação de prazo realizada com sucesso!", "success");
            modalComentar.hide();
            const histPane = document.getElementById('historico-atividades-pane');
            if (histPane) histPane.dataset.loaded = 'false';
            await carregarDashboardEBadges();
            renderizarAcordeonPendencias(window.todasPendenciasAtividades);
        } catch (e) {
            mostrarToast(e.message, 'error');
        }
        finally { setButtonLoading(btn, false); delete modalComentar._element.dataset.acaoEmLote; toggleLoader(false, '#atividades-pane'); }
    });

    // =================================================================
    // HANDLERS DE SUBMIT (MATERIAIS)
    // =================================================================

    document.getElementById('btnConfirmarAprovacaoMaterial')?.addEventListener('click', async function () {
        const id = this.dataset.id;
        const endpoint = userRole === 'COORDINATOR' ? `/solicitacoes/${id}/coordenador/aprovar` : `/solicitacoes/${id}/controller/aprovar`;

        toggleLoader(true, '#materiais-pane');
        setButtonLoading(this, true);
        try {
            await fetchComAuth(`${API_MATERIALS_URL}${endpoint}`, { method: 'POST', body: JSON.stringify({ aprovadorId: userId }) });
            mostrarToast('Solicitação de material aprovada!', 'success');
            modalAprovarMaterial.hide();
            await carregarDashboardEBadges();

            if (typeof carregarDadosMateriais === 'function') carregarDadosMateriais();
            else renderizarCardsPedidos(window.todasPendenciasMateriais);

        } catch (e) { mostrarToast(e.message, 'error'); }
        finally { setButtonLoading(this, false); toggleLoader(false, '#materiais-pane'); }
    });

    document.getElementById('formRecusarMaterial')?.addEventListener('submit', async function (event) {
        event.preventDefault();
        const id = this.dataset.id;
        const motivo = document.getElementById('motivoRecusaMaterial').value;
        const btn = document.getElementById('btnConfirmarRecusaMaterial');
        const endpoint = userRole === 'COORDINATOR' ? `/solicitacoes/${id}/coordenador/rejeitar` : `/solicitacoes/${id}/controller/rejeitar`;

        toggleLoader(true, '#materiais-pane');
        setButtonLoading(btn, true);
        try {
            await fetchComAuth(`${API_MATERIALS_URL}${endpoint}`, { method: 'POST', body: JSON.stringify({ aprovadorId: userId, observacao: motivo }) });
            mostrarToast('Solicitação de material recusada.', 'success');
            modalRecusarMaterial.hide();
            await carregarDashboardEBadges();

            if (typeof carregarDadosMateriais === 'function') carregarDadosMateriais();
            else renderizarCardsPedidos(window.todasPendenciasMateriais);

        } catch (e) { mostrarToast(e.message, 'error'); }
        finally { setButtonLoading(btn, false); toggleLoader(false, '#materiais-pane'); }
    });

    // =================================================================
    // HANDLERS DE SUBMIT (COMPLEMENTARES)
    // =================================================================

    document.getElementById('btnConfirmarAprovacaoComplementar')?.addEventListener('click', async function () {
        const isLote = modalAprovarComplementar._element.dataset.acaoEmLote === 'true';
        const ids = isLote
            ? Array.from(document.querySelectorAll('#tbody-pendentes-complementares .linha-checkbox-complementar:checked')).map(cb => cb.dataset.id)
            : [this.dataset.id];

        if (ids.length === 0) return;
        const endpoint = userRole === 'COORDINATOR' ? '/aprovacoes/complementares/lote/coordenador/aprovar' : '/aprovacoes/complementares/lote/controller/aprovar';

        toggleLoader(true, '#complementares-pane');
        setButtonLoading(this, true);
        try {
            await fetchComAuth(`${API_BASE_URL}${endpoint}`, { method: 'POST', body: JSON.stringify({ solicitacaoIds: ids, aprovadorId: userId }) });
            mostrarToast(`${ids.length} solicitação(ões) aprovada(s)!`, 'success');
            modalAprovarComplementar.hide();
            await carregarDashboardEBadges();
            renderizarTabelaPendentesComplementares(window.todasPendenciasComplementares);
        } catch (e) { mostrarToast(e.message, 'error'); }
        finally { setButtonLoading(this, false); delete modalAprovarComplementar._element.dataset.acaoEmLote; toggleLoader(false, '#complementares-pane'); }
    });

    document.getElementById('formRecusarComplementar')?.addEventListener('submit', async function (event) {
        event.preventDefault();
        const btn = document.getElementById('btnConfirmarRecusaComplementar');
        const isLote = modalRecusarComplementar._element.dataset.acaoEmLote === 'true';
        const ids = isLote
            ? Array.from(document.querySelectorAll('#tbody-pendentes-complementares .linha-checkbox-complementar:checked')).map(cb => cb.dataset.id)
            : [this.dataset.id];
        const motivo = document.getElementById('motivoRecusaComplementar').value;

        if (ids.length === 0) return;
        const endpoint = userRole === 'COORDINATOR' ? '/aprovacoes/complementares/lote/coordenador/rejeitar' : '/aprovacoes/complementares/lote/controller/rejeitar';

        toggleLoader(true, '#complementares-pane');
        setButtonLoading(btn, true);
        try {
            await fetchComAuth(`${API_BASE_URL}${endpoint}`, { method: 'POST', body: JSON.stringify({ solicitacaoIds: ids, aprovadorId: userId, motivo: motivo }) });
            mostrarToast(`${ids.length} solicitação(ões) recusada(s).`, 'success');
            modalRecusarComplementar.hide();
            await carregarDashboardEBadges();
            renderizarTabelaPendentesComplementares(window.todasPendenciasComplementares);
        } catch (e) { mostrarToast(e.message, 'error'); }
        finally { setButtonLoading(btn, false); delete modalRecusarComplementar._element.dataset.acaoEmLote; toggleLoader(false, '#complementares-pane'); }
    });

    // =================================================================
    // HANDLERS DE SUBMIT (CPS)
    // =================================================================

    document.getElementById('formAlterarValorCPS')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btnConfirmarAcaoCPS');
        const acao = document.getElementById('cpsAcaoCoordenador').value;
        const just = document.getElementById('cpsJustificativaInput').value;
        const competencia = document.getElementById('cpsCompetenciaInput').value;
        const isLote = modalAlterarValorCPS._element.dataset.acaoEmLote === 'true';

        let ids = isLote
            ? Array.from(document.querySelectorAll('.cps-check:checked')).map(c => parseInt(c.dataset.id))
            : [parseInt(document.getElementById('cpsLancamentoIdAcao').value)];

        if (ids.length === 0) return;

        let endpoint = acao === 'recusar'
            ? (isLote ? '/controle-cps/recusar-lote' : '/controle-cps/recusar')
            : (isLote ? '/controle-cps/fechar-lote' : '/controle-cps/fechar');

        let payload = {};
        if (acao === 'recusar') {
            payload = isLote
                ? { lancamentoIds: ids, coordenadorId: userId, justificativa: just }
                : { lancamentoId: ids[0], coordenadorId: userId, valorPagamento: 0, justificativa: just };
        } else {
            if (isLote) payload = { lancamentoIds: ids, coordenadorId: userId, competencia: competencia };
            else {
                const valor = parseFloat(document.getElementById('cpsValorPagamentoInput').value.replace(/\./g, '').replace(',', '.'));
                payload = { lancamentoId: ids[0], coordenadorId: userId, valorPagamento: valor, justificativa: just, competencia: competencia };
            }
        }

        toggleLoader(true, '#cps-pendencias-pane');
        setButtonLoading(btn, true);
        try {
            await fetchComAuth(`${API_BASE_URL}${endpoint}`, { method: 'POST', body: JSON.stringify(payload) });
            mostrarToast("Ação CPS realizada com sucesso!", "success");
            modalAlterarValorCPS.hide();
            await carregarPendenciasCPS();
        } catch (e) { mostrarToast(e.message, 'error'); }
        finally { setButtonLoading(btn, false); toggleLoader(false, '#cps-pendencias-pane'); }
    });

    document.getElementById('formRecusarCPS')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.querySelector('#formRecusarCPS button[type="submit"]');
        const motivo = document.getElementById('cpsMotivoRecusaInput').value;
        const isLote = modalRecusarCPS._element.dataset.acaoEmLote === 'true';

        let ids = isLote
            ? Array.from(document.querySelectorAll('.cps-check:checked')).map(c => parseInt(c.dataset.id))
            : [parseInt(document.getElementById('cpsLancamentoIdRecusar').value)];

        const endpoint = isLote ? '/controle-cps/recusar-controller-lote' : '/controle-cps/recusar-controller';
        const payload = isLote
            ? { lancamentoIds: ids, controllerId: userId, motivo: motivo }
            : { lancamentoId: ids[0], controllerId: userId, motivo: motivo };

        toggleLoader(true, '#cps-pendencias-pane');
        setButtonLoading(btn, true);
        try {
            await fetchComAuth(`${API_BASE_URL}${endpoint}`, { method: 'POST', body: JSON.stringify(payload) });
            mostrarToast("Item(ns) devolvido(s) ao Gestor.", "success");
            modalRecusarCPS.hide();
            await carregarPendenciasCPS();
        } catch (e) { mostrarToast(e.message, 'error'); }
        finally { setButtonLoading(btn, false); toggleLoader(false, '#cps-pendencias-pane'); }
    });

    document.getElementById('btnConfirmarAprovarAdiantamento')?.addEventListener('click', async function () {
        const id = document.getElementById('idAdiantamentoAprovar').value;
        toggleLoader(true, '#cps-pendencias-pane');
        setButtonLoading(this, true);
        try {
            await fetchComAuth(`${API_BASE_URL}/lancamentos/${id}/pagar-adiantamento`, { method: 'POST', body: JSON.stringify({ usuarioId: userId }) });
            mostrarToast("Adiantamento pago!", "success");
            modalAprovarAdiantamento.hide();
            await carregarPendenciasCPS();
        } catch (e) { mostrarToast(e.message, 'error'); }
        finally { setButtonLoading(this, false); toggleLoader(false, '#cps-pendencias-pane'); }
    });

    document.getElementById('btnConfirmarRecusaAdiantamento')?.addEventListener('click', async function () {
        const id = document.getElementById('idAdiantamentoRecusar').value;
        const motivo = document.getElementById('motivoRecusaAdiantamento').value;
        if (!motivo) { mostrarToast("Motivo obrigatório.", "warning"); return; }

        toggleLoader(true, '#cps-pendencias-pane');
        setButtonLoading(this, true);
        try {
            await fetchComAuth(`${API_BASE_URL}/lancamentos/${id}/recusar-adiantamento`, { method: 'POST', body: JSON.stringify({ usuarioId: userId, motivo: motivo }) });
            mostrarToast("Adiantamento recusado.", "warning");
            modalRecusarAdiantamento.hide();
            await carregarPendenciasCPS();
        } catch (e) { mostrarToast(e.message, 'error'); }
        finally { setButtonLoading(this, false); toggleLoader(false, '#cps-pendencias-pane'); }
    });

    document.getElementById('btn-pagar-selecionados-cps')?.addEventListener('click', async function () {
        const ids = Array.from(document.querySelectorAll('.cps-check:checked')).map(c => parseInt(c.dataset.id));
        if (ids.length === 0) return;

        toggleLoader(true, '#cps-pendencias-pane');
        const btn = this;
        setButtonLoading(btn, true);
        try {
            await fetchComAuth(`${API_BASE_URL}/controle-cps/pagar-lote`, { method: 'POST', body: JSON.stringify({ lancamentoIds: ids, controllerId: userId }) });
            mostrarToast("Pagamentos realizados!", "success");
            await carregarPendenciasCPS();
        } catch (e) { mostrarToast(e.message, 'error'); }
        finally { setButtonLoading(btn, false); toggleLoader(false, '#cps-pendencias-pane'); }
    });

    document.getElementById('filtro-historico-status')?.addEventListener('change', () => {
        renderizarTabelaHistorico(window.todosHistoricoAtividades);
    });
    document.getElementById('btn-carregar-mais-historico')?.addEventListener('click', () => {
        window.histDataFim.setDate(window.histDataFim.getDate() - 1);
        window.histDataInicio.setDate(window.histDataInicio.getDate() - 30);
        carregarDadosHistoricoAtividades(true);
    });

    async function carregarComponentesHTML() {
        const containers = document.querySelectorAll('[data-include]');

        for (const el of containers) {
            const file = el.getAttribute('data-include');
            try {
                const response = await fetch(file);
                if (!response.ok) throw new Error(`Falha ao carregar ${file}`);
                const html = await response.text();
                el.innerHTML = html;
            } catch (error) {
                console.error("Erro na modularização:", error);
            }
        }
    }
});

async function carregarDashboardEBadges() {
    toggleLoader(true, '.overview-card');
    try {
        const URL_MATERIAIS = window.API_MATERIALS_URL || (window.location.origin.includes('localhost') ? 'http://localhost:8081' : window.location.origin);
        const URL_COMPLEMENTARES = window.API_COMPLEMENTARES_URL || (window.location.origin.includes('localhost') ? 'http://localhost:8082' : window.location.origin + '/atividades');

        // Carregamentos paralelos iniciais
        const promises = [
            fetchComAuth(`${API_BASE_URL}/lancamentos`), // Geral (pode vir vazio para doc)
            fetchComAuth(`${API_BASE_URL}/lancamentos/pendentes/${userId}`), // Pendentes
            fetchComAuth(`${API_BASE_URL}/lancamentos/pendencias-por-coordenador`),
            fetchComAuth(`${URL_MATERIAIS}/api/materiais/solicitacoes/pendentes`, { headers: { 'X-User-Role': userRole, 'X-User-ID': userId } }),
            fetchComAuth(`${URL_COMPLEMENTARES}/v1/solicitacoes-complementares/pendentes?role=${userRole}`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } })
        ];

        const [resGeral, resPendAtiv, resPendCoord, resPendMat, resPendCompl] = await Promise.all(promises);

        if (!resGeral.ok) throw new Error('Falha no dashboard.');

        window.todosOsLancamentosGlobais = await resGeral.json();
        const todasPendenciasGerais = await resPendAtiv.json();

        if (userRole === 'DOCUMENTIST') {
            // 1. Inicia listas
            let listaPendentes = todasPendenciasGerais.map(l => mapearParaFrontDoc(l));
            let listaHistorico = [];

            // 2. Busca histórico completo (Carteira)
            try {
                const resHistorico = await fetchComAuth(`${API_BASE_URL}/lancamentos/documentacao/historico-lista?usuarioId=${userId}`);
                if (resHistorico.ok) {
                    const dadosCarteira = await resHistorico.json();

                    // 3. LÓGICA DE FUSÃO E FILTRAGEM (CORREÇÃO PEDIDA)
                    dadosCarteira.forEach(itemCarteira => {
                        const itemFormatado = mapearParaFrontDoc(itemCarteira);
                        const status = itemFormatado.statusDocumentacao;

                        // Se for status ATIVO, garante que esteja na lista de pendentes
                        if (status === 'PENDENTE_RECEBIMENTO' || status === 'EM_ANALISE') {
                            // Verifica se já existe na lista de pendentes (pelo ID da OS)
                            const jaExiste = listaPendentes.some(p => String(p.id) === String(itemFormatado.id));
                            if (!jaExiste) {
                                listaPendentes.push(itemFormatado);
                            }
                        }
                        // Se for status FINALIZADO/REJEITADO, vai para o histórico
                        else if (status.includes('FINALIZADO') || status === 'DEVOLVIDO' || status === 'REPROVADO') {
                            listaHistorico.push(itemFormatado);
                        }
                    });
                }
            } catch (e) {
                console.error("Erro ao buscar histórico dedicado", e);
            }

            // Atribui às variáveis globais
            window.minhasDocsPendentes = listaPendentes;
            window.minhasDocsHistorico = listaHistorico;

            // Ordenação
            window.minhasDocsHistorico.sort((a, b) => b.id - a.id);

        } else {
            // Lógica MANAGER/ADMIN (Mantida a original)
            const osComDocumentacaoFinalizada = new Set();
            window.todosOsLancamentosGlobais.forEach(l => {
                if (l.os && (l.os.statusDocumentacao === 'FINALIZADO' || l.os.statusDocumentacao === 'FINALIZADO_COM_RESSALVA')) {
                    osComDocumentacaoFinalizada.add(String(l.os.id));
                }
            });

            const mapaOsDoc = new Map();
            window.todosOsLancamentosGlobais.forEach(l => {
                const osId = l.os ? String(l.os.id) : null;
                if (!osId) return;

                const statusOS = l.os.statusDocumentacao;
                if (!statusOS || statusOS === 'NAO_APLICAVEL') return;
                if (statusOS === 'FINALIZADO') return;
                if (osComDocumentacaoFinalizada.has(osId)) return;

                if (!mapaOsDoc.has(osId)) {
                    mapaOsDoc.set(osId, mapearParaFrontDoc(l));
                }
                const entradaOS = mapaOsDoc.get(osId);
                if (!entradaOS.itensRelacionados.includes(l.id)) {
                    entradaOS.itensRelacionados.push(l.id);
                }
            });
            window.minhasDocsPendentes = Array.from(mapaOsDoc.values());
        }

        // Resto da lógica de dashboard...
        window.todasPendenciasAtividades = todasPendenciasGerais.filter(l => !l.statusDocumentacao || l.statusDocumentacao === 'NAO_APLICAVEL');
        if (userRole === 'DOCUMENTIST') window.todasPendenciasAtividades = [];

        const pendenciasPorCoordenador = await resPendCoord.json();
        if (resPendMat.ok) window.todasPendenciasMateriais = await resPendMat.json(); else window.todasPendenciasMateriais = [];
        if (resPendCompl.ok) window.todasPendenciasComplementares = await resPendCompl.json(); else window.todasPendenciasComplementares = [];

        renderizarCardsDashboard(window.todosOsLancamentosGlobais, pendenciasPorCoordenador, window.todasPendenciasMateriais.length, window.todasPendenciasComplementares.length);
        atualizarBadge('#materiais-tab', window.todasPendenciasMateriais.length);
        atualizarBadge('#complementares-tab', window.todasPendenciasComplementares.length);
        atualizarBadge('#minhas-docs-tab', window.minhasDocsPendentes.length);

        const abaAtivaAgora = document.querySelector('#aprovacoesTab .nav-link.active');
        if (abaAtivaAgora) {
            const painelAtivoId = abaAtivaAgora.getAttribute('data-bs-target');
            if (painelAtivoId === '#minhas-docs-pane') initDocumentacaoTab();
            // ... outros painéis omitidos para brevidade (mantém igual)
        }

    } catch (e) { console.error(e); }
    finally { toggleLoader(false, '.overview-card'); }
}

function mapearParaFrontDoc(l) {
    const idReal = (l.os && l.os.id) ? l.os.id : l.id;

    let statusParaExibir = l.statusDocumentacao;

    if (!statusParaExibir || statusParaExibir === 'NAO_APLICAVEL') {
        if (l.os && l.os.statusDocumentacao) {
            statusParaExibir = l.os.statusDocumentacao;
        } else {
            statusParaExibir = 'PENDENTE';
        }
    }

    return {
        id: idReal,
        isAgrupado: true,
        os: l.os || {},
        // Aqui usamos a variável calculada acima, que agora será 'FINALIZADO'
        statusDocumentacao: statusParaExibir,

        tipoDocumentacaoNome: l.tipoDocumentacaoNome || (l.os && l.os.tipoDocumentacao ? l.os.tipoDocumentacao.nome : 'Padrão'),
        documentistaNome: l.documentistaNome || (l.os && l.os.documentista ? l.os.documentista.nome : '-'),
        dataPrazoDoc: l.dataPrazoDoc || (l.os ? l.os.dataPrazoDoc : null),
        manager: l.manager,
        valorTotalOS: l.valorDocumentista || (l.os ? l.os.valorDocumentista : 0),
        itensRelacionados: [l.id],
        assuntoEmail: l.os ? l.os.assuntoEmailDoc : ''
    };
}

function atualizarBadge(selector, count) {
    const tab = document.querySelector(selector);
    if (!tab) return;

    if (!tab.classList.contains('position-relative')) {
        tab.classList.add('position-relative');
    }

    let badge = tab.querySelector('.badge');
    if (!badge) {
        badge = document.createElement('span');
        badge.className = 'position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger';
        tab.appendChild(badge);
    }

    badge.textContent = count > 9 ? '9+' : count;
    badge.style.display = count > 0 ? '' : 'none';
}

function configurarVisibilidadePorRole() {
    const currentRole = (localStorage.getItem("role") || "").trim().toUpperCase();

    if (currentRole === 'MANAGER') {
        ['atividades-tab', 'materiais-tab', 'complementares-tab', 'cps-pendencias-tab', 'cps-historico-tab'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.parentElement.style.display = 'none';
        });
        const histTab = document.getElementById('historico-atividades-tab');
        if (histTab) new bootstrap.Tab(histTab).show();
    }

    else if (currentRole === 'DOCUMENTIST') {
        const dashboardSuperior = document.querySelector('.overview-card');
        if (dashboardSuperior) dashboardSuperior.style.setProperty('display', 'none', 'important');

        const abasParaEsconder = [
            'atividades-tab', 'historico-atividades-tab', 'cps-pendencias-tab',
            'cps-historico-tab', 'complementares-tab', 'historico-complementares-tab',
            'materiais-tab', 'historico-materiais-tab'
        ];

        const docPane = document.getElementById('minhas-docs-pane');
        if (docPane) {
            docPane.style.setProperty('display', 'block', 'important');
        }

        abasParaEsconder.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.style.setProperty('display', 'none', 'important');
            }
        });

        const docTab = document.getElementById('minhas-docs-tab');
        if (docTab) {
            docTab.innerHTML = '<i class="bi bi-folder-check me-1"></i> Controle de documentação';
            const tabTrigger = new bootstrap.Tab(docTab);
            tabTrigger.show();
            document.getElementById('atividades-pane')?.classList.remove('show', 'active');
            document.getElementById('minhas-docs-pane')?.classList.add('show', 'active');
        }
    }
}

function initScrollAbas() {
    const list = document.getElementById('aprovacoesTab');
    const left = document.getElementById('btnScrollLeft');
    const right = document.getElementById('btnScrollRight');
    if (list && left && right) {
        left.addEventListener('click', () => list.scrollBy({ left: -300, behavior: 'smooth' }));
        right.addEventListener('click', () => list.scrollBy({ left: 300, behavior: 'smooth' }));
    }
}

function atualizarEstadoAcoesLote() {
    const checkboxesSelecionados = document.querySelectorAll('#accordion-pendencias .linha-checkbox:checked');
    const totalSelecionado = checkboxesSelecionados.length;

    const acoesContainer = document.getElementById('acoes-lote-container');
    const contadorAprov = document.getElementById('contador-aprovacao');
    const contadorRecusa = document.getElementById('contador-recusa');
    const contadorPrazo = document.getElementById('contador-prazo');

    const btnAprovar = document.getElementById('btn-aprovar-selecionados');
    const btnRecusar = document.getElementById('btn-recusar-selecionados');
    const btnPrazo = document.getElementById('btn-solicitar-prazo-selecionados');

    if (!acoesContainer) return;

    acoesContainer.classList.toggle('d-none', totalSelecionado === 0);
    if (totalSelecionado === 0) return;

    if (contadorAprov) contadorAprov.textContent = totalSelecionado;
    if (contadorRecusa) contadorRecusa.textContent = totalSelecionado;
    if (contadorPrazo) contadorPrazo.textContent = totalSelecionado;

    const idsSelecionados = Array.from(checkboxesSelecionados).map(cb => cb.dataset.id);
    const lancamentosSelecionados = window.todosOsLancamentosGlobais.filter(l => idsSelecionados.includes(String(l.id)));

    if (lancamentosSelecionados.length === 0 && window.todasPendenciasAtividades) {
        const temp = window.todasPendenciasAtividades.filter(l => idsSelecionados.includes(String(l.id)));
        lancamentosSelecionados.push(...temp);
    }

    if (lancamentosSelecionados.length === 0) return;

    const primeiroStatus = lancamentosSelecionados[0].situacaoAprovacao;
    const todosMesmoStatus = lancamentosSelecionados.every(l => l.situacaoAprovacao === primeiroStatus);

    [btnAprovar, btnRecusar, btnPrazo].forEach(btn => {
        if (btn) btn.style.display = 'none';
    });

    if (todosMesmoStatus) {
        if (['COORDINATOR', 'MANAGER', 'ADMIN'].includes(userRole)) {
            if (primeiroStatus === 'PENDENTE_COORDENADOR') {
                if (btnAprovar) btnAprovar.style.display = 'inline-block';
                if (btnRecusar) btnRecusar.style.display = 'inline-block';
                if (btnPrazo) btnPrazo.style.display = 'inline-block';
            }
        }
        if (['CONTROLLER', 'ADMIN'].includes(userRole)) {
            if (primeiroStatus === 'PENDENTE_CONTROLLER') {
                if (btnAprovar) {
                    btnAprovar.style.display = 'inline-block';
                    btnAprovar.innerHTML = `<i class="bi bi-check-lg"></i> Aprovar (${totalSelecionado})`;
                }
                if (btnRecusar) {
                    btnRecusar.style.display = 'inline-block';
                    btnRecusar.innerHTML = `<i class="bi bi-x-lg"></i> Recusar (${totalSelecionado})`;
                }
            }
            else if (['AGUARDANDO_EXTENSAO_PRAZO', 'PRAZO_VENCIDO'].includes(primeiroStatus)) {
                if (btnAprovar) {
                    btnAprovar.style.display = 'inline-block';
                    btnAprovar.innerHTML = `<i class="bi bi-calendar-check"></i> Aprovar Prazo (${totalSelecionado})`;
                }
                if (btnRecusar) {
                    btnRecusar.style.display = 'inline-block';
                    btnRecusar.innerHTML = `<i class="bi bi-calendar-x"></i> Recusar Prazo (${totalSelecionado})`;
                }
            }
        }
    }
}

function atualizarEstadoAcoesLoteComplementar() {
    const container = document.getElementById('acoes-lote-container-complementar');
    const checkboxes = document.querySelectorAll('#tbody-pendentes-complementares .linha-checkbox-complementar:checked');
    if (!container) return;
    container.classList.toggle('d-none', checkboxes.length === 0);
    if (checkboxes.length > 0) {
        document.getElementById('contador-aprovacao-complementar').textContent = checkboxes.length;
        document.getElementById('contador-recusa-complementar').textContent = checkboxes.length;
    }
}