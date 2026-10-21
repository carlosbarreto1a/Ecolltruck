/* ==========================================================================
   ECOLLTRUCK - GESTÃO DE CAMINHÕES (INTEGRADO AO SEU FIREBASE.JS)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', async () => {
  const modal = document.getElementById('truckModal');
  const openModalBtn = document.getElementById('openTruckModal');
  const closeModalBtn = document.getElementById('closeTruckModal');
  const modalTitle = document.getElementById('truckModalTitle');
  const form = document.getElementById('truckForm');

  const editingTruckIdInput = document.getElementById('editingTruckId');
  const nameInput = document.getElementById('truckName');
  const plateInput = document.getElementById('truckPlate');
  const capacityInput = document.getElementById('truckCapacity');
  const routeSelect = document.getElementById('truckRoute');
  const statusSelect = document.getElementById('truckStatus');
  const notesInput = document.getElementById('truckNotes');
  const submitBtn = document.getElementById('saveTruck');

  const tableBody = document.getElementById('truckTable');
  const searchInput = document.getElementById('truckSearch');
  const emptyState = document.getElementById('emptyTruckState');
  const toast = document.getElementById('toast');

  const totalTrucksMetric = document.getElementById('totalTrucks');
  const operationalTrucksMetric = document.getElementById('operationalTrucks');
  const attentionTrucksMetric = document.getElementById('attentionTrucks');

  let trucks = [];
  let routesMap = {};

  // 1. CARREGAR INSTÂNCIA DO FIREBASE
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

  if (fb && typeof fb.seedInitialDatabase === 'function') {
    fb.seedInitialDatabase().catch(console.error);
  }

  // 2. ESCUTAR ROTAS PARA PREENCHER DROPDOWN
  fb.subscribe('routes', (snapshot) => {
    routesMap = {};
    if (routeSelect) {
      routeSelect.innerHTML = '<option value="">Nenhuma / Garagem</option>';
    }

    if (snapshot && snapshot.exists()) {
      const data = snapshot.val();
      Object.keys(data).forEach(key => {
        const route = data[key];
        routesMap[key] = route.name || route.code || key;
        if (routeSelect) {
          const option = document.createElement('option');
          option.value = key;
          option.textContent = `${route.code ? route.code + ' - ' : ''}${route.name || key}`;
          routeSelect.appendChild(option);
        }
      });
    }
  });

  // 3. ESCUTAR DADOS EM TEMPO REAL NO NÓ 'trucks'
  fb.subscribe('trucks', (snapshot) => {
    trucks = [];
    if (snapshot && snapshot.exists()) {
      const data = snapshot.val();
      Object.keys(data).forEach(id => {
        trucks.push({ id, ...data[id] });
      });
    }
    updateMetrics();
    renderTable(filterTrucks(searchInput ? searchInput.value : ''));
  });

  // 4. ATUALIZAR MÉTRICAS DA FROTA
  function updateMetrics() {
    const total = trucks.length;
    const operational = trucks.filter(t => t.status === 'Operacional' || t.status === 'Em rota').length;
    const attention = trucks.filter(t => t.status === 'Atenção' || t.status === 'Manutenção' || t.status === 'Pausado').length;

    if (totalTrucksMetric) totalTrucksMetric.textContent = total;
    if (operationalTrucksMetric) operationalTrucksMetric.textContent = operational;
    if (attentionTrucksMetric) attentionTrucksMetric.textContent = attention;
  }

  // 5. RENDERIZAR TABELA
  function renderTable(items) {
    if (!tableBody) return;
    tableBody.innerHTML = '';

    if (!items || items.length === 0) {
      if (emptyState) emptyState.hidden = false;
      return;
    }

    if (emptyState) emptyState.hidden = true;

    items.forEach(truck => {
      const tr = document.createElement('tr');

      let statusBadgeClass = 'badge active';
      if (truck.status === 'Em rota') statusBadgeClass = 'badge route';
      if (truck.status === 'Atenção' || truck.status === 'Pausado') statusBadgeClass = 'badge warning';
      if (truck.status === 'Manutenção') statusBadgeClass = 'badge danger';

      const truckName = truck.name || truck.nome || truck.id || 'Caminhão';
      const plate = truck.plate || truck.placa || '---';
      const capacity = truck.capacityKg || truck.capacidade || 1000;
      const currentRouteId = truck.currentRouteId || truck.routeId || '';
      const routeName = routesMap[currentRouteId] || (currentRouteId ? currentRouteId : 'Sem Rota');
      const formattedDate = truck.createdAt ? new Date(truck.createdAt).toLocaleDateString('pt-BR') : 'Hoje';

      tr.innerHTML = `
        <td>
          <div class="truck-info-cell">
            <div class="truck-icon-box">🚛</div>
            <strong>${escapeHtml(truckName)}</strong>
          </div>
        </td>
        <td><strong>${escapeHtml(plate)}</strong></td>
        <td>${escapeHtml(capacity)} kg</td>
        <td><span class="badge badge-route-code">${escapeHtml(routeName)}</span></td>
        <td><span class="${statusBadgeClass}">${escapeHtml(truck.status || 'Operacional')}</span></td>
        <td>${escapeHtml(formattedDate)}</td>
        <td class="actions-cell">
          <button class="btn-action edit" type="button" data-edit-id="${truck.id}">Editar</button>
          <button class="btn-action delete" type="button" data-delete-id="${truck.id}">Excluir</button>
        </td>
      `;

      tableBody.appendChild(tr);
    });
  }

  // 6. MODAL
  function openModal(isEdit = false) {
    clearErrors();
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');

    if (isEdit) {
      if (modalTitle) modalTitle.textContent = 'Editar Caminhão';
      if (submitBtn) submitBtn.querySelector('span').textContent = 'Salvar Alterações';
    } else {
      if (modalTitle) modalTitle.textContent = 'Cadastrar Novo Caminhão';
      if (submitBtn) submitBtn.querySelector('span').textContent = 'Salvar Caminhão';
      form.reset();
      editingTruckIdInput.value = '';
    }

    nameInput.focus();
  }

  function closeModal() {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    form.reset();
    editingTruckIdInput.value = '';
    clearErrors();
  }

  if (openModalBtn) openModalBtn.addEventListener('click', () => openModal(false));
  if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }

  // 7. SUBMETER FORMULÁRIO (SALVAR OU EDITAR)
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearErrors();

      const id = editingTruckIdInput.value;
      const name = nameInput.value.trim();
      const plate = plateInput.value.trim().toUpperCase();
      const capacity = parseInt(capacityInput.value, 10);
      const routeId = routeSelect.value;
      const status = statusSelect.value;
      const notes = notesInput.value.trim();

      let isValid = true;

      if (!name) {
        showFieldError('truckNameError', 'Informe o nome do caminhão.');
        isValid = false;
      }

      if (!plate) {
        showFieldError('truckPlateError', 'Informe a placa.');
        isValid = false;
      }

      if (isNaN(capacity) || capacity <= 0) {
        showFieldError('truckCapacityError', 'Informe uma capacidade válida.');
        isValid = false;
      }

      if (!isValid) return;

      if (submitBtn) submitBtn.disabled = true;

      try {
        const payload = {
          name,
          plate,
          capacityKg: capacity,
          currentRouteId: routeId,
          status,
          notes,
          createdAt: new Date().toISOString()
        };

        if (id) {
          await fb.update('trucks/' + id, payload);
          showToast('Caminhão atualizado!');
        } else {
          const newTruckKey = 'truck_' + Date.now().toString().slice(-4);
          await fb.set('trucks/' + newTruckKey, { id: newTruckKey, ...payload });
          showToast('Caminhão cadastrado!');
        }

        closeModal();
      } catch (error) {
        console.error('Erro ao salvar caminhão:', error);
        alert('Erro ao salvar no banco de dados.');
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  // 8. EXCLUIR E EDITAR
  if (tableBody) {
    tableBody.addEventListener('click', async (e) => {
      const editBtn = e.target.closest('[data-edit-id]');
      const deleteBtn = e.target.closest('[data-delete-id]');

      if (editBtn) {
        const id = editBtn.getAttribute('data-edit-id');
        const truck = trucks.find(t => t.id === id);

        if (truck) {
          editingTruckIdInput.value = truck.id;
          nameInput.value = truck.name || truck.nome || '';
          plateInput.value = truck.plate || truck.placa || '';
          capacityInput.value = truck.capacityKg || truck.capacidade || 1000;
          routeSelect.value = truck.currentRouteId || truck.routeId || '';
          statusSelect.value = truck.status || 'Operacional';
          notesInput.value = truck.notes || '';
          openModal(true);
        }
      }

      if (deleteBtn) {
        const id = deleteBtn.getAttribute('data-delete-id');
        const truck = trucks.find(t => t.id === id);
        const truckName = truck ? (truck.name || truck.nome || truck.id) : '';

        if (confirm(`Tem certeza que deseja excluir o caminhão "${truckName}"?`)) {
          try {
            await fb.set('trucks/' + id, null);
            showToast('Caminhão removido!');
          } catch (err) {
            console.error('Erro ao remover caminhão:', err);
            alert('Erro ao excluir caminhão.');
          }
        }
      }
    });
  }

  // 9. FILTRO DE BUSCA
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value;
      renderTable(filterTrucks(query));
    });
  }

  function filterTrucks(query) {
    const term = query.toLowerCase().trim();
    if (!term) return trucks;
    return trucks.filter(t => {
      const name = (t.name || t.nome || '').toLowerCase();
      const plate = (t.plate || t.placa || '').toLowerCase();
      const route = (routesMap[t.currentRouteId] || '').toLowerCase();
      const status = (t.status || '').toLowerCase();
      return name.includes(term) || plate.includes(term) || route.includes(term) || status.includes(term);
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