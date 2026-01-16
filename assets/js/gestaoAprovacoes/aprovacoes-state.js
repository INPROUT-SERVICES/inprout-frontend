// ==========================================================
// 1. ESTADO GLOBAL E UTILITÁRIOS (aprovacoes-state.js)
// ==========================================================

const API_BASE_URL = 'https://www.inproutservices.com.br/api';
const userRole = (localStorage.getItem("role") || "").trim().toUpperCase();
const userId = localStorage.getItem('usuarioId');

// --- Variáveis de Dados Globais ---
window.todosOsLancamentosGlobais = [];
window.todasPendenciasMateriais = [];
window.todosHistoricoMateriais = [];
window.todasPendenciasComplementares = [];
window.todoHistoricoComplementares = [];
window.todasPendenciasAtividades = [];

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
    
    // Se os elementos não existirem no HTML, não faz nada
    if (!toastElement || !toastBody) return;

    // Cria a instância do Bootstrap apenas quando chamar (garante que o DOM carregou)
    const toast = new bootstrap.Toast(toastElement);
    
    // Remove classes anteriores
    toastElement.classList.remove('text-bg-success', 'text-bg-danger', 'text-bg-warning');
    
    // Adiciona a classe correta
    if (tipo === 'success') {
        toastElement.classList.add('text-bg-success');
    } else if (tipo === 'error') {
        toastElement.classList.add('text-bg-danger');
    } else {
        toastElement.classList.add('text-bg-warning'); // Para avisos
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
    document.getElementById('aprovarLancamentoId').value = id;
    if (modalAprovar._element) delete modalAprovar._element.dataset.acaoEmLote;
    
    const bodyP = modalAprovar._element.querySelector('.modal-body p');
    if(bodyP) bodyP.textContent = "Você tem certeza que deseja aprovar este lançamento?";
    modalAprovar.show();
}

function recusarLancamento(id) {
    if (!modalRecusar) return;
    document.getElementById('recusarLancamentoId').value = id;
    document.getElementById('formRecusarLancamento').reset();
    if (modalRecusar._element) delete modalRecusar._element.dataset.acaoEmLote;
    modalRecusar.show();
}

function comentarLancamento(id) {
    if (!modalComentar) return;
    document.getElementById('comentarLancamentoId').value = id;
    document.getElementById('formComentarPrazo').reset();
    if (modalComentar._element) delete modalComentar._element.dataset.acaoEmLote;
    
    const modalTitle = modalComentar._element.querySelector('.modal-title');
    if(modalTitle) modalTitle.innerHTML = '<i class="bi bi-chat-left-text-fill text-warning me-2"></i>Comentar ou Solicitar Prazo';
    const labelData = modalComentar._element.querySelector('label[for="novaDataProposta"]');
    if(labelData) labelData.textContent = 'Sugerir Novo Prazo';
    
    modalComentar.show();
}

// Controller Actions
function aprovarLancamentoController(id) {
    if (!modalAprovar) return;
    document.getElementById('aprovarLancamentoId').value = id;
    if (modalAprovar._element) delete modalAprovar._element.dataset.acaoEmLote;
    
    const bodyP = modalAprovar._element.querySelector('.modal-body p');
    if(bodyP) bodyP.innerHTML = `Você tem certeza que deseja aprovar este lançamento?<br><span class="text-danger small"><b>Atenção:</b> Esta ação é final.</span>`;
    
    modalAprovar.show();
}

function recusarLancamentoController(id) {
    recusarLancamento(id); 
}

function aprovarPrazoController(id) {
    if (!modalAprovar) return;
    document.getElementById('aprovarLancamentoId').value = id;
    if (modalAprovar._element) delete modalAprovar._element.dataset.acaoEmLote;
    
    const bodyP = modalAprovar._element.querySelector('.modal-body p');
    if(bodyP) bodyP.textContent = "Aprovar a solicitação de novo prazo feita pelo coordenador?";
    
    modalAprovar.show();
}

function recusarPrazoController(id) {
    if (!modalComentar) return;
    document.getElementById('comentarLancamentoId').value = id;
    if (modalComentar._element) delete modalComentar._element.dataset.acaoEmLote;

    const modalTitle = modalComentar._element.querySelector('.modal-title');
    if(modalTitle) modalTitle.innerHTML = '<i class="bi bi-calendar-x-fill text-danger me-2"></i>Recusar/Estabelecer Novo Prazo';
    
    const comentarioLabel = modalComentar._element.querySelector('label[for="comentarioCoordenador"]');
    if(comentarioLabel) comentarioLabel.textContent = 'Motivo da Recusa / Comentário (Obrigatório)';
    
    const dataLabel = modalComentar._element.querySelector('label[for="novaDataProposta"]');
    if(dataLabel) dataLabel.textContent = 'Definir Novo Prazo (Obrigatório)';
    
    modalComentar.show();
}

// Materiais
function aprovarMaterial(id) {
    if (!modalAprovarMaterial) return;
    const btn = document.getElementById('btnConfirmarAprovacaoMaterial');
    if(btn) btn.dataset.id = id;
    modalAprovarMaterial.show();
}

function recusarMaterial(id) {
    if (!modalRecusarMaterial) return;
    const form = document.getElementById('formRecusarMaterial');
    if(form) {
        form.dataset.id = id;
        form.reset();
    }
    modalRecusarMaterial.show();
}

// Complementares
function aprovarComplementar(id) {
    if (!modalAprovarComplementar) return;
    const btn = document.getElementById('btnConfirmarAprovacaoComplementar');
    if(btn) btn.dataset.id = id;
    modalAprovarComplementar.show();
}

function recusarComplementar(id) {
    if (!modalRecusarComplementar) return;
    const form = document.getElementById('formRecusarComplementar');
    if(form) {
        form.dataset.id = id;
        form.reset();
    }
    modalRecusarComplementar.show();
}

// Detalhes/Comentários
function verComentarios(id) {
    if (!modalComentarios) return;
    
    let lancamento = window.todosOsLancamentosGlobais.find(l => l.id == id);
    if (!lancamento && window.todosHistoricoAtividades) {
        lancamento = window.todosHistoricoAtividades.find(l => l.id == id);
    }
    // Tenta também no array de pendências específico
    if (!lancamento && window.todasPendenciasAtividades) {
        lancamento = window.todasPendenciasAtividades.find(l => l.id == id);
    }
    // Tenta no array global de CPS se existir
    if (!lancamento && window.dadosCpsGlobais) {
        lancamento = window.dadosCpsGlobais.find(l => l.id == id);
    }
    
    const modalBody = document.getElementById('modalComentariosBody');
    modalBody.innerHTML = '';

    if (!lancamento || !lancamento.comentarios || lancamento.comentarios.length === 0) {
        modalBody.innerHTML = '<p class="text-center text-muted">Nenhum comentário para este lançamento.</p>';
    } else {
        const comentariosOrdenados = [...lancamento.comentarios].sort((a, b) => parseDataBrasileira(b.dataHora) - parseDataBrasileira(a.dataHora));
        modalBody.innerHTML = comentariosOrdenados.map(comentario => `
            <div class="card mb-3">
                <div class="card-header bg-light d-flex justify-content-between align-items-center small">
                    <strong><i class="bi bi-person-circle me-2"></i>${comentario.autor.nome}</strong>
                    <span class="text-muted">${comentario.dataHora ? new Date(parseDataBrasileira(comentario.dataHora)).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : ''}</span>
                </div>
                <div class="card-body">
                    <p class="card-text">${comentario.texto}</p>
                </div>
            </div>
        `).join('');
    }
    modalComentarios.show();
}

// --- EXPORTAÇÃO GLOBAL (CRUCIAL PARA O HTML E OUTROS ARQUIVOS) ---
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
window.mostrarToast = mostrarToast;