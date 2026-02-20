function toggleLoader(ativo = true) {
    const overlay = document.getElementById("overlay-loader");
    if (ativo) {
        overlay.classList.remove("d-none");
    } else {
        overlay.classList.add("d-none");
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    await inicializarPagina();

    const botoesFiltro = document.querySelectorAll('.filter-card');
    const conteudos = document.querySelectorAll('.conteudo-filtro');

    // Define o filtro ativo inicial
    let filtroAtivo = document.querySelector('.filter-card.active')?.getAttribute('data-filter') || 'etapas';
    controlarVisibilidadeDasAcoes(filtroAtivo); // Aplica regra de visibilidade de acordo com o role

    // Adiciona evento de clique em cada botão de filtro
    botoesFiltro.forEach(botao => {
        botao.addEventListener('click', () => {
            const filtro = botao.getAttribute('data-filter');
            filtroAtivo = filtro;

            // Atualiza estado visual dos botões
            botoesFiltro.forEach(b => b.classList.remove('active'));
            botao.classList.add('active');

            // Esconde todos os conteúdos e mostra apenas o do filtro selecionado
            conteudos.forEach(div => div.classList.add('d-none'));
            const alvo = document.getElementById(`conteudo-${filtro}`);
            if (alvo) alvo.classList.remove('d-none');

            // Aplica regras de visibilidade nos botões de ação
            controlarVisibilidadeDasAcoes(filtro);
        });
    });
});

async function inicializarPagina() {
    // --- Bloco 1: Configuração Inicial de Componentes e Formulários ---
    declareVariaveisGlobais();
    configurarFormularioAdicionarEtapa();
    configurarFormularioAdicionarDetalhada();
    configurarModalEditar();
    configurarEventosDeModais();
    configurarSelectIndiceAuto();

    // Configura os modais dos Prestadores (adiciona os listeners de evento)
    configurarModaisPrestadores();
    configurarModalDesativarPrestador();
    configurarModalAtivarPrestador();
    configurarModalEditarPrestador();

    // --- Bloco 2: Carregamento de Dados Iniciais da API ---
    await carregarTabelaEtapas();
    await preencherSelectComEtapas(selectEtapa);
    await preencherSelectComEtapas(selectEtapaEditar);

    // Carrega a tabela de prestadores pela primeira vez
    await inicializarPrestadores();

    // --- Bloco 3: Lógica de UI Pós-Carregamento ---
    // Aplica visibilidade inicial com base no filtro ativo
    let filtroAtivo = document.querySelector('.filter-card.active')?.getAttribute('data-filter') || 'etapas';
    controlarVisibilidadeDasAcoes(filtroAtivo);

    // Esconde o loader ao final de tudo
    toggleLoader(false);
}

function controlarVisibilidadeDasAcoes(filtroAtivo) {
    const role = (localStorage.getItem("role") || "").trim().toUpperCase();

    // 1. Array com todos os containers de ação para facilitar a iteração
    // ADICIONADO "gate" AO ARRAY
    const todosOsContainers = [
        { id: 'acoes-etapas', filtro: 'etapas', permissoes: ["COORDINATOR", "ASSISTANT", "ADMIN"] },
        { id: 'acoes-prestadores', filtro: 'prestadores', permissoes: ["ADMIN", "ASSISTANT", "CONTROLLER"] },
        { id: 'acoes-lpu', filtro: 'lpu', permissoes: ["ADMIN", "ASSISTANT", "CONTROLLER"] },
        // --- NOVA LINHA ---
        { id: 'acoes-gate', filtro: 'gate', permissoes: ["ADMIN", "ASSISTANT"] }
    ];

    // 2. Itera sobre cada container para decidir se ele deve ser mostrado ou escondido
    todosOsContainers.forEach(container => {
        const elemento = document.getElementById(container.id);
        if (!elemento) {
            // Se o elemento não existir no HTML, apenas ignora e vai para o próximo.
            return;
        }

        // A REGRA DE NEGÓCIO É APLICADA AQUI
        const deveMostrar = (filtroAtivo === container.filtro) && container.permissoes.includes(role);

        if (deveMostrar) {
            // Usamos 'display: flex' pois 'bloco-etapas-header' usa flexbox
            elemento.style.display = "flex";
        } else {
            // Esconde com !important para garantir que sobreponha o CSS
            elemento.style.setProperty('display', 'none', 'important');
        }
    });
}

function declareVariaveisGlobais() {
    window.form = document.getElementById("formAdicionarEtapa");
    window.formDetalhada = document.getElementById("formAdicionarEtapaDetalhada");
    window.modalDetalhada = document.getElementById("modalAdicionarEtapaDetalhada");
    window.modalAdicionarEtapa = document.getElementById("modalAdicionarEtapa");
    window.modalEditarDetalhada = document.getElementById("modalEditarEtapaDetalhada");
    window.selectEtapa = document.getElementById("etapaSelecionada");
    window.selectEtapaEditar = document.getElementById("etapaSelecionadaEditar");
    window.inputIndice = document.getElementById("indiceEtapaDetalhada");
    window.listaEditar = document.getElementById("listaEtapasDetalhadasEditar");
    window.btnSalvarEdicoes = document.getElementById("btnSalvarEdicoesEtapasDetalhadas");
    window.urlEtapas = "/api/index/etapas";
    window.etapasDisponiveis = [];
}

function formatarStatus(statusCodigo) {
    const mapa = {
        "TRABALHADO": "Trabalhado",
        "TRABALHO_PARCIAL": "Trabalho Parcial",
        "NAO_TRABALHADO": "Não trabalhado",
        "NAO_APLICAVEL": "N/A"
    };
    // Se não achar no mapa, devolve o próprio código (segurança)
    return mapa[statusCodigo] || statusCodigo;
}

function formatarBadges(statusArray) {
    // Mapa: CHAVE (Vem do Backend) -> VALOR (Classe CSS)
    const mapaCor = {
        "TRABALHADO": 'success',
        "TRABALHO_PARCIAL": 'warning',
        "NAO_TRABALHADO": 'danger',
        "NAO_APLICAVEL": 'secondary',
        // Fallback para caso venha a descrição antiga
        "Trabalhado": 'success',
        "Trabalho Parcial": 'warning',
        "Não trabalhado": 'danger'
    };

    // Mapa: CHAVE (Vem do Backend) -> TEXTO (Para exibir na tela)
    const mapaTexto = {
        "TRABALHADO": "Trabalhado",
        "TRABALHO_PARCIAL": "Trabalho Parcial",
        "NAO_TRABALHADO": "Não trabalhado",
        "NAO_APLICAVEL": "N/A"
    };

    if (!Array.isArray(statusArray)) {
        // Se vier null ou string única, transforma em array para evitar erro
        if (!statusArray) return '';
        statusArray = [statusArray];
    }

    return statusArray.map(status => {
        // Pega a cor baseada no status (ou usa cinza 'secondary' se não achar)
        const cor = mapaCor[status] || 'secondary';
        // Pega o texto bonitinho (ou usa o próprio status se não tiver tradução)
        const texto = mapaTexto[status] || status;

        return `<span class="badge-status badge-${cor}">${texto}</span>`;
    }).join(' ');
}

function formatarTitulo(campo) {
    return campo.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').toUpperCase();
}

function gerarCabecalho(campos) {
    const thead = document.querySelector('thead');
    thead.innerHTML = '';
    const tr = document.createElement('tr');
    campos.forEach(c => {
        const th = document.createElement('th');
        th.textContent = formatarTitulo(c);
        tr.appendChild(th);
    });
    thead.appendChild(tr);
}

async function carregarTabelaEtapas() {
    // 1. Dicionário para os títulos da tabela de Etapas.
    // Usei 'nome' como chave para combinar com a propriedade 'row.nome' que você usa abaixo.
    const titulosEtapas = {
        codigo: 'Código',
        nome: 'Descrição', // Título amigável para a propriedade 'nome'
    };

    // 2. Selecionando os elementos da tabela pelos seus IDs
    const thead = document.getElementById("thead-etapas");
    const tbody = document.getElementById("table-body");

    // Define os campos para criar as colunas. O último é para o botão.
    const campos = ['codigo', 'nome', ''];

    // 3. Gerando o cabeçalho diretamente, usando o dicionário.
    // A chamada para gerarCabecalho() foi removida.
    thead.innerHTML = `
        <tr>
            ${campos.map(campo => `<th>${titulosEtapas[campo] || ''}</th>`).join('')}
        </tr>
    `;

    try {
        const res = await fetchComAuth(urlEtapas);
        if (!res.ok) throw new Error('Falha ao carregar etapas da API.');
        const data = await res.json();

        etapasDisponiveis = data;
        tbody.innerHTML = ""; // Limpa o corpo da tabela antes de adicionar novas linhas

        data.forEach(row => {
            const tr = document.createElement("tr");
            tr.classList.add("main-row");

            // Note que aqui você usa 'row.nome', por isso a chave no dicionário foi ajustada.
            tr.innerHTML = `
                <td>${row.codigo ?? ''}</td>
                <td>${row.nome ?? ''}</td> 
                <td><button class="btn btn-sm btn-outline-secondary">Ocultar</button></td>
            `;
            tbody.appendChild(tr);

            // O restante do seu código para criar a linha de detalhes está perfeito e permanece igual.
            const detalheTr = document.createElement("tr");
            detalheTr.classList.add("detalhe-row");
            if (row.codigo === '01') {
                detalheTr.style.display = "none";
            }

            detalheTr.innerHTML = `
                <td colspan="3">
                    <div class="lista-detalhes-cards">
                        ${row.etapasDetalhadas?.map(d => `
                            <div class="card-detalhe">
                                <div class="topo">
                                    <strong>${d.indice || ''}</strong> — ${d.nome || ''}
                                </div>
                                <div class="status">
                                    Status: ${formatarBadges(Array.isArray(d.status) ? d.status : [d.status])}
                                </div>
                            </div>`).join('') || '<div class="text-muted">Nenhuma etapa detalhada cadastrada.</div>'}
                    </div>
                </td>
            `;
            tbody.appendChild(detalheTr);

            const btn = tr.querySelector("button");
            if (row.codigo === '01') btn.textContent = "Mostrar";

            btn.addEventListener("click", () => {
                const ocultar = btn.textContent === "Ocultar";
                detalheTr.style.display = ocultar ? "none" : "";
                btn.textContent = ocultar ? "Mostrar" : "Ocultar";
            });
        });
    } catch (err) {
        console.error("Erro ao carregar tabela de etapas:", err);
        mostrarToast("Erro ao carregar tabela de etapas.", "error");
    }
}

function configurarFormularioAdicionarEtapa() {
    form.addEventListener("submit", async (e) => { // Tornamos o listener async
        e.preventDefault();
        const codigo = document.getElementById("indiceEtapa").value.trim();
        const descricao = document.getElementById("nomeEtapa").value.trim();

        if (!codigo || !descricao) return mostrarToast("Preencha todos os campos.", 'error');

        try {
            await fetchComAuth(urlEtapas, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ codigo, descricao }) // Corrigido para 'nome' se for o caso no backend
            });

            mostrarToast("Etapa adicionada com sucesso!", 'success');
            bootstrap.Modal.getInstance(modalAdicionarEtapa).hide();
            form.reset();

            // --- INÍCIO DA ATUALIZAÇÃO ---

            // 1. Invalide o cache de etapas
            window.etapasDisponiveis = null;

            // 2. Recarregue os dados na tabela e nos selects
            await carregarTabelaEtapas();
            await preencherSelectComEtapas(selectEtapa);
            await preencherSelectComEtapas(selectEtapaEditar);

            // --- FIM DA ATUALIZAÇÃO ---

        } catch (error) {
            mostrarToast("Erro ao adicionar etapa.", 'error');
        }
    });
}

function configurarFormularioAdicionarDetalhada() {
    formDetalhada.addEventListener("submit", e => {
        e.preventDefault();

        const etapa = selectEtapa.value;
        const nome = document.getElementById("nomeEtapaDetalhada").value.trim();
        const statusSelecionados = Array.from(document.getElementById("statusEtapaDetalhada").selectedOptions)
            .map(opt => opt.value);

        if (!etapa || !nome || statusSelecionados.length === 0) return mostrarToast("Preencha todos os campos.", 'error');

        fetchComAuth(`${urlEtapas}/${etapa}/detalhadas`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nome: nome, status: statusSelecionados })
        })
            .then(res => res.ok ? res.json() : Promise.reject())
            .then(() => {
                mostrarToast("Etapa detalhada adicionada com sucesso!", 'success');
                bootstrap.Modal.getInstance(modalDetalhada).hide();
                formDetalhada.reset();
                carregarTabelaEtapas();
            })
            .catch(() => mostrarToast("Erro ao adicionar etapa detalhada.", 'error'));
    });
}

function preencherCodigoNovaEtapa() {
    const maiorCodigo = Math.max(0, ...etapasDisponiveis.map(e => parseInt(e.codigo)).filter(n => !isNaN(n)));
    document.getElementById("indiceEtapa").value = String(maiorCodigo + 1).padStart(2, "0");
}

function configurarEventosDeModais() {
    modalAdicionarEtapa.addEventListener("show.bs.modal", preencherCodigoNovaEtapa);

    modalEditarDetalhada.addEventListener("show.bs.modal", () => {
        // Limpa a lista de itens da última edição
        listaEditar.innerHTML = '';

        // Reseta o valor do select para a opção padrão ("Selecione a etapa")
        if (window.selectEtapaEditar) {
            window.selectEtapaEditar.value = "";
        }
    });
}

async function preencherSelectComEtapas(elementoSelect) {
    try {
        if (!window.etapasDisponiveis || window.etapasDisponiveis.length === 0) {
            console.log("Buscando etapas da API...");
            const res = await fetchComAuth(urlEtapas);
            window.etapasDisponiveis = await res.json();
        }

        // Limpa o select antes de adicionar as novas opções
        elementoSelect.innerHTML = '<option value="">Selecione a etapa</option>';

        // Usa a lista já carregada (seja da API ou do cache)
        window.etapasDisponiveis.forEach(etapa => {
            const opt = document.createElement("option");
            opt.value = etapa.codigo;
            opt.textContent = `${etapa.codigo} - ${etapa.nome}`;
            elementoSelect.appendChild(opt);
        });

    } catch (err) {
        mostrarToast("Erro ao carregar lista de etapas.", 'error');
        console.error("Falha ao preencher select de etapas:", err);
    }
}

function preencherCodigoNovaEtapa() {
    const maiorCodigo = Math.max(0, ...etapasDisponiveis.map(e => parseInt(e.codigo)).filter(n => !isNaN(n)));

    document.getElementById("indiceEtapa").value = String(maiorCodigo + 1).padStart(2, "0");
}

function configurarSelectIndiceAuto() {
    selectEtapa.addEventListener("change", function () {
        // Encontra a etapa principal selecionada
        const etapa = etapasDisponiveis.find(e => e.codigo === this.value);

        // Se nenhuma etapa for selecionada, limpa o campo
        if (!etapa) {
            inputIndice.value = "";
            return;
        }

        let maiorIndiceDetalhado = 0;

        // Verifica explicitamente se o array 'etapasDetalhadas' existe e não está vazio
        if (etapa.etapasDetalhadas && etapa.etapasDetalhadas.length > 0) {
            // Se existir, calcula o maior índice como antes
            maiorIndiceDetalhado = Math.max(...etapa.etapasDetalhadas.map(d => {
                // Adiciona uma verificação para garantir que d.indice exista
                const indiceNumerico = d.indice ? parseInt(d.indice.split(".")[1]) : 0;
                return isNaN(indiceNumerico) ? 0 : indiceNumerico;
            }));
        }

        inputIndice.value = `${etapa.codigo}.${String(maiorIndiceDetalhado + 1).padStart(2, "0")}`;
    });
}

function configurarModalEditar() {
    selectEtapaEditar.addEventListener("change", e => {
        renderizarEtapasDetalhadasParaEdicao(e.target.value);
    });

    btnSalvarEdicoes.addEventListener("click", () => {
        const codigo = selectEtapaEditar.value;
        const etapa = etapasDisponiveis.find(e => e.codigo === codigo);
        if (!etapa) return;

        const atualizadas = etapa.etapasDetalhadas.map((etapa, i) => {
            const indice = document.querySelector(`[data-edit-index="${i}"]`)?.value.trim();
            const nome = document.querySelector(`[data-edit-nome="${i}"]`)?.value.trim();
            const status = Array.from(document.querySelector(`[data-edit-status="${i}"]`)?.selectedOptions || []).map(opt => opt.value);
            return { ...etapa, indice, nome, status };
        });

        fetchComAuth(`${urlEtapas}/${codigo}/detalhadas/lote`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(atualizadas)
        })
            .then(res => res.ok ? res.json() : Promise.reject())
            .then(() => {
                mostrarToast("Etapas detalhadas atualizadas com sucesso!", "success");
                bootstrap.Modal.getInstance(modalEditarDetalhada).hide();
                carregarTabelaEtapas();
            })
            .catch(() => mostrarToast("Erro ao salvar alterações.", "error"));
    });
}

function renderizarEtapasDetalhadasParaEdicao(codigo) {
    const etapa = etapasDisponiveis.find(e => e.codigo === codigo);
    if (!etapa || !etapa.etapasDetalhadas?.length) {
        listaEditar.innerHTML = '<div class="text-muted">Nenhuma etapa detalhada encontrada.</div>';
        return;
    }

    // Aqui garantimos que o VALUE seja o código (para o backend entender)
    // E o TEXTO seja a descrição (para o usuário ler)
    listaEditar.innerHTML = etapa.etapasDetalhadas.map((d, i) => `
        <div class="card p-3 shadow-sm border rounded-3">
            <div class="mb-2">
                <label class="form-label">Índice</label>
                <input type="text" class="form-control" value="${d.indice || ''}" data-edit-index="${i}">
            </div>
            <div class="mb-2">
                <label class="form-label">Nome</label>
                <input type="text" class="form-control" value="${d.nome || ''}" data-edit-nome="${i}">
            </div>
            <div class="mb-2">
                <label class="form-label">Status</label>
                <select class="form-select" multiple data-edit-status="${i}">
                    <option value="TRABALHADO" ${d.status?.includes('TRABALHADO') || d.status?.includes('Trabalhado') ? 'selected' : ''}>Trabalhado</option>
                    <option value="NAO_TRABALHADO" ${d.status?.includes('NAO_TRABALHADO') || d.status?.includes('Não trabalhado') ? 'selected' : ''}>Não trabalhado</option>
                    <option value="TRABALHO_PARCIAL" ${d.status?.includes('TRABALHO_PARCIAL') || d.status?.includes('Trabalho Parcial') ? 'selected' : ''}>Trabalho Parcial</option>
                </select>
            </div>
        </div>
    `).join('');
}