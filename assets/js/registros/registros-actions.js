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

        // Delegação de eventos para botões dentro da tabela (Editar, Excluir, Histórico)
        accordionContainer.addEventListener('click', function (e) {
            const btnEdit = e.target.closest('.btn-edit-detalhe');
            const btnDelete = e.target.closest('.btn-delete-registro');
            const btnHistorico = e.target.closest('.btn-historico');

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
        });

        // Configura os listeners internos do formulário de edição
        RegistrosActions.setupFormEdicao(modalEditarDetalhe);

        // Listener do botão de Confirmação de Exclusão (Modal de Exclusão)
        const btnConfirmarExclusaoDefinitiva = document.getElementById('btnConfirmarExclusaoDefinitiva');
        if (btnConfirmarExclusaoDefinitiva) {
            btnConfirmarExclusaoDefinitiva.addEventListener('click', async function () {
                const detalheId = document.getElementById('deleteOsId').value;
                const btnConfirmar = this;

                if (!detalheId || detalheId === 'undefined') {
                    RegistrosUtils.mostrarToast("Não foi possível identificar o registro para exclusão.", "error");
                    return;
                }

                // UI Loading
                btnConfirmar.disabled = true;
                btnConfirmar.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Excluindo...`;

                try {
                    // Chama API Delete
                    const response = await fetchComAuth(`${RegistrosState.API_BASE_URL}/os/detalhe/${detalheId}`, {
                        method: 'DELETE'
                    });

                    if (!response.ok) {
                        let errorMsg = 'Erro ao excluir o registro.';
                        try {
                            const errorData = await response.json();
                            errorMsg = errorData.message || `Status: ${response.status}`;
                        } catch (e) {
                            const errorText = await response.text();
                            errorMsg = errorText || errorMsg;
                        }
                        throw new Error(errorMsg);
                    }

                    RegistrosUtils.mostrarToast('Registro excluído com sucesso!', 'success');
                    if (modalConfirmarExclusao) modalConfirmarExclusao.hide();

                    // --- ATUALIZAÇÃO VIA SERVIDOR ---
                    // Recarrega a página atual mantendo a busca, para refletir a exclusão
                    RegistrosApi.carregarDados(RegistrosState.paginaAtual, RegistrosState.termoBusca);

                } catch (error) {
                    console.error("Erro ao excluir:", error);
                    RegistrosUtils.mostrarToast(error.message, 'error');
                } finally {
                    btnConfirmar.disabled = false;
                    btnConfirmar.innerHTML = 'Sim, Excluir';
                }
            });
        }
    },

    abrirModalEdicao: async (detalheId, modal) => {
        // Busca a linha na memória local (que representa a página atual)
        const linhaData = RegistrosState.todasAsLinhas.find(l => RegistrosUtils.get(l, 'detalhe.id') == detalheId);

        if (linhaData) {
            const formEditarDetalheEl = document.getElementById('formEditarDetalhe');
            document.getElementById('editDetalheId').value = detalheId;

            // 1. Armazena o ID da OS (necessário para o patch do Gestor TIM)
            const osId = RegistrosUtils.get(linhaData, 'os.id');
            formEditarDetalheEl.dataset.osId = osId;

            document.getElementById('osValue').value = RegistrosUtils.get(linhaData, 'os.os', 'N/A');

            // 2. Popula Campo KEY
            const chaveExistente = RegistrosUtils.get(linhaData, 'detalhe.key', '');
            document.getElementById('novaKeyValue').value = chaveExistente;
            formEditarDetalheEl.dataset.originalKey = chaveExistente;

            // 3. Popula Campo Gestor TIM
            const gestorTimExistente = RegistrosUtils.get(linhaData, 'os.gestorTim', '');
            document.getElementById('novoGestorTimValue').value = gestorTimExistente;
            formEditarDetalheEl.dataset.originalGestorTim = gestorTimExistente;

            // 4. Popula Campo Segmento (Select)
            const selectSegmento = document.getElementById('selectSegmento');
            const segmentoAtualId = RegistrosUtils.get(linhaData, 'os.segmento.id');
            formEditarDetalheEl.dataset.originalSegmentoId = segmentoAtualId;

            selectSegmento.innerHTML = '<option value="">Carregando...</option>';
            try {
                // Usa a API para buscar lista de segmentos atualizada
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

            // 5. Reseta os toggles e inputs para estado inicial (desabilitado)
            document.querySelectorAll('#formEditarDetalhe .toggle-editar').forEach(toggle => {
                toggle.checked = false;
                const targetInput = document.querySelector(toggle.dataset.target);
                if (targetInput) targetInput.disabled = true;
            });
            document.getElementById('btnSalvarDetalhe').disabled = true;

            // 6. Controla a visibilidade dos campos por Role (Permissões)
            const userRole = RegistrosState.userRole;
            const keyFieldGroup = document.getElementById('novaKeyValue').closest('.mb-3');
            const segmentoFieldGroup = document.getElementById('selectSegmento').closest('.mb-3');
            const gestorTimFieldGroup = document.getElementById('novoGestorTimValue').closest('.mb-3');

            // Esconde todos por padrão
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

    setupFormEdicao: (modal) => {
        const formEditarDetalheEl = document.getElementById('formEditarDetalhe');
        if (!formEditarDetalheEl) return;

        // 1. Listener para os Toggles (Switchs) que habilitam/desabilitam campos
        formEditarDetalheEl.addEventListener('change', (e) => {
            if (e.target.classList.contains('toggle-editar')) {
                const toggle = e.target;
                const targetSelector = toggle.dataset.target;
                const targetInput = document.querySelector(targetSelector);
                if (targetInput) {
                    targetInput.disabled = !toggle.checked;
                    // Dispara evento de input para validar se houve alteração e liberar o botão Salvar
                    const event = new Event('input', { bubbles: true });
                    targetInput.dispatchEvent(event);
                }
            }
        });

        // 2. Listener para verificar alterações e habilitar o botão Salvar
        formEditarDetalheEl.addEventListener('input', () => {
            const originalKey = formEditarDetalheEl.dataset.originalKey || '';
            const originalSegmentoId = formEditarDetalheEl.dataset.originalSegmentoId;
            const originalGestorTim = formEditarDetalheEl.dataset.originalGestorTim || '';

            const currentKey = document.getElementById('novaKeyValue').value;
            const currentSegmentoId = document.getElementById('selectSegmento').value;
            const currentGestorTim = document.getElementById('novoGestorTimValue').value;

            // Verifica se está habilitado (checked) E se o valor mudou em relação ao original
            const keyChanged = originalKey !== currentKey && document.querySelector('#formEditarDetalhe .toggle-editar[data-target="#novaKeyValue"]').checked;
            const segmentoChanged = originalSegmentoId != currentSegmentoId && document.querySelector('#formEditarDetalhe .toggle-editar[data-target="#selectSegmento"]').checked;
            const gestorTimChanged = originalGestorTim !== currentGestorTim && document.querySelector('#formEditarDetalhe .toggle-editar[data-target="#novoGestorTimValue"]').checked;

            document.getElementById('btnSalvarDetalhe').disabled = !(keyChanged || segmentoChanged || gestorTimChanged);
        });

        // 3. Listener do Submit do formulário
        formEditarDetalheEl.addEventListener('submit', async function (e) {
            e.preventDefault();

            const detalheId = document.getElementById('editDetalheId').value;
            const osId = formEditarDetalheEl.dataset.osId;
            const btnSalvar = document.getElementById('btnSalvarDetalhe');

            const currentKey = document.getElementById('novaKeyValue').value;
            const currentSegmentoId = document.getElementById('selectSegmento').value;
            const currentGestorTim = document.getElementById('novoGestorTimValue').value;

            // Re-verifica quais campos devem ser salvos
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

                // Validação de sucesso de todas as requisições
                let allSuccessful = true;
                let errorMessages = [];

                for (let i = 0; i < results.length; i++) {
                    const response = results[i];
                    if (!response.ok) {
                        allSuccessful = false;
                        let errorType = "Campo";
                        // Tenta adivinhar qual falhou baseado na ordem (não é perfeito mas ajuda no feedback)
                        // Lógica simplificada de erro
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

                    // --- ATUALIZAÇÃO VIA SERVIDOR ---
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

            // Ordena do mais recente para o mais antigo
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

            // Remove local
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
        // Atualiza Cache Visual
        const grupoIdx = RegistrosState.gruposFiltradosCache.findIndex(g => g.id == osId);
        if (grupoIdx > -1) {
            RegistrosState.gruposFiltradosCache[grupoIdx].linhas = RegistrosState.todasAsLinhas.filter(l => l.os.id == osId);
            const el = document.getElementById(`accordion-item-${osId}`);
            if (el) el.outerHTML = RegistrosRender.gerarHtmlParaGrupo(RegistrosState.gruposFiltradosCache[grupoIdx]);
        }
    },

    // Função Global para o HTML chamar
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

// Expõe globalmente para funcionar no onclick do HTML
window.abrirModalFinanceiro = RegistrosActions.abrirModalFinanceiro;