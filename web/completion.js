import { api, el } from './api.js';

function percentBar(value, label) {
  const wrapper = el('div', undefined, 'completion-bar');
  const top = el('div', undefined, 'space-between');
  top.append(el('span', label), el('strong', `${value}%`));
  const track = el('div', undefined, 'completion-track');
  const fill = el('div', undefined, 'completion-fill');
  fill.style.width = `${Math.max(0, Math.min(100, value))}%`;
  track.append(fill);
  wrapper.append(top, track);
  return wrapper;
}

function render(scorecard) {
  const host = document.querySelector('#matterhorn-completion');
  if (!host) return;
  host.replaceChildren();

  const headline = el('div', undefined, 'completion-headline');
  headline.append(
    el('div', `${scorecard.productionReadiness} / 100`, 'completion-score'),
    el('div', 'Matterhorn 100 · production readiness', 'muted-sm'),
  );
  host.append(
    headline,
    percentBar(scorecard.capabilityCoverage, 'Capability coverage'),
    percentBar(scorecard.productionReadiness, 'Production readiness'),
  );

  const grid = el('div', undefined, 'completion-grid');
  for (const pillar of scorecard.pillars) {
    const card = el('div', undefined, 'completion-pillar');
    card.append(
      el('strong', pillar.label),
      el('span', `${pillar.productionReadiness}% ready · ${pillar.capabilityCoverage}% capability`, 'muted-sm'),
    );
    card.append(percentBar(pillar.productionReadiness, 'Ready'));
    grid.append(card);
  }
  host.append(grid);

  const next = el('div', undefined, 'completion-next');
  next.append(el('h3', 'Critical next'));
  const list = document.createElement('ol');
  for (const item of scorecard.criticalNext) list.append(el('li', item));
  next.append(list);
  host.append(next);
}

export async function loadCompletionScorecard() {
  const scorecard = await api('/api/studio/completion');
  render(scorecard);
  return scorecard;
}
