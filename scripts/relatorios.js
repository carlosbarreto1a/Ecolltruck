/* ==========================================================================
   ECOLLTRUCK - GERAÇÃO DE RELATÓRIOS (REALTIME DATABASE)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', async () => {
  const filterForm = document.getElementById('reportFilterForm');
  const startDateInput = document.getElementById('filterStartDate');
  const endDateInput = document.getElementById('filterEndDate');
  const truckSelect = document.getElementById('filterTruck');
  const routeSelect = document.getElementById('filterRoute');
  const clearFilterBtn = document.getElementById('clearFilterBtn');
  const printReportBtn = document.getElementById('printReportBtn');

  const tableBody = document.getElementById('reportTableBody');
  const emptyState = document.getElementById('emptyReportState');
  const toast = document.getElementById('toast');

  const totalCollectedMetric = document.getElementById('totalCollectedMetric');
  const totalWeighingsMetric = document.getElementById('totalWeighingsMetric');
  const avgPerCollectionMetric = document.getElementById('avgPerCollectionMetric');

  let rawRecords = [];
  let trucksMap = {};
  let routesMap = {};

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

  // 2. ESCUTAR CAMINHÕES E PREENCHER SELECT
  fb.subscribe('trucks', (snapshot) => {
    trucksMap = {};
    if (truckSelect) truckSelect.innerHTML = '<option value="">Todos os caminhões</option>';

    if (snapshot && snapshot.exists()) {
      const data = snapshot.val();
      Object.keys(data).forEach(id => {
        const truck = data[id];
        const name = truck.name || truck.nome || id;
        trucksMap[id] = name;

        if (truckSelect) {
          const opt = document.createElement('option');
          opt.value = id;
          opt.textContent = name;
          truckSelect.appendChild(opt);
        }
      });
    }
  });

  // 3. ESCUTAR ROTAS E PREENCHER SELECT
  fb.subscribe('routes', (snapshot) => {
    routesMap = {};
    if (routeSelect) routeSelect.innerHTML = '<option value="">Todas as rotas</option>';

    if (snapshot && snapshot.exists()) {
      const data = snapshot.val();
      Object.keys(data).forEach(id => {
        const route = data[id];
        const name = `${route.code ? route.code + ' - ' : ''}${route.name || id}`;
        routesMap[id] = name;

        if (routeSelect) {
          const opt = document.createElement('option');
          opt.value = id;
          opt.textContent = name;
          routeSelect.appendChild(opt);
        }
      });
    }
  });

  // 4. ESCUTAR PESAGENS EM TEMPO REAL
  fb.subscribe('weightRecords', (snapshot) => {
    rawRecords = [];
    if (snapshot && snapshot.exists()) {
      const data = snapshot.val();
      Object.keys(data).forEach(id => {
        rawRecords.push({ id, ...data[id] });
      });

      // Ordena pelas datas mais recentes
      rawRecords.sort((a, b) => new Date(b.timestamp || b.createdAt || 0) - new Date(a.timestamp || a.createdAt || 0));
    }

    applyCurrentFilters();
  });

  // 5. APLICAR FILTROS DE PESQUISA
  function applyCurrentFilters() {
    let filtered = [...rawRecords];

    const startDate = startDateInput.value ? new Date(startDateInput.value + 'T00:00:00') : null;
    const endDate = endDateInput.value ? new Date(endDateInput.value + 'T23:59:59') : null;
    const selectedTruck = truckSelect.value;
    const selectedRoute = routeSelect.value;

    if (startDate) {
      filtered = filtered.filter(r => new Date(r.timestamp || r.createdAt || 0) >= startDate);
    }

    if (endDate) {
      filtered = filtered.filter(r => new Date(r.timestamp || r.createdAt || 0) <= endDate);
    }

    if (selectedTruck) {
      filtered = filtered.filter(r => r.truckId === selectedTruck);
    }

    if (selectedRoute) {
      filtered = filtered.filter(r => r.routeId === selectedRoute);
    }

    updateMetrics(filtered);
    renderTable(filtered);
  }

  // 6. ATUALIZAR MÉTRICAS
  function updateMetrics(items) {
    const totalWeighings = items.length;
    let sumWeight = 0;

    items.forEach(r => {
      sumWeight += Number(r.weightKg || r.peso || 0);
    });

    const avgWeight = totalWeighings > 0 ? Math.round(sumWeight / totalWeighings) : 0;

    if (totalCollectedMetric) totalCollectedMetric.textContent = `${sumWeight.toLocaleString('pt-BR')} kg`;
    if (totalWeighingsMetric) totalWeighingsMetric.textContent = totalWeighings;
    if (avgPerCollectionMetric) avgPerCollectionMetric.textContent = `${avgWeight.toLocaleString('pt-BR')} kg`;
  }

  // 7. RENDERIZAR TABELA
  function renderTable(items) {
    if (!tableBody) return;
    tableBody.innerHTML = '';

    if (!items || items.length === 0) {
      if (emptyState) emptyState.hidden = false;
      return;
    }

    if (emptyState) emptyState.hidden = true;

    items.forEach(rec => {
      const truckLabel = trucksMap[rec.truckId] || rec.truckName || rec.truckId || 'Caminhão';
      const routeLabel = routesMap[rec.routeId] || rec.routeName || rec.routeId || 'Sem Rota';
      const weight = Number(rec.weightKg || rec.peso || 0).toLocaleString('pt-BR');
      const location = rec.location || rec.local || '---';
      const formattedTime = rec.timestamp ? new Date(rec.timestamp).toLocaleString('pt-BR') : 'Sem data';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHtml(formattedTime)}</td>
        <td><strong>${escapeHtml(truckLabel)}</strong></td>
        <td>${escapeHtml(routeLabel)}</td>
        <td>${escapeHtml(location)}</td>
        <td><strong>${escapeHtml(weight)} kg</strong></td>
      `;

      tableBody.appendChild(tr);
    });
  }

  // 8. EVENTOS DE FORMULÁRIO E FILTROS
  if (filterForm) {
    filterForm.addEventListener('submit', (e) => {
      e.preventDefault();
      applyCurrentFilters();
      showToast('Filtros aplicados!');
    });
  }

  if (clearFilterBtn) {
    clearFilterBtn.addEventListener('click', () => {
      if (startDateInput) startDateInput.value = '';
      if (endDateInput) endDateInput.value = '';
      if (truckSelect) truckSelect.value = '';
      if (routeSelect) routeSelect.value = '';
      applyCurrentFilters();
      showToast('Filtros limpos!');
    });
  }

  // 9. EVENTO DE IMPRESSÃO / PDF
  if (printReportBtn) {
    printReportBtn.addEventListener('click', () => {
      window.print();
    });
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