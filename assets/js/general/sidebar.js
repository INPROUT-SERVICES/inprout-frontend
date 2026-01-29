document.addEventListener("DOMContentLoaded", function () {
    // 1. Identificação do Usuário e Elementos
    const role = localStorage.getItem('role') || localStorage.getItem('userRole');
    const sidebarContainer = document.getElementById("sidebar-container");
    const toggleButton = document.getElementById('menu-toggle');

    // ======================================================================
    // CENÁRIO A: DOCUMENTISTA (Não carrega Sidebar + Ajusta Layout)
    // ======================================================================
    if (role === 'DOCUMENTIST') {
        // Garante que o container da sidebar não ocupe espaço
        if (sidebarContainer) {
            sidebarContainer.innerHTML = '';
            sidebarContainer.style.display = 'none';
        }

        // Esconde o botão de toggle (menu hambúrguer) se existir
        if (toggleButton) {
            toggleButton.style.display = 'none';
        }

        // AJUSTE DE LAYOUT: Remove a margem esquerda para a tela ficar cheia
        const mainContent = document.querySelector('.main-content') || 
                            document.getElementById('main-content') || 
                            document.querySelector('main') || 
                            document.body;
        
        if (mainContent) {
            mainContent.style.marginLeft = '0';
            mainContent.style.width = '100%';
        }

        // Desabilita o link da Logo na Navbar (para não navegar para home)
        const logoNavbar = document.querySelector('.navbar-brand');
        if (logoNavbar) {
            logoNavbar.removeAttribute('href');
            logoNavbar.style.pointerEvents = 'none';
            logoNavbar.style.cursor = 'default';
        }

        // ENCERRA AQUI: Não executa o fetch para documentistas
        return; 
    }

    // ======================================================================
    // CENÁRIO B: OUTROS PERFIS (Carrega Sidebar Normalmente)
    // ======================================================================

    // 2. Define o caminho do arquivo sidebar.html
    let sidebarPath;
    if (
        window.location.pathname.endsWith('/index.html') ||
        window.location.pathname === '/' ||
        window.location.pathname.endsWith('/index')
    ) {
        sidebarPath = 'pages/extras/sidebar.html'; // Caminho relativo para index
    } else {
        sidebarPath = '../pages/extras/sidebar.html'; // Caminho relativo para páginas dentro de /pages
    }

    // 3. Carrega o HTML
    fetch(sidebarPath)
        .then(res => {
            if (!res.ok) throw new Error("Erro ao carregar sidebar");
            return res.text();
        })
        .then(html => {
            // Insere o conteúdo
            if (sidebarContainer) {
                sidebarContainer.innerHTML = html;
            }

            const sidebar = document.getElementById('sidebar');

            // --- LÓGICA DE CORREÇÃO DE LINKS (Index vs Pages) ---
            const isIndex = window.location.pathname.endsWith('/index.html') ||
                            window.location.pathname === '/' ||
                            window.location.pathname.endsWith('/index');

            if (isIndex) {
                const linkMap = {
                    '../index.html': 'index.html',
                    'cps.html': 'pages/cps.html',
                    'cms.html': 'pages/cms.html',
                    'registros.html': 'pages/registros.html',
                    'indexDB.html': 'pages/indexDB.html',
                    'gestaoAprovacoes.html': 'pages/gestaoAprovacoes.html',
                    'faturamento.html': 'pages/faturamento.html',
                    'gateReport.html': 'pages/gateReport.html',
                    'controle-cps.html': 'pages/controle-cps.html'
                };

                for (const [key, value] of Object.entries(linkMap)) {
                    const el = document.querySelector(`#sidebar a[href="${key}"]`);
                    if (el) el.setAttribute('href', value);
                }
            }

            // --- CONTROLE DE VISIBILIDADE POR PERFIL ---
            try {
                // Seleciona elementos
                const cpsLink = document.querySelector('#sidebar a[href*="cps.html"]');
                const faturamentoLink = document.querySelector('#sidebar a[href*="faturamento.html"]');
                const gateReportLink = document.querySelector('#sidebar a[href*="gateReport.html"]');

                // 1. REGRA DE FATURAMENTO:
                // Se NÃO for ADMIN e NÃO for CONTROLLER, esconde o link.
                if (role !== 'ADMIN' && role !== 'CONTROLLER') {
                    if (faturamentoLink) faturamentoLink.parentElement.style.display = 'none';
                }

                // 2. REGRAS PARA MANAGER:
                // Manager não vê CPS nem Gate Report (e nem Faturamento, que já foi escondido acima)
                if (role === 'MANAGER') {
                    if (cpsLink) cpsLink.parentElement.style.display = 'none';
                    if (gateReportLink) gateReportLink.parentElement.style.display = 'none';
                }

            } catch (error) {
                console.error("Falha ao configurar a visibilidade da sidebar:", error);
            }

            // --- LÓGICA DE COMPORTAMENTO DA SIDEBAR (Toggle e Links) ---
            
            // Força navegação nos links (Prevenção de erros de SPA simples)
            if (sidebar) {
                const sidebarLinks = sidebar.querySelectorAll('a');
                sidebarLinks.forEach(link => {
                    link.addEventListener('click', function (e) {
                        // Se tiver submenu, não navega, apenas abre
                        if (this.getAttribute('data-bs-toggle') === 'collapse') return;

                        e.preventDefault();
                        window.location.href = this.href;
                    });
                });
            }

            // Botão Toggle (Mobile)
            if (toggleButton && sidebar) {
                toggleButton.addEventListener('click', (e) => {
                    e.stopPropagation();
                    sidebar.classList.toggle('active');
                    toggleButton.classList.toggle('active');
                });

                // Fecha ao clicar fora
                document.addEventListener('click', (e) => {
                    const isClickInsideSidebar = sidebar.contains(e.target);
                    const isClickToggle = toggleButton.contains(e.target);

                    if (!isClickInsideSidebar && !isClickToggle && sidebar.classList.contains('active')) {
                        sidebar.classList.remove('active');
                        toggleButton.classList.remove('active');
                    }
                });
            }
            
            // Exibir Nome do Usuário (se houver campo na sidebar)
            const nomeUsuario = localStorage.getItem('nome') || localStorage.getItem('usuarioNome');
            const userLabel = document.getElementById('sidebar-user-name');
            if (userLabel && nomeUsuario) {
                userLabel.textContent = nomeUsuario;
            }
        })
        .catch(error => console.error("Erro no sidebar:", error));
});