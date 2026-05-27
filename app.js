// ===================================
// 喫煙記録アプリ - メインロジック
// ===================================

// ---------- データ管理 ----------

const DB_KEY = 'smokingRecords';
const SETTINGS_KEY = 'smokingSettings';

// 記録の取得（全件）
function getRecords() {
  return JSON.parse(localStorage.getItem(DB_KEY) || '[]');
}

// 記録の保存
function saveRecords(records) {
  localStorage.setItem(DB_KEY, JSON.stringify(records));
}

// 設定の取得
function getSettings() {
  const defaults = { pricePerBox: 580, cigsPerBox: 20, dailyGoal: 0 };
  return { ...defaults, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') };
}

// 設定の保存
function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

// 今日の日付文字列（YYYY-MM-DD）
function today() {
  return new Date().toISOString().slice(0, 10);
}

// 日付別にグループ化
function groupByDate(records) {
  return records.reduce((acc, r) => {
    const d = r.time.slice(0, 10);
    if (!acc[d]) acc[d] = [];
    acc[d].push(r);
    return acc;
  }, {});
}

// 直近N日の日付配列
function getLastNDays(n) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (n - 1 - i));
    return d.toISOString().slice(0, 10);
  });
}

// 今週の開始日（月曜日）
function getWeekStart() {
  const d = new Date();
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1);
  return d.toISOString().slice(0, 10);
}

// 今月の開始日
function getMonthStart() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

// ---------- 喫煙記録 ----------

function recordSmoke() {
  const records = getRecords();
  records.push({ time: new Date().toISOString() });
  saveRecords(records);
  showToast('🚬 記録しました！');
  updateAll();
}

// ---------- UI更新 ----------

function updateAll() {
  updateHome();
  updateHistory();
  updateStats();
}

// ホーム画面の更新
function updateAll_home_only() {
  updateHome();
}

function updateHome() {
  const records = getRecords();
  const grouped = groupByDate(records);
  const settings = getSettings();
  const t = today();
  const weekStart = getWeekStart();
  const monthStart = getMonthStart();

  // 今日の本数
  const todayRec = grouped[t] || [];
  document.getElementById('todayCount').textContent = todayRec.length;

  // 今週の本数
  const weekTotal = records.filter(r => r.time.slice(0, 10) >= weekStart).length;
  document.getElementById('weekCount').textContent = weekTotal + '本';

  // 今月の本数・出費
  const monthTotal = records.filter(r => r.time.slice(0, 10) >= monthStart).length;
  document.getElementById('monthCount').textContent = monthTotal + '本';

  const pricePerCig = settings.pricePerBox / settings.cigsPerBox;
  const cost = Math.round(monthTotal * pricePerCig);
  document.getElementById('monthCost').textContent = '¥' + cost.toLocaleString();

  // 直近7日グラフ
  const last7 = getLastNDays(7);
  const weekData = last7.map(d => (grouped[d] || []).length);
  const labels = last7.map(d => {
    const date = new Date(d);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  });

  drawBarChart('weekChart', labels, weekData, '本数');
}

// 履歴ページの更新
function updateHistory() {
  const records = getRecords();
  const grouped = groupByDate(records);
  const container = document.getElementById('historyList');

  const sorted = Object.entries(grouped).sort((a, b) => b[0].localeCompare(a[0]));

  if (sorted.length === 0) {
    container.innerHTML = '<p style="text-align:center;color:var(--sub);padding:40px">まだ記録がありません</p>';
    return;
  }

  container.innerHTML = sorted.map(([date, recs]) => {
    const d = new Date(date);
    const label = `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}（${['日','月','火','水','木','金','土'][d.getDay()]}）`;

    // 記録時刻リスト（最新3件 + ...）
    const times = recs
      .map(r => new Date(r.time).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }))
      .reverse();
    const timeStr = times.slice(0, 5).join(' / ') + (times.length > 5 ? ' ...' : '');

    return `
      <div class="history-item">
        <div>
          <div class="history-date">${label}</div>
          <div class="history-times">${timeStr}</div>
        </div>
        <div class="history-count">${recs.length}本</div>
      </div>
    `;
  }).join('');
}

// 統計ページの更新
function updateStats() {
  const records = getRecords();
  const grouped = groupByDate(records);
  const settings = getSettings();
  const t = today();

  // --- 時間帯別グラフ ---
  const todayRec = grouped[t] || [];
  const hourData = Array(24).fill(0);
  todayRec.forEach(r => {
    const h = new Date(r.time).getHours();
    hourData[h]++;
  });
  const hourLabels = Array.from({ length: 24 }, (_, i) => i + '時');
  drawBarChart('hourChart', hourLabels, hourData, '本数', '#e67e22');

  // --- 月別グラフ ---
  const monthMap = {};
  records.forEach(r => {
    const key = r.time.slice(0, 7); // YYYY-MM
    monthMap[key] = (monthMap[key] || 0) + 1;
  });
  const sortedMonths = Object.keys(monthMap).sort();
  const monthLabels = sortedMonths.map(m => {
    const [y, mo] = m.split('-');
    return `${y}/${parseInt(mo)}月`;
  });
  drawBarChart('monthChart', monthLabels, sortedMonths.map(m => monthMap[m]), '本数', '#8e44ad');

  // --- サマリー統計 ---
  const allDays = Object.values(grouped);
  const avg = allDays.length ? Math.round(records.length / allDays.length * 10) / 10 : 0;
  const maxEntry = allDays.reduce((a, b) => a.length > b.length ? a : b, []);
  const maxDate = Object.entries(grouped).find(([, v]) => v === maxEntry);
  const pricePerCig = settings.pricePerBox / settings.cigsPerBox;

  document.getElementById('avgDay').textContent = avg + '本';
  document.getElementById('maxDay').textContent = maxEntry.length + '本';
  document.getElementById('totalAll').textContent = records.length + '本';
  document.getElementById('totalCost').textContent = '¥' + Math.round(records.length * pricePerCig).toLocaleString();
}

// ---------- グラフ描画 ----------

const chartInstances = {};

function drawBarChart(canvasId, labels, data, label, color = '#e94560') {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;

  if (chartInstances[canvasId]) {
    chartInstances[canvasId].destroy();
  }

  chartInstances[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label,
        data,
        backgroundColor: color + 'cc',
        borderColor: color,
        borderRadius: 6,
        borderWidth: 1,
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1, color: getComputedStyle(document.documentElement).getPropertyValue('--sub') },
          grid: { color: 'rgba(128,128,128,0.15)' }
        },
        x: {
          ticks: { color: getComputedStyle(document.documentElement).getPropertyValue('--sub'), maxRotation: 45 },
          grid: { display: false }
        }
      }
    }
  });
}

// ---------- ナビゲーション ----------

function switchPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + pageId).classList.add('active');
  document.querySelector(`[data-page="${pageId}"]`).classList.add('active');

  // ページ表示時に必要な更新
  if (pageId === 'stats') updateStats();
  if (pageId === 'history') updateHistory();
}

// ---------- 設定 ----------

function loadSettingsUI() {
  const s = getSettings();
  document.getElementById('pricePerBox').value = s.pricePerBox;
  document.getElementById('cigsPerBox').value = s.cigsPerBox;
  document.getElementById('dailyGoal').value = s.dailyGoal;
}

// ---------- CSVエクスポート ----------

function exportCSV() {
  const records = getRecords();
  if (records.length === 0) { showToast('データがありません'); return; }

  const header = '日付,時刻\n';
  const rows = records.map(r => {
    const d = new Date(r.time);
    return `${d.toLocaleDateString('ja-JP')},${d.toLocaleTimeString('ja-JP')}`;
  }).join('\n');

  const blob = new Blob(['\uFEFF' + header + rows], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `smoking_log_${today()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('📤 エクスポートしました');
}

// ---------- トースト通知 ----------

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2200);
}

// ---------- テーマ切替 ----------

function toggleTheme() {
  const html = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  html.setAttribute('data-theme', isDark ? 'light' : 'dark');
  document.getElementById('themeToggle').textContent = isDark ? '🌙' : '☀️';
  localStorage.setItem('theme', isDark ? 'light' : 'dark');
  // グラフ再描画（色が変わるため）
  setTimeout(updateAll, 50);
}

// ---------- イベントリスナー ----------

document.addEventListener('DOMContentLoaded', () => {

  // テーマ復元
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  document.getElementById('themeToggle').textContent = savedTheme === 'dark' ? '☀️' : '🌙';

  // 記録ボタン
  document.getElementById('recordBtn').addEventListener('click', recordSmoke);

  // ナビゲーション
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchPage(btn.dataset.page));
  });

  // テーマ切替
  document.getElementById('themeToggle').addEventListener('click', toggleTheme);

  // 設定保存
  document.getElementById('saveSettings').addEventListener('click', () => {
    const settings = {
      pricePerBox: Number(document.getElementById('pricePerBox').value) || 580,
      cigsPerBox: Number(document.getElementById('cigsPerBox').value) || 20,
      dailyGoal: Number(document.getElementById('dailyGoal').value) || 0,
    };
    saveSettings(settings);
    showToast('✅ 設定を保存しました');
    updateHome();
  });

  // 今日のリセット
  document.getElementById('clearTodayBtn').addEventListener('click', () => {
    if (!confirm('今日の記録を削除しますか？')) return;
    const records = getRecords().filter(r => r.time.slice(0, 10) !== today());
    saveRecords(records);
    showToast('🗑️ 今日の記録を削除しました');
    updateAll();
  });

  // CSVエクスポート
  document.getElementById('exportBtn').addEventListener('click', exportCSV);

  // 全データ削除
  document.getElementById('deleteAllBtn').addEventListener('click', () => {
    if (!confirm('⚠️ 全データを削除しますか？この操作は取り消せません。')) return;
    saveRecords([]);
    showToast('🗑️ 全データを削除しました');
    updateAll();
  });

  // 設定UI読み込み
  loadSettingsUI();

  // 初期表示
  updateAll();
});

// ---------- PWAインストール ----------

let deferredPrompt;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  document.getElementById('installBtn').style.display = 'block';
});

document.getElementById('installBtn')?.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const result = await deferredPrompt.userChoice;
  if (result.outcome === 'accepted') showToast('📲 インストールしました！');
  deferredPrompt = null;
});