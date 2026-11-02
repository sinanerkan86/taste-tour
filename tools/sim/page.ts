// Browser report for the balance simulation (served by the Vite dev server at /sim.html).
import { Chart, registerables } from 'chart.js';
import { DISHES, SECTION_IDS } from '../../src/core/economy';
import { formatDuration, formatNumber } from '../../src/core/format';
import { simulate, type SimResult } from './simulate';

Chart.register(...registerables);

const CYCLE_COLORS = ['#c0392b', '#1f6f8b', '#e08e0b', '#4a8c3a', '#7b4fa0', '#b8693d', '#2f8fb0', '#8c2f39'];
const SECTION_COLORS = ['#c0392b', '#e08e0b', '#4a8c3a', '#1f6f8b', '#7b4fa0', '#8a7a6a'];

const charts: Chart[] = [];

function element<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

function readOptions() {
  return {
    incomeBoost: Number(element<HTMLSelectElement>('boost').value),
    prestigeGain: Number(element<HTMLSelectElement>('gain').value),
    maxCycles: Number(element<HTMLSelectElement>('cycles').value),
    maxSeconds: 48 * 3600,
  };
}

function renderKpis(result: SimResult): void {
  const first = result.cycles[0];
  const total = result.cycles.reduce((sum, c) => sum + c.duration, 0);
  const kpis = [
    ['First franchise after', formatDuration(first.duration)],
    ['First new dish after', formatDuration(first.dishUnlocks[1]?.time ?? NaN)],
    ['Longest wait in first cycle', formatDuration(first.longestWait)],
    [`Total time for ${result.cycles.length} cycles`, formatDuration(total)],
  ];
  element('kpis').innerHTML = kpis
    .map(([label, value]) => `<div class="kpi"><div class="v">${value}</div><div class="l">${label}</div></div>`)
    .join('');
}

function renderIncomeChart(result: SimResult): void {
  const datasets = result.cycles.map((cycle) => ({
    label: `Cycle ${cycle.index + 1}`,
    data: result.samples.filter((s) => s.cycle === cycle.index).map((s) => ({ x: s.time / 60, y: s.income })),
    borderColor: CYCLE_COLORS[cycle.index % CYCLE_COLORS.length],
    backgroundColor: CYCLE_COLORS[cycle.index % CYCLE_COLORS.length],
    borderWidth: 2,
    pointRadius: 0,
    stepped: true as const,
  }));
  charts.push(
    new Chart(element<HTMLCanvasElement>('income'), {
      type: 'line',
      data: { datasets },
      options: {
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: 'nearest', intersect: false },
        scales: {
          x: { type: 'linear', title: { display: true, text: 'minutes of active play' } },
          y: { type: 'logarithmic', ticks: { callback: (v) => formatNumber(Number(v)) } },
        },
        plugins: {
          tooltip: {
            callbacks: {
              title: (items) => formatDuration(items[0].parsed.x! * 60),
              label: (item) => `${item.dataset.label}: ${formatNumber(item.parsed.y!)}/s`,
            },
          },
        },
      },
    }),
  );
}

function renderBottleneckChart(result: SimResult): void {
  const datasets = SECTION_IDS.map((id, i) => ({
    label: id,
    data: result.cycles.map((c) => Math.round((c.bottleneckSeconds[id] / c.duration) * 100)),
    backgroundColor: SECTION_COLORS[i],
  }));
  charts.push(
    new Chart(element<HTMLCanvasElement>('bottleneck'), {
      type: 'bar',
      data: { labels: result.cycles.map((c) => `Cycle ${c.index + 1}`), datasets },
      options: {
        indexAxis: 'y',
        maintainAspectRatio: false,
        animation: false,
        scales: { x: { stacked: true, max: 100, ticks: { callback: (v) => `${v}%` } }, y: { stacked: true } },
        plugins: { tooltip: { callbacks: { label: (item) => `${item.dataset.label}: ${item.parsed.x}%` } } },
      },
    }),
  );
}

function renderTable(id: string, headers: string[], rows: (string | number)[][]): void {
  const head = `<tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr>`;
  const body = rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`).join('');
  element(id).innerHTML = head + body;
}

function render(): void {
  charts.splice(0).forEach((chart) => chart.destroy());
  const result = simulate(readOptions());
  renderKpis(result);
  renderIncomeChart(result);
  renderBottleneckChart(result);
  renderTable(
    'cycles-table',
    ['Cycle', 'Duration', 'Stars before', 'Stars gained', 'Final income/s', 'Purchases', 'Longest wait'],
    result.cycles.map((c) => [
      c.index + 1,
      formatDuration(c.duration),
      c.starsBefore,
      c.starsGained,
      formatNumber(c.finalIncome),
      c.purchases,
      formatDuration(c.longestWait),
    ]),
  );
  renderTable(
    'dishes-table',
    ['Cycle', ...DISHES.map((d) => d.id)],
    result.cycles.map((c) => [
      c.index + 1,
      ...DISHES.map((d) => {
        const unlock = c.dishUnlocks.find((u) => u.dish === d.id);
        return unlock ? formatDuration(unlock.time) : '-';
      }),
    ]),
  );
}

['boost', 'gain', 'cycles'].forEach((id) => element(id).addEventListener('change', render));
render();
