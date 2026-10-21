/* ==========================================================================
   ECOLLTRUCK - GESTÃO DE MANUTENÇÃO (REALTIME DATABASE - NÓ 'maintenances')
   ========================================================================== */

document.addEventListener('DOMContentLoaded', async () => {
  const modal = document.getElementById('maintenanceModal');
  const closeModalBtn = document.getElementById('closeMaintenanceModal');
  const modalTitle = document.getElementById('maintenanceModalTitle');
  const form = document.getElementById('maintenanceForm');

  const editingTruckKeyInput = document.getElementById('editingTruckKey');
  const truckLabelInput = document.getElementById('truckLabel');
  const lastMaintenanceInput = document.getElementById('lastMaintenance');
  const nextRevisionInput = document.getElementById('nextRevision');
  const tireChangeInput = document.getElementById('tireChange');
  const scaleRevisionInput = document.getElementById('scaleRevision');
  const oilChangeInput = document.getElementById('oilChange');
  const maintenanceStatusSelect = document.getElementById('maintenanceStatus');
  const submitBtn = document.getElementById('saveMaintenance');

  const tableBody = document.getElementById('maintenanceTable');
  const searchInput = document.getElementById('maintenanceSearch');
  const emptyState = document.getElementById('emptyMaintenanceState');
  const toast = document.getElementById('toast');

  const upToDateMetric = document.getElementById('upToDateCount');
  const scheduledMetric = document.getElementById('scheduledCount');
  const overdueMetric = document.getElementById('overdueCount');

  let maintenancesMap = {};
  let trucksMap = {};

  // 1. CARREGAR SERVIÇO DO FIREBASE
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

  // 2. ESCUTAR CAMINHÕES
  fb.subscribe('trucks', (snapshot) => {
    trucksMap = {};
    if (snapshot && snapshot.exists()) {
      const data = snapshot.val();
      Object.keys(data).forEach(id => {
        trucksMap[id] = data[id];
      });
    }
    renderTable(filterRecords(searchInput ? searchInput.value : ''));
  });

  // 3. ESCUTAR MANUTENÇÕES NO REALTIME DATABASE
  fb.subscribe('maintenances', (snapshot) => {
    maintenancesMap = {};
    if (snapshot && snapshot.exists()) {
      maintenancesMap = snapshot.val();
    } else {
      // Se não houver dados no nó, semeia os registros padrão de manutenção
      seedInitialMaintenances();
    }
    updateMetrics();
    renderTable(filterRecords(searchInput ? searchInput.value : ''));
  });

  // Função para popular registros padrão se o nó 'maintenances' estiver vazio
  async function seedInitialMaintenances() {
    const defaultData = {
      truck_01: {
        truckName: "Truck 01",
        lastMaintenance: "2026-03-19",
        nextRevision: "2026-04-19",
        tireChange: "2026-05-14",
        scaleRevision: "2026-04-24",
        oilChange: "2026-04-17",
        status: "Programada"
      },
      truck_02: {
        truckName: "Truck 02",
        lastMaintenance: "2026-04-09",
        nextRevision: "2026-05-09",
        tireChange: "2026-06-19",
        scaleRevision: "2026-05-14",
        oilChange: "2026-05-07",
        status: "Em dia"
      },
      truck_03: {
        truckName: "Truck 03",
        lastMaintenance: "2026-02-14",
        nextRevision: "2026-03-14",
        tireChange: "2026-04-09",
        scaleRevision: "2026-03-19",
        oilChange: "2026-03-12",
        status: "Vencida"
      },
      truck_04: {
        truckName: "Truck 04",
        lastMaintenance: "2026-04-04",
        nextRevision: "2026-05-04",
        tireChange: "2026-06-30",
        scaleRevision: "2026-05-09",
        oilChange: "2026-05-02",
        status: "Em dia"
      }
    };

    try {
      await fb.set('maintenances', defaultData);
    } catch (err) {
      console.warn('Não foi possível semear dados iniciais de manutenção:', err);
    }
  }

  // 4. ATUALIZAR MÉTRICAS
  function updateMetrics() {
    const keys = Object.keys(maintenancesMap);
    let upToDate = 0;
    let scheduled = 0;
    let overdue = 0;

    keys.forEach(k => {
      const item = maintenancesMap[k];
      const status = item.status || 'Em dia';
      if (status === 'Em dia') upToDate++;
      if (status === 'Programada') scheduled++;
      if (status === 'Vencida') overdue++;
    });

    if (upToDateMetric) upToDateMetric.textContent = upToDate;
    if (scheduledMetric) scheduledMetric.textContent = scheduled;
    if (overdueMetric) overdueMetric.textContent = overdue;
  }

  // 5. RENDERIZAR TABELA
  function renderTable(items) {
    if (!tableBody) return;
    tableBody.innerHTML = '';

    const keys = Object.keys(items);

    if (keys.length === 0) {
      if (emptyState) emptyState.hidden = false;
      return;
    }

    if (emptyState) emptyState.hidden = true;

    keys.forEach(truckKey => {
      const m = items[truckKey];
      const truckInfo = trucksMap[truckKey] || {};
      const truckName = m.truckName || truckInfo.name || truckInfo.nome || truckKey;

      let badgeClass = 'badge em-dia';
      if (m.status === 'Programada') badgeClass = 'badge programada';
      if (m.status === 'Vencida') badgeClass = 'badge vencida';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${escapeHtml(truckName)}</strong></td>
        <td>${formatDate(m.lastMaintenance)}</td>
        <td>${formatDate(m.nextRevision)}</td>
        <td>${formatDate(m.tireChange)}</td>
        <td>${formatDate(m.scaleRevision)}</td>
        <td>${formatDate(m.oilChange)}</td>
        <td><span class="${badgeClass}">${escapeHtml(m.status || 'Em dia')}</span></td>
        <td class="actions-cell">
          <button class="btn-action" type="button" data-edit-key="${truckKey}">Atualizar</button>
        </td>
      `;

      tableBody.appendChild(tr);
    });
  }

  // 6. CONTROLAR MODAL DE EDIÇÃO
  function openModal(truckKey) {
    const data = maintenancesMap[truckKey] || {};
    const truckInfo = trucksMap[truckKey] || {};
    const name = data.truckName || truckInfo.name || truckInfo.nome || truckKey;

    editingTruckKeyInput.value = truckKey;
    truckLabelInput.value = name;
    lastMaintenanceInput.value = data.lastMaintenance || '';
    nextRevisionInput.value = data.nextRevision || '';
    tireChangeInput.value = data.tireChange || '';
    scaleRevisionInput.value = data.scaleRevision || '';
    oilChangeInput.value = data.oilChange || '';
    maintenanceStatusSelect.value = data.status || 'Em dia';

    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
  }

  function closeModal() {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    form.reset();
  }

  if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }

  // 7. SUBMETER ATUALIZAÇÃO NO FIREBASE
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const truckKey = editingTruckKeyInput.value;
      if (!truckKey) return;

      if (submitBtn) submitBtn.disabled = true;

      const payload = {
        truckName: truckLabelInput.value,
        lastMaintenance: lastMaintenanceInput.value,
        nextRevision: nextRevisionInput.value,
        tireChange: tireChangeInput.value,
        scaleRevision: scaleRevisionInput.value,
        oilChange: oilChangeInput.value,
        status: maintenanceStatusSelect.value,
        updatedAt: new Date().toISOString()
      };

      try {
        await fb.set(`maintenances/${truckKey}`, payload);
        showToast('Manutenção atualizada!');
        closeModal();
      } catch (error) {
        console.error('Erro ao salvar manutenção:', error);
        alert('Erro ao atualizar banco de dados.');
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  // 8. EVENTO DE CLIQUE NA TABELA (ABRIR MODAL)
  if (tableBody) {
    tableBody.addEventListener('click', (e) => {
      const editBtn = e.target.closest('[data-edit-key]');
      if (editBtn) {
        const key = editBtn.getAttribute('data-edit-key');
        openModal(key);
      }
    });
  }

  // 9. FILTRO DE BUSCA
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value;
      renderTable(filterRecords(query));
    });
  }

  function filterRecords(query) {
    const term = query.toLowerCase().trim();
    if (!term) return maintenancesMap;

    const filtered = {};
    Object.keys(maintenancesMap).forEach(key => {
      const item = maintenancesMap[key];
      const name = (item.truckName || key).toLowerCase();
      const status = (item.status || '').toLowerCase();
      if (name.includes(term) || status.includes(term)) {
        filtered[key] = item;
      }
    });
    return filtered;
  }

  // HELPERS
  function formatDate(dateStr) {
    if (!dateStr) return '---';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
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