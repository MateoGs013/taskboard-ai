<script setup>
defineProps({
  issue: { type: Object, required: true },
  priorityDot: { type: String, default: 'none' },
});
</script>

<template>
  <article class="issue-card">
    <header>
      <span class="identifier">{{ issue.identifier }}</span>
      <span class="priority" :class="`p-${priorityDot}`" :title="`Priority ${priorityDot}`"></span>
    </header>
    <h4>{{ issue.title }}</h4>
    <footer>
      <div class="labels" v-if="issue.labels?.length">
        <span
          v-for="l in issue.labels.slice(0, 3)"
          :key="l.id"
          class="label"
          :style="{ '--lc': l.color }"
        >{{ l.name }}</span>
        <span v-if="issue.labels.length > 3" class="label-more">+{{ issue.labels.length - 3 }}</span>
      </div>
      <div class="assignee" v-if="issue.assignee_name" :title="issue.assignee_name">
        {{ issue.assignee_name[0] }}
      </div>
    </footer>
  </article>
</template>
