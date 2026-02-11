// ==========================================================
// 1. ESTADO GLOBAL E UTILITÁRIOS (aprovacoes-state.js)
// ==========================================================

const API_BASE_URL = 'http://localhost:8080';
const userRole = (localStorage.getItem("role") || "").trim().toUpperCase();
const userId = localStorage.getItem('usuarioId');

// --- Variáveis de Dados Globais ---
window.todosOsLancamentosGlobais = [];
window.todasPendenciasMateriais = [];
window.todosHistoricoMateriais = [];
window.todasPendenciasComplementares = [];
window.todoHistoricoComplementares = [];
window.todasPendenciasAtividades = [];
window.minhasDocsPendentes = [];
window.minhasDocsHistorico = [];
window.dadosCpsGlobais = [];

// Variáveis de Datas Globais
window.histDataFim = new Date();
window.histDataInicio = new Date();
window.histDataInicio.setDate(window.histDataFim.getDate() - 30);

// --- Inicialização de Modais (Bootstrap) ---
const getModal = (id) => document.getElementById(id) ? new bootstrap.Modal(document.getElementById(id)) : null;

const modalAprovar = getModal('modalAprovarLancamento');
const modalComentar = getModal('modalComentarPrazo');
const modalEditar = getModal('modalEditarLancamento');
const modalRecusar = getModal('modalRecusarLancamento');
const modalComentarios = getModal('modalComentarios');
const modalAprovarMaterial = getModal('modalAprovarMaterial');
const modalRecusarMaterial = getModal('modalRecusarMaterial');
const modalAprovarComplementar = getModal('modalAprovarComplementar');
const modalRecusarComplementar = getModal('modalRecusarComplementar');
const modalAdiantamento = getModal('modalSolicitarAdiantamento');
const modalAlterarValorCPS = getModal('modalAlterarValorCPS');
const modalRecusarCPS = getModal('modalRecusarCPS');
const modalAprovarAdiantamento = getModal('modalAprovarAdiantamento');
const modalRecusarAdiantamento = getModal('modalRecusarAdiantamento');

// --- Funções Utilitárias ---
const formatarISO = (d) => d.toISOString().split('T')[0];

function parseDataBrasileira(dataString) {
    if (!dataString) return null;
    const [data, hora] = dataString.split(' ');
    const [dia, mes, ano] = data.split('/');
    return new Date(`${ano}-${mes}-${dia}T${hora || '00:00:00'}`);
}

function toggleLoader(ativo = true, containerSelector = '.content-loader-container') {
    const container = document.querySelector(containerSelector);
    if (container) {
        const overlay = container.querySelector(".overlay-loader");
        if (overlay) {
            overlay.classList.toggle("d-none", !ativo);
        }
    }
}

// --- FUNÇÃO DE TOAST (GLOBAL) ---
function mostrarToast(mensagem, tipo = 'success') {
    const toastElement = document.getElementById('toastMensagem');
    const toastBody = document.getElementById('toastTexto');

    if (!toastElement || !toastBody) return;

    const toast = new bootstrap.Toast(toastElement);

    toastElement.classList.remove('text-bg-success', 'text-bg-danger', 'text-bg-warning');

    if (tipo === 'success') {
        toastElement.classList.add('text-bg-success');
    } else if (tipo === 'error') {
        toastElement.classList.add('text-bg-danger');
    } else {
        toastElement.classList.add('text-bg-warning'); 
    }

    toastBody.textContent = mensagem;
    toast.show();
}

function setButtonLoading(button, isLoading) {
    if (!button) return;
    const spinner = button.querySelector('.spinner-border');
    button.disabled = isLoading;
    if (spinner) spinner.classList.toggle('d-none', !isLoading);
}

const formatarMoeda = (valor) => (valor || valor === 0) ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor) : '-';
const formatarData = (data) => data ? data.split('-').reverse().join('/') : '-';
const get = (obj, path, defaultValue = '-') => {
    const value = path.split('.').reduce((a, b) => (a && a[b] != null ? a[b] : undefined), obj);
    return value !== undefined ? value : defaultValue;
};

// =========================================================================
// FUNÇÕES DE AÇÃO GLOBAIS
// =========================================================================

// Atividades
function aprovarLancamento(id) {
    if (!modalAprovar) return;
    const elId = document.getElementById('aprovarLancamentoId');
    if(elId) elId.value = id;
    if (modalAprovar._element) delete modalAprovar._element.dataset.acaoEmLote;

    const bodyP = modalAprovar._element.querySelector('.modal-body p');
    if (bodyP) bodyP.textContent = "Você tem certeza que deseja aprovar este lançamento?";
    modalAprovar.show();
}

function recusarLancamento(id) {
    if (!modalRecusar) return;
    const elId = document.getElementById('recusarLancamentoId');
    if(elId) elId.value = id;
    document.getElementById('formRecusarLancamento').reset();
    if (modalRecusar._element) delete modalRecusar._element.dataset.acaoEmLote;
    modalRecusar.show();
}

function comentarLancamento(id) {
    if (!modalComentar) return;
    const elId = document.getElementById('comentarLancamentoId');
    if(elId) elId.value = id;
    document.getElementById('formComentarPrazo').reset();
    if (modalComentar._element) delete modalComentar._element.dataset.acaoEmLote;

    const modalTitle = modalComentar._element.querySelector('.modal-title');
    if (modalTitle) modalTitle.innerHTML = '<i class="bi bi-chat-left-text-fill text-warning me-2"></i>Comentar ou Solicitar Prazo';
    const labelData = modalComentar._element.querySelector('label[for="novaDataProposta"]');
    if (labelData) labelData.textContent = 'Sugerir Novo Prazo';

    modalComentar.show();
}

// Controller Actions
function aprovarLancamentoController(id) {
    if (!modalAprovar) return;
    const elId = document.getElementById('aprovarLancamentoId');
    if(elId) elId.value = id;
    if (modalAprovar._element) delete modalAprovar._element.dataset.acaoEmLote;

    const bodyP = modalAprovar._element.querySelector('.modal-body p');
    if (bodyP) bodyP.innerHTML = `Você tem certeza que deseja aprovar este lançamento?<br><span class="text-danger small"><b>Atenção:</b> Esta ação é final.</span>`;

    modalAprovar.show();
}

function recusarLancamentoController(id) {
    recusarLancamento(id);
}

function aprovarPrazoController(id) {
    if (!modalAprovar) return;
    const elId = document.getElementById('aprovarLancamentoId');
    if(elId) elId.value = id;
    if (modalAprovar._element) delete modalAprovar._element.dataset.acaoEmLote;

    const bodyP = modalAprovar._element.querySelector('.modal-body p');
    if (bodyP) bodyP.textContent = "Aprovar a solicitação de novo prazo feita pelo coordenador?";

    modalAprovar.show();
}

function recusarPrazoController(id) {
    if (!modalComentar) return;
    const elId = document.getElementById('comentarLancamentoId');
    if(elId) elId.value = id;
    if (modalComentar._element) delete modalComentar._element.dataset.acaoEmLote;

    const modalTitle = modalComentar._element.querySelector('.modal-title');
    if (modalTitle) modalTitle.innerHTML = '<i class="bi bi-calendar-x-fill text-danger me-2"></i>Recusar/Estabelecer Novo Prazo';

    const comentarioLabel = modalComentar._element.querySelector('label[for="comentarioCoordenador"]');
    if (comentarioLabel) comentarioLabel.textContent = 'Motivo da Recusa / Comentário (Obrigatório)';

    const dataLabel = modalComentar._element.querySelector('label[for="novaDataProposta"]');
    if (dataLabel) dataLabel.textContent = 'Definir Novo Prazo (Obrigatório)';

    modalComentar.show();
}

// Materiais
function aprovarMaterial(id) {
    if (!modalAprovarMaterial) return;
    const btn = document.getElementById('btnConfirmarAprovacaoMaterial');
    if (btn) btn.dataset.id = id;
    modalAprovarMaterial.show();
}

function recusarMaterial(id) {
    if (!modalRecusarMaterial) return;
    const form = document.getElementById('formRecusarMaterial');
    if (form) {
        form.dataset.id = id;
        form.reset();
    }
    modalRecusarMaterial.show();
}

// Complementares
function aprovarComplementar(id) {
    if (!modalAprovarComplementar) return;
    const btn = document.getElementById('btnConfirmarAprovacaoComplementar');
    if (btn) btn.dataset.id = id;
    modalAprovarComplementar.show();
}

function recusarComplementar(id) {
    if (!modalRecusarComplementar) return;
    const form = document.getElementById('formRecusarComplementar');
    if (form) {
        form.dataset.id = id;
        form.reset();
    }
    modalRecusarComplementar.show();
}

// =========================================================================
// CORREÇÃO: VISUALIZAÇÃO DE COMENTÁRIOS (Compatível com Novo HTML)
// =========================================================================

function verComentarios(id) {
    // Tenta encontrar o container correto
    const containerLista = document.getElementById('listaComentariosContainer');
    
    // Se não encontrar o container novo, tenta o antigo (para compatibilidade)
    const containerAntigo = document.getElementById('modalComentariosBody');

    // Se não houver container nenhum, aborta
    if (!containerLista && !containerAntigo) {
        console.error("Erro: Container de comentários não encontrado no HTML.");
        return;
    }

    const targetContainer = containerLista || containerAntigo;

    // Busca o lançamento em todas as listas possíveis
    let lancamento = window.todosOsLancamentosGlobais.find(l => l.id == id) ||
        (window.todosHistoricoAtividades && window.todosHistoricoAtividades.find(l => l.id == id)) ||
        (window.todasPendenciasAtividades && window.todasPendenciasAtividades.find(l => l.id == id)) ||
        (window.dadosCpsGlobais && window.dadosCpsGlobais.find(l => l.id == id)) ||
        (window.minhasDocsPendentes && window.minhasDocsPendentes.find(l => l.id == id)) ||
        (window.minhasDocsHistorico && window.minhasDocsHistorico.find(l => l.id == id));

    targetContainer.innerHTML = '';

    if (!lancamento) {
        targetContainer.innerHTML = '<p class="text-center text-muted py-3">Dados não encontrados em memória.</p>';
        return;
    }

    if (!lancamento.comentarios || lancamento.comentarios.length === 0) {
        targetContainer.innerHTML = '<p class="text-center text-muted py-3">Nenhum histórico disponível.</p>';
    } else {
        renderizarListaComentarios(targetContainer, lancamento.comentarios);
    }
    
    // Se estivermos usando o modal genérico, apenas abre se não estiver aberto
    // (A documentação controla sua própria abertura, mas outras abas podem usar isso)
    if (modalComentarios && !modalComentarios._element.classList.contains('show')) {
        modalComentarios.show();
    }
}

// Renderiza a lista de forma bonita
function renderizarListaComentarios(container, comentarios) {
    const ordenados = [...comentarios].sort((a, b) => {
        const dataA = a.dataHora ? parseDataBrasileira(a.dataHora) : new Date(0);
        const dataB = b.dataHora ? parseDataBrasileira(b.dataHora) : new Date(0);
        return dataB - dataA;
    });

    container.innerHTML = ordenados.map(comentario => `
        <div class="d-flex flex-column mb-3 border-start border-4 ps-3 ${isUsuarioLogado(comentario) ? 'border-primary' : 'border-secondary'}">
            <div class="d-flex justify-content-between align-items-center mb-1">
                <span class="fw-bold small ${isUsuarioLogado(comentario) ? 'text-primary' : 'text-dark'}">
                    <i class="bi bi-person-circle me-1"></i>${comentario.autor ? comentario.autor.nome : 'Sistema'}
                </span>
                <span class="text-muted" style="font-size: 0.75rem;">
                    ${comentario.dataHora ? comentario.dataHora : '-'}
                </span>
            </div>
            <div class="bg-light p-2 rounded text-dark text-break" style="font-size: 0.9rem;">
                ${comentario.texto}
            </div>
        </div>
    `).join('');
}

function isUsuarioLogado(comentario) {
    if (!comentario.autor) return false;
    return String(comentario.autor.id) === String(localStorage.getItem('usuarioId'));
}

// Função para enviar comentário (Global)
async function enviarComentarioPeloModal(id, textoPersonalizado = null) {
    const input = document.getElementById('novoComentarioTexto');
    const texto = textoPersonalizado || (input ? input.value : '');
    
    if (!texto.trim()) {
        mostrarToast("Digite um comentário.", "warning");
        return;
    }

    // Identifica se é Documentação (que usa endpoint de OS) ou Lançamento Normal
    // A distinção é feita verificando se o ID está nas listas de doc
    const isDoc = (window.minhasDocsPendentes && window.minhasDocsPendentes.some(d => d.id == id)) ||
                  (window.minhasDocsHistorico && window.minhasDocsHistorico.some(d => d.id == id));

    let endpoint = isDoc 
        ? `${API_BASE_URL}/lancamentos/${id}/documentacao/comentar`  // Endpoint de OS (se houver) ou genérico
        : `${API_BASE_URL}/lancamentos/${id}/comentarios`;

    // Se não houver endpoint específico de comentar doc, usa o genérico de OS se for OS, ou lançamentos
    // Assumindo que o back trata Lancamento e OS de forma polimórfica ou endpoints diferentes.
    // Dado seu código anterior, Documentação usa endpoints específicos.
    // Se não tiver endpoint de comentar doc, vamos usar o padrão de lançamentos e torcer para o ID bater.
    
    toggleLoader(true, '#modalComentarios .modal-content');

    try {
        const userId = localStorage.getItem('usuarioId');
        
        await fetchComAuth(endpoint, {
            method: 'POST',
            body: JSON.stringify({
                texto: texto,
                autorId: userId, // Para lançamentos
                usuarioId: userId, // Para documentação (alguns endpoints usam esse nome)
                comentario: texto // Alguns endpoints de doc usam esse campo
            })
        });

        if(input) input.value = '';
        mostrarToast("Comentário enviado.", "success");

        verComentarios(id); 

    } catch (error) {
        console.error("Erro ao comentar:", error);
        mostrarToast("Erro ao enviar comentário: " + error.message, "error");
    } finally {
        toggleLoader(false, '#modalComentarios .modal-content');
    }
}


// --- EXPORTAÇÃO GLOBAL ---
window.aprovarLancamento = aprovarLancamento;
window.recusarLancamento = recusarLancamento;
window.comentarLancamento = comentarLancamento;
window.aprovarLancamentoController = aprovarLancamentoController;
window.recusarLancamentoController = recusarLancamentoController;
window.aprovarPrazoController = aprovarPrazoController;
window.recusarPrazoController = recusarPrazoController;
window.aprovarMaterial = aprovarMaterial;
window.recusarMaterial = recusarMaterial;
window.aprovarComplementar = aprovarComplementar;
window.recusarComplementar = recusarComplementar;
window.verComentarios = verComentarios;
window.enviarComentarioPeloModal = enviarComentarioPeloModal;
window.mostrarToast = mostrarToast;