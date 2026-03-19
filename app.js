/* ─── STATE ──────────────────────────────────────────────────── */
let debtCount = 0;
let chartInstance = null;
let lastPayload = null; // Store for what-if scenarios
let lastSimResult = null;

const API_BASE = window.location.origin; // same origin (FastAPI serves frontend)

/* ─── INIT ───────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  addDebt(); // Start with one debt card
});

/* ─── DEBT CARD ──────────────────────────────────────────────── */
function addDebt() {
  debtCount++;
  const id = debtCount;
  const container = document.getElementById('debts-container');

  const card = document.createElement('div');
  card.className = 'debt-card';
  card.id = `debt-card-${id}`;
  card.innerHTML = `
    <div class="debt-card-header">
      <span class="debt-card-num">DEBT #${String(id).padStart(2, '0')}</span>
      ${id > 1 ? `<button class="remove-debt-btn" onclick="removeDebt(${id})">✕ Remove</button>` : ''}
    </div>
    <div class="debt-grid">
      <div class="field-group">
        <label>Debt Name</label>
        <input type="text" id="debt-name-${id}" placeholder="e.g. Credit Card, Car Loan" />
      </div>
      <div class="field-group">
        <label>Current Balance</label>
        <input type="number" id="debt-balance-${id}" placeholder="5000" min="0" />
      </div>
      <div class="field-group">
        <label>Annual Interest Rate (%)</label>
        <input type="number" id="debt-rate-${id}" placeholder="18" min="0" max="200" step="0.1" />
      </div>
      <div class="field-group">
        <label>Minimum Monthly Payment</label>
        <input type="number" id="debt-min-${id}" placeholder="150" min="0" />
      </div>
    </div>
  `;
  container.appendChild(card);
}

function removeDebt(id) {
  const card = document.getElementById(`debt-card-${id}`);
  if (card) card.remove();
}

/* ─── BUILD PAYLOAD ──────────────────────────────────────────── */
function buildPayload() {
  const income = parseFloat(document.getElementById('income').value);
  const expenses = parseFloat(document.getElementById('expenses').value);
  const years = parseInt(document.getElementById('years').value);
  const currency = document.getElementById('currency').value;

  if (!income || income <= 0) throw new Error('Please enter your monthly income.');
  if (isNaN(expenses) || expenses < 0) throw new Error('Please enter your monthly expenses.');

  const debtCards = document.querySelectorAll('.debt-card');
  if (debtCards.length === 0) throw new Error('Please add at least one debt.');

  const debts = [];
  for (const card of debtCards) {
    const cardId = card.id.split('-')[2];
    const name    = document.getElementById(`debt-name-${cardId}`)?.value?.trim();
    const balance = parseFloat(document.getElementById(`debt-balance-${cardId}`)?.value);
    const rate    = parseFloat(document.getElementById(`debt-rate-${cardId}`)?.value);
    const min     = parseFloat(document.getElementById(`debt-min-${cardId}`)?.value);

    if (!name) throw new Error(`Debt #${cardId}: Please enter a name.`);
    if (!balance || balance <= 0) throw new Error(`"${name || 'Debt #' + cardId}": Please enter a valid balance.`);
    if (isNaN(rate) || rate < 0) throw new Error(`"${name}": Please enter a valid interest rate.`);
    if (!min || min <= 0) throw new Error(`"${name}": Please enter a minimum payment.`);

    debts.push({
      name,
      balance,
      annual_interest_rate: rate / 100,
      minimum_payment: min,
    });
  }

  return { monthly_income: income, monthly_essential_expenses: expenses, debts, projection_years: years, currency };
}

/* ─── MAIN ANALYSIS ──────────────────────────────────────────── */
async function runAnalysis() {
  clearError();

  let payload;
  try {
    payload = buildPayload();
  } catch (e) {
    showError(e.message);
    return;
  }

  setLoading(true);

  try {
    const res = await fetch(`${API_BASE}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Server error. Please try again.');
    }

    const data = await res.json();
    lastPayload = payload;
    lastSimResult = data.simulation;
    displayResults(data, payload);
  } catch (e) {
    showError(e.message || 'Failed to reach the server. Is the backend running?');
  } finally {
    setLoading(false);
  }
}

/* ─── DISPLAY RESULTS ────────────────────────────────────────── */
function displayResults(data, payload) {
  const { simulation, advice } = data;
  const sym = payload.currency;

  document.getElementById('form-section').style.display = 'none';
  const resultsEl = document.getElementById('results-section');
  resultsEl.style.display = 'block';

  // Emergency Mode check
  const firstMonthDti = simulation.projection[0]?.dti_ratio || 0;
  if (simulation.spiral_detected || firstMonthDti > 43) {
    document.body.classList.add('emergency-mode');
  } else {
    document.body.classList.remove('emergency-mode');
  }

  // Daily Bleed
  updateDailyBleed(payload);

  // Show What-If panel
  document.getElementById('what-if-panel').style.display = 'block';
  // Reset sliders
  document.getElementById('slider-extra').value = 0;
  document.getElementById('slider-reduction').value = 0;
  document.getElementById('slider-rate').value = 0;
  document.getElementById('val-extra').textContent = '$0';
  document.getElementById('val-reduction').textContent = '$0';
  document.getElementById('val-rate').textContent = '0%';

  // Summary cards
  renderSummaryCards(simulation, sym);

  // Chart
  renderChart(simulation, sym);

  // Spiral annotation
  updateSpiralAnnotation(simulation);

  // AI advice (with typewriter)
  renderAdviceWithTypewriter(advice);

  setTimeout(() => resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
}

/* ─── SUMMARY CARDS ──────────────────────────────────────────── */
function renderSummaryCards(sim, sym) {
  const cards = [
    {
      label: 'Total Debt Today',
      value: formatMoney(sim.initial_total_debt, sym),
      cls: 'red',
      sub: 'across all debts',
    },
    {
      label: sim.spiral_detected ? 'Spiral Threshold' : 'Debt Free In',
      value: sim.spiral_detected
        ? `Month ${sim.spiral_month}`
        : sim.debt_free_month
          ? `${sim.debt_free_month} months`
          : 'Ongoing',
      cls: sim.spiral_detected ? 'red' : 'green',
      sub: sim.spiral_detected
        ? `${Math.floor(sim.spiral_month / 12)}yr ${sim.spiral_month % 12}mo from now`
        : sim.debt_free_month
          ? `${Math.floor(sim.debt_free_month / 12)} years from now`
          : '',
      cardCls: sim.spiral_detected ? 'is-danger' : 'is-safe',
    },
    {
      label: 'Est. Interest Cost',
      value: formatMoney(sim.total_interest_estimated, sym),
      cls: 'amber',
      sub: 'extra you pay beyond principal',
    },
    {
      label: 'Peak Debt Projected',
      value: formatMoney(sim.peak_debt, sym),
      cls: 'red',
      sub: 'highest point in simulation',
    },
  ];

  const container = document.getElementById('summary-cards');
  container.innerHTML = cards
    .map(
      (c, i) => `
    <div class="summary-card ${c.cardCls || ''}" style="animation-delay:${i * 0.08}s">
      <div class="sc-label">${c.label}</div>
      <div class="sc-value ${c.cls}">${c.value}</div>
      <div class="sc-sub">${c.sub}</div>
    </div>`,
    )
    .join('');
}

/* ─── CHART ──────────────────────────────────────────────────── */
function renderChart(sim, sym) {
  const canvas = document.getElementById('debtChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  
  if (chartInstance) { 
    chartInstance.destroy(); 
    chartInstance = null; 
  }

  const proj = sim.projection;
  const spiralM = sim.spiral_month;
  const income = lastPayload ? lastPayload.monthly_income : 0;

  // Sampling for readability
  const sampled = proj.filter((_, i) => i % 3 === 0 || i === proj.length - 1);
  const labels = sampled.map(p => `Month ${p.month}`);
  
  // Find index for vertical annotation
  const spiralIdx = spiralM ? sampled.findIndex(p => p.month >= spiralM) : -1;

  // Data for datasets
  const debtTotal = sampled.map(p => p.total_debt);
  const debtSafe = sampled.map(p => (spiralM && p.month > spiralM) ? null : p.total_debt);
  const debtDanger = sampled.map(p => (spiralM && p.month < spiralM) ? null : p.total_debt);
  const incomeData = sampled.map(() => income);

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          // Hidden dataset 0 for insolvency fill calculation
          label: 'Hidden Total',
          data: debtTotal,
          fill: false,
          pointRadius: 0,
          borderWidth: 0,
          showLine: false
        },
        {
          label: 'Total Debt (Safe)',
          data: debtSafe,
          borderColor: '#4f7fff',
          backgroundColor: ctx => {
            const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, 300);
            g.addColorStop(0, 'rgba(79, 127, 255, 0.4)');
            g.addColorStop(1, 'rgba(79, 127, 255, 0)');
            return g;
          },
          borderWidth: 2.5,
          fill: true,
          tension: 0.3,
          pointRadius: sampled.map(p => (spiralM && p.month === spiralM) ? 5 : 0),
          pointBackgroundColor: '#4f7fff',
        },
        {
          label: 'Total Debt (Danger)',
          data: debtDanger,
          borderColor: '#ff3b3b',
          backgroundColor: ctx => {
            const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, 300);
            g.addColorStop(0, 'rgba(255, 59, 59, 0.4)');
            g.addColorStop(1, 'rgba(255, 59, 59, 0)');
            return g;
          },
          borderWidth: 2.5,
          fill: true,
          tension: 0.3,
          pointRadius: sampled.map(p => (spiralM && p.month === spiralM) ? 5 : 0),
          pointBackgroundColor: '#ff3b3b',
        },
        {
          label: 'Monthly Income',
          data: incomeData,
          borderColor: '#00d4a1',
          borderWidth: 2,
          borderDash: [5, 5],
          pointRadius: 0,
          tension: 0,
          fill: {
            target: '0', // Fill to Hidden Total (index 0)
            above: 'rgba(255, 59, 59, 0.15)', // Red if Income > Hidden Total? Wait, no.
            below: 'rgba(0, 212, 161, 0.08)', // Blue if Income < Hidden Total?
            // User says: "When debt > income ... shade red with 15%", "When debt < income, shade blue with 8%"
            // So if target is Hidden Total (Debt):
            // If Income is ABOVE Debt (Debt < Income) -> shade blue 8%
            // If Income is BELOW Debt (Debt > Income) -> shade red 15%
            above: 'rgba(0, 212, 161, 0.08)', 
            below: 'rgba(255, 59, 59, 0.15)'
          }
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: 'index' },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#6b7490', font: { family: 'Space Mono', size: 10 }, maxTicksLimit: 12 }
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: {
            color: '#6b7490',
            font: { family: 'Space Mono', size: 10 },
            callback: v => sym + v.toLocaleString()
          }
        }
      },
      plugins: {
        legend: {
          position: 'top',
          align: 'end',
          labels: {
            boxWidth: 20,
            boxHeight: 2,
            color: '#fff',
            font: { family: 'Space Mono', size: 11 },
            filter: (item) => ['Total Debt (Safe)', 'Monthly Income'].includes(item.text)
          },
          // Map label text for cleaner legend
          onClick: (e, legendItem, legend) => {
            if (legendItem.text === 'Total Debt (Safe)') {
              legendItem.text = 'Total Debt';
            }
          }
        },
        tooltip: {
          backgroundColor: '#161922',
          titleFont: { family: 'Space Mono', size: 12 },
          bodyFont: { family: 'Space Mono', size: 12 },
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          padding: 12,
          callbacks: {
            label: ctx => {
              if (ctx.dataset.label === 'Hidden Total') return null;
              const label = ctx.dataset.label.includes('Debt') ? 'Total Debt' : ctx.dataset.label;
              return ` ${label}: ${sym}${ctx.parsed.y.toLocaleString()}`;
            }
          }
        },
        annotation: {
          annotations: spiralIdx !== -1 ? {
            line1: {
              type: 'line',
              xMin: spiralIdx,
              xMax: spiralIdx,
              borderColor: '#ff0a56',
              borderWidth: 2.5,
              borderDash: [8, 4],
              label: {
                display: true,
                content: '⚠ POINT OF NO RETURN',
                position: 'start',
                backgroundColor: 'rgba(255, 10, 86, 0.15)',
                color: '#ff0a56',
                font: { family: 'Space Mono', size: 11, weight: 'bold' },
                padding: 6
              }
            }
          } : {}
        }
      }
    }
  });
}

/* ─── AI ADVICE ──────────────────────────────────────────────── */
function renderAdviceWithTypewriter(advice) {
  const el = document.getElementById('advice-content');
  el.innerHTML = ''; // Clear existing
  
  // Create a pre-style container for the typewriter effect
  const typeContainer = document.createElement('div');
  typeContainer.style.fontFamily = 'monospace';
  typeContainer.style.whiteSpace = 'pre-wrap';
  el.appendChild(typeContainer);

  typewriter(advice, typeContainer, () => {
    // Swap to formatted HTML when done
    renderAdvice(advice);
  });
}

function typewriter(text, targetEl, onComplete) {
  let i = 0;
  const interval = setInterval(() => {
    targetEl.textContent += text[i];
    i++;
    if (i >= text.length) {
      clearInterval(interval);
      if (onComplete) onComplete();
    }
  }, 18);
}

function renderAdvice(advice) {
  const el = document.getElementById('advice-content');

  // Split into lines, wrap section headers in block divs, convert rest to HTML
  const lines = advice.split('\n');
  const sectionTitles = new Set(['SITUATION', 'RED FLAGS', 'EXIT STRATEGIES', 'BOTTOM LINE']);
  let html = '';
  for (const line of lines) {
    const trimmed = line.trim();
    if (sectionTitles.has(trimmed)) {
      html += `<div class="advice-block-title">${trimmed}</div>`;
    } else if (trimmed === '') {
      html += '<br>';
    } else {
      // Escape and append as a paragraph line
      const escaped = trimmed.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      html += escaped + '<br>';
    }
  }

  el.innerHTML = html;
}

/* ─── HELPERS ────────────────────────────────────────────────── */
function formatMoney(val, sym) {
  if (val >= 1_000_000) return `${sym}${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1000) return `${sym}${(val / 1000).toFixed(1)}k`;
  return `${sym}${val.toFixed(0)}`;
}

function setLoading(state) {
  const btn = document.getElementById('analyze-btn');
  const text = document.getElementById('btn-text');
  const loader = document.getElementById('btn-loader');
  btn.disabled = state;
  text.style.display = state ? 'none' : 'inline';
  loader.style.display = state ? 'inline' : 'none';
  if (state) loader.classList.add('pulsing');
  else loader.classList.remove('pulsing');
}

function showError(msg) {
  clearError();
  const err = document.createElement('div');
  err.className = 'error-banner';
  err.id = 'error-banner';
  err.textContent = `⚠ ${msg}`;
  document.querySelector('.analyze-btn').before(err);
}

function clearError() {
  const existing = document.getElementById('error-banner');
  if (existing) existing.remove();
}

function resetForm() {
  document.body.classList.remove('emergency-mode');
  document.getElementById('results-section').style.display = 'none';
  document.getElementById('form-section').style.display = 'block';
  if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
  document.getElementById('form-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ─── NEW FEATURES ───────────────────────────────────────────── */

function updateDailyBleed(payload) {
  const el = document.getElementById('bleed-meter');
  const { debts, currency } = payload;
  
  let totalDebt = 0;
  let weightedInterestSum = 0;
  
  debts.forEach(d => {
    totalDebt += d.balance;
    weightedInterestSum += (d.balance * d.annual_interest_rate);
  });
  
  const avgRate = totalDebt > 0 ? weightedInterestSum / totalDebt : 0;
  const yearlyLoss = totalDebt * avgRate;
  const monthlyLoss = yearlyLoss / 12;
  const dailyLoss = yearlyLoss / 365;

  el.style.display = 'block';
  el.innerHTML = `⚡ You are losing ${currency}${dailyLoss.toFixed(2)} per day to interest — ${currency}${monthlyLoss.toFixed(0)} per month`;
}

function updateSpiralAnnotation(sim) {
  const ann = document.getElementById('spiral-annotation');
  if (sim.spiral_detected) {
    const m = sim.spiral_month;
    ann.style.display = 'block';
    ann.innerHTML = `⚠ DANGER POINT: Month ${m} (${Math.floor(m / 12)}yr ${m % 12}mo from now) — your debt-to-income ratio exceeds the 43% danger threshold. After this point, recovery without external help becomes extremely difficult.`;
  } else {
    ann.style.display = 'none';
  }
}

function updateVerdictBadge(sim) {
  const badge = document.getElementById('verdict-badge');
  if (sim.spiral_detected) {
    badge.className = 'verdict-badge danger';
    badge.textContent = '⚠ SPIRAL DETECTED';
  } else {
    badge.className = 'verdict-badge safe';
    badge.textContent = sim.debt_free_month ? '✓ ON TRACK' : '~ STABLE';
  }
}

async function updateWhatIf() {
  if (!lastPayload) return;

  const extra = parseFloat(document.getElementById('slider-extra').value);
  const reduction = parseFloat(document.getElementById('slider-reduction').value);
  const rateCut = parseFloat(document.getElementById('slider-rate').value) / 100;

  document.getElementById('val-extra').textContent = `$${extra}`;
  document.getElementById('val-reduction').textContent = `$${reduction}`;
  document.getElementById('val-rate').textContent = `${(rateCut * 100).toFixed(1)}%`;

  // Run sim in frontend
  const sim = simulateFrontend(lastPayload, { extra, reduction, rateCut });

  // Update Summary
  renderSummaryCards(sim, lastPayload.currency);
  updateVerdictBadge(sim);
  updateSpiralAnnotation(sim);

  // Update Chart
  if (chartInstance) {
    const proj = sim.projection;
    const sampled = proj.filter((_, i) => i % 3 === 0 || i === proj.length - 1);
    const spiralM = sim.spiral_month;
    const income = lastPayload ? lastPayload.monthly_income : 0;
    
    const debtTotal = sampled.map(p => p.total_debt);
    const debtSafe = sampled.map(p => (spiralM && p.month > spiralM) ? null : p.total_debt);
    const debtDanger = sampled.map(p => (spiralM && p.month < spiralM) ? null : p.total_debt);
    const incomeData = sampled.map(() => income);
    const spiralIdx = spiralM ? sampled.findIndex(p => p.month >= spiralM) : -1;

    chartInstance.data.labels = sampled.map(p => `Month ${p.month}`);
    chartInstance.data.datasets[0].data = debtTotal;
    chartInstance.data.datasets[1].data = debtSafe;
    chartInstance.data.datasets[2].data = debtDanger;
    chartInstance.data.datasets[3].data = incomeData;

    // Update Annotation
    if (chartInstance.options.plugins.annotation) {
      if (spiralIdx !== -1) {
        chartInstance.options.plugins.annotation.annotations.line1 = {
          type: 'line',
          xMin: spiralIdx,
          xMax: spiralIdx,
          borderColor: '#ff0a56',
          borderWidth: 2.5,
          borderDash: [8, 4],
          label: {
            display: true,
            content: '⚠ POINT OF NO RETURN',
            position: 'start',
            backgroundColor: 'rgba(255, 10, 86, 0.15)',
            color: '#ff0a56',
            font: { family: 'Space Mono', size: 11, weight: 'bold' },
            padding: 6
          }
        };
      } else {
        chartInstance.options.plugins.annotation.annotations = {};
      }
    }

    chartInstance.update('none');
  }
}

function simulateFrontend(financials, adj) {
  const months = financials.projection_years * 12;
  const debts = financials.debts.map(d => ({
    ...d,
    annual_interest_rate: Math.max(0, d.annual_interest_rate - adj.rateCut)
  }));
  
  const results = [];
  let spiral_month = null;
  let consecutive_shortfall = 0;
  const initial_total_debt = debts.reduce((sum, d) => sum + d.balance, 0);
  let total_interest_accrued = 0;

  for (let month = 1; month <= months; month++) {
    // Apply interest
    debts.forEach(d => {
      const monthlyRate = d.annual_interest_rate / 12;
      const interest = d.balance * monthlyRate;
      d.balance += interest;
      total_interest_accrued += interest;
    });

    const total_debt = debts.reduce((sum, d) => sum + d.balance, 0);
    const min_payments = debts.reduce((sum, d) => sum + d.minimum_payment, 0);
    
    // Adjust available cash
    const base_available = financials.monthly_income - financials.monthly_essential_expenses;
    const available_cash = base_available + adj.extra + adj.reduction;

    const shortfall = Math.max(0, min_payments - available_cash);
    const dti_ratio = financials.monthly_income > 0 ? (min_payments / financials.monthly_income) * 100 : 0;

    // Avalanche payments
    let payment_pool = Math.max(0, available_cash);
    const sorted = [...debts].sort((a,b) => b.annual_interest_rate - a.annual_interest_rate);
    for (const d of sorted) {
      if (payment_pool <= 0) break;
      const pay = Math.min(d.balance, payment_pool);
      d.balance -= pay;
      payment_pool -= pay;
    }

    const total_debt_after = debts.reduce((sum, d) => sum + d.balance, 0);
    
    if (shortfall > 0) consecutive_shortfall++;
    else consecutive_shortfall = 0;

    const debt_growth_rate = initial_total_debt > 0 ? total_debt_after / initial_total_debt : 1;
    const is_spiral = (consecutive_shortfall >= 3 || dti_ratio > 43 || (month === 12 && debt_growth_rate > 2.0));

    if (spiral_month === null && is_spiral) spiral_month = month;

    results.push({
      month,
      total_debt: total_debt_after,
      dti_ratio,
      shortfall,
      available_cash,
      min_payments
    });

    if (total_debt_after < 1.0) break;
  }

  const final_debt = results[results.length - 1].total_debt;
  const peak_debt = Math.max(...results.map(r => r.total_debt), initial_total_debt);

  return {
    projection: results,
    spiral_month,
    spiral_detected: spiral_month !== null,
    initial_total_debt,
    final_debt,
    peak_debt,
    total_interest_estimated: total_interest_accrued,
    debt_free_month: results.find(r => r.total_debt < 1.0)?.month || null
  };
}
