/* ==========================================================================
   ECOLLTRUCK - GESTÃO DE BAIRROS (INTEGRADO AO SEU FIREBASE.JS)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', async () => {
  const modal = document.getElementById('neighborhoodModal');
  const openModalBtn = document.getElementById('openAddModalBtn');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const form = document.getElementById('neighborhoodForm');

  const nameInput = document.getElementById('neighborhoodName');
  const zoneInput = document.getElementById('neighborhoodZone');
  const statusInput = document.getElementById('neighborhoodStatus');

  const tableBody = document.getElementById('neighborhoodsTableBody');
  const searchInput = document.getElementById('searchNeighborhood');
  const emptyState = document.getElementById('emptyState');
  const toast = document.getElementById('toast');

  let neighborhoods = [];

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

  // 1. ESCUTAR NÓ 'neighborhoods' EM TEMPO REAL
  fb.subscribe('neighborhoods', (snapshot) => {
    neighborhoods = [];
    if (snapshot && snapshot.exists()) {
      const data = snapshot.val();
      Object.keys(data).forEach(id => {
        neighborhoods.push({ id, ...data[id] });
      });
    }
    renderTable(filterNeighborhoods(searchInput ? searchInput.value : ''));
  });

  // 2. RENDERIZAR TABELA
  function renderTable(items) {
    if (!tableBody) return;
    tableBody.innerHTML = '';

    if (!items || items.length === 0) {
      if (emptyState) emptyState.hidden = false;
      return;
    }

    if (emptyState) emptyState.hidden = true;

    items.forEach(item => {
      const tr = document.createElement('tr');

      let badgeClass = 'badge active';
      if (item.status === 'Em Expansão' || item.status === 'Pausado') badgeClass = 'badge expansion';
      if (item.status === 'Inativo') badgeClass = 'badge inactive';

      const name = item.name || item.nome || '';
      const zone = item.zone || item.zona || '';

      tr.innerHTML = `
        <td><strong>${escapeHtml(name)}</strong></td>
        <td><span class="badge badge-zone">${escapeHtml(zone)}</span></td>
        <td><span class="${badgeClass}">${escapeHtml(item.status || 'Ativo')}</span></td>
        <td class="actions-cell">
          <button class="btn-delete" type="button" data-delete-id="${item.id}" title="Excluir Bairro">
            Excluir
          </button>
        </td>
      `;

      tableBody.appendChild(tr);
    });
  }

  // 3. MODAL
  function openModal() {
    form.reset();
    clearErrors();
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    nameInput.focus();
  }

  function closeModal() {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    form.reset();
    clearErrors();
  }

  if (openModalBtn) openModalBtn.addEventListener('click', openModal);
  if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }

  // 4. SUBMETER NOVO BAIRRO
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearErrors();

      const name = nameInput.value.trim();
      const zone = zoneInput.value;
      const status = statusInput.value;

      let isValid = true;

      if (!name) {
        showFieldError('nameError', 'Informe o nome do bairro.');
        isValid = false;
      }

      if (!zone) {
        showFieldError('zoneError', 'Selecione uma zona.');
        isValid = false;
      }

      if (!status) {
        showFieldError('statusError', 'Selecione um status.');
        isValid = false;
      }

      if (!isValid) return;

      try {
        await fb.push('neighborhoods', {
          name: name,
          zone: zone,
          status: status,
          createdAt: new Date().toISOString()
        });

        closeModal();
        showToast('Bairro cadastrado!');
      } catch (error) {
        console.error('Erro ao salvar bairro:', error);
        alert('Erro ao salvar no banco de dados.');
      }
    });
  }

  // 5. EXCLUIR BAIRRO
  if (tableBody) {
    tableBody.addEventListener('click', async (e) => {
      const deleteBtn = e.target.closest('[data-delete-id]');
      if (!deleteBtn) return;

      const id = deleteBtn.getAttribute('data-delete-id');
      const item = neighborhoods.find(n => n.id === id);
      const name = item ? (item.name || item.nome) : '';

      if (confirm(`Deseja excluir o bairro "${name}"?`)) {
        try {
          await fb.set('neighborhoods/' + id, null);
          showToast('Bairro removido!');
        } catch (err) {
          console.error('Erro ao remover bairro:', err);
          alert('Erro ao deletar bairro.');
        }
      }
    });
  }

  // 6. BUSCA E FILTRO
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value;
      renderTable(filterNeighborhoods(query));
    });
  }

  function filterNeighborhoods(query) {
    const term = query.toLowerCase().trim();
    if (!term) return neighborhoods;
    return neighborhoods.filter(n => {
      const name = (n.name || n.nome || '').toLowerCase();
      const zone = (n.zone || n.zona || '').toLowerCase();
      return name.includes(term) || zone.includes(term);
    });
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