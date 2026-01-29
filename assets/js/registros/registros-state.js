/**
 * registros-state.js
 * Responsável por armazenar o estado global da tela e funções utilitárias comuns.
 */

window.RegistrosState = {
    userRole: (localStorage.getItem("role") || "").trim().toUpperCase(),
    API_BASE_URL: 'https://www.inproutservices.com.br/api',
    
    // Dados da página atual
    todasAsLinhas: [], 
    
    // Controle de Paginação Server-Side
    paginaAtual: 0,
    totalPaginas: 0,
    totalElementos: 0,
    linhasPorPagina: 10,
    
    // Filtros
    termoBusca: '',
    osSortDirection: 'desc',
    
    isLoading: false
};

window.RegistrosUtils = {
    get: (obj, path, defaultValue = '-') => {
        if (obj === null || obj === undefined) return defaultValue;
        const value = path.split('.').reduce((a, b) => (a && a[b] != null ? a[b] : undefined), obj);
        return value !== undefined ? value : defaultValue;
    },

    formatarMoeda: (valor) => {
        if (valor === null || valor === undefined || isNaN(Number(valor))) return 'R$ 0,00';
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
    },

    formatarData: (dataStr) => {
        if (!dataStr || dataStr === '-') return '-';
        let dataLimpa = dataStr.split(' ')[0];
        if (dataLimpa.includes('-')) dataLimpa = dataLimpa.split('-').reverse().join('/');
        if (dataLimpa === '//' || dataLimpa === 'Invalid Date') return '-';
        return dataLimpa;
    },

    formatarDataHora: (dataStr) => {
        if (!dataStr || dataStr === '-' || dataStr === 'null') return '-';
        return dataStr; 
    },

    mostrarToast: (mensagem, tipo = 'success') => {
        if (typeof window.mostrarToast === 'function') {
            window.mostrarToast(mensagem, tipo);
        } else {
            console.log(`[${tipo.toUpperCase()}] ${mensagem}`);
        }
    }
};