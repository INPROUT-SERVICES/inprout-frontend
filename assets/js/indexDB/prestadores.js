async function inicializarPrestadores() {
    const form = document.getElementById("formAdicionarPrestador");
    if (form) {
        form.addEventListener("submit", async (e) => {
            e.preventDefault();

            const getValor = (id) => {
                const elemento = document.getElementById(id);
                return elemento?.value?.trim() || null;
            };

            // --- LÓGICA DO BANCO CORRIGIDA ---
            const selectBanco = document.getElementById('selectBancoCadastro');
            const bancoOption = selectBanco.options[selectBanco.selectedIndex];

            let bancoId = null;
            let codigoBancoLegado = null;
            let nomeBancoLegado = null;

            if (selectBanco.value) {
                bancoId = Number(selectBanco.value);
                // Pega do dataset que populamos na função carregarSelectBancosDinamicamente
                codigoBancoLegado = bancoOption.dataset.codigo;
                nomeBancoLegado = bancoOption.dataset.nome;
            }
            // ----------------------------------

            const prestador = {
                codigoPrestador: Number(getValor("codigoPrestador")) || null,
                prestador: getValor("nomePrestador"),
                razaoSocial: getValor("razaoSocial"),
                cidade: getValor("cidadePrestador"),
                uf: getValor("ufPrestador"),
                regiao: getValor("regionalPrestador"),
                rg: getValor("rgPrestador"),
                cpf: getValor("cpfPrestador"),
                cnpj: getValor("cnpjPrestador"),

                // Campos de Banco Corrigidos
                bancoId: bancoId,
                codigoBanco: codigoBancoLegado,
                banco: nomeBancoLegado,

                agencia: getValor("agenciaPrestador"),
                conta: getValor("contaPrestador"),
                tipoDeConta: getValor("tipoConta"),
                telefone: getValor("telefonePrestador"),
                email: getValor("emailPrestador"),
                tipoPix: getValor("tipoChavePix"),
                chavePix: getValor("chavePix"),
                observacoes: getValor("observacoesPrestador")
            };

            toggleLoader(true);

            try {
                const response = await fetchComAuth("http://localhost:8080/index/prestadores", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(prestador)
                });

                if (!response.ok) throw new Error("Erro ao salvar o prestador.");

                mostrarToast("Prestador salvo com sucesso!", "success");
                form.reset();
                selectBanco.value = ""; // Reseta o select

                await carregarTabelaPrestadores(getColunasAtuaisPorRole());
                bootstrap.Modal.getInstance(document.getElementById("modalAdicionarPrestador")).hide();

            } catch (error) {
                console.error(error);
                mostrarToast("Erro ao salvar o prestador.", "error");
            } finally {
                toggleLoader(false);
            }
        });
    }

    // Carregamento inicial da tabela
    await carregarTabelaPrestadores(getColunasAtuaisPorRole());

    // Listener para carregar os bancos quando abrir o modal
    const modalAdicionar = document.getElementById('modalAdicionarPrestador');
    if (modalAdicionar) {
        modalAdicionar.addEventListener('show.bs.modal', () => {
            carregarSelectBancosDinamicamente();
        });
    }
}

async function carregarTabelaPrestadores(camposOriginais) {
    const thead = document.getElementById("thead-prestadores");
    const tbody = document.getElementById("tbody-prestadores");

    // Adiciona a coluna de status no início
    const campos = ['status', ...camposOriginais];

    const titulosFormatados = {
        status: 'Status',
        codigoPrestador: "Código",
        prestador: "Prestador",
        razaoSocial: "Razão Social",
        cidade: "Cidade",
        uf: "UF",
        regiao: "Região",
        cpf: "CPF",
        cnpj: "CNPJ",

        // 1. Título alterado para "Instituição Financeira"
        banco: "Instituição Financeira",
        agencia: "Agência",
        conta: "Conta",
        tipoDeConta: "Tipo Conta",

        telefone: "Telefone",
        email: "E-mail",
        tipoPix: "Tipo de PIX",
        chavePix: "Chave PIX",
        observacoes: "Observações"
    };

    try {
        const response = await fetchComAuth("http://localhost:8080/index/prestadores");

        if (!response.ok) {
            throw new Error("Erro ao buscar prestadores.");
        }

        const todosOsPrestadores = await response.json();

        if (!Array.isArray(todosOsPrestadores) || todosOsPrestadores.length === 0) {
            thead.innerHTML = "<tr><th>Nenhum dado encontrado</th></tr>";
            tbody.innerHTML = "";
            return;
        }

        // Gera o Cabeçalho (THEAD)
        thead.innerHTML = `
            <tr>
                ${campos.map(campo => `<th>${titulosFormatados[campo] || campo}</th>`).join("")}
            </tr>
        `;

        // Gera o Corpo (TBODY)
        tbody.innerHTML = todosOsPrestadores.map(prestador => {
            const linhaHtml = campos.map(campo => {
                if (campo === 'status') {
                    const statusClass = prestador.ativo ? 'active' : 'inactive';
                    return `<td><span class="status-indicator ${statusClass}"></span></td>`;
                }

                // 2. Lógica para concatenar Código + Nome na coluna Instituição Financeira (banco)
                if (campo === 'banco') {
                    const codigo = prestador.codigoBanco || "";
                    const nome = prestador.banco || "";
                    // Se ambos existirem, concatena com hífen; caso contrário, mostra o que estiver disponível
                    const display = (codigo && nome) ? `${codigo} - ${nome}` : (codigo || nome || "");
                    return `<td>${display}</td>`;
                }

                // Retorna o valor padrão para os outros campos
                return `<td>${prestador[campo] ?? ""}</td>`;
            }).join("");

            return `<tr>${linhaHtml}</tr>`;
        }).join("");

    } catch (err) {
        console.error("Erro:", err);
        thead.innerHTML = "<tr><th>Erro ao carregar dados</th></tr>";
        tbody.innerHTML = "";
    }
}

/**
 * Busca a lista de prestadores da API e popula um elemento <select>.
 * @param {HTMLSelectElement} elementoSelect - O elemento <select> a ser preenchido.
 */
async function preencherSelectComPrestadores(elementoSelect) {
    // URL do seu endpoint de prestadores
    const urlPrestadores = "http://localhost:8080/index/prestadores";

    try {
        const response = await fetchComAuth(urlPrestadores);
        if (!response.ok) {
            throw new Error("Não foi possível carregar a lista de prestadores.");
        }
        const prestadores = await response.json();

        // Limpa o select e adiciona a opção padrão
        elementoSelect.innerHTML = '<option value="">Selecione o prestador</option>';

        // Itera sobre a lista de prestadores e cria as opções
        prestadores.forEach(prestador => {
            const opt = document.createElement("option");

            // O 'value' da opção deve ser o ID único do prestador
            opt.value = prestador.id;

            // O texto visível será no formato "Código - Nome"
            opt.textContent = `${prestador.codigoPrestador} - ${prestador.prestador}`;

            elementoSelect.appendChild(opt);
        });

    } catch (error) {
        console.error("Erro ao preencher select de prestadores:", error);
        // Em caso de erro, exibe uma mensagem dentro do select
        elementoSelect.innerHTML = '<option value="">Erro ao carregar</option>';
        mostrarToast(error.message, 'error');
    }
}

async function carregarSelectBancosDinamicamente() {
    // Lista de IDs dos selects que vamos popular (Cadastro e Edição futuramente)
    const selectsIds = ['selectBancoCadastro', 'selectBancoEditar'];

    try {
        const response = await fetchComAuth('http://localhost:8080/geral/bancos');
        if (!response.ok) return;

        const bancos = await response.json();

        // Ordenar por código
        bancos.sort((a, b) => a.codigo.localeCompare(b.codigo));

        selectsIds.forEach(id => {
            const selectEl = document.getElementById(id);
            if (!selectEl) return;

            // Mantém valor selecionado caso já tenha (útil para edição)
            const valorAtual = selectEl.value;
            selectEl.innerHTML = '<option value="">Selecione o banco...</option>';

            bancos.forEach(banco => {
                const option = document.createElement('option');
                // IMPORTANTE: Value é o ID para o vínculo relacional
                option.value = banco.id;

                // Guardamos o código e nome em dataset para enviar como fallback (legado)
                option.dataset.codigo = banco.codigo;
                option.dataset.nome = banco.nome;

                option.textContent = `${banco.codigo} - ${banco.nome}`;
                selectEl.appendChild(option);
            });

            if (valorAtual) selectEl.value = valorAtual;
        });

    } catch (error) {
        console.error("Erro ao carregar bancos:", error);
    }
}

function configurarModaisPrestadores() {
    // --- Modal de Edição de Prestador ---
    const modalEditar = document.getElementById("modalEditarPrestador");
    if (modalEditar) {
        modalEditar.addEventListener("show.bs.modal", () => {
            const selectParaEditar = document.getElementById("selectPrestadorEditar");
            if (selectParaEditar) {
                preencherSelectComPrestadores(selectParaEditar);
            }
            carregarSelectBancosDinamicamente();
        });
    }

    // --- Modal de Desativação de Prestador ---
    const modalDesativar = document.getElementById("modalDesativarPrestador");
    if (modalDesativar) {
        modalDesativar.addEventListener("show.bs.modal", () => {
            const selectParaDesativar = document.getElementById("selectPrestadorDesativar");
            if (selectParaDesativar) {
                preencherSelectComPrestadores(selectParaDesativar);
            }
        });
    }
}

function configurarModalDesativarPrestador() {
    const modalEl = document.getElementById("modalDesativarPrestador");
    const form = document.getElementById("formDesativarPrestador");
    const select = document.getElementById("selectPrestadorDesativar");
    const btnConfirmar = document.getElementById("btnConfirmarDesativar");
    const aviso = document.getElementById("avisoPrestadorSelecionado");

    if (!modalEl) {
        return;
    }

    modalEl.addEventListener('show.bs.modal', () => {
        preencherSelectComPrestadores(select);
        select.value = '';
        aviso.classList.add('d-none');
        btnConfirmar.disabled = true;
    });

    select.addEventListener('change', () => {
        const prestadorSelecionado = select.value;
        if (prestadorSelecionado) {
            aviso.classList.remove('d-none');
            btnConfirmar.disabled = false;
        } else {
            aviso.classList.add('d-none');
            btnConfirmar.disabled = true;
        }
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const prestadorId = select.value;
        if (!prestadorId) {
            mostrarToast("Por favor, selecione um prestador para desativar.", "warning");
            return;
        }
        toggleLoader(true);

        try {
            // --- INÍCIO DA CORREÇÃO ---
            // 1. Busca todos os prestadores para encontrar o código
            const prestadoresResponse = await fetchComAuth("http://localhost:8080/index/prestadores/ativos");
            const prestadores = await prestadoresResponse.json();
            const prestadorSelecionado = prestadores.find(p => p.id == prestadorId);

            if (!prestadorSelecionado) {
                throw new Error('Não foi possível encontrar o prestador selecionado.');
            }

            const prestadorCodigo = prestadorSelecionado.codigoPrestador;

            // 2. Usa o CÓDIGO na URL, como o backend espera
            const response = await fetchComAuth(`http://localhost:8080/index/prestadores/desativar/${prestadorCodigo}`, {
                method: 'PUT',
            });
            // --- FIM DA CORREÇÃO ---

            if (!response.ok) {
                throw new Error('Falha ao desativar o prestador. Tente novamente.');
            }

            mostrarToast("Prestador desativado com sucesso!", 'success');
            bootstrap.Modal.getInstance(modalEl).hide();

            const colunas = getColunasAtuaisPorRole();
            await carregarTabelaPrestadores(colunas);

        } catch (error) {
            console.error("Erro ao desativar prestador:", error);
            mostrarToast(error.message, 'error');
        } finally {
            toggleLoader(false);
        }
    });
}

/**
 * Busca a lista de prestadores INATIVOS da API e popula um elemento <select>.
 * @param {HTMLSelectElement} elementoSelect - O elemento <select> a ser preenchido.
 */
async function preencherSelectComPrestadoresDesativados(elementoSelect) {
    const urlPrestadoresDesativados = "http://localhost:8080/index/prestadores/desativados";

    try {
        const response = await fetchComAuth(urlPrestadoresDesativados);
        if (!response.ok) {
            throw new Error("Não foi possível carregar a lista de prestadores desativados.");
        }
        const prestadores = await response.json();

        elementoSelect.innerHTML = '<option value="">Selecione o prestador desativado</option>';

        if (prestadores.length === 0) {
            elementoSelect.innerHTML = '<option value="">Nenhum prestador inativo</option>';
            return;
        }

        prestadores.forEach(prestador => {
            const opt = document.createElement("option");
            opt.value = prestador.id;
            opt.textContent = `${prestador.codigoPrestador} - ${prestador.prestador}`;
            elementoSelect.appendChild(opt);
        });

    } catch (error) {
        console.error("Erro ao preencher select de prestadores desativados:", error);
        elementoSelect.innerHTML = '<option value="">Erro ao carregar</option>';
        mostrarToast(error.message, 'error');
    }
}

function configurarModalAtivarPrestador() {
    const modalEl = document.getElementById("modalAtivarPrestador");
    const form = document.getElementById("formAtivarPrestador");
    const select = document.getElementById("selectPrestadorAtivar");
    const btnConfirmar = document.getElementById("btnConfirmarAtivar");
    const aviso = document.getElementById("avisoPrestadorSelecionadoAtivar");

    if (!modalEl) {
        return;
    }

    modalEl.addEventListener('show.bs.modal', () => {
        // Usamos a nova função para mostrar apenas prestadores inativos
        preencherSelectComPrestadoresDesativados(select);

        // Reseta o estado do modal
        select.value = '';
        aviso.classList.add('d-none');
        btnConfirmar.disabled = true;
    });

    select.addEventListener('change', () => {
        if (select.value) {
            aviso.classList.remove('d-none');
            btnConfirmar.disabled = false;
        } else {
            aviso.classList.add('d-none');
            btnConfirmar.disabled = true;
        }
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const prestadorId = select.value;
        if (!prestadorId) {
            mostrarToast("Por favor, selecione um prestador para ativar.", "warning");
            return;
        }
        toggleLoader(true);

        try {
            // --- INÍCIO DA CORREÇÃO ---
            // 1. Busca os prestadores INATIVOS para encontrar o código
            const prestadoresResponse = await fetchComAuth("http://localhost:8080/index/prestadores/desativados");
            const prestadores = await prestadoresResponse.json();
            const prestadorSelecionado = prestadores.find(p => p.id == prestadorId);

            if (!prestadorSelecionado) {
                throw new Error('Não foi possível encontrar o prestador selecionado.');
            }

            const prestadorCodigo = prestadorSelecionado.codigoPrestador;

            // 2. Usa o CÓDIGO na URL
            const response = await fetchComAuth(`http://localhost:8080/index/prestadores/ativar/${prestadorCodigo}`, {
                method: 'PUT',
            });
            // --- FIM DA CORREÇÃO ---

            if (!response.ok) {
                throw new Error('Falha ao ativar o prestador. Tente novamente.');
            }

            mostrarToast("Prestador ativado com sucesso!", 'success');
            bootstrap.Modal.getInstance(modalEl).hide();

            const colunas = getColunasAtuaisPorRole();
            await carregarTabelaPrestadores(colunas);

        } catch (error) {
            console.error("Erro ao ativar prestador:", error);
            mostrarToast(error.message, 'error');
        } finally {
            toggleLoader(false);
        }
    });
}

/**
 * Retorna a lista de nomes de colunas de prestadores com base
 * na 'role' do usuário armazenada no localStorage.
 * @returns {string[]} Um array com os nomes das colunas.
 */
function getColunasAtuaisPorRole() {
    const colunasPorRole = {
        ADMIN: ['codigoPrestador', 'prestador', 'razaoSocial', 'cidade', 'uf', 'regiao', 'cpf', 'cnpj', 'banco', 'agencia', 'conta', 'tipoDeConta', 'telefone', 'email', 'tipoPix', 'chavePix', 'observacoes'],
        COORDINATOR: ['codigoPrestador', 'prestador', 'cidade', 'uf', 'regiao', 'telefone', 'email'],
        MANAGER: ['codigoPrestador', 'prestador', 'cidade', 'uf', 'regiao', 'telefone', 'email'],
        CONTROLLER: ['codigoPrestador', 'prestador', 'cidade', 'uf', 'regiao', 'telefone', 'email'],
        ASSISTANT: ['codigoPrestador', 'prestador', 'razaoSocial', 'cidade', 'uf', 'regiao', 'cpf', 'cnpj', 'banco', 'agencia', 'conta', 'tipoDeConta', 'telefone', 'email', 'tipoPix', 'chavePix', 'observacoes']
    };

    const role = (localStorage.getItem("role") || "").trim().toUpperCase();
    return colunasPorRole[role] ?? ['codigoPrestador', 'prestador'];
}

/**
 * Configura a lógica completa do modal de Edição de Prestador,
 * usando o padrão de interruptor e com o mapeamento de campos corrigido.
 */
function configurarModalEditarPrestador() {
    const modalEl = document.getElementById("modalEditarPrestador");
    if (!modalEl) return;

    const selectEl = document.getElementById("selectPrestadorEditar");
    const formCampos = document.getElementById("formCamposPrestador");
    const formEl = document.getElementById("formEditarPrestador");
    const btnSalvar = document.getElementById("btnSalvarEdicaoPrestador");
    let todosOsPrestadores = [];

    // Mapeamento dos campos (ID do HTML : Propriedade do Objeto)
    const mapeamentoCampos = {
        codigoPrestador: 'codigoPrestador_Editar',
        prestador: 'nomePrestador_Editar',
        razaoSocial: 'razaoSocial_Editar',
        cidade: 'cidadePrestador_Editar',
        uf: 'ufPrestador_Editar',
        regiao: 'regionalPrestador_Editar',
        rg: 'rgPrestador_Editar',
        cpf: 'cpfPrestador_Editar',
        cnpj: 'cnpjPrestador_Editar',
        agencia: 'agenciaPrestador_Editar',
        conta: 'contaPrestador_Editar',
        tipoDeConta: 'tipoConta_Editar',
        telefone: 'telefonePrestador_Editar',
        email: 'emailPrestador_Editar',
        tipoPix: 'tipoChavePix_Editar',
        chavePix: 'chavePix_Editar',
        observacoes: 'observacoesPrestador_Editar'
    };

    const preencherFormularioEdicao = (prestador) => {
        // 1. Preenche campos simples
        for (const key in mapeamentoCampos) {
            const campoId = mapeamentoCampos[key];
            if (campoId) {
                const campo = document.getElementById(campoId);
                if (campo) {
                    campo.value = prestador[key] ?? '';
                }
            }
        }

        // 2. Lógica Especial para o Banco (Select)
        const selectBanco = document.getElementById('selectBancoEditar');
        if (selectBanco) {
            if (prestador.bancoReferencia && prestador.bancoReferencia.id) {
                // Se o prestador já tem o objeto bancoReferencia (novo modelo)
                selectBanco.value = prestador.bancoReferencia.id;
            } else {
                // Fallback: Tenta encontrar pelo código antigo (legado)
                const options = Array.from(selectBanco.options);
                const optionEncontrada = options.find(opt => opt.dataset.codigo === prestador.codigoBanco);
                if (optionEncontrada) {
                    selectBanco.value = optionEncontrada.value;
                } else {
                    selectBanco.value = "";
                }
            }
        }
    };

    const resetarFormulario = () => {
        formCampos.querySelectorAll('input:not([readonly]):not(.toggle-editar), select, textarea').forEach(input => {
            input.disabled = true;
        });
        formCampos.querySelectorAll('.toggle-editar').forEach(toggle => {
            toggle.checked = false;
        });
    };

    modalEl.addEventListener('show.bs.modal', async () => {
        formCampos.classList.add('d-none');
        btnSalvar.disabled = true;
        selectEl.value = '';
        resetarFormulario();
        try {
            toggleLoader(true);
            // Carrega a lista de bancos antes de tudo
            await carregarSelectBancosDinamicamente();
            await preencherSelectComPrestadores(selectEl);

            const response = await fetchComAuth("http://localhost:8080/index/prestadores");
            todosOsPrestadores = await response.json();
        } catch (error) {
            mostrarToast("Erro ao preparar modal.", "error");
        } finally {
            toggleLoader(false);
        }
    });

    selectEl.addEventListener('change', () => {
        const prestadorId = parseInt(selectEl.value);
        if (!prestadorId) {
            formCampos.classList.add('d-none');
            return;
        }
        const prestador = todosOsPrestadores.find(p => p.id === prestadorId);
        if (prestador) {
            resetarFormulario();
            preencherFormularioEdicao(prestador);
            formCampos.classList.remove('d-none');
            btnSalvar.disabled = false;
        }
    });

    // Lógica do Toggle (Switch) de editar
    formCampos.addEventListener('change', (e) => {
        if (e.target.classList.contains('toggle-editar')) {
            const targetSelector = e.target.getAttribute('data-target');
            const inputTarget = document.querySelector(targetSelector);
            if (inputTarget) {
                inputTarget.disabled = !e.target.checked;
                if (e.target.checked) inputTarget.focus();
            }
        }
    });

    formEl.addEventListener('submit', async (e) => {
        e.preventDefault();
        const prestadorId = parseInt(selectEl.value);
        if (!prestadorId) return;

        toggleLoader(true);

        const dadosAtualizados = {};

        // 1. Pega valores dos campos mapeados
        for (const key in mapeamentoCampos) {
            const campo = document.getElementById(mapeamentoCampos[key]);
            if (campo) {
                let valor = campo.value;
                if (campo.tagName === 'SELECT' && valor === '') valor = null;
                dadosAtualizados[key] = valor;
            }
        }

        // 2. CORREÇÃO PRINCIPAL: Pega valor do Banco Novo e monta o objeto correto
        const selectBanco = document.getElementById('selectBancoEditar');
        if (selectBanco && selectBanco.value) {
            const bancoId = Number(selectBanco.value);

            // Aqui enviamos o objeto bancoReferencia para o Java mapear corretamente
            dadosAtualizados.bancoReferencia = { id: bancoId };

            // Preenche legado para garantir compatibilidade visual imediata
            const option = selectBanco.options[selectBanco.selectedIndex];
            dadosAtualizados.codigoBanco = option.dataset.codigo;
            dadosAtualizados.banco = option.dataset.nome;
        } else {
            // Se o usuário limpou o banco, enviamos null para remover o vínculo
            dadosAtualizados.bancoReferencia = null;
            dadosAtualizados.codigoBanco = null;
            dadosAtualizados.banco = null;
        }

        dadosAtualizados.id = prestadorId;
        // Mantém o status ativo original
        dadosAtualizados.ativo = todosOsPrestadores.find(p => p.id === prestadorId)?.ativo;

        try {
            const response = await fetchComAuth(`http://localhost:8080/index/prestadores/${prestadorId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dadosAtualizados)
            });

            if (!response.ok) throw new Error("Falha ao atualizar.");

            mostrarToast("Atualizado com sucesso!", 'success');
            bootstrap.Modal.getInstance(modalEl).hide();
            await carregarTabelaPrestadores(getColunasAtuaisPorRole());
        } catch (error) {
            mostrarToast(error.message, 'error');
        } finally {
            toggleLoader(false);
        }
    });
}