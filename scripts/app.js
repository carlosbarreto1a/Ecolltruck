/* ==========================================================================
   ECOLLTRUCK - CONTROLE GLOBAL, ÍCONES E PERMISSÕES DE ACESSO (APP.JS)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', async () => {
  const requiresAuth = document.body.hasAttribute('data-auth');
  const isAuthPage = document.body.hasAttribute('data-auth-page');
  const savedUser = localStorage.getItem('ecolltruck_user');
  const isSubfolder = window.location.pathname.includes('/paginas/') || window.location.pathname.includes('/Paginas/');

  // 1. RENDERIZAÇÃO AUTOMÁTICA DOS ÍCONES SVG
  const iconMap = {
    'log-out': `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>`,
    'truck': `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>`,
    'search': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`,
    'users': `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 1 0 7.75"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>`
  };

  document.querySelectorAll('[data-icon]').forEach(el => {
    const iconName = el.getAttribute('data-icon');
    if (iconMap[iconName] && el.children.length === 0 && !el.textContent.trim()) {
      el.innerHTML = iconMap[iconName];
    }
  });

  // 2. PROTEÇÃO DE PÁGINAS QUE EXIGEM AUTENTICAÇÃO
  if (requiresAuth && !savedUser) {
    window.location.replace(isSubfolder ? '../login.html' : 'login.html');
    return;
  }

  if (isAuthPage && savedUser) {
    window.location.replace(isSubfolder ? '../index.html' : 'index.html');
    return;
  }

  // 3. CONTROLE DE PERMISSÕES POR CARGO (RBAC ROBUSTO)
  if (savedUser) {
    try {
      const currentUser = JSON.parse(savedUser);
      const rawUserRole = currentUser.role || currentUser.cargo || currentUser.perfil || 'Administrador';
      const userRoleLower = String(rawUserRole).trim().toLowerCase();

      const isAdmin = userRoleLower.includes('admin');
      const isOperator = userRoleLower.includes('operad');
      const isDriver = userRoleLower.includes('motorist') || userRoleLower.includes('driver');

      if (!isAdmin) {
        const pageRolesAttr = document.body.getAttribute('data-roles');
        if (pageRolesAttr) {
          const allowedRolesLower = pageRolesAttr.split(',').map(r => r.trim().toLowerCase());
          
          const hasAccess = allowedRolesLower.some(role => {
            if (isOperator && role.includes('operad')) return true;
            if (isDriver && (role.includes('motorist') || role.includes('driver'))) return true;
            return role === userRoleLower;
          });

          // Se NÃO tem acesso à página atual, redireciona diretamente sem alertar
          if (!hasAccess) {
            let redirectTarget = isSubfolder ? 'rotas.html' : 'Paginas/rotas.html';
            
            if (isOperator) {
              redirectTarget = isSubfolder ? 'monitoramento.html' : 'Paginas/monitoramento.html';
            }

            // Evita loop recarregando a mesma página destino
            const currentPath = window.location.pathname.toLowerCase();
            const targetLower = redirectTarget.toLowerCase();

            if (!currentPath.includes(targetLower)) {
              window.location.replace(redirectTarget);
              return;
            }
          }
        }
      }

      // Oculta itens do menu de navegação não permitidos para o perfil
      document.querySelectorAll('.centered-nav [data-roles], .side-nav [data-roles]').forEach(item => {
        const rolesLower = item.getAttribute('data-roles').split(',').map(r => r.trim().toLowerCase());
        const canSeeMenu = rolesLower.some(role => {
          if (isAdmin) return true;
          if (isOperator && role.includes('operad')) return true;
          if (isDriver && (role.includes('motorist') || role.includes('driver'))) return true;
          return role === userRoleLower;
        });

        if (!canSeeMenu) {
          item.style.display = 'none';
        } else {
          item.style.display = '';
        }
      });

      // 4. TRAVA DE SELEÇÃO DE CAMINHÃO PARA MOTORISTAS
      if (isDriver) {
        const assignedTruck = currentUser.assignedTruck || currentUser.caminhaoId || 'truck_02';
        
        const scaleTruckSelect = document.getElementById('scaleTruckSelect');
        const truckSelect = document.getElementById('truckSelect');
        const routeTruckSelect = document.getElementById('routeTruckSelect');

        [scaleTruckSelect, truckSelect, routeTruckSelect].forEach(selectEl => {
          if (selectEl) {
            selectEl.value = assignedTruck;
            selectEl.disabled = true;
          }
        });
      }

      // Preenche os dados do perfil na barra superior
      const profileName = document.querySelector('.profile-info strong') || document.querySelector('.profile-copy small');
      const profileRole = document.querySelector('.profile-copy strong');
      const avatar = document.querySelector('.avatar');

      if (profileName) profileName.textContent = currentUser.nome || currentUser.name || 'Usuário';
      if (profileRole) profileRole.textContent = rawUserRole;
      if (avatar) {
        const name = currentUser.nome || currentUser.name || 'US';
        const initials = name.trim().split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        avatar.textContent = initials;
      }

    } catch (e) {
      console.error('Erro ao processar permissões de acesso:', e);
    }
  }

  // 5. OBSERVA AUTENTICAÇÃO NO FIREBASE
  async function getFirebaseService() {
    if (window.EcollTruckFirebase) return window.EcollTruckFirebase;
    if (window.EcollTruckFirebaseReady) return await window.EcollTruckFirebaseReady;
    return new Promise((resolve) => {
      window.addEventListener('ecolltruck:firebase-ready', () => {
        resolve(window.EcollTruckFirebase);
      }, { once: true });
    });
  }

  try {
    const fb = await getFirebaseService();
    if (fb && typeof fb.observeAuth === 'function') {
      fb.observeAuth((user) => {
        if (!user && requiresAuth) {
          localStorage.removeItem('ecolltruck_user');
          window.location.replace(isSubfolder ? '../login.html' : 'login.html');
        }
      });
    }
  } catch (err) {
    console.warn('Aviso do serviço Firebase Auth:', err);
  }

  // 6. BOTÃO DE SAIR (LOGOUT)
  document.querySelectorAll('[data-logout]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (confirm('Deseja realmente sair do sistema?')) {
        localStorage.removeItem('ecolltruck_user');
        try {
          if (window.EcollTruckFirebase && typeof window.EcollTruckFirebase.signOut === 'function') {
            await window.EcollTruckFirebase.signOut();
          }
        } catch (err) {
          console.warn('Erro ao deslogar:', err);
        }
        window.location.replace(isSubfolder ? '../login.html' : 'login.html');
      }
    });
  });
});