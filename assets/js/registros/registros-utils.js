/**
 * registros-utils.js
 * Funções utilitárias compartilhadas.
 */
window.RegistrosUtils = {
    // Pega valor de objeto aninhado com segurança
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
        if (!dataStr || dataStr === '-' || dataStr === 'null') return '-';
        let dataLimpa = dataStr.split(' ')[0];
        if (dataLimpa.includes('-')) {
            dataLimpa = dataLimpa.split('-').reverse().join('/');
        }
        if (dataLimpa === '//' || dataLimpa === 'Invalid Date') return '-';
        return dataLimpa;
    },

    formatarDataHora: (dataStr) => {
        if (!dataStr || dataStr === '-' || dataStr === 'null') return '-';
        return dataStr;
    },

    mostrarToast: (mensagem, tipo = 'success') => {
        // Usa a função global se existir (do global.js), senão faz log
        if (typeof window.mostrarToast === 'function') {
            window.mostrarToast(mensagem, tipo);
        } else {
            console.log(`[${tipo.toUpperCase()}] ${mensagem}`);
            if(tipo === 'error') alert(mensagem);
        }
    }
};