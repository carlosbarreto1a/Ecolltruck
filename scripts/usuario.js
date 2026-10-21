/* ==========================================================================
   ECOLLTRUCK - GESTÃO DE USUÁRIOS (MENSAGEM DE SUCESSO AJUSTADA)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', async () => {
  const modal = document.getElementById('userModal');
  const openModalBtn = document.getElementById('openUserModal');
  const closeModalBtn = document.getElementById('closeUserModal');
  const modalTitle = document.getElementById('modalTitle');
  const form = document.getElementById('userForm');

  const editingUserIdInput = document.getElementById('editingUserId');
  const nameInput = document.getElementById('userName');
  const emailInput = document.getElementById('userEmail');
  const roleInput = document.getElementById('userRole');
  const statusInput = document.getElementById('userStatus');
  const passwordInput = document.getElementById('userPassword');
  const passwordFieldBlock = document.getElementById('passwordField');
  const submitBtn = document.getElementById('saveUser');

  const tableBody = document.getElementById('userTable');
  const searchInput = document.getElementById('userSearch');
  const emptyState = document.getElementById('emptyState');
  const toast = document.getElementById('toast');

  const totalUsersMetric = document.getElementById('totalUsers');
  const activeUsersMetric = document.getElementById('activeUsers');
  const blockedUsersMetric = document.getElementById('blockedUsers');

  let users = [];

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

  if (fb && typeof fb.seedInitialProfiles === 'function') {
    fb.seedInitialProfiles().catch(console.error);
  }

  // 1. ESCUTAR DADOS EM TEMPO REAL
  fb.subscribe('users', (snapshot) => {
    users = [];
    if (snapshot && snapshot.exists()) {
      const data = snapshot.val();
      Object.keys(data).forEach(id => {
        users.push({ id, ...data[id] });
      });
    }
    updateMetrics();
    renderTable(filterUsers(searchInput ? searchInput.value : ''));
  });

  // 2. MÉTRICAS
  function updateMetrics() {
    const total = users.length;
    const active = users.filter(u => u.status === 'Ativo').length;
    const blocked = users.filter(u => u.status === 'Bloqueado').length;

    if (totalUsersMetric) totalUsersMetric.textContent = total;
    if (activeUsersMetric) activeUsersMetric.textContent = active;
    if (blockedUsersMetric) blockedUsersMetric.textContent = blocked;
  }

  // 3. TABELA
  function renderTable(items) {
    if (!tableBody) return;
    tableBody.innerHTML = '';

    if (!items || items.length === 0) {
      if (emptyState) emptyState.hidden = false;
      return;
    }

    if (emptyState) emptyState.hidden = true;

    items.forEach(user => {
      const tr = document.createElement('tr');

      let roleBadgeClass = 'badge driver';
      if (user.role === 'Administrador') roleBadgeClass = 'badge admin';
      if (user.role === 'Operador') roleBadgeClass = 'badge operator';

      const statusBadgeClass = user.status === 'Ativo' ? 'badge active' : 'badge blocked';
      const userName = user.name || user.nome || 'Usuário';
      const userEmail = user.email || '';
      const initials = getInitials(userName);

      tr.innerHTML = `
        <td>
          <div class="user-info-cell">
            <span class="user-avatar">${initials}</span>
            <strong>${escapeHtml(userName)}</strong>
          </div>
        </td>
        <td>${escapeHtml(userEmail)}</td>
        <td><span class="${roleBadgeClass}">${escapeHtml(user.role || 'Motorista')}</span></td>
        <td><span class="${statusBadgeClass}">${escapeHtml(user.status || 'Ativo')}</span></td>
        <td>${escapeHtml(user.createdAt ? new Date(user.createdAt).toLocaleDateString('pt-BR') : 'Recente')}</td>
        <td class="actions-cell">
          <button class="btn-action edit" type="button" data-edit-id="${user.id}">Editar</button>
          <button class="btn-action delete" type="button" data-delete-id="${user.id}">Excluir</button>
        </td>
      `;

      tableBody.appendChild(tr);
    });
  }

  // 4. MODAL
  function openModal(isEdit = false) {
    clearErrors();
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');

    if (isEdit) {
      modalTitle.textContent = 'Editar Usuário';
      if (submitBtn) submitBtn.querySelector('span').textContent = 'Salvar Alterações';
      if (passwordFieldBlock) passwordFieldBlock.style.display = 'none';
    } else {
      modalTitle.textContent = 'Cadastrar Novo Usuário';
      if (submitBtn) submitBtn.querySelector('span').textContent = 'Cadastrar Usuário';
      if (passwordFieldBlock) passwordFieldBlock.style.display = 'flex';
      form.reset();
      editingUserIdInput.value = '';
    }

    nameInput.focus();
  }

  function closeModal() {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    form.reset();
    editingUserIdInput.value = '';
    clearErrors();
  }

  if (openModalBtn) openModalBtn.addEventListener('click', () => openModal(false));
  if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }

  // 5. SUBMETER
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearErrors();

      const id = editingUserIdInput.value;
      const name = nameInput.value.trim();
      const email = emailInput.value.trim();
      const role = roleInput.value;
      const status = statusInput.value;
      const password = passwordInput ? passwordInput.value : '';

      let isValid = true;

      if (!name) {
        showFieldError('nameError', 'Informe o nome completo.');
        isValid = false;
      }

      if (!email || !email.includes('@')) {
        showFieldError('emailError', 'Informe um e-mail válido.');
        isValid = false;
      }

      if (!id && (!password || password.length < 6)) {
        showFieldError('passwordError', 'A senha deve ter no mínimo 6 caracteres.');
        isValid = false;
      }

      if (!isValid) return;

      if (submitBtn) submitBtn.disabled = true;

      try {
        if (id) {
          await fb.update('users/' + id, { name, email, role, status });
          showToast('Usuário atualizado com sucesso!');
          closeModal();
        } else {
          const result = await fb.createUser({ name, email, password, role, status });
          if (result && result.user) {
            showToast('Conta criada com sucesso!');
            closeModal();
          }
        }
      } catch (error) {
        console.error('Erro ao salvar usuário:', error);
        if (error.code === 'auth/email-already-in-use') {
          showFieldError('emailError', 'Este e-mail já está em uso.');
        } else {
          alert('Erro: ' + (error.message || 'Falha ao salvar usuário.'));
        }
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  // 6. EXCLUIR E EDITAR
  if (tableBody) {
    tableBody.addEventListener('click', async (e) => {
      const editBtn = e.target.closest('[data-edit-id]');
      const deleteBtn = e.target.closest('[data-delete-id]');

      if (editBtn) {
        const id = editBtn.getAttribute('data-edit-id');
        const user = users.find(u => u.id === id);

        if (user) {
          editingUserIdInput.value = user.id;
          nameInput.value = user.name || user.nome || '';
          emailInput.value = user.email || '';
          roleInput.value = user.role || 'Motorista';
          statusInput.value = user.status || 'Ativo';
          openModal(true);
        }
      }

      if (deleteBtn) {
        const id = deleteBtn.getAttribute('data-delete-id');
        const user = users.find(u => u.id === id);
        const userName = user ? (user.name || user.nome) : '';

        if (confirm(`Tem certeza que deseja excluir o usuário "${userName}"?`)) {
          try {
            await fb.set('users/' + id, null);
            showToast('Usuário removido!');
          } catch (err) {
            console.error('Erro ao remover usuário:', err);
            alert('Erro ao excluir usuário.');
          }
        }
      }
    });
  }

  // 7. FILTRO
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value;
      renderTable(filterUsers(query));
    });
  }

  function filterUsers(query) {
    const term = query.toLowerCase().trim();
    if (!term) return users;
    return users.filter(u => {
      const name = (u.name || u.nome || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      const role = (u.role || '').toLowerCase();
      return name.includes(term) || email.includes(term) || role.includes(term);
    });
  }

  function getInitials(name) {
    if (!name) return 'US';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  function showFieldError(elementId, message) {
    const errorEl = document.getElementById(elementId);
    if (errorEl) errorEl.textContent = message;
  }

  function clearErrors() {
    document.querySelectorAll('.field-error').forEach(el => el.textContent = '');
  }

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
});