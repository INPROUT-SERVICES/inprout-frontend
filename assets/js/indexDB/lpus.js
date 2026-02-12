/**
 * =========================================================================
 * FUNÇÕES AUXILIARES GLOBAIS
 * - Estas funções podem ser chamadas de qualquer lugar.
 * =========================================================================
 */

/**
 * Mostra uma notificação toast na tela.
 * @param {string} mensagem A mensagem a ser exibida.
 * @param {string} [tipo='success'] O tipo do toast ('success' ou 'error').
 */
function mostrarToast(mensagem, tipo = 'success') {
    const toastElemento = document.getElementById('toastMensagem');
    const toastTexto = document.getElementById('toastTexto');
    if (!toastElemento || !toastTexto) {
        console.error('Elementos do Toast não foram encontrados no DOM.');
        return;
    }

    toastTexto.textContent = mensagem;
    toastElemento.classList.remove('text-bg-success', 'text-bg-danger');
    toastElemento.classList.add(tipo === 'error' ? 'text-bg-danger' : 'text-bg-success');

    const toast = new bootstrap.Toast(toastElemento);
    toast.show();
}

/**
 * Carrega a lista de CONTRATOS ativos e pré-seleciona um ID, se fornecido.
 * @param {string} selectId O ID do elemento <select> de contratos.
 * @param {number|null} [selectedId=null] O ID do contrato a ser pré-selecionado.
 */
async function carregarContratos(selectId, selectedId = null) {
    const selectElement = document.getElementById(selectId);
    if (!selectElement) return;

    selectElement.innerHTML = '<option value="" selected disabled>Carregando...</option>';
    try {
        const response = await fetchComAuth('https://www.inproutservices.com.br/api/contrato');
        if (!response.ok) throw new Error('Falha ao buscar contratos');
        const contratos = await response.json();

        selectElement.innerHTML = '<option value="" selected disabled>Selecione um contrato</option>';
        contratos.forEach(contrato => {
            const option = document.createElement('option');
            option.value = contrato.id;
            option.textContent = contrato.nome;
            if (contrato.id === selectedId) {
                option.selected = true;
            }
            selectElement.appendChild(option);
        });
    } catch (error) {
        console.error('ERRO AO CARREGAR CONTRATOS:', error);
        selectElement.innerHTML = '<option value="" selected disabled>Erro ao carregar</option>';
    }
}

/**
 * Carrega a lista de LPUs (ativas ou inativas) em um <select>, buscando dados a partir dos contratos.
 * @param {string} selectId O ID do elemento <select> de LPUs.
 * @param {boolean} filtroAtivo O status para filtrar (true=ativas, false=inativas).
 * @param {string} textoPlaceholder O texto da primeira opção.
 */
async function carregarLpusNoSelect(selectId, filtroAtivo, textoPlaceholder) {
    const selectElement = document.getElementById(selectId);
    if (!selectElement) return;

    selectElement.innerHTML = `<option value="" selected disabled>Carregando...</option>`;
    
    // MUDANÇA: Buscar direto em /lpu em vez de /contrato para pegar TUDO
    const url = `https://www.inproutservices.com.br/api/lpu`;

    try {
        const response = await fetchComAuth(url);
        if (!response.ok) throw new Error('Falha ao buscar LPUs');
        const todasLpus = await response.json();

        selectElement.innerHTML = `<option value="" selected disabled>${textoPlaceholder}</option>`;

        // Filtra localmente pelo status desejado (true ou false)
        const lpusFiltradas = todasLpus.filter(lpu => lpu.ativo === filtroAtivo);

        if (lpusFiltradas.length === 0) {
            const txtStatus = filtroAtivo ? 'ativas' : 'inativas';
            selectElement.innerHTML = `<option value="" selected disabled>Nenhuma LPU ${txtStatus} encontrada</option>`;
            return;
        }

        lpusFiltradas.forEach(lpu => {
            const option = document.createElement('option');
            option.value = lpu.id;

            // Tenta obter o nome do contrato (se o backend mandar o objeto contrato dentro da LPU)
            const nomeContrato = lpu.contrato ? lpu.contrato.nome : 'Sem Contrato';
            
            option.textContent = `${lpu.codigoLpu} - ${lpu.nomeLpu} (Contrato: ${nomeContrato})`;
            selectElement.appendChild(option);
        });

    } catch (error) {
        console.error(`Falha ao carregar LPUs para '${selectId}':`, error);
        mostrarToast('Erro ao carregar LPUs.', 'error');
        selectElement.innerHTML = `<option value="" selected disabled>Erro ao carregar</option>`;
    }
}

/**
 * Configura os botões de toggle para habilitar/desabilitar campos de um container específico.
 * @param {string} containerId O ID do container onde os toggles estão (ex: 'formCamposLPU').
 */
function configurarTogglesDeEdicao(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const toggles = container.querySelectorAll('.toggle-editar');
    toggles.forEach(toggle => {
        // Reseta o estado do toggle para desligado
        toggle.checked = false;

        // Garante que o campo correspondente comece desabilitado
        const targetInput = document.querySelector(toggle.dataset.target);
        if (targetInput) targetInput.disabled = true;

        // O evento de 'change' já está sendo adicionado uma vez.
        // Se houver problemas de múltiplos eventos, a lógica de remoção pode ser necessária,
        // mas a abordagem atual de chamar no 'show.bs.modal' geralmente funciona bem.
    });
}


/**
 * =========================================================================
 * LÓGICA PRINCIPAL DA PÁGINA (Executada após o carregamento do DOM)
 * =========================================================================
 */
document.addEventListener('DOMContentLoaded', function () {

    // --- Referências aos Modais ---
    const modalCriarLPU = document.getElementById('modalCriarLPU');
    const modalAlterarLPU = document.getElementById('modalAlterarLPU');
    const modalDesativarLPU = document.getElementById('modalDesativarLPU');
    const modalAtivarLPU = document.getElementById('modalAtivarLPU');

    document.addEventListener('change', function (event) {
        if (event.target.matches('.toggle-editar')) {
            const toggle = event.target;
            const targetSelector = toggle.dataset.target;
            const targetInput = document.querySelector(targetSelector);

            if (targetInput) {
                targetInput.disabled = !toggle.checked;
                if (toggle.checked) {
                    targetInput.focus();
                }
            }
        }
    });

    // ================== LÓGICA DO MODAL DE CRIAR LPU ==================
    if (modalCriarLPU) {
        // Carrega os contratos quando o modal de criar é aberto
        modalCriarLPU.addEventListener('show.bs.modal', () => {
            carregarContratos('lpuContratoAssociado');
            // Limpa o formulário caso ele tenha dados de uma tentativa anterior
            document.getElementById('formCriarLPU').reset();
        });

        // --- AQUI ESTÁ A LÓGICA DE SUBMIT QUE FALTAVA ---
        const formCriarLPU = document.getElementById('formCriarLPU');
        const btnSalvarLPU = formCriarLPU.querySelector('button[type="submit"]');

        formCriarLPU.addEventListener('submit', async function (event) {
            event.preventDefault(); // Impede o recarregamento da página

            btnSalvarLPU.disabled = true;
            btnSalvarLPU.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Salvando...';

            // Coleta os dados do formulário
            const dadosLPU = {
                codigoLpu: document.getElementById('lpuCodigo').value,
                nomeLpu: document.getElementById('lpuNome').value,
                unidade: document.getElementById('lpuUnidade').value,
                valorSemImposto: parseFloat(document.getElementById('lpuValorSemImposto').value.replace(',', '.')),
                valorComImposto: parseFloat(document.getElementById('lpuValorComImposto').value.replace(',', '.')),
                contratoId: parseInt(document.getElementById('lpuContratoAssociado').value)
            };

            try {
                const response = await fetchComAuth('https://www.inproutservices.com.br/api/lpu', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(dadosLPU)
                });

                if (response.ok) {
                    mostrarToast('LPU criada com sucesso!', 'success');
                    const modalInstance = bootstrap.Modal.getInstance(modalCriarLPU);
                    modalInstance.hide();
                    // Opcional: Adicione aqui uma função para recarregar sua tabela de LPUs
                    // recarregarTabelaLPUs(); 
                } else {
                    const erro = await response.json();
                    const mensagemErro = `Erro: ${erro.message || 'Verifique os dados.'}`;
                    mostrarToast(mensagemErro, 'error');
                }
            } catch (error) {
                console.error('Falha de comunicação com a API:', error);
                mostrarToast('Falha de comunicação com a API.', 'error');
            } finally {
                // Reabilita o botão
                btnSalvarLPU.disabled = false;
                btnSalvarLPU.innerHTML = '<i class="bi bi-check-circle"></i> Salvar';
            }
        });
    }

    // ================== LÓGICA DO MODAL DE ALTERAR LPU ==================
    if (modalAlterarLPU) {
        modalAlterarLPU.addEventListener('show.bs.modal', () => {
            carregarLpusNoSelect('selectLPUAlterar', true, 'Selecione a LPU para alterar');
            document.getElementById('formCamposLPU').classList.add('d-none');
            document.getElementById('btnSalvarAlteracaoLPU').disabled = true;

            // Ao abrir o modal, reseta todos os toggles e desabilita os campos
            document.querySelectorAll('#formCamposLPU .toggle-editar').forEach(toggle => {
                toggle.checked = false;
                const targetInput = document.querySelector(toggle.dataset.target);
                if (targetInput) targetInput.disabled = true;
            });
        });

        document.getElementById('selectLPUAlterar').addEventListener('change', async function (event) {
            const lpuId = event.target.value;
            const formCampos = document.getElementById('formCamposLPU');
            const btnSalvar = document.getElementById('btnSalvarAlteracaoLPU');

            if (!lpuId) {
                formCampos.classList.add('d-none');
                btnSalvar.disabled = true;
                return;
            }
            
            // Esta função provavelmente está no seu arquivo global.js e controla o overlay
            if (typeof toggleLoader === 'function') {
                toggleLoader(true);
            }

            try {
                // 1. Busca os detalhes da LPU selecionada
                const lpuResponse = await fetchComAuth(`https://www.inproutservices.com.br/api/lpu/${lpuId}`);
                if (!lpuResponse.ok) throw new Error('LPU não encontrada');
                const lpu = await lpuResponse.json();

                // LÓGICA CORRIGIDA PARA ENCONTRAR O CONTRATO DA LPU
                let contratoIdDaLpu = null;
                // 2. Busca TODOS os contratos para descobrir a qual deles a LPU pertence
                const contratosResponse = await fetchComAuth('https://www.inproutservices.com.br/api/contrato');
                const todosContratos = await contratosResponse.json();

                // 3. Encontra o contrato que contém a LPU com o ID selecionado
                const contratoPai = todosContratos.find(c => c.lpus && c.lpus.some(l => l.id == lpuId));
                if (contratoPai) {
                    contratoIdDaLpu = contratoPai.id;
                }

                // 4. Preenche os campos do formulário com os dados da LPU
                document.getElementById('lpuCodigoAlterar').value = lpu.codigoLpu;
                document.getElementById('lpuNomeAlterar').value = lpu.nomeLpu;
                document.getElementById('lpuUnidadeAlterar').value = lpu.unidade;
                document.getElementById('lpuValorSemImpostoAlterar').value = lpu.valorSemImposto.toFixed(2).replace('.', ',');
                document.getElementById('lpuValorComImpostoAlterar').value = lpu.valorComImposto.toFixed(2).replace('.', ',');

                // 5. Carrega la lista de contratos no select e pré-seleciona o correto
                await carregarContratos('lpuContratoAssociadoAlterar', contratoIdDaLpu);

                formCampos.classList.remove('d-none');
                btnSalvar.disabled = false;

            } catch (error) {
                console.error("Erro ao buscar detalhes da LPU:", error);
                mostrarToast('Erro ao buscar dados da LPU.', 'error');
                formCampos.classList.add('d-none');
                btnSalvar.disabled = true;
            } finally {
                // Esconde o loader, tendo a operação dado certo ou errado.
                if (typeof toggleLoader === 'function') {
                    toggleLoader(false);
                }
            }
        });

        // =========================================================================
        // ESTA PARTE JÁ ESTÁ CORRETA, USANDO O PATCH
        // =========================================================================
        const formAlterarLPU = document.getElementById('formAlterarLPU');
        formAlterarLPU.addEventListener('submit', async function (event) {
            event.preventDefault();

            const btnSalvar = document.getElementById('btnSalvarAlteracaoLPU');
            const lpuId = document.getElementById('selectLPUAlterar').value;

            if (!lpuId) {
                mostrarToast('Nenhuma LPU selecionada.', 'error');
                return;
            }

            const dadosUpdate = {};
            const toggles = document.querySelectorAll('#formCamposLPU .toggle-editar');

            // Monta o objeto apenas com os campos que foram habilitados
            toggles.forEach(toggle => {
                if (toggle.checked) {
                    const input = document.querySelector(toggle.dataset.target);
                    if (input) {
                        let valor = input.value;
                        if (input.id.includes('Valor')) {
                            valor = parseFloat(valor.replace(',', '.'));
                        } else if (input.id.includes('Contrato')) {
                            valor = parseInt(valor, 10);
                        }
                        dadosUpdate[input.name] = valor;
                    }
                }
            });

            if (Object.keys(dadosUpdate).length === 0) {
                mostrarToast('Nenhum campo foi habilitado para alteração.', 'error');
                return;
            }

            btnSalvar.disabled = true;
            btnSalvar.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Salvando...';

            try {
                // Envia os dados para a API usando o método PATCH
                const response = await fetchComAuth(`https://www.inproutservices.com.br/api/lpu/${lpuId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(dadosUpdate)
                });

                if (response.ok) {
                    mostrarToast('LPU alterada com sucesso!', 'success');
                    bootstrap.Modal.getInstance(modalAlterarLPU).hide();
                    carregarTabelaLPU(); // Recarrega a tabela principal
                } else {
                    const erro = await response.json();
                    const mensagemErro = `Erro: ${erro.message || 'Verifique os dados.'}`;
                    mostrarToast(mensagemErro, 'error');
                }

            } catch (error) {
                console.error('Falha de comunicação ao alterar LPU:', error);
                mostrarToast('Falha de comunicação com a API.', 'error');
            } finally {
                btnSalvar.disabled = false;
                btnSalvar.innerHTML = 'Salvar Alterações';
            }
        });
    }

    // ================== LÓGICA DO MODAL DE DESATIVAR LPU ==================
    if (modalDesativarLPU) {
        // Evento para quando o modal é aberto (reseta o estado)
        modalDesativarLPU.addEventListener('show.bs.modal', () => {
            carregarLpusNoSelect('selectLPUDesativar', true, 'Selecione a LPU para desativar');
            document.getElementById('infoLPUDesativar').classList.add('d-none');
            document.getElementById('btnConfirmarDesativacaoLPU').disabled = true;
        });

        // Evento de 'change' com a experiência de usuário melhorada
        document.getElementById('selectLPUDesativar').addEventListener('change', async function (event) {
            const lpuId = event.target.value;
            const infoContainer = document.getElementById('infoLPUDesativar');
            const btnConfirmar = document.getElementById('btnConfirmarDesativacaoLPU');

            if (!lpuId) {
                infoContainer.classList.add('d-none');
                btnConfirmar.disabled = true;
                return;
            }

            // UX MELHORADA: Ativa o loader e desabilita o botão
            toggleLoader(true);
            btnConfirmar.disabled = true;

            try {
                // UX MELHORADA: Busca e preenche os campos em segundo plano
                await preencherCamposConfirmacao(lpuId, 'Desativar');

                // UX MELHORADA: Só agora mostra o container e habilita o botão
                infoContainer.classList.remove('d-none');
                btnConfirmar.disabled = false;

            } catch (error) {
                console.error("Falha ao carregar dados da LPU para desativação.", error);
                infoContainer.classList.add('d-none');
                btnConfirmar.disabled = true;
            } finally {
                toggleLoader(false);
            }
        });

        // Lógica de clique no botão de confirmação
        const btnConfirmarDesativacao = document.getElementById('btnConfirmarDesativacaoLPU');
        btnConfirmarDesativacao.addEventListener('click', async function (event) {
            event.preventDefault();
            const lpuId = document.getElementById('selectLPUDesativar').value;
            if (!lpuId) {
                mostrarToast('Por favor, selecione uma LPU.', 'error');
                return;
            }

            toggleLoader(true);
            this.disabled = true;

            try {
                const response = await fetchComAuth(`https://www.inproutservices.com.br/api/lpu/${lpuId}`, {
                    method: 'DELETE'
                });

                // Dentro da lógica de clique do btnConfirmarDesativacaoLPU
                if (response.ok) {
                    mostrarToast('LPU desativada com sucesso!', 'success');
                    bootstrap.Modal.getInstance(modalDesativarLPU).hide();
                    carregarTabelaLPU(); // <-- ADICIONE ESTA LINHA
                } else {
                    const erro = await response.text();
                    mostrarToast(`Erro ao desativar LPU: ${erro}`, 'error');
                }
            } catch (error) {
                console.error('Falha de comunicação ao desativar LPU:', error);
                mostrarToast('Falha de comunicação com a API.', 'error');
            } finally {
                toggleLoader(false);
                this.disabled = false;
            }
        });
    }

    // ================== LÓGICA DO MODAL DE ATIVAR LPU ==================
    if (modalAtivarLPU) {
        // Evento para quando o modal é aberto (reseta o estado)
        modalAtivarLPU.addEventListener('show.bs.modal', () => {
            carregarLpusNoSelect('selectLPUReativar', false, 'Selecione a LPU para reativar');
            document.getElementById('infoLPUReativar').classList.add('d-none');
            document.getElementById('btnConfirmarReativacaoLPU').disabled = true;
        });

        // Evento de 'change' com a experiência de usuário melhorada
        document.getElementById('selectLPUReativar').addEventListener('change', async function (event) {
            const lpuId = event.target.value;
            const infoContainer = document.getElementById('infoLPUReativar');
            const btnConfirmar = document.getElementById('btnConfirmarReativacaoLPU');

            if (!lpuId) {
                infoContainer.classList.add('d-none');
                btnConfirmar.disabled = true;
                return;
            }

            // UX MELHORADA: Ativa o loader e desabilita o botão
            toggleLoader(true);
            btnConfirmar.disabled = true;

            try {
                // UX MELHORADA: Busca e preenche os campos em segundo plano
                await preencherCamposConfirmacao(lpuId, 'Reativar');

                // UX MELHORADA: Só agora mostra o container e habilita o botão
                infoContainer.classList.remove('d-none');
                btnConfirmar.disabled = false;
            } catch (error) {
                console.error("Falha ao carregar dados da LPU para reativação.", error);
                infoContainer.classList.add('d-none');
                btnConfirmar.disabled = true;
            } finally {
                toggleLoader(false);
            }
        });

        // Lógica de clique no botão de confirmação
        const btnConfirmarReativacao = document.getElementById('btnConfirmarReativacaoLPU');
        btnConfirmarReativacao.addEventListener('click', async function (event) {
            event.preventDefault();
            const lpuId = document.getElementById('selectLPUReativar').value;
            if (!lpuId) {
                mostrarToast('Por favor, selecione uma LPU para reativar.', 'error');
                return;
            }

            toggleLoader(true);
            this.disabled = true;

            try {
                const url = `https://www.inproutservices.com.br/api/lpu/${lpuId}`;
                const response = await fetchComAuth(url, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ ativo: true })
                });

                // Dentro da lógica de clique do btnConfirmarReativacaoLPU
                if (response.ok) {
                    mostrarToast('LPU reativada com sucesso!', 'success');
                    bootstrap.Modal.getInstance(modalAtivarLPU).hide();
                    carregarTabelaLPU(); // <-- ADICIONE ESTA LINHA
                } else {
                    const erro = await response.text();
                    mostrarToast(`Erro ao reativar LPU: ${erro}`, 'error');
                }
            } catch (error) {
                console.error('Falha de comunicação ao reativar LPU:', error);
                mostrarToast('Falha de comunicação com a API. Verifique o CORS no backend.', 'error');
            } finally {
                toggleLoader(false);
                this.disabled = false;
            }
        });
    }

    carregarTabelaLPU();
});


/**
 * Formata um número para o padrão de moeda brasileiro (BRL).
 * @param {number} valor - O valor numérico a ser formatado.
 * @returns {string} O valor formatado como moeda.
 */
function formatarMoeda(valor) {
    if (typeof valor !== 'number') {
        return "R$ 0,00";
    }
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(valor);
}

async function carregarTabelaLPU() {
    // 1. Referências aos elementos da tabela no HTML
    const thead = document.getElementById("thead-lpu");
    const tbody = document.getElementById("tbody-lpu");

    // 2. Lógica de permissão por role (continua a mesma para as colunas da LPU)
    const role = (localStorage.getItem("role") || "").trim().toUpperCase();

    const colunasBaseLPU = ['status', 'codigoLpu', 'nomeLpu', 'unidade'];
    const colunasPorRole = {
        ADMIN: [...colunasBaseLPU, 'valorSemImposto', 'valorComImposto'],
        ASSISTANT: [...colunasBaseLPU, 'valorSemImposto', 'valorComImposto'],
        COORDINATOR: [...colunasBaseLPU, 'valorSemImposto', 'valorComImposto'],
        MANAGER: colunasBaseLPU,
        CONTROLLER: colunasBaseLPU
    };
    const camposVisiveis = colunasPorRole[role] || colunasBaseLPU;

    const titulosLPU = {
        status: "Status",
        codigoLpu: "Código LPU",
        nomeLpu: "Nome",
        unidade: "Unidade",
        valorSemImposto: "Valor s/ Imposto",
        valorComImposto: "Valor c/ Imposto"
    };

    thead.innerHTML = "";
    tbody.innerHTML = "<tr><td colspan='100%'>Carregando contratos...</td></tr>";

    try {
        const response = await fetchComAuth("https://www.inproutservices.com.br/api/contrato");
        if (!response.ok) throw new Error("Falha ao carregar os dados dos contratos.");

        const dadosContratos = await response.json();

        if (!Array.isArray(dadosContratos) || dadosContratos.length === 0) {
            tbody.innerHTML = "<tr><td colspan='100%'>Nenhum contrato encontrado.</td></tr>";
            return;
        }

        let htmlFinal = "";
        dadosContratos.forEach(contrato => {
            // Linha principal do contrato (o "botão" do acordeão)
            htmlFinal += `
                <tr class="contrato-header-row">
                    <td colspan="${camposVisiveis.length}">
                        <div class="d-flex justify-content-between align-items-center">
                            <strong>Contrato: ${contrato.nome}</strong>
                            <i class="bi bi-chevron-down toggle-icon"></i>
                        </div>
                    </td>
                </tr>
            `;

            // Linha ÚNICA que conterá a sub-tabela (começa fechada via CSS)
            htmlFinal += `
                <tr class="lpu-details-row">
                    <td colspan="${camposVisiveis.length}">
                        <div class="p-3">
            `;

            if (contrato.lpus && contrato.lpus.length > 0) {
                htmlFinal += `<table class="table table-sm table-bordered lpu-sub-table">`;
                htmlFinal += `
                    <thead>
                        <tr>
                            ${camposVisiveis.map(campo => `<th>${titulosLPU[campo]}</th>`).join("")}
                        </tr>
                    </thead>
                `;
                htmlFinal += '<tbody>';
                contrato.lpus.forEach(lpu => {
                    htmlFinal += '<tr>';
                    camposVisiveis.forEach(campo => {
                        let celulaHtml = '';
                        switch (campo) {
                            case 'status':
                                const statusClass = lpu.ativo ? 'active' : 'inactive';
                                celulaHtml = `<td><span class="status-indicator ${statusClass}"></span></td>`;
                                break;
                            case 'valorSemImposto':
                            case 'valorComImposto':
                                celulaHtml = `<td>${formatarMoeda(lpu[campo])}</td>`;
                                break;
                            default:
                                celulaHtml = `<td>${lpu[campo] ?? ""}</td>`;
                                break;
                        }
                        htmlFinal += celulaHtml;
                    });
                    htmlFinal += '</tr>';
                });
                htmlFinal += '</tbody></table>';
            } else {
                htmlFinal += '<p class="text-muted">Nenhuma LPU cadastrada para este contrato.</p>';
            }

            htmlFinal += `</div></td></tr>`;
        });

        tbody.innerHTML = htmlFinal;

    } catch (err) {
        console.error("Erro ao carregar tabela de LPUs por contrato:", err);
        tbody.innerHTML = `<tr><td colspan='100%'>Erro ao carregar dados. Tente novamente.</td></tr>`;
        if (typeof mostrarToast === 'function') {
            mostrarToast(err.message, 'error');
        }
    }
}

document.addEventListener('click', function (event) {
    // Procura pelo elemento clicado ou um "pai" dele que seja a nossa linha de cabeçalho
    const headerRow = event.target.closest('.contrato-header-row');

    // Se não clicou em uma linha de cabeçalho, não faz nada
    if (!headerRow) return;

    // A partir da linha de cabeçalho, encontramos o ícone e a linha de detalhes
    const icon = headerRow.querySelector('.toggle-icon');
    const detailsRow = headerRow.nextElementSibling;

    // Alterna (adiciona/remove) as classes que controlam a aparência e a animação
    if (icon) icon.classList.toggle('rotated');
    if (detailsRow) detailsRow.classList.toggle('open');
});

/**
 * VERSÃO CORRIGIDA - Use esta no seu arquivo lpus.js
 * * Busca os dados de uma LPU e preenche os campos de confirmação nos modais,
 * que agora são campos <input>.
 * @param {string|number} lpuId O ID da LPU a ser buscada.
 * @param {'Desativar'|'Reativar'} modo O modo de operação para encontrar os elementos corretos.
 */
async function preencherCamposConfirmacao(lpuId, modo) {
    // 1. Encontra os elementos INPUT corretos com base no modo
    // O 'modo' vai ser "Desativar" ou "Reativar", batendo com os IDs no seu HTML
    const inputContrato = document.getElementById(`lpuContratoAssociado${modo}`);
    const inputCodigo = document.getElementById(`lpuCodigo${modo}`);
    const inputNome = document.getElementById(`lpuNome${modo}`);
    const inputUnidade = document.getElementById(`lpuUnidade${modo}`);
    const inputValorSemImposto = document.getElementById(`lpuValorSemImposto${modo}`);
    const inputValorComImposto = document.getElementById(`lpuValorComImposto${modo}`);

    // Checa se todos os inputs foram encontrados no HTML
    if (!inputContrato || !inputCodigo || !inputNome || !inputUnidade || !inputValorSemImposto || !inputValorComImposto) {
        console.error(`Um ou mais campos de input para o modo '${modo}' não foram encontrados no DOM.`);
        throw new Error(`Elementos de confirmação (inputs) não encontrados.`);
    }

    try {
        // 2. Busca os detalhes da LPU específica
        const lpuResponse = await fetchComAuth(`https://www.inproutservices.com.br/api/lpu/${lpuId}`);
        if (!lpuResponse.ok) throw new Error('Falha ao buscar detalhes da LPU.');
        const lpu = await lpuResponse.json();

        // 3. Busca todos os contratos para encontrar o contrato pai da LPU
        const contratosResponse = await fetchComAuth('https://www.inproutservices.com.br/api/contrato');
        if (!contratosResponse.ok) throw new Error('Falha ao buscar contratos.');
        const todosContratos = await contratosResponse.json();
        const contratoPai = todosContratos.find(c => c.lpus && c.lpus.some(l => l.id == lpuId));

        // 4. Preenche os INPUTS usando .value
        inputContrato.value = contratoPai ? contratoPai.nome : 'Contrato não encontrado';
        inputCodigo.value = lpu.codigoLpu || 'N/A';
        inputNome.value = lpu.nomeLpu || 'N/A';
        inputUnidade.value = lpu.unidade || 'N/A';
        // Formata os valores como moeda para exibição
        inputValorSemImposto.value = formatarMoeda(lpu.valorSemImposto);
        inputValorComImposto.value = formatarMoeda(lpu.valorComImposto);

    } catch (error) {
        console.error(`Erro ao preencher campos de confirmação para LPU ${lpuId}:`, error);
        // Propaga o erro para que a lógica do modal possa tratá-lo
        throw error;
    }
}