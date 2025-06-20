// auth.js - Handles admin login and registration

// --- DOM Elements ---
const loginView = document.getElementById('loginView');
const registerView = document.getElementById('registerView');
const showRegister = document.getElementById('showRegister');
const showLogin = document.getElementById('showLogin');

const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const loginMessage = document.getElementById('loginMessage');
const registerMessage = document.getElementById('registerMessage');

// --- View Toggling ---
showRegister.addEventListener('click', (e) => {
  e.preventDefault();
  loginView.style.display = 'none';
  registerView.style.display = 'block';
});

showLogin.addEventListener('click', (e) => {
  e.preventDefault();
  registerView.style.display = 'none';
  loginView.style.display = 'block';
});

// --- Form Submission Handlers ---
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginMessage.textContent = 'Logging in...';

  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;

  try {
    const res = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Login failed');
    
    // On success, store token and redirect
    localStorage.setItem('adminToken', data.token);
    window.location.href = 'index.html';

  } catch (err) {
    loginMessage.textContent = 'Error: ' + err.message;
  }
});

registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  registerMessage.textContent = 'Registering...';

  const name = document.getElementById('registerName').value;
  const email = document.getElementById('registerEmail').value;
  const password = document.getElementById('registerPassword').value;

  try {
    const res = await fetch('http://localhost:5000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Registration failed');
    
    // On success, store token and redirect
    registerMessage.textContent = 'Registration successful! Redirecting to login...';
    setTimeout(() => {
        loginView.style.display = 'block';
        registerView.style.display = 'none';
        loginMessage.textContent = 'Please login with your new credentials.';
    }, 1500);

  } catch (err) {
    registerMessage.textContent = 'Error: ' + err.message;
  }
}); 
