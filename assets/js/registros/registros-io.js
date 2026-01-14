/**
 * registros-io.js
 * Responsável por importação e exportação de planilhas.
 */

const RegistrosIO = {
    init: () => {
        RegistrosIO.setupTemplateDownload();
        RegistrosIO.setupImportacao();
        RegistrosIO.setupExportacao();
        RegistrosIO.setupImportacaoFinanceiro();
        RegistrosIO.aplicarPermissoes();
    },

    aplicarPermissoes: () => {
        const role = RegistrosState.userRole;
        if (role !== 'ADMIN' && role !== 'ASSISTANT') {
            const btnTemplate = document.getElementById('btnDownloadTemplate');
            const btnImport = document.getElementById('btnImportar');
            if (btnTemplate) btnTemplate.classList.add('d-none');
            if (btnImport) btnImport.classList.add('d-none');
        }
        if (role !== 'ADMIN') {
            const switchLegado = document.getElementById('importLegado');
            if (switchLegado) {
                const container = switchLegado.closest('.form-check');
                if (container) container.classList.add('d-none');
            }
        }
        if (role === 'MANAGER') {
            const botoesAcao = document.getElementById('botoes-acao');
            if (botoesAcao) botoesAcao.classList.add('d-none');
        }
    },

    setupTemplateDownload: () => {
        const btn = document.getElementById('btnDownloadTemplate');
        if (btn) {
            btn.addEventListener('click', () => {
                const link = document.createElement('a');
                link.href = '../assets/templates/template_importacao_os.xlsx';
                link.setAttribute('download', 'template_importacao_os.xlsx');
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            });
        }
    },

    setupImportacao: () => {
        const btnImportar = document.getElementById('btnImportar');
        const importFileInput = document.getElementById('importFile');

        // Verificação de segurança se os elementos existem
        if (btnImportar && importFileInput) {
            const modalProgressoEl = document.getElementById('modalProgressoImportacao');
            const modalProgresso = modalProgressoEl ? new bootstrap.Modal(modalProgressoEl) : null;

            const textoProgresso = document.getElementById('textoProgressoImportacao');
            const barraProgresso = document.getElementById('barraProgressoImportacao');
            const errosContainer = document.getElementById('errosImportacaoContainer');
            const listaErros = document.getElementById('listaErrosImportacao');
            const btnFecharProgresso = document.getElementById('btnFecharProgressoImportacao');
            const btnCancelarImportacao = document.getElementById('btnCancelarImportacao');
            const importLegadoCheckbox = document.getElementById('importLegado');

            // Botão "Cancelar" apenas visual (não interrompe o fetch real, mas fecha o modal)
            if (btnCancelarImportacao) {
                btnCancelarImportacao.addEventListener('click', () => {
                    if (modalProgresso) modalProgresso.hide();
                    importFileInput.value = ''; // Limpa para permitir tentar de novo
                });
            }

            // Clique no botão visual dispara o input file oculto
            btnImportar.addEventListener('click', () => {
                importFileInput.click();
            });

            // Evento de Seleção de Arquivo
            importFileInput.addEventListener('change', async (event) => {
                const file = event.target.files[0];
                if (!file) return;

                const isLegado = importLegadoCheckbox ? importLegadoCheckbox.checked : false;
                const formData = new FormData();
                formData.append('file', file);

                // 1. Reset da UI do Modal
                textoProgresso.textContent = 'Iniciando importação...';
                barraProgresso.style.width = '0%';
                barraProgresso.textContent = '0%';
                barraProgresso.classList.remove('bg-danger', 'bg-warning');
                barraProgresso.classList.add('bg-success');

                errosContainer.classList.add('d-none');
                listaErros.innerHTML = '';

                btnFecharProgresso.disabled = true;
                btnCancelarImportacao.classList.remove('d-none');

                if (modalProgresso) modalProgresso.show();

                // 2. Animação de progresso "fake" inicial para feedback visual
                // (O usuário percebe que algo está acontecendo enquanto o arquivo sobe)
                let fakeProgress = 0;
                const progressInterval = setInterval(() => {
                    if (fakeProgress < 40) {
                        fakeProgress += 5;
                        barraProgresso.style.width = `${fakeProgress}%`;
                        barraProgresso.textContent = `${fakeProgress}%`;
                        if (fakeProgress > 10) textoProgresso.textContent = 'Enviando arquivo para o servidor...';
                    } else {
                        clearInterval(progressInterval);
                    }
                }, 100);

                try {
                    // 3. Envio para o Backend
                    const response = await fetchComAuth(`${RegistrosState.API_BASE_URL}/os/importar?legado=${isLegado}`, {
                        method: 'POST',
                        body: formData
                    });

                    clearInterval(progressInterval); // Para a animação fake

                    if (!response.ok) {
                        let errorMsg = `Erro no servidor: ${response.status}`;
                        try {
                            const errorData = await response.json();
                            errorMsg = errorData.message || JSON.stringify(errorData);
                        } catch (e) {
                            const errorText = await response.text();
                            errorMsg = errorText || errorMsg;
                        }
                        throw new Error(errorMsg);
                    }

                    const result = await response.json();

                    // 4. Sucesso: Atualiza barra para 100%
                    barraProgresso.style.width = '100%';
                    barraProgresso.textContent = '100%';
                    textoProgresso.textContent = 'Processando resposta...';

                    // 5. Verifica se houve Warnings (Avisos de negócio)
                    if (result.warnings && result.warnings.length > 0) {
                        errosContainer.classList.remove('d-none');
                        const tituloErro = errosContainer.querySelector('h6');
                        if (tituloErro) tituloErro.textContent = 'Avisos da Importação:';

                        listaErros.innerHTML = result.warnings.map(warn =>
                            `<li class="list-group-item list-group-item-warning py-1"><small>${warn}</small></li>`
                        ).join('');
                    }

                    // 6. Atualiza a Tabela
                    // Como estamos usando paginação no servidor, o jeito certo de ver 
                    // os dados novos é recarregar a busca (resetando para a primeira página)
                    textoProgresso.textContent = 'Atualizando tabela...';

                    // Pequeno delay para o usuário ver o "100%" antes de fechar/atualizar
                    await new Promise(r => setTimeout(r, 500));

                    // Chama a API para buscar os dados atualizados
                    RegistrosApi.carregarDados(0, RegistrosState.termoBusca);

                    textoProgresso.textContent = 'Importação concluída com sucesso!';
                    RegistrosUtils.mostrarToast('Importação realizada com sucesso!', 'success');

                } catch (error) {
                    console.error('Erro na importação:', error);
                    clearInterval(progressInterval);

                    textoProgresso.textContent = 'Falha na Importação';
                    barraProgresso.classList.remove('bg-success');
                    barraProgresso.classList.add('bg-danger');
                    barraProgresso.style.width = '100%';

                    errosContainer.classList.remove('d-none');
                    const tituloErro = errosContainer.querySelector('h6');
                    if (tituloErro) tituloErro.textContent = 'Ocorreu um erro:';

                    listaErros.innerHTML = `<li class="list-group-item list-group-item-danger">${error.message}</li>`;
                } finally {
                    // 7. Limpeza Final
                    btnFecharProgresso.disabled = false;
                    btnCancelarImportacao.classList.add('d-none');
                    importFileInput.value = ''; // Reseta o input para permitir selecionar o mesmo arquivo novamente
                }
            });
        }
    },

    setupExportacao: () => {
        const btn = document.getElementById('btnExportar');
        if (btn) {
            const modalProgresso = new bootstrap.Modal(document.getElementById('modalProgressoExportacao'));

            btn.addEventListener('click', async () => {
                // Limpeza preventiva
                document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
                document.body.classList.remove('modal-open');
                document.body.style.overflow = 'auto';

                const linhasNaTela = RegistrosState.todasAsLinhas || [];
                const totalGeralBanco = RegistrosState.totalElementos || 0;

                // --- NOVO DESIGN DO MODAL ---
                const result = await Swal.fire({
                    title: '<span class="fw-bold text-dark">Exportar Relatório</span>',
                    width: 700,
                    padding: '2em',
                    html: `
                        <style>
                            /* Estilos exclusivos para este modal */
                            .export-options-container {
                                display: flex;
                                gap: 20px;
                                justify-content: center;
                                margin-top: 20px;
                            }
                            .export-card {
                                flex: 1;
                                border: 2px solid #e9ecef;
                                border-radius: 16px;
                                padding: 25px 15px;
                                cursor: pointer;
                                transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
                                background: white;
                                position: relative;
                                overflow: hidden;
                            }
                            .export-card:hover {
                                border-color: #198754;
                                transform: translateY(-5px);
                                box-shadow: 0 10px 25px rgba(25, 135, 84, 0.15);
                            }
                            .export-card:hover .icon-box {
                                background-color: #e8f5e9; /* Verde bem claro */
                                color: #198754;
                            }
                            .export-card.active {
                                border-color: #198754;
                                background-color: #f8fffb;
                            }
                            .icon-box {
                                width: 60px;
                                height: 60px;
                                background-color: #f8f9fa;
                                border-radius: 50%;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                margin: 0 auto 15px;
                                font-size: 1.8rem;
                                color: #6c757d;
                                transition: all 0.3s;
                            }
                            .export-title {
                                font-weight: 700;
                                color: #343a40;
                                margin-bottom: 8px;
                                font-size: 1.1rem;
                            }
                            .export-desc {
                                font-size: 0.85rem;
                                color: #6c757d;
                                margin-bottom: 15px;
                                line-height: 1.4;
                                min-height: 40px; /* Alinha a altura das descrições */
                            }
                            .export-badge {
                                background-color: #f1f3f5;
                                color: #495057;
                                padding: 6px 12px;
                                border-radius: 30px;
                                font-size: 0.8rem;
                                font-weight: 600;
                                display: inline-flex;
                                align-items: center;
                                gap: 6px;
                            }
                            .export-card:hover .export-badge {
                                background-color: #198754;
                                color: white;
                            }
                        </style>

                        <p class="text-muted mb-4">Selecione o tipo de exportação desejada:</p>
                        
                        <div class="export-options-container">
                            <div class="export-card" onclick="Swal.clickConfirm()">
                                <div class="icon-box">
                                    <i class="bi bi-funnel"></i>
                                </div>
                                <h5 class="export-title">Vista Atual</h5>
                                <p class="export-desc">Exporta apenas os registros filtrados e visíveis na tabela atual.</p>
                                <span class="export-badge">
                                    <i class="bi bi-list-check"></i> ${linhasNaTela.length} registros
                                </span>
                            </div>

                            <div class="export-card" onclick="Swal.clickDeny()">
                                <div class="icon-box">
                                    <i class="bi bi-database-down"></i>
                                </div>
                                <h5 class="export-title">Base Completa</h5>
                                <p class="export-desc">Baixa todos os registros do sistema, ignorando filtros de pesquisa.</p>
                                <span class="export-badge">
                                    <i class="bi bi-server"></i> ${totalGeralBanco} registros
                                </span>
                            </div>
                        </div>
                    `,
                    showConfirmButton: false, // Esconde botões padrões pois usamos os Cards
                    showDenyButton: false,
                    showCancelButton: true,
                    cancelButtonText: 'Cancelar',
                    buttonsStyling: false,
                    customClass: {
                        cancelButton: 'btn btn-outline-secondary px-4 mt-4 rounded-pill'
                    }
                });

                if (!result.isConfirmed && !result.isDenied) return;

                modalProgresso.show();
                const textoProgresso = document.getElementById('textoProgresso');
                const barraProgresso = document.getElementById('barraProgresso');

                // Função auxiliar para atualizar visual e texto ao mesmo tempo
                const atualizarProgresso = (porcentagem, texto) => {
                    barraProgresso.style.width = `${porcentagem}%`;
                    barraProgresso.textContent = `${porcentagem}%`;
                    if (texto) textoProgresso.textContent = texto;
                };

                atualizarProgresso(10, 'Iniciando exportação...');

                setTimeout(async () => {
                    try {
                        let linhasParaExportar = [];

                        if (result.isConfirmed) {
                            // --- OPÇÃO 1: APENAS TELA ---
                            linhasParaExportar = linhasNaTela;
                        } else if (result.isDenied) {
                            // --- OPÇÃO 2: BANCO COMPLETO ---
                            atualizarProgresso(30, 'Baixando base completa do servidor...');

                            // CORREÇÃO: Usar o endpoint /all em vez da paginação
                            // Isso garante que receberemos a lista inteira, sem cortes do Spring Data
                            const response = await fetchComAuth(`${RegistrosState.API_BASE_URL}/os/export/completo`);
                            if (!response.ok) throw new Error("Erro ao baixar dados completos.");

                            // Quando usamos /all, o retorno é um Array direto, não um Page object com .content
                            const listaCompletaOS = await response.json();

                            atualizarProgresso(60, 'Processando dados...');

                            const userSegmentos = JSON.parse(localStorage.getItem('segmentos')) || [];
                            const role = RegistrosState.userRole;

                            listaCompletaOS.forEach(os => {
                                // Permissões
                                if (['MANAGER', 'COORDINATOR'].includes(role)) {
                                    if (!os.segmento || !userSegmentos.includes(os.segmento.id)) return;
                                }

                                if (os.detalhes && os.detalhes.length > 0) {
                                    // Filtra excluídos
                                    const detalhesAtivos = os.detalhes.filter(d => d.statusRegistro !== 'INATIVO');

                                    detalhesAtivos.forEach(detalhe => {
                                        let lancamentoParaExibir = detalhe.ultimoLancamento;
                                        if (!lancamentoParaExibir && detalhe.lancamentos && detalhe.lancamentos.length > 0) {
                                            const operacionais = detalhe.lancamentos.filter(l => l.situacaoAprovacao !== 'APROVADO_LEGADO');
                                            if (operacionais.length > 0) {
                                                lancamentoParaExibir = operacionais.reduce((prev, curr) => (prev.id > curr.id) ? prev : curr);
                                            } else {
                                                lancamentoParaExibir = detalhe.lancamentos.reduce((prev, curr) => (prev.id > curr.id) ? prev : curr);
                                            }
                                        }

                                        linhasParaExportar.push({
                                            os: os,
                                            detalhe: detalhe,
                                            ultimoLancamento: lancamentoParaExibir
                                        });
                                    });
                                }
                            });
                        }

                        if (linhasParaExportar.length === 0) {
                            throw new Error("Nenhum dado encontrado para exportar.");
                        }

                        // --- GERAÇÃO DO EXCEL ---
                        atualizarProgresso(80, 'Gerando arquivo Excel...');

                        const grupos = RegistrosRender.transformarEmGrupos(linhasParaExportar);

                        const resumoHeaders = ["Projeto", "OS", "Total OS", "Total CPS Aprovado", "Total Material", "Total CPS Legado", "% Concluído"];
                        const resumoRows = grupos.map(grupo => {
                            const dadosOS = grupo.linhas[0].os || {};
                            const valorTotalOS = RegistrosUtils.get(grupo.linhas[0], 'os.detalhes', []).reduce((sum, d) => sum + (d.valorTotal || 0), 0);
                            const valorTotalCPS = grupo.linhas.flatMap(l => RegistrosUtils.get(l, 'detalhe.lancamentos', [])).filter(la => ['APROVADO', 'APROVADO_CPS_LEGADO'].includes(la.situacaoAprovacao)).reduce((sum, la) => sum + (la.valor || 0), 0);
                            const mat = dadosOS.custoTotalMateriais || 0;
                            const leg = dadosOS.valorCpsLegado || 0;
                            const transp = dadosOS.transporte || 0;
                            const totalGasto = valorTotalCPS + mat + leg + transp;
                            const perc = valorTotalOS > 0 ? (totalGasto / valorTotalOS) * 100 : 0;
                            return [grupo.projeto, grupo.os, valorTotalOS, valorTotalCPS, mat, leg, perc];
                        });

                        const detalhesHeaders = [...RegistrosRender.getHeaders(), "VALOR CPS LEGADO"];
                        const detalhesRows = linhasParaExportar.map(linha => {
                            return detalhesHeaders.map(h => {
                                const func = RegistrosRender.dataMapping[h];
                                let val = func ? func(linha) : '-';
                                if (h.includes('VALOR') || h === 'QUANTIDADE') {
                                    if (typeof val === 'string') val = val.replace('R$', '').replace(/\./g, '').replace(',', '.').trim();
                                    return parseFloat(val) || 0;
                                }
                                return val;
                            });
                        });

                        const wb = XLSX.utils.book_new();
                        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([resumoHeaders, ...resumoRows]), "Resumo");
                        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([detalhesHeaders, ...detalhesRows]), "Detalhes");
                        XLSX.writeFile(wb, "relatorio_registros.xlsx");

                        atualizarProgresso(100, 'Concluído!');
                        RegistrosUtils.mostrarToast('Exportação concluída com sucesso!', 'success');

                    } catch (e) {
                        console.error(e);
                        RegistrosUtils.mostrarToast('Erro ao exportar: ' + e.message, 'error');
                    } finally {
                        setTimeout(() => modalProgresso.hide(), 1000);
                    }
                }, 300);
            });
        }
    },

    setupImportacaoFinanceiro: () => {
        const btn = document.getElementById('btnImportarFinanceiro');
        const input = document.getElementById('importFileFinanceiro');

        if (btn && input) {
            if (RegistrosState.userRole !== 'ADMIN') {
                btn.classList.add('d-none');
                return;
            }

            btn.addEventListener('click', () => input.click());

            input.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return;

                const conf = await Swal.fire({
                    title: 'Importar Financeiro',
                    text: 'Sobrescrever valores de Material e Transporte?',
                    showCancelButton: true,
                    confirmButtonText: 'Sim'
                });

                if (!conf.isConfirmed) {
                    input.value = '';
                    return;
                }

                const fd = new FormData();
                fd.append('file', file);

                Swal.fire({ title: 'Processando...', didOpen: () => Swal.showLoading() });

                try {
                    const resp = await fetchComAuth(`${RegistrosState.API_BASE_URL}/os/importar-financeiro-legado`, {
                        method: 'POST', body: fd
                    });
                    if (!resp.ok) throw new Error(await resp.text());

                    const res = await resp.json();

                    let htmlLogs = '';
                    if (res.logs && res.logs.length) {
                        htmlLogs = `<div class="text-start p-2 border bg-light" style="max-height: 200px; overflow: auto;"><ul>${res.logs.map(l => `<li>${l}</li>`).join('')}</ul></div>`;
                    }

                    await Swal.fire({ title: 'Concluído', html: `<p>${res.mensagem}</p>${htmlLogs}`, icon: 'info' });
                    window.location.reload();

                } catch (e) {
                    Swal.fire('Erro', e.message, 'error');
                } finally {
                    input.value = '';
                }
            });
        }
    }
};