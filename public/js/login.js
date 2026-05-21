async function checkAuth() {
    try {
        const response = await fetch('/api/auth/status');
        const data = await response.json();
        
        // Só redireciona se o servidor explicitamente disser que SIM, estamos logados
        if (data.authenticated === true) {
            window.location.href = '/dashboard.html';
        }
    } catch (error) {
        console.log('Sessão limpa, aguardando login.');
    }
}

async function login(username, password) {
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        if (response.ok) {
            window.location.href = '/dashboard.html';
        } else {
            alert('Usuário ou senha incorretos');
        }
    } catch (error) {
        alert('Erro ao conectar com o servidor');
    }
}

async function guestLogin() {
    try {
        const response = await fetch('/api/login/guest', { method: 'POST' });
        if (response.ok) {
            window.location.href = '/dashboard.html';
        } else {
            alert('Falha ao entrar como convidado');
        }
    } catch (err) {
        alert('Erro ao conectar com o servidor');
    }
}

document.getElementById('loginForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const u = document.getElementById('username').value;
    const p = document.getElementById('password').value;
    login(u, p);
});

// Mode toggle (Login / Convidado)
document.addEventListener('DOMContentLoaded', function() {
    const btnLoginMode = document.getElementById('btn-login-mode');
    const btnGuestMode = document.getElementById('btn-guest-mode');
    const credentials = document.getElementById('credentials');
    const loginForm = document.getElementById('loginForm');

    btnLoginMode.addEventListener('click', function() {
        btnLoginMode.classList.add('active');
        btnGuestMode.classList.remove('active');
        credentials.style.display = '';
        document.getElementById('btn-submit').textContent = 'Entrar';
    });

    btnGuestMode.addEventListener('click', function() {
        btnGuestMode.classList.add('active');
        btnLoginMode.classList.remove('active');
        credentials.style.display = 'none';
        document.getElementById('btn-submit').textContent = 'Entrar como Convidado';
    });

    // Bind submit to guest when guest mode active
    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        if (btnGuestMode.classList.contains('active')) {
            guestLogin();
        } else {
            const u = document.getElementById('username').value;
            const p = document.getElementById('password').value;
            login(u, p);
        }
    });
});

// Executa apenas uma vez ao abrir
document.addEventListener('DOMContentLoaded', checkAuth);