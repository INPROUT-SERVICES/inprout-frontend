/**
 * Filtra uma lista de lançamentos com base na role e nos segmentos do usuário logado.
 * @param {Array} lancamentos - A lista completa de lançamentos vinda da API.
 * @returns {Array} A lista de lançamentos filtrada.
 */
function filtrarLancamentosParaUsuario(lancamentos) {
    // Pega os dados do usuário do localStorage
    const role = (localStorage.getItem("role") || "").trim().toUpperCase();
    const userSegmentos = JSON.parse(localStorage.getItem('segmentos')) || [];
    const userId = localStorage.getItem('usuarioId'); // <<< ID do usuário logado

    // Se for Admin, Controller ou Assistant, pode ver tudo.
    if (['ADMIN', 'CONTROLLER', 'ASSISTANT'].includes(role)) {
        return lancamentos;
    }

    // --- INÍCIO DA CORREÇÃO ---
    // Lógica separada estritamente por Role

    if (role === 'MANAGER') {
        if (userSegmentos.length === 0) return [];
        return lancamentos.filter(lancamento =>
            lancamento?.os?.segmento && userSegmentos.includes(lancamento.os.segmento.id)
        );
    }

    if (role === 'COORDINATOR') {
        // REGRA DO SEGMENTO:
        // O Coordenador vê APENAS os lançamentos do(s) seu(s) segmento(s).
        if (userSegmentos.length === 0) {
            return []; // Coordenador sem segmento não vê nada
        }
        return lancamentos.filter(lancamento =>
            lancamento?.os?.segmento && userSegmentos.includes(lancamento.os.segmento.id)
        );
    }
    // --- FIM DA CORREÇÃO ---

    // Se não tiver nenhuma das roles acima, não vê nada por padrão.
    return [];
}