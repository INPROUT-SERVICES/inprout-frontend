// Variável global para gerenciar as instâncias do Choices.js
const choicesInstances = new Map();

/**
 * Aplica o Choices.js em um elemento <select> pelo ID.
 */
function aplicarChoices(selectId, placeholderValue = 'Selecione uma opção') {
    const elemento = document.getElementById(selectId);
    if (!elemento) return;

    if (choicesInstances.has(selectId)) {
        choicesInstances.get(selectId).destroy();
        choicesInstances.delete(selectId);
    }

    const instance = new Choices(elemento, {
        searchEnabled: true,
        itemSelectText: '',
        noResultsText: 'Nenhum resultado encontrado',
        searchPlaceholderValue: 'Buscar...',
        placeholder: true,
        placeholderValue: placeholderValue,
        shouldSort: false,
        position: 'bottom',
        searchResultLimit: 10,
        // Configuração para busca mais exata (resolve o problema de mostrar parecidos)
        fuseOptions: {
            threshold: 0.1, // 0.0 = exato, 0.6 = padrão (frouxo). 0.1 garante que só traga muito parecidos.
            distance: 100   // Distância da busca, padrão funciona bem com threshold baixo
        }
    });

    choicesInstances.set(selectId, instance);
}

function exibirCarregando(selectId) {
    const elemento = document.getElementById(selectId);
    if (!elemento) return;

    if (choicesInstances.has(selectId)) {
        choicesInstances.get(selectId).destroy();
        choicesInstances.delete(selectId);
    }

    elemento.innerHTML = '<option value="">Carregando dados...</option>';
    elemento.disabled = true;

    const instance = new Choices(elemento, {
        searchEnabled: false,
        placeholder: true,
        placeholderValue: 'Aguarde...',
        itemSelectText: '',
        position: 'bottom',
    });
    
    choicesInstances.set(selectId, instance);
}

async function inicializarPrestadores() {
    const form = document.getElementById("formAdicionarPrestador");
    if (form) {
        form.addEventListener("submit", async (e) => {
            e.preventDefault();

            const getValor = (id) => {
                const elemento = document.getElementById(id);
                return elemento?.value?.trim() || null;
            };

            const selectBanco = document.getElementById('selectBancoCadastro');
            const bancoOption = selectBanco.options[selectBanco.selectedIndex];

            let bancoId = null;
            let codigoBancoLegado = null;
            let nomeBancoLegado = null;

            if (selectBanco.value) {
                bancoId = Number(selectBanco.value);
                codigoBancoLegado = bancoOption.dataset.codigo;
                nomeBancoLegado = bancoOption.dataset.nome;
            }

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
                const response = await fetchComAuth("https://www.inproutservices.com.br/api/index/prestadores", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(prestador)
                });

                if (!response.ok) throw new Error("Erro ao salvar o prestador.");

                mostrarToast("Prestador salvo com sucesso!", "success");
                form.reset();
                selectBanco.value = ""; 

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

    await carregarTabelaPrestadores(getColunasAtuaisPorRole());

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
        const response = await fetchComAuth("https://www.inproutservices.com.br/api/index/prestadores");
        if (!response.ok) throw new Error("Erro ao buscar prestadores.");

        const todosOsPrestadores = await response.json();

        if (!Array.isArray(todosOsPrestadores) || todosOsPrestadores.length === 0) {
            thead.innerHTML = "<tr><th>Nenhum dado encontrado</th></tr>";
            tbody.innerHTML = "";
            return;
        }

        thead.innerHTML = `<tr>${campos.map(campo => `<th>${titulosFormatados[campo] || campo}</th>`).join("")}</tr>`;

        tbody.innerHTML = todosOsPrestadores.map(prestador => {
            const linhaHtml = campos.map(campo => {
                if (campo === 'status') {
                    const statusClass = prestador.ativo ? 'active' : 'inactive';
                    return `<td><span class="status-indicator ${statusClass}"></span></td>`;
                }
                if (campo === 'banco') {
                    const codigo = prestador.codigoBanco || "";
                    const nome = prestador.banco || "";
                    const display = (codigo && nome) ? `${codigo} - ${nome}` : (codigo || nome || "");
                    return `<td>${display}</td>`;
                }
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

// Busca TODOS os prestadores (Usado no EDITAR para poder selecionar qualquer um)
async function preencherSelectComTodosPrestadores(elementoSelect) {
    const urlPrestadores = "https://www.inproutservices.com.br/api/index/prestadores";
    const selectId = elementoSelect.id;

    try {
        const response = await fetchComAuth(urlPrestadores);
        
        if (choicesInstances.has(selectId)) {
            choicesInstances.get(selectId).destroy();
            choicesInstances.delete(selectId);
        }
        
        if (!response.ok) throw new Error("Erro ao carregar lista.");
        const prestadores = await response.json();

        elementoSelect.innerHTML = '<option value="">Selecione o prestador</option>';
        elementoSelect.disabled = false;

        prestadores.forEach(prestador => {
            const opt = document.createElement("option");
            opt.value = prestador.id;
            opt.textContent = `${prestador.codigoPrestador} - ${prestador.prestador}`;
            elementoSelect.appendChild(opt);
        });

        aplicarChoices(selectId, 'Selecione o prestador');

    } catch (error) {
        console.error("Erro ao preencher select:", error);
        elementoSelect.innerHTML = '<option value="">Erro ao carregar</option>';
        mostrarToast("Erro ao carregar lista de prestadores.", 'error');
        aplicarChoices(selectId, 'Erro ao carregar');
    }
}

// [NOVO] Busca APENAS prestadores ATIVOS (Usado no DESATIVAR)
async function preencherSelectComPrestadoresAtivos(elementoSelect) {
    const urlPrestadoresAtivos = "https://www.inproutservices.com.br/api/index/prestadores/ativos"; // Endpoint filtrado
    const selectId = elementoSelect.id;

    try {
        const response = await fetchComAuth(urlPrestadoresAtivos);
        
        if (choicesInstances.has(selectId)) {
            choicesInstances.get(selectId).destroy();
            choicesInstances.delete(selectId);
        }
        
        if (!response.ok) throw new Error("Erro ao carregar lista de ativos.");
        const prestadores = await response.json();

        elementoSelect.innerHTML = '<option value="">Selecione o prestador ativo</option>';
        elementoSelect.disabled = false;

        if (prestadores.length === 0) {
            elementoSelect.innerHTML = '<option value="">Nenhum prestador ativo</option>';
        } else {
            prestadores.forEach(prestador => {
                const opt = document.createElement("option");
                opt.value = prestador.id;
                opt.textContent = `${prestador.codigoPrestador} - ${prestador.prestador}`;
                elementoSelect.appendChild(opt);
            });
        }

        aplicarChoices(selectId, 'Selecione o prestador ativo');

    } catch (error) {
        console.error("Erro ao preencher select:", error);
        elementoSelect.innerHTML = '<option value="">Erro ao carregar</option>';
        mostrarToast("Erro ao carregar lista de ativos.", 'error');
        aplicarChoices(selectId, 'Erro ao carregar');
    }
}

// Busca APENAS prestadores DESATIVADOS (Usado no ATIVAR)
async function preencherSelectComPrestadoresDesativados(elementoSelect) {
    const urlPrestadoresDesativados = "https://www.inproutservices.com.br/api/index/prestadores/desativados";
    const selectId = elementoSelect.id;

    try {
        const response = await fetchComAuth(urlPrestadoresDesativados);
        
        if (choicesInstances.has(selectId)) {
            choicesInstances.get(selectId).destroy();
            choicesInstances.delete(selectId);
        }

        if (!response.ok) throw new Error("Erro ao carregar lista.");
        const prestadores = await response.json();

        elementoSelect.innerHTML = '<option value="">Selecione o prestador desativado</option>';
        elementoSelect.disabled = false;

        if (prestadores.length === 0) {
            elementoSelect.innerHTML = '<option value="">Nenhum prestador inativo</option>';
        } else {
            prestadores.forEach(prestador => {
                const opt = document.createElement("option");
                opt.value = prestador.id;
                opt.textContent = `${prestador.codigoPrestador} - ${prestador.prestador}`;
                elementoSelect.appendChild(opt);
            });
        }

        aplicarChoices(selectId, 'Selecione o prestador desativado');

    } catch (error) {
        console.error("Erro:", error);
        elementoSelect.innerHTML = '<option value="">Erro ao carregar</option>';
        mostrarToast("Erro ao carregar lista.", 'error');
        aplicarChoices(selectId, 'Erro ao carregar');
    }
}

async function carregarSelectBancosDinamicamente() {
    const selectsIds = ['selectBancoCadastro', 'selectBancoEditar'];

    try {
        const response = await fetchComAuth('https://www.inproutservices.com.br/api/geral/bancos');
        if (!response.ok) return;

        const bancos = await response.json();
        bancos.sort((a, b) => a.codigo.localeCompare(b.codigo));

        selectsIds.forEach(id => {
            const selectEl = document.getElementById(id);
            if (!selectEl) return;
            const valorAtual = selectEl.value;
            selectEl.innerHTML = '<option value="">Selecione o banco...</option>';
            bancos.forEach(banco => {
                const option = document.createElement('option');
                option.value = banco.id;
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
    // --- Modal de Edição (Mostra TODOS) ---
    const modalEditar = document.getElementById("modalEditarPrestador");
    if (modalEditar) {
        modalEditar.addEventListener("show.bs.modal", () => {
            const selectEl = document.getElementById("selectPrestadorEditar");
            if (selectEl) {
                exibirCarregando("selectPrestadorEditar");
                preencherSelectComTodosPrestadores(selectEl);
            }
            carregarSelectBancosDinamicamente();
        });
    }

    // --- Modal de Desativação (Mostra só ATIVOS) ---
    const modalDesativar = document.getElementById("modalDesativarPrestador");
    if (modalDesativar) {
        modalDesativar.addEventListener("show.bs.modal", () => {
            const selectEl = document.getElementById("selectPrestadorDesativar");
            if (selectEl) {
                exibirCarregando("selectPrestadorDesativar");
                // CORRIGIDO: Usa a função de ativos
                preencherSelectComPrestadoresAtivos(selectEl);
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

    if (!modalEl) return;

    modalEl.addEventListener('show.bs.modal', () => {
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
            mostrarToast("Selecione um prestador.", "warning");
            return;
        }
        toggleLoader(true);
        try {
            // Busca a lista de ATIVOS para encontrar o objeto (já que o select só tem ativos)
            const prestadoresResponse = await fetchComAuth("https://www.inproutservices.com.br/api/index/prestadores/ativos");
            const prestadores = await prestadoresResponse.json();
            const selecionado = prestadores.find(p => p.id == prestadorId);
            if (!selecionado) throw new Error('Prestador não encontrado.');
            
            const response = await fetchComAuth(`https://www.inproutservices.com.br/api/index/prestadores/desativar/${selecionado.codigoPrestador}`, { method: 'PUT' });
            if (!response.ok) throw new Error('Falha ao desativar.');

            mostrarToast("Desativado com sucesso!", 'success');
            bootstrap.Modal.getInstance(modalEl).hide();
            await carregarTabelaPrestadores(getColunasAtuaisPorRole());
        } catch (error) {
            mostrarToast(error.message, 'error');
        } finally {
            toggleLoader(false);
        }
    });
}

function configurarModalAtivarPrestador() {
    const modalEl = document.getElementById("modalAtivarPrestador");
    const form = document.getElementById("formAtivarPrestador");
    const select = document.getElementById("selectPrestadorAtivar");
    const btnConfirmar = document.getElementById("btnConfirmarAtivar");
    const aviso = document.getElementById("avisoPrestadorSelecionadoAtivar");

    if (!modalEl) return;

    modalEl.addEventListener('show.bs.modal', () => {
        exibirCarregando("selectPrestadorAtivar");
        // Busca apenas DESATIVADOS
        preencherSelectComPrestadoresDesativados(select);
        
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
        if (!prestadorId) return;
        toggleLoader(true);
        try {
            // Busca a lista de DESATIVADOS
            const resLista = await fetchComAuth("https://www.inproutservices.com.br/api/index/prestadores/desativados");
            const lista = await resLista.json();
            const selecionado = lista.find(p => p.id == prestadorId);
            if (!selecionado) throw new Error('Não encontrado.');

            const response = await fetchComAuth(`https://www.inproutservices.com.br/api/index/prestadores/ativar/${selecionado.codigoPrestador}`, { method: 'PUT' });
            if (!response.ok) throw new Error('Falha ao ativar.');

            mostrarToast("Ativado com sucesso!", 'success');
            bootstrap.Modal.getInstance(modalEl).hide();
            await carregarTabelaPrestadores(getColunasAtuaisPorRole());
        } catch (error) {
            mostrarToast(error.message, 'error');
        } finally {
            toggleLoader(false);
        }
    });
}

function getColunasAtuaisPorRole() {
    const role = (localStorage.getItem("role") || "").trim().toUpperCase();
    const map = {
        ADMIN: ['codigoPrestador', 'prestador', 'razaoSocial', 'cidade', 'uf', 'regiao', 'cpf', 'cnpj', 'banco', 'agencia', 'conta', 'tipoDeConta', 'telefone', 'email', 'tipoPix', 'chavePix', 'observacoes'],
        COORDINATOR: ['codigoPrestador', 'prestador', 'cidade', 'uf', 'regiao', 'telefone', 'email'],
        MANAGER: ['codigoPrestador', 'prestador', 'cidade', 'uf', 'regiao', 'telefone', 'email'],
        CONTROLLER: ['codigoPrestador', 'prestador', 'cidade', 'uf', 'regiao', 'telefone', 'email'],
        ASSISTANT: ['codigoPrestador', 'prestador', 'razaoSocial', 'cidade', 'uf', 'regiao', 'cpf', 'cnpj', 'banco', 'agencia', 'conta', 'tipoDeConta', 'telefone', 'email', 'tipoPix', 'chavePix', 'observacoes']
    };
    return map[role] ?? ['codigoPrestador', 'prestador'];
}

function configurarModalEditarPrestador() {
    const modalEl = document.getElementById("modalEditarPrestador");
    if (!modalEl) return;

    const selectEl = document.getElementById("selectPrestadorEditar");
    const formCampos = document.getElementById("formCamposPrestador");
    const formEl = document.getElementById("formEditarPrestador");
    const btnSalvar = document.getElementById("btnSalvarEdicaoPrestador");
    let todosOsPrestadores = [];

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
        for (const key in mapeamentoCampos) {
            const campoId = mapeamentoCampos[key];
            if (campoId) {
                const campo = document.getElementById(campoId);
                if (campo) campo.value = prestador[key] ?? '';
            }
        }
        const selectBanco = document.getElementById('selectBancoEditar');
        if (selectBanco) {
            if (prestador.bancoReferencia && prestador.bancoReferencia.id) {
                selectBanco.value = prestador.bancoReferencia.id;
            } else {
                const options = Array.from(selectBanco.options);
                const optionEncontrada = options.find(opt => opt.dataset.codigo === prestador.codigoBanco);
                selectBanco.value = optionEncontrada ? optionEncontrada.value : "";
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
        resetarFormulario();
        try {
            toggleLoader(true);
            await carregarSelectBancosDinamicamente();
            // Para editar, buscamos TODOS (ativos e inativos)
            await preencherSelectComTodosPrestadores(selectEl);

            const response = await fetchComAuth("https://www.inproutservices.com.br/api/index/prestadores");
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

    formCampos.addEventListener('change', (e) => {
        if (e.target.classList.contains('toggle-editar')) {
            const target = e.target.getAttribute('data-target');
            const input = document.querySelector(target);
            if (input) {
                input.disabled = !e.target.checked;
                if (e.target.checked) input.focus();
            }
        }
    });

    formEl.addEventListener('submit', async (e) => {
        e.preventDefault();
        const prestadorId = parseInt(selectEl.value);
        if (!prestadorId) return;
        toggleLoader(true);

        const dadosAtualizados = {};
        for (const key in mapeamentoCampos) {
            const campo = document.getElementById(mapeamentoCampos[key]);
            if (campo) {
                let valor = campo.value;
                if (campo.tagName === 'SELECT' && valor === '') valor = null;
                dadosAtualizados[key] = valor;
            }
        }

        const selectBanco = document.getElementById('selectBancoEditar');
        if (selectBanco && selectBanco.value) {
            const bancoId = Number(selectBanco.value);
            dadosAtualizados.bancoReferencia = { id: bancoId };
            const option = selectBanco.options[selectBanco.selectedIndex];
            dadosAtualizados.codigoBanco = option.dataset.codigo;
            dadosAtualizados.banco = option.dataset.nome;
        } else {
            dadosAtualizados.bancoReferencia = null;
            dadosAtualizados.codigoBanco = null;
            dadosAtualizados.banco = null;
        }

        dadosAtualizados.id = prestadorId;
        dadosAtualizados.ativo = todosOsPrestadores.find(p => p.id === prestadorId)?.ativo;

        try {
            const response = await fetchComAuth(`https://www.inproutservices.com.br/api/index/prestadores/${prestadorId}`, {
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