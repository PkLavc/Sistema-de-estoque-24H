// Check authentication status
async function checkAuth() {
    try {
        const response = await fetch('/api/auth/status');
        const data = await response.json();
        
        if (data.authenticated === true) {
            window.location.href = '/';
        }
    } catch (error) {
        // Server not available - could be GitHub Pages
        // Check if already in guest mode
        if (localStorage.getItem('isGuestMode') === 'true') {
            window.location.href = '/';
        }
    }
}

// Regular user login
async function login(username, password) {
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        if (response.ok) {
            window.location.href = '/';
        } else {
            showError('Usuário ou senha incorretos');
        }
    } catch (error) {
        showError('Erro ao conectar com o servidor. Tente o modo convidado.');
    }
}

// Guest login
async function guestLogin() {
    try {
        // Try server-based guest login first (for Cloudflare)
        const response = await fetch('/api/login/guest', { method: 'POST' });
        if (response.ok) {
            window.location.href = '/';
            return;
        }
    } catch (err) {
        // Server not available - use localStorage guest mode (for GitHub Pages)
    }
    
    // Fallback to localStorage guest mode
    localStorage.setItem('isGuestMode', 'true');
    window.location.href = '/';
}

function showError(message) {
    const errorEl = document.getElementById('errorMessage');
    if (errorEl) {
        errorEl.textContent = message;
        setTimeout(() => errorEl.textContent = '', 5000);
    }
}

// Mode toggle (Login / Convidado)
document.addEventListener('DOMContentLoaded', function() {
    const btnLoginMode = document.getElementById('btn-login-mode');
    const btnGuestMode = document.getElementById('btn-guest-mode');
    const credentials = document.getElementById('credentials');
    const loginForm = document.getElementById('loginForm');
    const btnSubmit = document.getElementById('btn-submit');

    // Apply custom logo and favicon if set
    applyCustomLogoAndFavicon();

    if (btnLoginMode) {
        btnLoginMode.addEventListener('click', function() {
            btnLoginMode.classList.add('active');
            btnGuestMode.classList.remove('active');
            credentials.style.display = '';
            btnSubmit.textContent = 'Entrar';
        });
    }

    if (btnGuestMode) {
        btnGuestMode.addEventListener('click', function() {
            btnGuestMode.classList.add('active');
            btnLoginMode.classList.remove('active');
            credentials.style.display = 'none';
            btnSubmit.textContent = 'Entrar como Convidado';
        });
    }

    // Handle form submission
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            if (btnGuestMode && btnGuestMode.classList.contains('active')) {
                guestLogin();
            } else {
                const u = document.getElementById('username').value;
                const p = document.getElementById('password').value;
                login(u, p);
            }
        });
    }

    // Check if already authenticated
    checkAuth();
});

function applyCustomLogoAndFavicon() {
    const customLogo = localStorage.getItem('custom-logo');
    if (customLogo) {
        const logoImg = document.querySelector('.logo-image');
        if (logoImg) {
            logoImg.src = customLogo;
        }
        
        // Update favicon using shared utility
        updateFaviconElement(customLogo);
    }
}

// Shared utility function for updating favicon
function updateFaviconElement(logoData) {
    // Remove existing favicon links
    const existingFavicons = document.querySelectorAll('link[rel*="icon"]');
    existingFavicons.forEach(link => link.remove());
    
    // Create new favicon link
    const link = document.createElement('link');
    link.rel = 'icon';
    link.type = 'image/webp';
    link.href = logoData;
    document.head.appendChild(link);
}