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

            if (btnCancelarImportacao) {
                btnCancelarImportacao.addEventListener('click', () => {
                    if (modalProgresso) modalProgresso.hide();
                    importFileInput.value = '';
                });
            }

            btnImportar.addEventListener('click', () => {
                importFileInput.click();
            });

            importFileInput.addEventListener('change', async (event) => {
                const file = event.target.files[0];
                if (!file) return;

                const isLegado = importLegadoCheckbox ? importLegadoCheckbox.checked : false;
                const formData = new FormData();
                formData.append('file', file);

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
                    const response = await fetchComAuth(`${RegistrosState.API_BASE_URL}/os/importar?legado=${isLegado}`, {
                        method: 'POST',
                        body: formData
                    });

                    clearInterval(progressInterval);

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

                    barraProgresso.style.width = '100%';
                    barraProgresso.textContent = '100%';
                    textoProgresso.textContent = 'Processando resposta...';

                    if (result.warnings && result.warnings.length > 0) {
                        errosContainer.classList.remove('d-none');
                        const tituloErro = errosContainer.querySelector('h6');
                        if (tituloErro) tituloErro.textContent = 'Avisos da Importação:';

                        listaErros.innerHTML = result.warnings.map(warn =>
                            `<li class="list-group-item list-group-item-warning py-1"><small>${warn}</small></li>`
                        ).join('');
                    }

                    textoProgresso.textContent = 'Atualizando tabela...';
                    await new Promise(r => setTimeout(r, 500));
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
                    btnFecharProgresso.disabled = false;
                    btnCancelarImportacao.classList.add('d-none');
                    importFileInput.value = '';
                }
            });
        }
    },

    setupExportacao: () => {
        const btn = document.getElementById('btnExportar');
        if (btn) {
            const modalProgresso = new bootstrap.Modal(document.getElementById('modalProgressoExportacao'));

            btn.addEventListener('click', async () => {
                document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
                document.body.classList.remove('modal-open');
                document.body.style.overflow = 'auto';

                const linhasNaTela = RegistrosState.todasAsLinhas || [];
                const totalGeralBanco = RegistrosState.totalElementos || 0;
                let tipoExportacaoSelecionada = '';

                const result = await Swal.fire({
                    title: '<span class="fw-bold text-dark">Exportar Relatório</span>',
                    width: 850,
                    padding: '2em',
                    html: `
                        <style>
                            .export-options-container {
                                display: flex;
                                gap: 15px;
                                justify-content: center;
                                margin-top: 20px;
                                flex-wrap: wrap;
                            }
                            .export-card {
                                flex: 1;
                                min-width: 200px;
                                border: 2px solid #e9ecef;
                                border-radius: 16px;
                                padding: 20px 10px;
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
                                background-color: #e8f5e9;
                                color: #198754;
                            }
                            .icon-box {
                                width: 50px;
                                height: 50px;
                                background-color: #f8f9fa;
                                border-radius: 50%;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                margin: 0 auto 15px;
                                font-size: 1.5rem;
                                color: #6c757d;
                                transition: all 0.3s;
                            }
                            .export-title {
                                font-weight: 700;
                                color: #343a40;
                                margin-bottom: 8px;
                                font-size: 1rem;
                            }
                            .export-desc {
                                font-size: 0.8rem;
                                color: #6c757d;
                                margin-bottom: 15px;
                                line-height: 1.4;
                                min-height: 45px;
                            }
                            .export-badge {
                                background-color: #f1f3f5;
                                color: #495057;
                                padding: 4px 10px;
                                border-radius: 30px;
                                font-size: 0.75rem;
                                font-weight: 600;
                            }
                        </style>

                        <p class="text-muted mb-4">Selecione o tipo de exportação desejada:</p>
                        
                        <div class="export-options-container">
                            <div class="export-card" onclick="window.tipoExportacaoTemp='VISTA_ATUAL'; Swal.clickConfirm()">
                                <div class="icon-box"><i class="bi bi-funnel"></i></div>
                                <h5 class="export-title">Vista Atual</h5>
                                <p class="export-desc">Apenas registros filtrados e visíveis agora.</p>
                                <span class="export-badge"><i class="bi bi-list-check"></i> ${linhasNaTela.length} registros</span>
                            </div>

                            <div class="export-card" onclick="window.tipoExportacaoTemp='COMPLETO'; Swal.clickConfirm()">
                                <div class="icon-box"><i class="bi bi-database-down"></i></div>
                                <h5 class="export-title">Base Completa</h5>
                                <p class="export-desc">Todos os registros do banco de dados.</p>
                                <span class="export-badge"><i class="bi bi-server"></i> ${totalGeralBanco} registros</span>
                            </div>

                            <div class="export-card" style="border-color: #ffc107;" onclick="window.tipoExportacaoTemp='FATURADOS_PENDENTES'; Swal.clickConfirm()">
                                <div class="icon-box" style="color: #d39e00; background-color: #fff3cd;"><i class="bi bi-exclamation-triangle"></i></div>
                                <h5 class="export-title">Fat. não Finalizado</h5>
                                <p class="export-desc">Lançamentos faturados mas com pendências operacionais.</p>
                                <span class="export-badge bg-warning text-dark border"><i class="bi bi-search"></i> Relatório Especial</span>
                            </div>
                        </div>
                    `,
                    showConfirmButton: false,
                    showDenyButton: false,
                    showCancelButton: true,
                    cancelButtonText: 'Cancelar',
                    buttonsStyling: false,
                    customClass: {
                        cancelButton: 'btn btn-outline-secondary px-4 mt-4 rounded-pill'
                    },
                    didOpen: () => {
                        window.tipoExportacaoTemp = '';
                    }
                });

                if (!result.isConfirmed && !result.isDenied && !window.tipoExportacaoTemp) return;

                tipoExportacaoSelecionada = window.tipoExportacaoTemp;

                modalProgresso.show();
                const textoProgresso = document.getElementById('textoProgresso');
                const barraProgresso = document.getElementById('barraProgresso');

                const atualizarProgresso = (porcentagem, texto) => {
                    barraProgresso.style.width = `${porcentagem}%`;
                    barraProgresso.textContent = `${porcentagem}%`;
                    if (texto) textoProgresso.textContent = texto;
                };

                atualizarProgresso(10, 'Iniciando exportação...');

                setTimeout(async () => {
                    try {
                        let linhasParaExportar = [];

                        if (tipoExportacaoSelecionada === 'VISTA_ATUAL') {
                            linhasParaExportar = linhasNaTela;
                        } else if (tipoExportacaoSelecionada === 'COMPLETO') {
                            atualizarProgresso(30, 'Baixando base completa...');
                            const response = await fetchComAuth(`${RegistrosState.API_BASE_URL}/os/export/completo`);
                            if (!response.ok) throw new Error("Erro ao baixar dados completos.");
                            const listaCompletaOS = await response.json();

                            atualizarProgresso(50, 'Processando dados...');
                            linhasParaExportar = RegistrosIO.processarListaParaExportacao(listaCompletaOS);

                        } else if (tipoExportacaoSelecionada === 'FATURADOS_PENDENTES') {
                            atualizarProgresso(30, 'Buscando registros inconsistentes...');

                            // 1. Chama o endpoint que retorna JSON (Lista de DTOs)
                            const response = await fetchComAuth(`${RegistrosState.API_BASE_URL}/os/relatorios/faturados-nao-finalizados`);

                            if (!response.ok) throw new Error("Erro ao buscar dados do relatório.");

                            // 2. Recebe a lista igual à Base Completa
                            const listaInconsistencias = await response.json();

                            if (!listaInconsistencias || listaInconsistencias.length === 0) {
                                throw new Error("Nenhum registro com inconsistência (Faturado mas não Finalizado) encontrado.");
                            }

                            atualizarProgresso(60, 'Gerando Excel no padrão Base Completa...');

                            linhasParaExportar = RegistrosIO.processarListaParaExportacao(listaInconsistencias);
                        }

                        if (linhasParaExportar.length === 0) {
                            throw new Error("Nenhum dado encontrado para exportar.");
                        }

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

                        let nomeArquivo = "relatorio_registros.xlsx";
                        if (tipoExportacaoSelecionada === 'FATURADOS_PENDENTES') {
                            nomeArquivo = `Relatorio_Faturados_Nao_Finalizados_${new Date().toISOString().slice(0, 10)}.xlsx`;
                        }

                        XLSX.writeFile(wb, nomeArquivo);

                        atualizarProgresso(100, 'Concluído!');
                        RegistrosUtils.mostrarToast('Exportação concluída com sucesso!', 'success');

                    } catch (e) {
                        console.error(e);
                        RegistrosUtils.mostrarToast('Erro ao exportar: ' + e.message, 'error');
                    } finally {
                        setTimeout(() => modalProgresso.hide(), 1000);
                        delete window.tipoExportacaoTemp;
                    }
                }, 300);
            });
        }
    },

    processarListaParaExportacao: (listaOS) => {
        const linhasProcessadas = [];
        const userSegmentos = JSON.parse(localStorage.getItem('segmentos')) || [];
        const role = RegistrosState.userRole;

        listaOS.forEach(os => {
            if (['MANAGER', 'COORDINATOR'].includes(role)) {
                if (!os.segmento || !userSegmentos.includes(os.segmento.id)) return;
            }

            if (os.detalhes && os.detalhes.length > 0) {
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

                    linhasProcessadas.push({
                        os: os,
                        detalhe: detalhe,
                        ultimoLancamento: lancamentoParaExibir
                    });
                });
            }
        });
        return linhasProcessadas;
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