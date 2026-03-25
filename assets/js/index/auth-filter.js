/**
 * Filtra uma lista de lançamentos com base na role e nos segmentos do usuário logado.
 * NOTA: Com o LancamentosViewer, o backend já filtra por segmento.
 * Este filtro é mantido apenas como camada de segurança extra no frontend.
 * @param {Array} lancamentos - A lista de lançamentos vinda da API.
 * @returns {Array} A lista de lançamentos filtrada.
 */
function filtrarLancamentosParaUsuario(lancamentos) {
    const role = (localStorage.getItem("role") || "").trim().toUpperCase();
    const userSegmentos = JSON.parse(localStorage.getItem('segmentos')) || [];

    // Se for Admin, Controller, Assistant ou Visualizador, pode ver tudo.
    if (['ADMIN', 'CONTROLLER', 'ASSISTANT', 'VISUALIZADOR'].includes(role)) {
        return lancamentos;
    }

    if (role === 'MANAGER' || role === 'COORDINATOR') {
        if (userSegmentos.length === 0) return [];
        return lancamentos.filter(l => l.segmentoId && userSegmentos.includes(l.segmentoId));
    }

    return [];
}
