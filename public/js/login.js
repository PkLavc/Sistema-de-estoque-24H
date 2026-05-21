// Guest mode only - set flag in localStorage and redirect
function guestLogin() {
    // Set guest mode flag in localStorage
    localStorage.setItem('isGuestMode', 'true');
    // Redirect to main page
    window.location.href = '/';
}

document.addEventListener('DOMContentLoaded', function() {
    // Check if already in guest mode
    if (localStorage.getItem('isGuestMode') === 'true') {
        window.location.href = '/';
        return;
    }

    // Handle form submission
    const loginForm = document.getElementById('loginForm');
    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        guestLogin();
    });
});