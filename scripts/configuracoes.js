/* ==========================================================================
   ECOLLTRUCK - CONFIGURAÇÕES DO SISTEMA (REALTIME DATABASE & LOCAL STORAGE)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('settingsForm');
  const resetBtn = document.getElementById('resetSettings');
  const toast = document.getElementById('toast');

  // Inputs Form
  const systemNameInput = document.getElementById('systemName');
  const cityNameInput = document.getElementById('cityName');
  const operationManagerInput = document.getElementById('operationManager');
  const timezoneSelect = document.getElementById('timezone');

  const dailyTargetInput = document.getElementById('dailyTarget');
  const truckCapacityInput = document.getElementById('truckCapacity');
  const capacityAlertInput = document.getElementById('capacityAlert');
  const offlineMinutesInput = document.getElementById('offlineMinutes');

  const firebaseProjectIdInput = document.getElementById('firebaseProjectId');
  const databaseUrlInput = document.getElementById('databaseUrl');
  const devicePrefixInput = document.getElementById('devicePrefix');
  const syncIntervalInput = document.getElementById('syncInterval');

  const notifySensorOfflineCheck = document.getElementById('notifySensorOffline');
  const notifyCapacityCheck = document.getElementById('notifyCapacity');
  const notifyMaintenanceCheck = document.getElementById('notifyMaintenance');
  const notifyDailySummaryCheck = document.getElementById('notifyDailySummary');

  // Status & Extras
  const integrationBadge = document.getElementById('integrationStatusBadge');
  const integrationText = document.getElementById('integrationStatusText');
  const testConnectionBtn = document.getElementById('testConnection');
  const connectionFeedback = document.getElementById('connectionFeedback');

  const copyPathBtn = document.getElementById('copySensorPath');
  const copyPayloadBtn = document.getElementById('copySensorPayload');
  const sensorPathCode = document.getElementById('sensorRealtimePath');
  const sensorPayloadPre = document.getElementById('sensorPayloadExample');

  // Valores Padrão
  const defaultSettings = {
    systemName: "EcollTruck",
    cityName: "Feira de Santana",
    operationManager: "João Silva",
    timezone: "America/Sao_Paulo",
    dailyTarget: 8000,
    truckCapacity: 1000,
    capacityAlert: 85,
    offlineMinutes: 15,
    firebaseProjectId: "ecolltruck-fsa",
    databaseUrl: "https://ecolltruck-fsa-default-rtdb.firebaseio.com",
    devicePrefix: "ESP32-TRUCK",
    syncInterval: 10,
    notifySensorOffline: true,
    notifyCapacity: true,
    notifyMaintenance: true,
    notifyDailySummary: false
  };

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

  // 2. ESCUTAR CONFIGURAÇÕES NO REALTIME DATABASE OU LOCALSTORAGE
  fb.subscribe('settings', (snapshot) => {
    if (snapshot && snapshot.exists()) {
      populateForm(snapshot.val());
      updateIntegrationBadge(true, 'Sincronizado com Firebase');
    } else {
      loadFromLocalStorage();
    }
  });

  function loadFromLocalStorage() {
    const local = localStorage.getItem('ecolltruck-settings');
    if (local) {
      try {
        const parsed = JSON.parse(local);
        populateForm(parsed);
        updateIntegrationBadge(true, 'Carregado do armazenamento local');
      } catch (e) {
        populateForm(defaultSettings);
      }
    } else {
      populateForm(defaultSettings);
    }
  }

  // 3. PREENCHER CAMPOS DO FORMULÁRIO
  function populateForm(data) {
    const s = { ...defaultSettings, ...data };

    if (systemNameInput) systemNameInput.value = s.systemName;
    if (cityNameInput) cityNameInput.value = s.cityName;
    if (operationManagerInput) operationManagerInput.value = s.operationManager;
    if (timezoneSelect) timezoneSelect.value = s.timezone;

    if (dailyTargetInput) dailyTargetInput.value = s.dailyTarget;
    if (truckCapacityInput) truckCapacityInput.value = s.truckCapacity;
    if (capacityAlertInput) capacityAlertInput.value = s.capacityAlert;
    if (offlineMinutesInput) offlineMinutesInput.value = s.offlineMinutes;

    if (firebaseProjectIdInput) firebaseProjectIdInput.value = s.firebaseProjectId;
    if (databaseUrlInput) databaseUrlInput.value = s.databaseUrl;
    if (devicePrefixInput) devicePrefixInput.value = s.devicePrefix;
    if (syncIntervalInput) syncIntervalInput.value = s.syncInterval;

    if (notifySensorOfflineCheck) notifySensorOfflineCheck.checked = s.notifySensorOffline;
    if (notifyCapacityCheck) notifyCapacityCheck.checked = s.notifyCapacity;
    if (notifyMaintenanceCheck) notifyMaintenanceCheck.checked = s.notifyMaintenance;
    if (notifyDailySummaryCheck) notifyDailySummaryCheck.checked = s.notifyDailySummary;
  }

  // 4. EXTRAIR DADOS DO FORMULÁRIO
  function getFormData() {
    return {
      systemName: systemNameInput ? systemNameInput.value.trim() : defaultSettings.systemName,
      cityName: cityNameInput ? cityNameInput.value.trim() : defaultSettings.cityName,
      operationManager: operationManagerInput ? operationManagerInput.value.trim() : defaultSettings.operationManager,
      timezone: timezoneSelect ? timezoneSelect.value : defaultSettings.timezone,

      dailyTarget: dailyTargetInput ? parseInt(dailyTargetInput.value, 10) : defaultSettings.dailyTarget,
      truckCapacity: truckCapacityInput ? parseInt(truckCapacityInput.value, 10) : defaultSettings.truckCapacity,
      capacityAlert: capacityAlertInput ? parseInt(capacityAlertInput.value, 10) : defaultSettings.capacityAlert,
      offlineMinutes: offlineMinutesInput ? parseInt(offlineMinutesInput.value, 10) : defaultSettings.offlineMinutes,

      firebaseProjectId: firebaseProjectIdInput ? firebaseProjectIdInput.value.trim() : defaultSettings.firebaseProjectId,
      databaseUrl: databaseUrlInput ? databaseUrlInput.value.trim() : defaultSettings.databaseUrl,
      devicePrefix: devicePrefixInput ? devicePrefixInput.value.trim() : defaultSettings.devicePrefix,
      syncInterval: syncIntervalInput ? parseInt(syncIntervalInput.value, 10) : defaultSettings.syncInterval,

      notifySensorOffline: notifySensorOfflineCheck ? notifySensorOfflineCheck.checked : false,
      notifyCapacity: notifyCapacityCheck ? notifyCapacityCheck.checked : false,
      notifyMaintenance: notifyMaintenanceCheck ? notifyMaintenanceCheck.checked : false,
      notifyDailySummary: notifyDailySummaryCheck ? notifyDailySummaryCheck.checked : false,

      updatedAt: new Date().toISOString()
    };
  }

  // 5. SUBMETER FORMULÁRIO (SALVAR CONFIGURAÇÕES)
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const payload = getFormData();

      try {
        // Salva Localmente
        localStorage.setItem('ecolltruck-settings', JSON.stringify(payload));

        // Salva no Firebase Realtime Database
        await fb.set('settings', payload);

        showToast('Configurações salvas com sucesso!');
        updateIntegrationBadge(true, 'Parâmetros atualizados');
      } catch (err) {
        console.error('Erro ao salvar configurações:', err);
        showToast('Salvo localmente (erro de rede)');
      }
    });
  }

  // 6. RESTAURAR PADRÕES
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (confirm('Deseja restaurar as configurações originais do sistema?')) {
        populateForm(defaultSettings);
        localStorage.removeItem('ecolltruck-settings');
        showToast('Valores padrões restaurados. Clique em Salvar para confirmar.');
      }
    });
  }

  // 7. TESTAR CONEXÃO COM O BANCO DE DADOS
  if (testConnectionBtn) {
    testConnectionBtn.addEventListener('click', async () => {
      if (connectionFeedback) connectionFeedback.textContent = 'Testando conexão com o Firebase...';

      try {
        const testSnapshot = await fb.get('settings');
        if (connectionFeedback) {
          connectionFeedback.style.color = 'var(--success-text)';
          connectionFeedback.textContent = '✓ Conexão Realtime Database operando normalmente!';
        }
        updateIntegrationBadge(true, 'Conexão Ativa');
      } catch (err) {
        if (connectionFeedback) {
          connectionFeedback.style.color = 'var(--danger-text)';
          connectionFeedback.textContent = '✕ Erro ao comunicar com o servidor Firebase.';
        }
        updateIntegrationBadge(false, 'Falha de Conexão');
      }
    });
  }

  // 8. COPIAR RECURSOS
  if (copyPathBtn && sensorPathCode) {
    copyPathBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(sensorPathCode.textContent);
      showToast('Caminho do ESP32 copiado!');
    });
  }

  if (copyPayloadBtn && sensorPayloadPre) {
    copyPayloadBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(sensorPayloadPre.textContent);
      showToast('Payload JSON copiado!');
    });
  }

  // HELPERS
  function updateIntegrationBadge(isOk, message) {
    if (integrationBadge) {
      integrationBadge.textContent = isOk ? 'Ativa' : 'Erro';
      integrationBadge.className = isOk ? 'badge success' : 'badge danger';
    }
    if (integrationText) {
      integrationText.textContent = message;
    }
  }

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
  }
});