/* ==========================================================================
   ECOLLTRUCK - AUTENTICAÇÃO E LOGIN (CORRIGIDO E SINCRONIZADO)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', async () => {
  const loginForm = document.getElementById('loginForm');
  const emailInput = document.getElementById('loginEmail');
  const passwordInput = document.getElementById('loginPassword');
  const submitBtn = document.getElementById('loginSubmit');
  const errorMsg = document.getElementById('loginError');
  const togglePassBtn = document.querySelector('[data-password-toggle]');

  // Obtém a instância do Firebase.js
  async function getFirebaseService() {
    if (window.EcollTruckFirebase) return window.EcollTruckFirebase;
    if (window.EcollTruckFirebaseReady) return await window.EcollTruckFirebaseReady;
    return new Promise((resolve) => {
      window.addEventListener('ecolltruck:firebase-ready', () => {
        resolve(window.EcollTruckFirebase);
      }, { once: true });
    });
  }

  const fb = await getFirebaseService();

  // Alternar visibilidade da senha
  if (togglePassBtn && passwordInput) {
    togglePassBtn.addEventListener('click', () => {
      const isPassword = passwordInput.type === 'password';
      passwordInput.type = isPassword ? 'text' : 'password';
    });
  }

  // Submissão do Formulário
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (errorMsg) errorMsg.textContent = '';

      const email = emailInput.value.trim();
      const password = passwordInput.value;

      if (!email || !password) {
        if (errorMsg) errorMsg.textContent = 'Informe o seu e-mail e senha.';
        return;
      }

      if (submitBtn) {
        submitBtn.classList.add('is-loading');
        submitBtn.disabled = true;
      }

      try {
        // 1. Efetua o login no Firebase Authentication
        const userCredential = await fb.signIn(email, password);
        const user = userCredential.user;

        // 2. Busca o perfil do utilizador no nó 'users'
        let userData = { name: user.displayName || 'Utilizador', role: 'Administrador', status: 'Ativo' };
        
        try {
          const snapshot = await fb.read('users/' + user.uid);
          if (snapshot && snapshot.exists()) {
            userData = snapshot.val();
          }
        } catch (readErr) {
          console.warn('Não foi possível ler o perfil no banco, utilizando dados padrão do Auth:', readErr);
        }

        // 3. Verifica se a conta está bloqueada
        if (userData.status === 'Bloqueado') {
          await fb.signOut();
          localStorage.removeItem('ecolltruck_user');
          if (errorMsg) errorMsg.textContent = 'A sua conta está bloqueada no sistema.';
          return;
        }

        // 4. Salva a sessão no localStorage para o app.js ler imediatamente ao trocar de página
        localStorage.setItem('ecolltruck_user', JSON.stringify({
          uid: user.uid,
          nome: userData.name || userData.nome || user.displayName || 'Utilizador',
          email: user.email,
          role: userData.role || 'Administrador'
        }));

        // 5. Redireciona para o Dashboard sem guardar o histórico de login
        window.location.replace('index.html');

      } catch (error) {
        console.error('Erro na autenticação:', error);
        if (errorMsg) {
          if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
            errorMsg.textContent = 'E-mail ou senha incorretos.';
          } else {
            errorMsg.textContent = error.message || 'Erro ao realizar login. Tente novamente.';
          }
        }
      } finally {
        if (submitBtn) {
          submitBtn.classList.remove('is-loading');
          submitBtn.disabled = false;
        }
      }
    });
  }
});