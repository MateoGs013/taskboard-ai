<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useSearchStore } from '@/stores/search';
import { useWorkspaceStore } from '@/stores/workspace';
import { useIssueStore } from '@/stores/issue';
import { useKeyboard } from '@/composables/useKeyboard';

const router = useRouter();
const search = useSearchStore();
const ws = useWorkspaceStore();
const issues = useIssueStore();

const inputEl = ref(null);
const cursor = ref(0);

let debounceHandle = null;
watch(() => search.query, (q) => {
  cursor.value = 0;
  if (debounceHandle) clearTimeout(debounceHandle);
  debounceHandle = setTimeout(() => search.search(ws.activeId), 180);
});

watch(() => search.open, async (open) => {
  if (open) { await nextTick(); inputEl.value?.focus(); }
});

useKeyboard({
  '!Escape': () => search.closePalette(),
  '!ArrowDown': () => { if (search.flat.length) cursor.value = (cursor.value + 1) % search.flat.length; },
  '!ArrowUp': () => { if (search.flat.length) cursor.value = (cursor.value - 1 + search.flat.length) % search.flat.length; },
  '!Enter': () => activate(),
});

const groups = computed(() => {
  const out = [];
  if (search.results.issues.length) out.push({ label: 'Issues', items: search.results.issues.map(i => ({ kind: 'issue', ...i })) });
  if (search.results.projects.length) out.push({ label: 'Proyectos', items: search.results.projects.map(p => ({ kind: 'project', ...p })) });
  if (search.results.cycles.length) out.push({ label: 'Cycles', items: search.results.cycles.map(c => ({ kind: 'cycle', ...c })) });
  return out;
});

const flatList = computed(() => groups.value.flatMap((g) => g.items));

async function activate(item) {
  const target = item || flatList.value[cursor.value];
  if (!target) return;
  if (target.kind === 'issue') {
    await issues.select(target.id);
    router.push({ name: 'board-team', params: { teamId: target.team_id } });
  } else if (target.kind === 'project') {
    router.push({ name: 'home' });
  } else if (target.kind === 'cycle') {
    router.push({ name: 'cycles' });
  }
  search.closePalette();
}
</script>

<template>
  <div v-if="search.open" class="cmdk" role="dialog" @click.self="search.closePalette()">
    <div class="cmdk__panel">
      <header>
        <span class="cmdk__icon">⌘K</span>
        <input
          ref="inputEl"
          v-model="search.query"
          type="text"
          placeholder="Buscar issues, proyectos, cycles…"
          autocomplete="off"
        />
        <button class="icon-btn" @click="search.closePalette()" aria-label="Cerrar">×</button>
      </header>

      <div class="cmdk__results">
        <p v-if="!search.query.trim()" class="muted small empty">
          Escribí para buscar. Las flechas mueven, Enter abre.
        </p>
        <p v-else-if="search.loading" class="muted small empty">Buscando…</p>
        <p v-else-if="!flatList.length" class="muted small empty">Sin resultados.</p>

        <template v-else v-for="g in groups" :key="g.label">
          <div class="cmdk__group">{{ g.label }}</div>
          <ul>
            <li
              v-for="(item, i) in g.items"
              :key="`${item.kind}-${item.id}`"
              :class="{ active: flatList.indexOf(item) === cursor }"
              @mouseenter="cursor = flatList.indexOf(item)"
              @click="activate(item)"
            >
              <span class="cmdk__kind">{{ item.kind === 'issue' ? '◇' : item.kind === 'project' ? '⊞' : '◎' }}</span>
              <span v-if="item.kind === 'issue'" class="identifier mono">{{ item.identifier }}</span>
              <span class="cmdk__title">
                {{ item.title || item.name || `Cycle #${item.number}` }}
              </span>
              <span class="muted small">{{ item.team_name || '' }}</span>
            </li>
          </ul>
        </template>
      </div>

      <footer class="cmdk__foot">
        <span><kbd>↑↓</kbd> mover</span>
        <span><kbd>↵</kbd> abrir</span>
        <span><kbd>Esc</kbd> cerrar</span>
      </footer>
    </div>
  </div>
</template>
