// Ativa/desativa campos conforme switches
document.querySelectorAll('.toggle-editar').forEach(toggle => {
    toggle.addEventListener('change', () => {
        const targetSelector = toggle.dataset.target;
        const targetField = document.querySelector(targetSelector);
        if (targetField) {
            targetField.disabled = !toggle.checked;

            // Se o campo for ativado e for o campo de valor, reaplica a formatação
            if (toggle.checked && targetSelector === '#valorAtividadeEditar') {
                formatarValorCampo(targetField);
            }
        }
    });
});

// Função para formatar valor monetário
function formatarParaReal(valor) {
    const numero = parseFloat(valor.replace(/\D/g, '')) / 100;
    return isNaN(numero)
        ? ''
        : numero.toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).replace('R$', '').trim();
}

// Aplica formatação no campo de valor
function formatarValorCampo(campo) {
    campo.addEventListener('input', (e) => {
        let valorLimpo = e.target.value.replace(/\D/g, '');
        e.target.value = formatarParaReal(valorLimpo);
    });
}

// Aplica no campo de valor da edição em lote, se existir
const campoValorAtividade = document.getElementById('valorAtividadeEditar');
if (campoValorAtividade) {
    formatarValorCampo(campoValorAtividade);
}