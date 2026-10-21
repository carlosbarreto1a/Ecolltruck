/* ==========================================================================
   ECOLLTRUCK - REGISTRO DE PESAGEM E TELEMETRIA DA BALANÇA
   ========================================================================== */

document.addEventListener('DOMContentLoaded', async () => {
  // Elementos da Telemetria Central
  const liveWeightValue = document.getElementById('liveWeightValue');
  const gaugeTruckName = document.getElementById('gaugeTruckName');
  const liveStatusBadge = document.getElementById('liveStatusBadge');
  const liveUpdatedTime = document.getElementById('liveUpdatedTime');
  const btnCaptureWeight = document.getElementById('btnCaptureWeight');
  const scaleTruckSelect = document.getElementById('scaleTruckSelect');

  // Formulário
  const weightForm = document.getElementById('weightForm');
  const truckSelect = document.getElementById('truckSelect');
  const routeSelect = document.getElementById('routeSelect');
  const weightInput = document.getElementById('weightInput');
  const locationInput = document.getElementById('locationInput');
  const notesInput = document.getElementById('notesInput');

  // Métricas
  const metricTotalWeight = document.getElementById('metricTotalWeight');
  const metricTotalCount = document.getElementById('metricTotalCount');
  const metricAverageWeight = document.getElementById('metricAverageWeight');

  // Tabela
  const historyTableBody = document.getElementById('historyTableBody');
  const searchInput = document.getElementById('searchInput');
  const toast = document.getElementById('toast');

  let allLatestReadings = {};
  let currentLiveWeight = 0;
  let weightLogsList = [];

  const OFFLINE_TIMEOUT_MS = 10000;

  // 1. TRAVA DE ACESSO PARA MOTORISTA (APENAS O PRÓPRIO CAMINHÃO)
  function applyDriverTruckRestriction() {
    try {
      const userRaw = localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser');
      if (!userRaw) return;
      
      const currentUser = JSON.parse(userRaw);
      const userRole = String(currentUser.role || currentUser.cargo || '').trim().toLowerCase();
      const assignedTruck = currentUser.assignedTruck || currentUser.caminhaoId || 'truck_02';

      // Se for Motorista, trava a visualização no caminhão atribuído
      if (userRole === 'motorista') {
        if (scaleTruckSelect) {
          scaleTruckSelect.value = assignedTruck;
          scaleTruckSelect.disabled = true; // Impede alterar
        }
        if (truckSelect) {
          truckSelect.value = assignedTruck;
          truckSelect.disabled = true; // Impede alterar no formulário
        }
      }
    } catch (e) {
      console.error('Erro ao aplicar restrição de caminhão:', e);
    }
  }

  applyDriverTruckRestriction();

  // 2. CONEXÃO COM O FIREBASE
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

  // 3. MONITORAMENTO DA BALANÇA EM TEMPO REAL
  fb.subscribe('latestReadings', (snapshot) => {
    if (snapshot && snapshot.exists()) {
      allLatestReadings = snapshot.val();
      updateGaugeForSelectedTruck();
    } else {
      allLatestReadings = {};
      updateGaugeForSelectedTruck();
    }
  });

  // 4. ATUALIZAÇÃO DO VISOR DIGITAL
  function updateGaugeForSelectedTruck() {
    const selectedTruckId = scaleTruckSelect ? scaleTruckSelect.value : (truckSelect ? truckSelect.value : 'truck_02');
    const selectedOptionText = scaleTruckSelect && scaleTruckSelect.options[scaleTruckSelect.selectedIndex]
      ? scaleTruckSelect.options[scaleTruckSelect.selectedIndex].text
      : 'CAMINHÃO SELECIONADO';

    if (gaugeTruckName) {
      gaugeTruckName.textContent = selectedOptionText.toUpperCase();
    }

    const truckData = allLatestReadings[selectedTruckId];
    const now = Date.now();
    let isOnline = false;
    let lastSignalDate = null;

    if (truckData) {
      let rawTime = truckData.timestamp || truckData.lastUpdate || truckData.updatedAt;
      
      if (rawTime) {
        lastSignalDate = new Date(rawTime);
        const diffMs = now - lastSignalDate.getTime();
        if (!isNaN(diffMs) && diffMs >= 0 && diffMs <= OFFLINE_TIMEOUT_MS) {
          isOnline = true;
        }
      }
    }

    if (isOnline) {
      currentLiveWeight = parseFloat(truckData.weightKg) || 0;

      if (liveWeightValue) liveWeightValue.textContent = currentLiveWeight.toFixed(2);
      if (liveStatusBadge) {
        liveStatusBadge.textContent = '● ONLINE';
        liveStatusBadge.className = 'status-badge';
      }

      if (liveUpdatedTime && lastSignalDate) {
        liveUpdatedTime.textContent = `Sinal ativo • Último dado às ${lastSignalDate.toLocaleTimeString('pt-BR')}`;
      }
    } else {
      currentLiveWeight = 0;

      if (liveWeightValue) liveWeightValue.textContent = '0.00';
      if (liveStatusBadge) {
        liveStatusBadge.textContent = '● OFFLINE';
        liveStatusBadge.className = 'status-badge offline';
      }

      if (liveUpdatedTime) {
        if (lastSignalDate && !isNaN(lastSignalDate.getTime())) {
          liveUpdatedTime.textContent = `Balança desconectada desde ${lastSignalDate.toLocaleTimeString('pt-BR')}`;
        } else {
          liveUpdatedTime.textContent = 'Sem comunicação com a balança (ESP32 desligado)...';
        }
      }
    }
  }

  setInterval(updateGaugeForSelectedTruck, 1000);

  // SINCRONIZAÇÃO DE DROPDOWNS
  if (scaleTruckSelect) {
    scaleTruckSelect.addEventListener('change', (e) => {
      if (truckSelect) truckSelect.value = e.target.value;
      updateGaugeForSelectedTruck();
    });
  }

  if (truckSelect) {
    truckSelect.addEventListener('change', (e) => {
      if (scaleTruckSelect) scaleTruckSelect.value = e.target.value;
      updateGaugeForSelectedTruck();
    });
  }

  // 5. CARREGAR PESAGENS HISTÓRICAS
  fb.subscribe('weightLogs', (snapshot) => {
    if (snapshot && snapshot.exists()) {
      const val = snapshot.val();
      weightLogsList = Object.keys(val).map(key => ({
        id: key,
        ...val[key]
      })).reverse();
    } else {
      loadFromLocalStorage();
    }
    renderHistoryTable();
    updateMetrics();
  });

  function loadFromLocalStorage() {
    const local = localStorage.getItem('ecolltruck-weight-logs');
    if (local) {
      try { weightLogsList = JSON.parse(local); } catch (e) { weightLogsList = []; }
    } else {
      weightLogsList = [];
    }
  }

  // 6. CAPTURA DE PESO
  if (btnCaptureWeight) {
    btnCaptureWeight.addEventListener('click', () => {
      if (weightInput) {
        weightInput.value = currentLiveWeight.toFixed(2);
        showToast(`Peso de ${currentLiveWeight.toFixed(2)} kg preenchido com sucesso!`);
      }
    });
  }

  // 7. REGISTRAR PESAGEM
  if (weightForm) {
    weightForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const newRecord = {
        truckId: truckSelect.value,
        truckName: truckSelect.options[truckSelect.selectedIndex].text,
        route: routeSelect.value,
        weightKg: parseFloat(weightInput.value) || 0,
        location: locationInput.value.trim(),
        notes: notesInput.value.trim(),
        timestamp: new Date().toISOString(),
        dateTimeFormatted: new Date().toLocaleString('pt-BR')
      };

      try {
        await fb.push('weightLogs', newRecord);

        weightLogsList.unshift(newRecord);
        localStorage.setItem('ecolltruck-weight-logs', JSON.stringify(weightLogsList));

        weightInput.value = '';
        locationInput.value = '';
        notesInput.value = '';

        showToast('Pesagem registrada no banco com sucesso!');
        renderHistoryTable();
        updateMetrics();
      } catch (err) {
        console.error('Erro ao registrar:', err);
        showToast('Salvo localmente.');
      }
    });
  }

  // 8. RENDERIZAR TABELA
  function renderHistoryTable(filterText = '') {
    if (!historyTableBody) return;

    const filtered = weightLogsList.filter(item => {
      const term = filterText.toLowerCase();
      return (
        (item.truckName && item.truckName.toLowerCase().includes(term)) ||
        (item.location && item.location.toLowerCase().includes(term)) ||
        (item.route && item.route.toLowerCase().includes(term))
      );
    });

    if (filtered.length === 0) {
      historyTableBody.innerHTML = `
        <tr>
          <td colspan="6" class="empty-state">
            Nenhuma pesagem registrada até o momento.
          </td>
        </tr>
      `;
      return;
    }

    historyTableBody.innerHTML = filtered.map(item => `
      <tr>
        <td><strong>${item.truckName || item.truckId}</strong></td>
        <td><strong>${(item.weightKg || 0).toFixed(2)} kg</strong></td>
        <td>${item.location || '-'}</td>
        <td>${item.route || '-'}</td>
        <td><small>${item.dateTimeFormatted || new Date(item.timestamp).toLocaleString('pt-BR')}</small></td>
        <td style="text-align: right;">
          <button class="btn-delete" onclick="window.deleteWeightLog('${item.id}')">Excluir</button>
        </td>
      </tr>
    `).join('');
  }

  // 9. EXCLUIR REGISTRO
  window.deleteWeightLog = async (id) => {
    if (confirm('Deseja realmente excluir este registro de pesagem?')) {
      try {
        if (id) await fb.remove(`weightLogs/${id}`);
        weightLogsList = weightLogsList.filter(item => item.id !== id);
        localStorage.setItem('ecolltruck-weight-logs', JSON.stringify(weightLogsList));
        renderHistoryTable();
        updateMetrics();
        showToast('Registro excluído.');
      } catch (e) {
        console.error('Erro ao excluir:', e);
      }
    }
  };

  // 10. ATUALIZAR MÉTRICAS
  function updateMetrics() {
    const totalWeight = weightLogsList.reduce((acc, curr) => acc + (curr.weightKg || 0), 0);
    const count = weightLogsList.length;
    const avg = count > 0 ? totalWeight / count : 0;

    if (metricTotalWeight) metricTotalWeight.textContent = `${totalWeight.toFixed(2)} kg`;
    if (metricTotalCount) metricTotalCount.textContent = count;
    if (metricAverageWeight) metricAverageWeight.textContent = `${avg.toFixed(2)} kg`;
  }

  // 11. BUSCA NA TABELA
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      renderHistoryTable(e.target.value.trim());
    });
  }

  function showToast(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
  }
});