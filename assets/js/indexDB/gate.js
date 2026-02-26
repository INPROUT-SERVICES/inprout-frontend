// Função para formatar a data (YYYY-MM-DD -> DD/MM/YYYY)
function formatarDataSimples(dataStr) {
    if (!dataStr) return 'N/A';
    const [ano, mes, dia] = dataStr.split('-');
    return `${dia}/${mes}/${ano}`;
}

// Carrega a tabela de GATEs
async function carregarTabelaGates() {
    const tbody = document.getElementById("tbody-gate");
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" class="text-center">Carregando...</td></tr>';

    try {
        // CORREÇÃO 1: Roteamento Nginx (Adicionado /faturamento)
        const response = await fetchComAuth("/api/faturamento/gates");
        if (!response.ok) throw new Error("Falha ao carregar GATEs.");

        const gates = await response.json();

        if (gates.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Nenhum GATE cadastrado.</td></tr>';
            return;
        }

        tbody.innerHTML = gates.map(gate => `
            <tr>
                <td>${gate.nome}</td>
                <td>${formatarDataSimples(gate.dataInicio)}</td>
                <td>${formatarDataSimples(gate.dataFim)}</td>
                <td>${formatarMoeda(gate.valorFaturado)}</td>
                <td>
                    <button class="btn btn-sm btn-outline-danger btn-excluir-gate" 
                            data-id="${gate.id}" 
                            data-nome="${gate.nome}" 
                            title="Excluir GATE">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');

    } catch (err) {
        console.error("Erro ao carregar tabela de GATEs:", err);
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Erro ao carregar dados.</td></tr>`;
        mostrarToast(err.message, 'error');
    }
}

// Configura o modal de criação
function configurarModalCriarGate() {
    const modalEl = document.getElementById('modalCriarGate');
    if (!modalEl) return;

    const modal = new bootstrap.Modal(modalEl);
    const form = document.getElementById('formCriarGate');
    const btnSalvar = document.getElementById('btnSalvarGate');

    // Inicializa os seletores de data
    const flatpickrConfig = { locale: "pt", dateFormat: "d/m/Y" };
    flatpickr("#gateDataInicio", flatpickrConfig);
    flatpickr("#gateDataFim", flatpickrConfig);

    // Reseta o formulário ao abrir
    modalEl.addEventListener('show.bs.modal', () => {
        form.reset();
    });

    // Evento de submit
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        btnSalvar.disabled = true;
        btnSalvar.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Salvando...`;

        const payload = {
            nome: document.getElementById('gateNome').value,
            dataInicio: document.getElementById('gateDataInicio').value,
            dataFim: document.getElementById('gateDataFim').value
        };

        try {
            // CORREÇÃO 2: Roteamento Nginx (Adicionado /faturamento)
            const response = await fetchComAuth("/api/faturamento/gates", {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.message || 'Erro ao criar GATE.');
            }

            mostrarToast('GATE criado com sucesso!', 'success');
            modal.hide();
            await carregarTabelaGates();

        } catch (error) {
            mostrarToast(error.message, 'error');
        } finally {
            btnSalvar.disabled = false;
            btnSalvar.innerHTML = 'Salvar';
        }
    });
}

// Configura o modal de exclusão
function configurarModalExcluirGate() {
    const modalEl = document.getElementById('modalExcluirGate');
    if (!modalEl) return;

    const modal = new bootstrap.Modal(modalEl);
    const btnConfirmar = document.getElementById('btnConfirmarExclusaoGate');
    const nomeGateSpan = document.getElementById('nomeGateExcluir');
    let gateIdParaExcluir = null;

    // Evento de clique na tabela (delegação)
    document.getElementById('tbody-gate').addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-excluir-gate');
        if (btn) {
            gateIdParaExcluir = btn.dataset.id;
            nomeGateSpan.textContent = btn.dataset.nome;
            modal.show();
        }
    });

    // Evento de clique no botão de confirmar
    btnConfirmar.addEventListener('click', async () => {
        if (!gateIdParaExcluir) return;

        btnConfirmar.disabled = true;
        btnConfirmar.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Excluindo...`;

        try {
            // CORREÇÃO 3: Roteamento Nginx (Adicionado /faturamento)
            const response = await fetchComAuth(`/api/faturamento/gates/${gateIdParaExcluir}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error('Falha ao excluir o GATE.');
            }

            mostrarToast('GATE excluído com sucesso!', 'success');
            modal.hide();
            await carregarTabelaGates();

        } catch (error) {
            mostrarToast(error.message, 'error');
        } finally {
            btnConfirmar.disabled = false;
            btnConfirmar.innerHTML = 'Sim, Excluir';
            gateIdParaExcluir = null;
        }
    });
}

// Inicializa tudo quando a aba de GATEs for clicada
document.querySelector('.filter-card[data-filter="gate"]')?.addEventListener('click', () => {
    carregarTabelaGates();
});

// Inicialização dos listeners dos modais
configurarModalCriarGate();
configurarModalExcluirGate();