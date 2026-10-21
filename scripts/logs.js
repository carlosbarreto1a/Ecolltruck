/* ==========================================================================
   ECOLLTRUCK - LOGS DO SISTEMA (REALTIME DATABASE - NÓ 'logs')
   ========================================================================== */

document.addEventListener('DOMContentLoaded', async () => {
  const tableBody = document.getElementById('logsTable');
  const emptyState = document.getElementById('emptyLogsState');
  const toast = document.getElementById('toast');
  const exportBtn = document.getElementById('exportLogs');

  const searchInput = document.getElementById('logSearch');
  const levelFilterSelect = document.getElementById('logLevelFilter');
  const sourceFilterSelect = document.getElementById('logSourceFilter');
  const periodFilterSelect = document.getElementById('logPeriodFilter');
  const clearFiltersBtn = document.getElementById('clearLogFilters');

  const todayLogsMetric = document.getElementById('todayLogs');
  const criticalLogsMetric = document.getElementById('criticalLogs');
  const sensorLogsMetric = document.getElementById('sensorLogs');
  const syncLogsMetric = document.getElementById('syncLogs');

  const detailEmpty = document.getElementById('logDetailEmpty');
  const detailContent = document.getElementById('logDetailContent');
  const detailLevel = document.getElementById('detailLevel');
  const detailEvent = document.getElementById('detailEvent');
  const detailDate = document.getElementById('detailDate');
  const detailSource = document.getElementById('detailSource');
  const detailActor = document.getElementById('detailActor');
  const detailStatus = document.getElementById('detailStatus');
  const detailDescription = document.getElementById('detailDescription');
  const markReviewedBtn = document.getElementById('markReviewed');

  let logsList = [];
  let selectedLogId = null;

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

  // 2. ESCUTAR LOGS EM TEMPO REAL
  fb.subscribe('logs', (snapshot) => {
    logsList = [];
    if (snapshot && snapshot.exists()) {
      const data = snapshot.val();
      Object.keys(data).forEach(id => {
        logsList.push({ id, ...data[id] });
      });

      // Ordena por data (mais recente primeiro)
      logsList.sort((a, b) => new Date(b.timestamp || b.createdAt || 0) - new Date(a.timestamp || a.createdAt || 0));
    } else {
      seedInitialLogs();
    }

    updateMetrics();
    applyFilters();

    if (selectedLogId) {
      const found = logsList.find(l => l.id === selectedLogId);
      if (found) renderDetails(found);
    }
  });

  // 3. SEMEAR DADOS INICIAIS CASO O NÓ ESTEJA VAZIO
  async function seedInitialLogs() {
    const defaultLogs = {
      log_01: {
        timestamp: new Date().toISOString(),
        level: "Informação",
        source: "Firebase",
        event: "Sincronização de Banco",
        actor: "Sistema",
        status: "Pendente",
        description: "Conexão Realtime Database restabelecida com sucesso."
      },
      log_02: {
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        level: "Crítico",
        source: "ESP32",
        event: "Sensor de Peso Offline",
        actor: "Truck 03 (ESP32_03)",
        status: "Pendente",
        description: "Perda de sinal do módulo de pesagem do Truck 03 há mais de 15 minutos."
      },
      log_03: {
        timestamp: new Date(Date.now() - 7200000).toISOString(),
        level: "Atenção",
        source: "Rotas",
        event: "Desvio de Rota",
        actor: "Carlos Oliveira",
        status: "Pendente",
        description: "Caminhão Truck 02 divergiu do perímetro planejado na Rota R-024."
      },
      log_04: {
        timestamp: new Date(Date.now() - 14400000).toISOString(),
        level: "Sucesso",
        source: "Usuários",
        event: "Login Efetuado",
        actor: "João Silva",
        status: "Revisado",
        description: "Autenticação realizada com sucesso no perfil Administrador."
      }
    };

    try {
      await fb.set('logs', defaultLogs);
    } catch (err) {
      console.warn('Erro ao semear logs iniciais:', err);
    }
  }

  // 4. ATUALIZAR MÉTRICAS
  function updateMetrics() {
    const totalCount = logsList.length;
    let criticalCount = 0;
    let sensorCount = 0;
    let syncCount = 0;

    logsList.forEach(log => {
      const level = (log.level || '').toLowerCase();
      const source = (log.source || '').toLowerCase();

      if (level === 'crítico' || level === 'critico') criticalCount++;
      if (source === 'esp32') sensorCount++;
      if (source === 'firebase' || source === 'sistema') syncCount++;
    });

    if (todayLogsMetric) todayLogsMetric.textContent = totalCount;
    if (criticalLogsMetric) criticalLogsMetric.textContent = criticalCount;
    if (sensorLogsMetric) sensorLogsMetric.textContent = sensorCount;
    if (syncLogsMetric) syncLogsMetric.textContent = syncCount;
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

    items.forEach(log => {
      const formattedDate = log.timestamp ? new Date(log.timestamp).toLocaleString('pt-BR') : '---';
      const level = log.level || 'Informação';
      const isSelected = log.id === selectedLogId;

      let badgeClass = 'badge neutral';
      if (level.includes('Crítico') || level.includes('Critico')) badgeClass = 'badge critico';
      else if (level.includes('Atenção') || level.includes('Atencao')) badgeClass = 'badge atencao';
      else if (level.includes('Sucesso')) badgeClass = 'badge sucesso';

      const tr = document.createElement('tr');
      if (isSelected) tr.classList.add('selected');

      tr.innerHTML = `
        <td>${escapeHtml(formattedDate)}</td>
        <td><span class="${badgeClass}">${escapeHtml(level)}</span></td>
        <td>${escapeHtml(log.source || 'Sistema')}</td>
        <td><strong>${escapeHtml(log.event || 'Evento')}</strong></td>
        <td>${escapeHtml(log.actor || '---')}</td>
        <td>${escapeHtml(log.status || 'Pendente')}</td>
        <td style="text-align: right;">
          <button class="btn-action-sm" type="button" data-view-id="${log.id}">Ver Detalhes</button>
        </td>
      `;

      tableBody.appendChild(tr);
    });
  }

  // 6. FILTRAR LOGS
  function applyFilters() {
    const searchTerm = (searchInput ? searchInput.value : '').toLowerCase().trim();
    const selectedLevel = levelFilterSelect ? levelFilterSelect.value : 'Todos';
    const selectedSource = sourceFilterSelect ? sourceFilterSelect.value : 'Todas';
    const selectedPeriod = periodFilterSelect ? periodFilterSelect.value : 'Todos';

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));

    const filtered = logsList.filter(log => {
      // Filtro de Texto
      const textMatch = !searchTerm || 
        (log.event || '').toLowerCase().includes(searchTerm) ||
        (log.source || '').toLowerCase().includes(searchTerm) ||
        (log.actor || '').toLowerCase().includes(searchTerm) ||
        (log.description || '').toLowerCase().includes(searchTerm);

      // Filtro de Nível
      const levelMatch = selectedLevel === 'Todos' || log.level === selectedLevel;

      // Filtro de Origem
      const sourceMatch = selectedSource === 'Todas' || log.source === selectedSource;

      // Filtro de Período
      let periodMatch = true;
      const logDate = new Date(log.timestamp || 0);

      if (selectedPeriod === 'Hoje') {
        periodMatch = logDate >= todayStart;
      } else if (selectedPeriod === 'Semana') {
        periodMatch = logDate >= weekAgo;
      }

      return textMatch && levelMatch && sourceMatch && periodMatch;
    });

    renderTable(filtered);
  }

  // 7. EXIBIR DETALHES DO LOG
  function renderDetails(log) {
    selectedLogId = log.id;

    if (detailEmpty) detailEmpty.hidden = true;
    if (detailContent) detailContent.hidden = false;

    if (detailLevel) {
      detailLevel.textContent = log.level || 'Informação';
      let badgeClass = 'badge neutral';
      if ((log.level || '').includes('Crítico')) badgeClass = 'badge critico';
      else if ((log.level || '').includes('Atenção')) badgeClass = 'badge atencao';
      else if ((log.level || '').includes('Sucesso')) badgeClass = 'badge sucesso';
      detailLevel.className = badgeClass;
    }

    if (detailEvent) detailEvent.textContent = log.event || 'Evento Sem Título';
    if (detailDate) detailDate.textContent = log.timestamp ? new Date(log.timestamp).toLocaleString('pt-BR') : '---';
    if (detailSource) detailSource.textContent = log.source || 'Sistema';
    if (detailActor) detailActor.textContent = log.actor || '---';
    if (detailStatus) detailStatus.textContent = log.status || 'Pendente';
    if (detailDescription) detailDescription.textContent = log.description || 'Sem descrição cadastrada.';

    applyFilters();
  }

  // 8. EVENTOS DE CLIQUE NA TABELA
  if (tableBody) {
    tableBody.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-view-id]');
      if (btn) {
        const id = btn.getAttribute('data-view-id');
        const log = logsList.find(l => l.id === id);
        if (log) renderDetails(log);
      }
    });
  }

  // 9. MARCAR COMO REVISADO
  if (markReviewedBtn) {
    markReviewedBtn.addEventListener('click', async () => {
      if (!selectedLogId) return;

      try {
        await fb.update(`logs/${selectedLogId}`, { status: 'Revisado' });
        showToast('Log marcado como revisado!');
      } catch (err) {
        console.error('Erro ao atualizar log:', err);
        alert('Erro ao atualizar status no banco.');
      }
    });
  }

  // 10. EVENTOS DE FILTRAGEM
  [searchInput, levelFilterSelect, sourceFilterSelect, periodFilterSelect].forEach(element => {
    if (element) {
      element.addEventListener('input', applyFilters);
      element.addEventListener('change', applyFilters);
    }
  });

  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      if (levelFilterSelect) levelFilterSelect.value = 'Todos';
      if (sourceFilterSelect) sourceFilterSelect.value = 'Todas';
      if (periodFilterSelect) periodFilterSelect.value = 'Todos';
      applyFilters();
      showToast('Filtros redefinidos!');
    });
  }

  // 11. EXPORTAR EXCEL / CSV
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      if (logsList.length === 0) {
        alert('Nenhum log disponível para exportação.');
        return;
      }

      let csvContent = "data:text/csv;charset=utf-8,Data/Hora,Nível,Origem,Evento,Responsável,Status,Descrição\n";

      logsList.forEach(l => {
        const date = l.timestamp ? new Date(l.timestamp).toLocaleString('pt-BR') : '';
        const level = `"${(l.level || '').replace(/"/g, '""')}"`;
        const source = `"${(l.source || '').replace(/"/g, '""')}"`;
        const event = `"${(l.event || '').replace(/"/g, '""')}"`;
        const actor = `"${(l.actor || '').replace(/"/g, '""')}"`;
        const status = `"${(l.status || '').replace(/"/g, '""')}"`;
        const desc = `"${(l.description || '').replace(/"/g, '""')}"`;

        csvContent += `${date},${level},${source},${event},${actor},${status},${desc}\n`;
      });

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `ecolltruck_logs_${new Date().toISOString().slice(0,10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToast('Exportação concluída!');
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