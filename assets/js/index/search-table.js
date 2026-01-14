const searchInput = document.getElementById('searchInput');
const tableRows = document.querySelectorAll('.modern-table tbody tr');

searchInput.addEventListener('input', function () {
    const searchTerm = this.value.toLowerCase();

    tableRows.forEach(row => {
        const rowText = row.innerText.toLowerCase();
        row.style.display = rowText.includes(searchTerm) ? '' : 'none';
    });
});