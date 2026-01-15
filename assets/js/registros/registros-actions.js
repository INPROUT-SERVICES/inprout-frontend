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
                // Chama a API com o novo termo, voltando para página 0
                RegistrosApi.carregarDados(0, e.target.value);
            }, 600); // Espera 600ms após parar de digitar
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
                // Recarrega dados com nova ordenação
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

        // Inicialização dos Modais
        const modalEditarDetalheEl = document.getElementById('modalEditarDetalhe');
        const modalEditarDetalhe = modalEditarDetalheEl ? new bootstrap.Modal(modalEditarDetalheEl) : null;

        const modalConfirmarExclusaoEl = document.getElementById('modalConfirmarExclusao');
        const modalConfirmarExclusao = modalConfirmarExclusaoEl ? new bootstrap.Modal(modalConfirmarExclusaoEl) : null;

        const modalHistoricoEl = document.getElementById('modalHistoricoLancamentos');
        const modalHistorico = modalHistoricoEl ? new bootstrap.Modal(modalHistoricoEl) : null;

        // NOVO: Modal de Finalização
        const modalFinalizarEl = document.getElementById('modalConfirmarFinalizacao');
        const modalFinalizar = modalFinalizarEl ? new bootstrap.Modal(modalFinalizarEl) : null;

        // Delegação de eventos
        accordionContainer.addEventListener('click', async function (e) {
            const btnEdit = e.target.closest('.btn-edit-detalhe');
            const btnDelete = e.target.closest('.btn-delete-registro');
            const btnHistorico = e.target.closest('.btn-historico');

            // Seletor ajustado para pegar o wrapper do ícone
            const btnFinalizarWrapper = e.target.closest('.icon-hover-wrapper');

            if (btnEdit) {
                e.preventDefault();
                const detalheId = btnEdit.dataset.id;
                RegistrosActions.abrirModalEdicao(detalheId, modalEditarDetalhe);
            }

            if (btnDelete) {
                e.preventDefault();
                const detalheId = btnDelete.dataset.id;
                const deleteInput = document.getElementById('deleteOsId');
                if (deleteInput) {
                    deleteInput.value = detalheId;
                }
                if (modalConfirmarExclusao) {
                    modalConfirmarExclusao.show();
                }
            }

            if (btnHistorico) {
                e.preventDefault();
                const detalheId = btnHistorico.dataset.detalheId;
                RegistrosActions.abrirModalHistorico(detalheId, modalHistorico);
            }

            // --- LÓGICA DO ÍCONE FINALIZAR (ABRE MODAL) ---
            if (btnFinalizarWrapper) {
                e.stopPropagation();
                e.preventDefault();

                const osId = btnFinalizarWrapper.getAttribute('data-os-id');

                // Joga o ID no input hidden do modal
                const inputHidden = document.getElementById('inputHiddenOsIdFinalizar');
                if (inputHidden) inputHidden.value = osId;

                // Abre o modal
                if (modalFinalizar) modalFinalizar.show();
            }
        });

        // --- LISTENER DO BOTÃO "SIM, FINALIZAR" DENTRO DO MODAL ---
        const btnConfirmarFinalizacaoAction = document.getElementById('btnConfirmarFinalizacaoAction');
        if (btnConfirmarFinalizacaoAction) {
            btnConfirmarFinalizacaoAction.addEventListener('click', async () => {
                const inputHidden = document.getElementById('inputHiddenOsIdFinalizar');
                const osId = inputHidden ? inputHidden.value : null;

                if (!osId) return;

                // UI Loading no botão do modal
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
                        // Se retornou false (erro tratado no API catch mas sem throw)
                        RegistrosUtils.mostrarToast('Não foi possível finalizar a OS.', 'error');
                    }
                } catch (error) {
                    console.error(error);
                    // O erro vindo do RegistrosApi já deve ser tratado lá, mas garantimos o toast
                    RegistrosUtils.mostrarToast(error.message || 'Erro inesperado.', 'error');
                } finally {
                    btnConfirmarFinalizacaoAction.innerHTML = originalText;
                    btnConfirmarFinalizacaoAction.disabled = false;
                }
            });
        }

        // Restante dos listeners (Edição, Exclusão...) mantidos...
        RegistrosActions.setupFormEdicao(modalEditarDetalhe);

        // Listener de Exclusão (Mantido)
        const btnConfirmarExclusaoDefinitiva = document.getElementById('btnConfirmarExclusaoDefinitiva');
        if (btnConfirmarExclusaoDefinitiva) {
            btnConfirmarExclusaoDefinitiva.addEventListener('click', async function () {
                // ... seu código de exclusão existente ...
                // Só lembre de checar se está usando RegistrosUtils.mostrarToast aqui também ao invés de alert
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

    setupRelatorioEspecial: () => {
        const userRole = RegistrosState.userRole; // Ou como você pega a role: localStorage.getItem('role')
        
        // Regra de Visibilidade: Apenas ADMIN, CONTROLLER, ASSISTANT
        if (['ADMIN', 'CONTROLLER', 'ASSISTANT'].includes(userRole)) {
            const container = document.getElementById('container-relatorio-especial');
            if (container) container.classList.remove('d-none');
        }

        // Listener do Click
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
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    });

                    if (!response.ok) throw new Error('Erro ao gerar relatório');

                    // Lógica para baixar o arquivo
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

    abrirModalHistorico: (detalheId, modal) => {
        const linhaData = RegistrosState.todasAsLinhas.find(l => RegistrosUtils.get(l, 'detalhe.id') == detalheId);

        if (linhaData && linhaData.detalhe && linhaData.detalhe.lancamentos) {
            const modalBody = document.getElementById('tbody-historico-lancamentos');
            const modalTitle = document.getElementById('modalHistoricoLancamentosLabel');
            const key = RegistrosUtils.get(linhaData, 'detalhe.key', '');

            modalTitle.innerHTML = `<i class="bi bi-clock-history me-2"></i>Histórico da Linha: ${key}`;

            const lancamentosOrdenados = [...linhaData.detalhe.lancamentos].sort((a, b) => b.id - a.id);

            if (lancamentosOrdenados.length === 0) {
                modalBody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Nenhum lançamento encontrado para esta linha.</td></tr>';
            } else {
                modalBody.innerHTML = lancamentosOrdenados.map(lanc => {
                    const etapa = RegistrosUtils.get(lanc, 'etapa', {});
                    return `
                    <tr>
                        <td>${RegistrosUtils.formatarData(RegistrosUtils.get(lanc, 'dataAtividade'))}</td>
                        <td><span class="badge rounded-pill text-bg-info">${RegistrosUtils.get(lanc, 'situacaoAprovacao', '').replace(/_/g, ' ')}</span></td>
                        <td>${RegistrosUtils.get(lanc, 'situacao', '')}</td>
                        <td>${etapa.nomeDetalhado || '-'}</td>
                        <td>${RegistrosUtils.get(lanc, 'prestador.nome', '-')}</td>
                        <td>${RegistrosUtils.formatarMoeda(RegistrosUtils.get(lanc, 'valor'))}</td>
                        <td>${RegistrosUtils.get(lanc, 'manager.nome', '-')}</td>
                    </tr>
                `;
                }).join('');
            }
            if (modal) modal.show();
        } else {
            RegistrosUtils.mostrarToast("Não foi possível encontrar o histórico para esta linha.", "error");
        }
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