const columns = 6;
const rows = 5;
const years = Object.keys(activity).map(Number).sort((a, b) => a - b);
const first = years[0];
const last = years.at(-1);
const icons = {
  C: 'c', 'C++': 'cplusplus', Haskell: 'haskell', Java: 'java', JavaScript: 'javascript',
  Python: 'python', Rust: 'rust', Scala: 'scala', TypeScript: 'typescript',
};
const colors = {
  C: ['#d6f2ed', '#94cbbd'], 'C++': ['#e8d9ff', '#b6a0e6'], Haskell: ['#ede0fb', '#bea4d8'],
  Java: ['#fce1cd', '#eaba96'], JavaScript: ['#fff7c6', '#efd273'], Python: ['#e1f1ff', '#8fc6ed'],
  Rust: ['#ffe4cc', '#f2a474'], Scala: ['#ffdbe6', '#f1a0b6'], TypeScript: ['#d9e6ff', '#92aef0'],
  Diamond: ['#e8eaf0', '#b5bdcb'], Circle: ['#f5f5f6', '#c9cbd1'],
};
const shapes = ['27%', '45%', '23%', '42% 25%', '25% 42%'];
const board = document.querySelector('#board');
const from = document.querySelector('#from');
const to = document.querySelector('#to');
const message = document.querySelector('#message');
const scoreLabel = document.querySelector('#score');
const languages = document.querySelector('#languages');
const reset = document.querySelector('#reset');
const options = new URLSearchParams(location.search);
const buttons = Array.from({ length: columns * rows }, (_, index) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'tile';
  button.addEventListener('click', () => select(index));
  board.append(button);
  return button;
});

let grid;
let palette;
let selected;
let score;
let busy;
let game = 0;

for (const field of [from, to]) {
  for (const year of years) field.add(new Option(year, year));
}
const initialYear = options.get('year');
const requested = (value, fallback) => years.includes(Number(value)) ? Number(value) : fallback;
from.value = requested(options.get('from') || initialYear, first);
to.value = requested(options.get('to') || initialYear, last);

function languagesFor(start, end) {
  const totals = new Map();
  for (const year of years.filter(year => year >= start && year <= end)) {
    for (const [name, count] of Object.entries(activity[year])) {
      totals.set(name, (totals.get(name) || 0) + count);
    }
  }
  return [...totals].sort(([a, countA], [b, countB]) => countB - countA || a.localeCompare(b))
    .slice(0, 5).map(([name]) => name);
}

function matchIndexes(tiles) {
  const hits = new Set();
  tiles.forEach((name, index) => {
    for (const step of [1, columns]) {
      if (step === 1 && index % columns >= columns - 2) continue;
      if (name === tiles[index + step] && name === tiles[index + 2 * step]) {
        hits.add(index).add(index + step).add(index + 2 * step);
      }
    }
  });
  return hits;
}

function swap(tiles, a, b) {
  [tiles[a], tiles[b]] = [tiles[b], tiles[a]];
}

function hasMove(tiles) {
  for (let i = 0; i < tiles.length; i++) {
    const neighbors = [];
    if (i % columns < columns - 1) neighbors.push(i + 1);
    if (i + columns < tiles.length) neighbors.push(i + columns);
    for (const j of neighbors) {
      if (tiles[i] === tiles[j]) continue;
      swap(tiles, i, j);
      const possible = matchIndexes(tiles).size > 0;
      swap(tiles, i, j);
      if (possible) return true;
    }
  }
  return false;
}

function newGrid() {
  let tiles;
  do {
    tiles = [];
    for (let i = 0; i < buttons.length; i++) {
      const choices = palette.filter(name => {
        const horizontal = i % columns >= 2 && tiles[i - 1] === name && tiles[i - 2] === name;
        const vertical = tiles[i - columns] === name && tiles[i - 2 * columns] === name;
        return !horizontal && !vertical;
      });
      tiles.push(random(choices));
    }
  } while (!hasMove(tiles));
  return tiles;
}

function random(values) {
  return values[Math.floor(Math.random() * values.length)];
}

function render(hits = new Set(), drops = new Set()) {
  buttons.forEach((button, index) => {
    const name = grid[index];
    if (button.dataset.kind !== name) {
      button.dataset.kind = name;
      const icon = icons[name];
      if (icon) {
        const image = document.createElement('img');
        image.alt = '';
        image.src = 'https://cdn.jsdelivr.net/gh/devicons/devicon@6910f0503efdd315c8f9b858234310c06e04d9c0/icons/' + icon + '/' + icon + '-original.svg';
        image.addEventListener('error', () => image.replaceWith(name.slice(0, 2)), { once: true });
        button.replaceChildren(image);
      } else {
        button.textContent = name === 'Diamond' ? '◆' : name === 'Circle' ? '●' : name.slice(0, 2);
      }
    }
    const [top, bottom] = colors[name] || ['#e5ebf4', '#b6c2d3'];
    button.style.setProperty('--top', top);
    button.style.setProperty('--bottom', bottom);
    button.style.setProperty('--shape', shapes[palette.indexOf(name)]);
    button.setAttribute('aria-label', name + ', row ' + (Math.floor(index / columns) + 1) + ', column ' + (index % columns + 1));
    button.setAttribute('aria-pressed', String(selected === index));
    button.classList.toggle('is-match', hits.has(index));
    button.classList.toggle('is-falling', drops.has(index));
  });
  scoreLabel.value = score;
}

function drop(hits) {
  const changed = new Set();
  for (let column = 0; column < columns; column++) {
    let writeRow = rows - 1;
    for (let row = rows - 1; row >= 0; row--) {
      const index = row * columns + column;
      if (hits.has(index)) continue;
      const target = writeRow * columns + column;
      grid[target] = grid[index];
      if (target !== index) changed.add(target);
      writeRow--;
    }
    while (writeRow >= 0) {
      const index = writeRow * columns + column;
      grid[index] = random(palette);
      changed.add(index);
      writeRow--;
    }
  }
  return changed;
}

const pause = () => new Promise(resolve => setTimeout(resolve, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 220));

async function select(index) {
  if (busy) return;
  const previous = selected;
  if (previous === null || previous === index) {
    selected = previous === index ? null : index;
    message.textContent = selected === null ? '' : 'Choose a neighboring tile.';
    render();
    return;
  }
  const distance = Math.abs(Math.floor(index / columns) - Math.floor(previous / columns))
    + Math.abs(index % columns - previous % columns);
  if (distance !== 1) {
    selected = index;
    render();
    return;
  }

  selected = null;
  swap(grid, previous, index);
  let hits = matchIndexes(grid);
  if (!hits.size) {
    swap(grid, previous, index);
    message.textContent = 'Try another swap.';
    render();
    return;
  }

  busy = true;
  const currentGame = game;
  let total = 0;
  while (hits.size) {
    total += hits.size;
    score += hits.size;
    render(hits);
    await pause();
    if (currentGame !== game) return;
    render(new Set(), drop(hits));
    await pause();
    if (currentGame !== game) return;
    hits = matchIndexes(grid);
  }
  const shuffled = !hasMove(grid);
  if (shuffled) grid = newGrid();
  busy = false;
  message.textContent = shuffled ? 'No moves left. Board shuffled.' : total + ' tiles matched.';
  render();
}

function start(changed) {
  if (Number(from.value) > Number(to.value)) {
    if (changed === to) from.value = to.value;
    else to.value = from.value;
  }
  const names = languagesFor(Number(from.value), Number(to.value));
  palette = [...names];
  if (palette.length < 3) palette.push('Diamond');
  if (palette.length < 3) palette.push('Circle');
  languages.textContent = names.join(' · ') + (names.length < 3 ? ' · Neutral pieces fill the board' : '');
  selected = null;
  score = 0;
  busy = false;
  game++;
  grid = newGrid();
  message.textContent = '';
  render();

  if (changed) {
    const url = new URL(location.href);
    url.searchParams.delete('year');
    url.searchParams.set('from', from.value);
    url.searchParams.set('to', to.value);
    history.replaceState(null, '', url);
  }
}

from.addEventListener('change', () => start(from));
to.addEventListener('change', () => start(to));
reset.addEventListener('click', () => start());
start();
