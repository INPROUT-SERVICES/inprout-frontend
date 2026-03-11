/**
 * registros-actions.js
 * Lógica para interação do usuário (Modais de Edição, Exclusão, Histórico e Sort).
 */

const RegistrosActions = {
    init: () => {
        RegistrosActions.setupListenersAcoes();
        RegistrosActions.setupSort();
        RegistrosActions.setupPaginationListeners();
        RegistrosActions.setupSearchDebounce();
    },

    setupSearchDebounce: () => {
        const input = document.getElementById('searchInput');
        let timeout = null;
        input.addEventListener('input', (e) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                RegistrosApi.carregarDados(0, e.target.value);
            }, 600);
        });
    },

    setupSort: () => {
        const btnSortOS = document.getElementById('btnSortOS');
        if (btnSortOS) {
            btnSortOS.addEventListener('click', () => {
                RegistrosState.osSortDirection = RegistrosState.osSortDirection === 'asc' ? 'desc' : 'asc';
                const icon = btnSortOS.querySelector('i');
                if (icon) {
                    icon.classList.remove('bi-sort-down', 'bi-sort-up');
                    icon.classList.add(RegistrosState.osSortDirection === 'asc' ? 'bi-sort-down' : 'bi-sort-up');
                }
                RegistrosApi.carregarDados(RegistrosState.paginaAtual, RegistrosState.termoBusca);
            });
        }
    },

    setupPaginationListeners: () => {
        const rowsSelect = document.getElementById('rowsPerPage');
        if (rowsSelect) {
            rowsSelect.addEventListener('change', (e) => {
                RegistrosState.linhasPorPagina = e.target.value === 'all' ? 'all' : parseInt(e.target.value, 10);
                RegistrosApi.carregarDados(0, RegistrosState.termoBusca);
            });
        }

        const goToPage = (novaPagina) => {
            if (novaPagina >= 0 && novaPagina < RegistrosState.totalPaginas) {
                RegistrosApi.carregarDados(novaPagina, RegistrosState.termoBusca);
            }
        };

        const btnPrimeira = document.getElementById('btnPrimeiraPagina');
        const btnAnterior = document.getElementById('btnPaginaAnterior');
        const btnProxima = document.getElementById('btnProximaPagina');
        const btnUltima = document.getElementById('btnUltimaPagina');

        if (btnPrimeira) btnPrimeira.addEventListener('click', () => goToPage(0));
        if (btnAnterior) btnAnterior.addEventListener('click', () => goToPage(RegistrosState.paginaAtual - 1));
        if (btnProxima) btnProxima.addEventListener('click', () => goToPage(RegistrosState.paginaAtual + 1));
        if (btnUltima) btnUltima.addEventListener('click', () => goToPage(RegistrosState.totalPaginas - 1));
    },

    setupListenersAcoes: () => {
        const accordionContainer = document.getElementById('accordion-registros');

        const modalEditarDetalheEl = document.getElementById('modalEditarDetalhe');
        const modalEditarDetalhe = modalEditarDetalheEl ? new bootstrap.Modal(modalEditarDetalheEl) : null;

        const modalConfirmarExclusaoEl = document.getElementById('modalConfirmarExclusao');
        const modalConfirmarExclusao = modalConfirmarExclusaoEl ? new bootstrap.Modal(modalConfirmarExclusaoEl) : null;

        const modalHistoricoEl = document.getElementById('modalHistoricoLancamentos');
        const modalHistorico = modalHistoricoEl ? new bootstrap.Modal(modalHistoricoEl) : null;

        const modalFinalizarEl = document.getElementById('modalConfirmarFinalizacao');
        const modalFinalizar = modalFinalizarEl ? new bootstrap.Modal(modalFinalizarEl) : null;

        // CORREÇÃO: Verificação se o container existe
        if (accordionContainer) {
            accordionContainer.addEventListener('click', async function (e) {
                const btnEdit = e.target.closest('.btn-edit-detalhe');
                const btnDelete = e.target.closest('.btn-delete-registro');
                const btnHistorico = e.target.closest('.btn-historico');
                const btnFinalizarWrapper = e.target.closest('.icon-hover-wrapper');

                // --- NOVO: Listener do Botão de Inativar/Ativar ---
                const btnToggleStatus = e.target.closest('.btn-toggle-status');

                if (btnToggleStatus) {
                    e.preventDefault();
                    e.stopPropagation();
                    const detalheId = btnToggleStatus.dataset.id;
                    const statusAtual = btnToggleStatus.dataset.status;

                    const acao = statusAtual === 'INATIVO' ? 'ATIVAR' : 'INATIVAR';
                    const novoStatus = statusAtual === 'INATIVO' ? 'ATIVO' : 'INATIVO';
                    const cor = statusAtual === 'INATIVO' ? 'success' : 'warning';

                    const result = await Swal.fire({
                        title: `Deseja ${acao} este registro?`,
                        text: acao === 'INATIVO'
                            ? "O registro ficará riscado e o valor não somará no total da OS."
                            : "O registro voltará a ser contabilizado normalmente.",
                        icon: 'question',
                        showCancelButton: true,
                        confirmButtonText: `Sim, ${acao}`,
                        confirmButtonColor: acao === 'INATIVO' ? '#d33' : '#28a745',
                        cancelButtonText: 'Cancelar'
                    });

                    if (result.isConfirmed) {
                        try {
                            await RegistrosApi.alternarStatusDetalhe(detalheId, novoStatus);
                            RegistrosUtils.mostrarToast(`Registro alterado para ${novoStatus} com sucesso!`, 'success');
                            RegistrosApi.carregarDados(RegistrosState.paginaAtual, RegistrosState.termoBusca);
                        } catch (error) {
                            RegistrosUtils.mostrarToast("Erro ao alterar status: " + error.message, 'error');
                        }
                    }
                }
                // --------------------------------------------------

                if (btnEdit) {
                    e.preventDefault();
                    const detalheId = btnEdit.dataset.id;
                    RegistrosActions.abrirModalEdicao(detalheId, modalEditarDetalhe);
                }

                if (btnDelete) {
                    e.preventDefault();
                    const detalheId = btnDelete.dataset.id;
                    const deleteInput = document.getElementById('deleteOsId');
                    if (deleteInput) deleteInput.value = detalheId;
                    if (modalConfirmarExclusao) modalConfirmarExclusao.show();
                }

                if (btnHistorico) {
                    e.preventDefault();
                    const detalheId = btnHistorico.dataset.detalheId;
                    RegistrosActions.abrirModalHistorico(detalheId, modalHistorico);
                }

                if (btnFinalizarWrapper) {
                    e.stopPropagation();
                    e.preventDefault();
                    const osId = btnFinalizarWrapper.getAttribute('data-os-id');
                    const inputHidden = document.getElementById('inputHiddenOsIdFinalizar');
                    if (inputHidden) inputHidden.value = osId;
                    if (modalFinalizar) modalFinalizar.show();
                }
            });
        }

        const btnConfirmarFinalizacaoAction = document.getElementById('btnConfirmarFinalizacaoAction');
        if (btnConfirmarFinalizacaoAction) {
            btnConfirmarFinalizacaoAction.addEventListener('click', async () => {
                const inputHidden = document.getElementById('inputHiddenOsIdFinalizar');
                const osId = inputHidden ? inputHidden.value : null;
                if (!osId) return;

                const originalText = btnConfirmarFinalizacaoAction.innerHTML;
                btnConfirmarFinalizacaoAction.disabled = true;
                btnConfirmarFinalizacaoAction.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Processando...';

                try {
                    const sucesso = await RegistrosApi.finalizarOsRestante(osId);
                    if (sucesso) {
                        RegistrosUtils.mostrarToast('OS finalizada com sucesso!', 'success');
                        RegistrosApi.carregarDados(RegistrosState.paginaAtual, RegistrosState.termoBusca);
                        if (modalFinalizar) modalFinalizar.hide();
                    } else {
                        RegistrosUtils.mostrarToast('Não foi possível finalizar a OS.', 'error');
                    }
                } catch (error) {
                    RegistrosUtils.mostrarToast(error.message || 'Erro inesperado.', 'error');
                } finally {
                    btnConfirmarFinalizacaoAction.innerHTML = originalText;
                    btnConfirmarFinalizacaoAction.disabled = false;
                }
            });
        }

        RegistrosActions.setupFormEdicao(modalEditarDetalhe);

        const btnConfirmarExclusaoDefinitiva = document.getElementById('btnConfirmarExclusaoDefinitiva');
        if (btnConfirmarExclusaoDefinitiva) {
            btnConfirmarExclusaoDefinitiva.addEventListener('click', function () {
                RegistrosActions.executarExclusao(this, modalConfirmarExclusao);
            });
        }
    },

    abrirModalEdicao: async (detalheId, modal) => {
        const linhaData = RegistrosState.todasAsLinhas.find(l => RegistrosUtils.get(l, 'detalhe.id') == detalheId);

        if (linhaData) {
            const formEditarDetalheEl = document.getElementById('formEditarDetalhe');
            document.getElementById('editDetalheId').value = detalheId;
            const osId = RegistrosUtils.get(linhaData, 'os.id');
            formEditarDetalheEl.dataset.osId = osId;

            document.getElementById('osValue').value = RegistrosUtils.get(linhaData, 'os.os', 'N/A');

            const chaveExistente = RegistrosUtils.get(linhaData, 'detalhe.key', '');
            document.getElementById('novaKeyValue').value = chaveExistente;
            formEditarDetalheEl.dataset.originalKey = chaveExistente;

            const gestorTimExistente = RegistrosUtils.get(linhaData, 'os.gestorTim', '');
            document.getElementById('novoGestorTimValue').value = gestorTimExistente;
            formEditarDetalheEl.dataset.originalGestorTim = gestorTimExistente;

            const selectSegmento = document.getElementById('selectSegmento');
            const segmentoAtualId = RegistrosUtils.get(linhaData, 'os.segmento.id');
            formEditarDetalheEl.dataset.originalSegmentoId = segmentoAtualId;

            selectSegmento.innerHTML = '<option value="">Carregando...</option>';
            try {
                const segmentos = await RegistrosApi.fetchSegmentos();
                selectSegmento.innerHTML = '<option value="" disabled>Selecione o segmento...</option>';
                segmentos.forEach(seg => {
                    const option = document.createElement('option');
                    option.value = seg.id;
                    option.textContent = seg.nome;
                    if (seg.id == segmentoAtualId) {
                        option.selected = true;
                    }
                    selectSegmento.appendChild(option);
                });
            } catch (err) {
                selectSegmento.innerHTML = '<option value="">Erro ao carregar</option>';
            }

            document.querySelectorAll('#formEditarDetalhe .toggle-editar').forEach(toggle => {
                toggle.checked = false;
                const targetInput = document.querySelector(toggle.dataset.target);
                if (targetInput) targetInput.disabled = true;
            });
            document.getElementById('btnSalvarDetalhe').disabled = true;

            const userRole = RegistrosState.userRole;
            const keyFieldGroup = document.getElementById('novaKeyValue').closest('.mb-3');
            const segmentoFieldGroup = document.getElementById('selectSegmento').closest('.mb-3');
            const gestorTimFieldGroup = document.getElementById('novoGestorTimValue').closest('.mb-3');

            if (keyFieldGroup) keyFieldGroup.style.display = 'none';
            if (segmentoFieldGroup) segmentoFieldGroup.style.display = 'none';
            if (gestorTimFieldGroup) gestorTimFieldGroup.style.display = 'none';

            if (userRole === 'ADMIN' || userRole === 'ASSISTANT') {
                if (keyFieldGroup) keyFieldGroup.style.display = 'block';
                if (segmentoFieldGroup) segmentoFieldGroup.style.display = 'block';
                if (gestorTimFieldGroup) gestorTimFieldGroup.style.display = 'block';
            } else if (userRole === 'COORDINATOR' || userRole === 'MANAGER') {
                if (gestorTimFieldGroup) gestorTimFieldGroup.style.display = 'block';
            }

            if (modal) modal.show();

        } else {
            RegistrosUtils.mostrarToast("Não foi possível carregar os dados para edição.", "error");
        }
    },

    abrirModalHistorico: (detalheId, modal) => {
        const linhaData = RegistrosState.todasAsLinhas.find(l => RegistrosUtils.get(l, 'detalhe.id') == detalheId);
        if (!linhaData || !linhaData.detalhe || !linhaData.detalhe.lancamentos) return;

        const lancamentos = [...linhaData.detalhe.lancamentos];
        // Ordena do mais recente para o mais antigo
        lancamentos.sort((a, b) => b.id - a.id);

        const tbody = document.getElementById('tbody-historico-lancamentos');
        if (tbody) {
            tbody.innerHTML = '';
            lancamentos.forEach(l => {
                const tr = document.createElement('tr');

                // Formatação de status (exemplo simples)
                let statusBadge = l.situacaoAprovacao;
                if (l.situacaoAprovacao === 'APROVADO') statusBadge = '<span class="badge bg-success">Aprovado</span>';
                else if (l.situacaoAprovacao === 'REJEITADO') statusBadge = '<span class="badge bg-danger">Rejeitado</span>';
                else if (l.situacaoAprovacao && l.situacaoAprovacao.includes('PENDENTE')) statusBadge = '<span class="badge bg-warning text-dark">Pendente</span>';

                tr.innerHTML = `
                    <td>${RegistrosUtils.formatarData(l.dataAtividade)}</td>
                    <td>${statusBadge}</td>
                    <td>${l.situacao || '-'}</td>
                    <td>${l.etapa ? (l.etapa.codigoGeral + ' - ' + l.etapa.nomeGeral) : '-'}</td>
                    
                    <td><small class="text-muted" style="white-space: pre-wrap;">${l.detalheDiario || '-'}</small></td>
                    
                    <td>${l.prestador ? l.prestador.nome : '-'}</td>
                    <td>${RegistrosUtils.formatarMoeda(l.valor)}</td>
                    <td>${l.manager ? l.manager.nome : '-'}</td>
                `;
                tbody.appendChild(tr);
            });
        }

        if (modal) modal.show();
    },

    setupRelatorioEspecial: () => {
        const userRole = RegistrosState.userRole;
        if (['ADMIN', 'CONTROLLER', 'ASSISTANT'].includes(userRole)) {
            const container = document.getElementById('container-relatorio-especial');
            if (container) container.classList.remove('d-none');
        }

        const btn = document.getElementById('btnRelatorioFaturadoPendente');
        if (btn) {
            btn.addEventListener('click', async () => {
                const originalHtml = btn.innerHTML;
                btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Gerando...';
                btn.disabled = true;

                try {
                    const token = localStorage.getItem('token');
                    const response = await fetch(`${RegistrosState.API_BASE_URL}/os/relatorios/faturados-nao-finalizados`, {
                        method: 'GET',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });

                    if (!response.ok) throw new Error('Erro ao gerar relatório');
                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `Relatorio_Faturados_Pendentes_${new Date().getTime()}.csv`;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    window.URL.revokeObjectURL(url);
                } catch (error) {
                    console.error(error);
                    alert('Erro ao baixar relatório.');
                } finally {
                    btn.innerHTML = originalHtml;
                    btn.disabled = false;
                }
            });
        }
    },

    setupFormEdicao: (modal) => {
        const formEditarDetalheEl = document.getElementById('formEditarDetalhe');
        if (!formEditarDetalheEl) return;

        formEditarDetalheEl.addEventListener('change', (e) => {
            if (e.target.classList.contains('toggle-editar')) {
                const toggle = e.target;
                const targetSelector = toggle.dataset.target;
                const targetInput = document.querySelector(targetSelector);
                if (targetInput) {
                    targetInput.disabled = !toggle.checked;
                    const event = new Event('input', { bubbles: true });
                    targetInput.dispatchEvent(event);
                }
            }
        });

        formEditarDetalheEl.addEventListener('input', () => {
            const originalKey = formEditarDetalheEl.dataset.originalKey || '';
            const originalSegmentoId = formEditarDetalheEl.dataset.originalSegmentoId;
            const originalGestorTim = formEditarDetalheEl.dataset.originalGestorTim || '';

            const currentKey = document.getElementById('novaKeyValue').value;
            const currentSegmentoId = document.getElementById('selectSegmento').value;
            const currentGestorTim = document.getElementById('novoGestorTimValue').value;

            const keyChanged = originalKey !== currentKey && document.querySelector('#formEditarDetalhe .toggle-editar[data-target="#novaKeyValue"]').checked;
            const segmentoChanged = originalSegmentoId != currentSegmentoId && document.querySelector('#formEditarDetalhe .toggle-editar[data-target="#selectSegmento"]').checked;
            const gestorTimChanged = originalGestorTim !== currentGestorTim && document.querySelector('#formEditarDetalhe .toggle-editar[data-target="#novoGestorTimValue"]').checked;

            document.getElementById('btnSalvarDetalhe').disabled = !(keyChanged || segmentoChanged || gestorTimChanged);
        });

        formEditarDetalheEl.addEventListener('submit', async function (e) {
            e.preventDefault();
            const detalheId = document.getElementById('editDetalheId').value;
            const osId = formEditarDetalheEl.dataset.osId;
            const btnSalvar = document.getElementById('btnSalvarDetalhe');
            const currentKey = document.getElementById('novaKeyValue').value;
            const currentSegmentoId = document.getElementById('selectSegmento').value;
            const currentGestorTim = document.getElementById('novoGestorTimValue').value;

            const keyChanged = document.querySelector('#formEditarDetalhe .toggle-editar[data-target="#novaKeyValue"]').checked;
            const segmentoChanged = document.querySelector('#formEditarDetalhe .toggle-editar[data-target="#selectSegmento"]').checked;
            const gestorTimChanged = document.querySelector('#formEditarDetalhe .toggle-editar[data-target="#novoGestorTimValue"]').checked;

            if (!(keyChanged || segmentoChanged || gestorTimChanged)) {
                RegistrosUtils.mostrarToast('Nenhuma alteração selecionada para salvar.', 'warning');
                return;
            }

            btnSalvar.disabled = true;
            btnSalvar.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Salvando...`;

            const promises = [];
            if (keyChanged) {
                promises.push(fetchComAuth(`${RegistrosState.API_BASE_URL}/os/detalhe/${detalheId}/key`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ key: currentKey })
                }));
            }
            if (segmentoChanged) {
                promises.push(fetchComAuth(`${RegistrosState.API_BASE_URL}/os/detalhe/${detalheId}/segmento`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ novoSegmentoId: parseInt(currentSegmentoId) })
                }));
            }
            if (gestorTimChanged) {
                promises.push(fetchComAuth(`${RegistrosState.API_BASE_URL}/os/${osId}/gestor-tim`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ gestorTim: currentGestorTim })
                }));
            }

            try {
                const results = await Promise.all(promises);
                let allSuccessful = true;
                let errorMessages = [];
                for (let i = 0; i < results.length; i++) {
                    const response = results[i];
                    if (!response.ok) {
                        allSuccessful = false;
                        let errorMessage = `Erro na requisição ${i + 1}`;
                        try {
                            const errorData = await response.json();
                            errorMessage = errorData.message || errorMessage;
                        } catch (e) { }
                        errorMessages.push(errorMessage);
                    }
                }

                if (allSuccessful) {
                    RegistrosUtils.mostrarToast('Detalhes atualizados com sucesso!', 'success');
                    if (modal) modal.hide();
                    RegistrosApi.carregarDados(RegistrosState.paginaAtual, RegistrosState.termoBusca);
                } else {
                    throw new Error(errorMessages.join(' | '));
                }
            } catch (error) {
                RegistrosUtils.mostrarToast(error.message, 'error');
            } finally {
                btnSalvar.disabled = false;
                btnSalvar.innerHTML = 'Salvar Alterações';
            }
        });
    },

    executarExclusao: async (btn, modal) => {
        const detalheId = document.getElementById('deleteOsId').value;
        if (!detalheId) return;

        btn.disabled = true;
        btn.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Excluindo...`;

        try {
            const response = await fetchComAuth(`${RegistrosState.API_BASE_URL}/os/detalhe/${detalheId}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Falha ao excluir.');
            RegistrosUtils.mostrarToast('Excluído com sucesso!', 'success');
            const idx = RegistrosState.todasAsLinhas.findIndex(l => RegistrosUtils.get(l, 'detalhe.id') == detalheId);
            if (idx > -1) RegistrosState.todasAsLinhas.splice(idx, 1);
            RegistrosRender.renderizarTabelaComFiltro();
            if (modal) modal.hide();
        } catch (error) {
            RegistrosUtils.mostrarToast(error.message, 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = 'Sim, Excluir';
        }
    },

    atualizarDadosLocais: (osId, detalheId, novosDados) => {
        RegistrosState.todasAsLinhas.forEach(linha => {
            if (linha.os.id == osId) {
                if (novosDados.gestorTim !== null) linha.os.gestorTim = novosDados.gestorTim;
                if (novosDados.segmentoId !== null && linha.os.segmento) {
                    linha.os.segmento.id = novosDados.segmentoId;
                    linha.os.segmento.nome = novosDados.segmentoNome;
                }
            }
            if (linha.detalhe && linha.detalhe.id == detalheId) {
                if (novosDados.key !== null) linha.detalhe.key = novosDados.key;
            }
        });
        const grupoIdx = RegistrosState.gruposFiltradosCache.findIndex(g => g.id == osId);
        if (grupoIdx > -1) {
            RegistrosState.gruposFiltradosCache[grupoIdx].linhas = RegistrosState.todasAsLinhas.filter(l => l.os.id == osId);
            const el = document.getElementById(`accordion-item-${osId}`);
            if (el) el.outerHTML = RegistrosRender.gerarHtmlParaGrupo(RegistrosState.gruposFiltradosCache[grupoIdx]);
        }
    },

    abrirModalFinanceiro: async (osId, nomeOs, materialAtual, transporteAtual) => {
        if (event) event.stopPropagation();
        const { value: formValues } = await Swal.fire({
            title: `Valores Extras - OS ${nomeOs}`,
            html: `
                <div class="text-start mb-3">
                    <label class="form-label fw-bold">Adicionar ao Material (R$)</label>
                    <div class="text-muted small mb-1">Atual: ${RegistrosUtils.formatarMoeda(materialAtual)} (Valor será somado)</div>
                    <input id="swal-input-material" type="number" step="0.01" class="form-control" placeholder="Ex: 1500.00">
                </div>
                <div class="text-start">
                    <label class="form-label fw-bold">Adicionar ao Transporte (R$)</label>
                    <div class="text-muted small mb-1">Atual: ${RegistrosUtils.formatarMoeda(transporteAtual)} (Valor será somado)</div>
                    <input id="swal-input-transporte" type="number" step="0.01" class="form-control" placeholder="Ex: 50.00">
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Salvar Adições',
            cancelButtonText: 'Cancelar',
            preConfirm: () => {
                return {
                    materialAdicional: document.getElementById('swal-input-material').value,
                    transporte: document.getElementById('swal-input-transporte').value
                }
            }
        });

        if (formValues) {
            try {
                const payload = {};
                if (formValues.materialAdicional) payload.materialAdicional = parseFloat(formValues.materialAdicional);
                if (formValues.transporte) payload.transporte = parseFloat(formValues.transporte);
                if (Object.keys(payload).length === 0) return;
                const response = await fetch(`${RegistrosState.API_BASE_URL}/os/${osId}/valores-financeiros`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + localStorage.getItem('token')
                    },
                    body: JSON.stringify(payload)
                });
                if (!response.ok) throw new Error('Erro ao atualizar valores');
                const osAtualizada = await response.json();
                Swal.fire('Sucesso!', 'Valores atualizados.', 'success');
                RegistrosState.todasAsLinhas.forEach(linha => {
                    if (linha.os.id === osId) {
                        linha.os.custoTotalMateriais = osAtualizada.custoTotalMateriais;
                        linha.os.transporte = osAtualizada.transporte;
                    }
                });
                RegistrosRender.renderizarTabelaComFiltro();
            } catch (error) {
                console.error(error);
                Swal.fire('Erro', 'Não foi possível salvar os valores.', 'error');
            }
        }
    }
};
window.abrirModalFinanceiro = RegistrosActions.abrirModalFinanceiro;

// =====================================================================
// CRIACAO MANUAL DE OS (Coordenador / Admin)
// =====================================================================

const NovaOsManager = {
    itensLpu: [],
    choicesInstance: null,
    listaLpusCache: null,
    modalInstance: null,

    getModal: () => {
        if (!NovaOsManager.modalInstance) {
            const el = document.getElementById('modalNovaOs');
            if (el) NovaOsManager.modalInstance = new bootstrap.Modal(el);
        }
        return NovaOsManager.modalInstance;
    },

    formatarMoeda: (valor) => {
        if (valor === null || valor === undefined || isNaN(Number(valor))) return 'R$ 0,00';
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
    },

    carregarLpus: async () => {
        if (NovaOsManager.listaLpusCache) return NovaOsManager.listaLpusCache;
        try {
            const response = await fetchComAuth(`${RegistrosState.API_BASE_URL}/contrato`);
            if (!response.ok) throw new Error('Erro ao buscar contratos');
            const contratos = await response.json();
            let lpus = [];
            contratos.forEach(c => {
                if (c.lpus) c.lpus.forEach(l => {
                    if (l.ativo) lpus.push({
                        id: l.id,
                        nome: `${c.nome} | ${l.codigoLpu} - ${l.nomeLpu}`,
                        valor: l.valorSemImposto || l.valor || 0
                    });
                });
            });
            lpus.sort((a, b) => a.nome.localeCompare(b.nome));
            NovaOsManager.listaLpusCache = lpus;
            return lpus;
        } catch (error) {
            console.error('Erro ao carregar LPUs:', error);
            RegistrosUtils.mostrarToast('Erro ao carregar LPUs.', 'error');
            return [];
        }
    },

    carregarSegmentos: async () => {
        const select = document.getElementById('novaOsSegmento');
        if (!select) return;
        select.innerHTML = '<option value="">Carregando...</option>';
        try {
            const segmentos = await RegistrosApi.fetchSegmentos();
            select.innerHTML = '<option value="" disabled selected>Selecione o segmento...</option>';
            segmentos.forEach(seg => {
                const opt = document.createElement('option');
                opt.value = seg.id;
                opt.textContent = seg.nome;
                select.appendChild(opt);
            });
        } catch (err) {
            select.innerHTML = '<option value="">Erro ao carregar</option>';
        }
    },

    inicializarChoicesLpu: async () => {
        const selectEl = document.getElementById('novaOsSelectLpu');
        if (!selectEl) return;

        // Destroi instancia anterior se existir
        if (NovaOsManager.choicesInstance) {
            NovaOsManager.choicesInstance.destroy();
            NovaOsManager.choicesInstance = null;
        }

        // Reset do select
        selectEl.innerHTML = '<option value="">Busque pela LPU...</option>';

        const lpus = await NovaOsManager.carregarLpus();

        NovaOsManager.choicesInstance = new Choices(selectEl, {
            searchEnabled: true,
            placeholder: true,
            placeholderValue: 'Busque pela LPU...',
            itemSelectText: '',
            noResultsText: 'Nenhuma LPU encontrada',
            shouldSort: false,
            searchPlaceholderValue: 'Digite para buscar...'
        });

        const choicesData = lpus.map(l => ({
            value: String(l.id),
            label: `${l.nome} (${NovaOsManager.formatarMoeda(l.valor)})`,
            selected: false,
            disabled: false
        }));

        NovaOsManager.choicesInstance.clearChoices();
        NovaOsManager.choicesInstance.setChoices(
            [{ value: '', label: 'Selecione uma LPU...', placeholder: true }, ...choicesData],
            'value', 'label', true
        );
    },

    abrirModal: async () => {
        // Limpa estado
        NovaOsManager.itensLpu = [];
        const form = document.getElementById('formNovaOs');
        if (form) form.reset();
        NovaOsManager.renderizarTabela();

        // Carrega dados em paralelo
        await Promise.all([
            NovaOsManager.carregarSegmentos(),
            NovaOsManager.inicializarChoicesLpu()
        ]);

        const modal = NovaOsManager.getModal();
        if (modal) modal.show();
    },

    adicionarLpu: () => {
        const selectEl = document.getElementById('novaOsSelectLpu');
        const qtdEl = document.getElementById('novaOsQuantidade');
        const lpuId = parseInt(selectEl?.value);
        const quantidade = parseInt(qtdEl?.value);

        if (!lpuId || isNaN(lpuId)) {
            RegistrosUtils.mostrarToast('Selecione uma LPU.', 'warning');
            return;
        }
        if (!quantidade || quantidade <= 0) {
            RegistrosUtils.mostrarToast('Informe uma quantidade valida.', 'warning');
            return;
        }

        // Verifica duplicata
        if (NovaOsManager.itensLpu.find(i => i.lpuId === lpuId)) {
            RegistrosUtils.mostrarToast('Esta LPU ja foi adicionada.', 'warning');
            return;
        }

        const lpuInfo = NovaOsManager.listaLpusCache?.find(l => l.id === lpuId);
        if (!lpuInfo) {
            RegistrosUtils.mostrarToast('LPU nao encontrada.', 'error');
            return;
        }

        NovaOsManager.itensLpu.push({
            lpuId: lpuInfo.id,
            lpuNome: lpuInfo.nome,
            valor: lpuInfo.valor,
            quantidade: quantidade
        });

        NovaOsManager.renderizarTabela();

        // Limpa selecao
        if (NovaOsManager.choicesInstance) {
            NovaOsManager.choicesInstance.setChoiceByValue('');
        }
        if (qtdEl) qtdEl.value = '';
    },

    removerLpu: (index) => {
        NovaOsManager.itensLpu.splice(index, 1);
        NovaOsManager.renderizarTabela();
    },

    renderizarTabela: () => {
        const tbody = document.getElementById('tbodyLpusNovaOs');
        const tfoot = document.getElementById('tfootLpusNovaOs');
        const semItens = document.getElementById('novaOsSemItens');
        if (!tbody) return;

        if (NovaOsManager.itensLpu.length === 0) {
            tbody.innerHTML = `
                <tr id="novaOsSemItens">
                    <td colspan="5" class="text-center text-muted py-3">
                        <i class="bi bi-info-circle me-1"></i> Adicione pelo menos uma LPU
                    </td>
                </tr>`;
            if (tfoot) tfoot.style.display = 'none';
            return;
        }

        let totalGeral = 0;
        tbody.innerHTML = NovaOsManager.itensLpu.map((item, idx) => {
            const total = item.valor * item.quantidade;
            totalGeral += total;
            return `
                <tr>
                    <td><small>${item.lpuNome}</small></td>
                    <td class="text-center">${item.quantidade}</td>
                    <td class="text-end">${NovaOsManager.formatarMoeda(item.valor)}</td>
                    <td class="text-end fw-bold">${NovaOsManager.formatarMoeda(total)}</td>
                    <td class="text-center">
                        <button type="button" class="btn btn-sm btn-outline-danger btn-remover-lpu-nova-os" data-index="${idx}" title="Remover">
                            <i class="bi bi-x-lg"></i>
                        </button>
                    </td>
                </tr>`;
        }).join('');

        if (tfoot) {
            tfoot.style.display = '';
            document.getElementById('novaOsTotalGeral').textContent = NovaOsManager.formatarMoeda(totalGeral);
        }
    },

    submeter: async () => {
        // Validacao
        const os = document.getElementById('novaOsNumero')?.value.trim();
        const projeto = document.getElementById('novaOsProjeto')?.value.trim();
        const segmentoId = document.getElementById('novaOsSegmento')?.value;

        if (!os) { RegistrosUtils.mostrarToast('Informe o numero da OS.', 'warning'); return; }
        if (!projeto) { RegistrosUtils.mostrarToast('Informe o projeto.', 'warning'); return; }
        if (!segmentoId) { RegistrosUtils.mostrarToast('Selecione o segmento.', 'warning'); return; }
        if (NovaOsManager.itensLpu.length === 0) {
            RegistrosUtils.mostrarToast('Adicione pelo menos uma LPU.', 'warning');
            return;
        }

        const btnSubmeter = document.getElementById('btnSubmeterNovaOs');
        const originalHtml = btnSubmeter.innerHTML;
        btnSubmeter.disabled = true;
        btnSubmeter.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Criando...';

        const base = {
            os: os,
            projeto: projeto,
            gestorTim: document.getElementById('novaOsGestorTim')?.value.trim() || '',
            segmentoId: parseInt(segmentoId),
            site: document.getElementById('novaOsSite')?.value.trim() || '',
            contrato: document.getElementById('novaOsContrato')?.value.trim() || '',
            regional: document.getElementById('novaOsRegional')?.value.trim() || '',
            lote: document.getElementById('novaOsLote')?.value.trim() || '',
            boq: document.getElementById('novaOsBoq')?.value.trim() || '',
            po: document.getElementById('novaOsPo')?.value.trim() || '',
            item: document.getElementById('novaOsItem')?.value.trim() || '',
            unidade: document.getElementById('novaOsUnidade')?.value.trim() || '',
            observacoes: document.getElementById('novaOsObservacoes')?.value.trim() || ''
        };

        let sucesso = 0;
        let erros = 0;
        let erroMsg = '';

        for (const lpu of NovaOsManager.itensLpu) {
            const payload = {
                ...base,
                lpuIds: [lpu.lpuId],
                quantidade: lpu.quantidade
            };

            try {
                const resp = await fetchComAuth(`${RegistrosState.API_BASE_URL}/os`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (resp.ok) {
                    sucesso++;
                } else {
                    erros++;
                    try { const err = await resp.json(); erroMsg = err.message || ''; } catch(e) {}
                }
            } catch (e) {
                erros++;
                erroMsg = e.message;
            }
        }

        btnSubmeter.disabled = false;
        btnSubmeter.innerHTML = originalHtml;

        const modal = NovaOsManager.getModal();
        if (modal) modal.hide();

        if (erros === 0) {
            Swal.fire({
                icon: 'success',
                title: 'OS Criada!',
                text: `${sucesso} item(ns) de LPU criado(s) com sucesso.`,
                confirmButtonColor: '#198754'
            });
        } else {
            Swal.fire({
                icon: 'warning',
                title: 'Criacao parcial',
                html: `<p>${sucesso} criado(s), ${erros} erro(s).</p>${erroMsg ? '<p class="text-muted small">' + erroMsg + '</p>' : ''}`,
                confirmButtonColor: '#198754'
            });
        }

        // Recarrega tabela
        RegistrosApi.carregarDados(0, RegistrosState.termoBusca);
    }
};

window.NovaOsManager = NovaOsManager;