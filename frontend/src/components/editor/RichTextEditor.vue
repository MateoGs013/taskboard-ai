<script setup>
import { useEditor, EditorContent } from '@tiptap/vue-3';
import StarterKit from '@tiptap/starter-kit';
import { watch } from 'vue';

const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: 'Escribí acá…' },
  minHeight: { type: String, default: '120px' },
});
const emit = defineEmits(['update:modelValue']);

const editor = useEditor({
  content: props.modelValue,
  extensions: [
    StarterKit.configure({
      heading: { levels: [2, 3] },
      codeBlock: { HTMLAttributes: { class: 'rte__code' } },
    }),
  ],
  editorProps: { attributes: { class: 'rte__content' } },
  onUpdate: ({ editor }) => emit('update:modelValue', editor.getHTML()),
});

watch(() => props.modelValue, (v) => {
  if (editor.value && editor.value.getHTML() !== v) editor.value.commands.setContent(v || '');
});

function toggle(fn) { editor.value?.chain().focus()[fn]().run(); }
function isActive(name, attrs) { return editor.value?.isActive(name, attrs) ?? false; }
</script>

<template>
  <div class="rte" :style="{ '--rte-min': minHeight }">
    <div class="rte__toolbar" v-if="editor">
      <button type="button" @click="toggle('toggleBold')" :class="{ active: isActive('bold') }" title="Negrita" tabindex="-1"><b>B</b></button>
      <button type="button" @click="toggle('toggleItalic')" :class="{ active: isActive('italic') }" title="Cursiva" tabindex="-1"><i>I</i></button>
      <button type="button" @click="toggle('toggleStrike')" :class="{ active: isActive('strike') }" title="Tachado" tabindex="-1"><s>S</s></button>
      <span class="rte__sep"></span>
      <button type="button" @click="editor.chain().focus().toggleHeading({ level: 2 }).run()" :class="{ active: isActive('heading', { level: 2 }) }" title="H2" tabindex="-1">H2</button>
      <button type="button" @click="editor.chain().focus().toggleHeading({ level: 3 }).run()" :class="{ active: isActive('heading', { level: 3 }) }" title="H3" tabindex="-1">H3</button>
      <span class="rte__sep"></span>
      <button type="button" @click="toggle('toggleBulletList')" :class="{ active: isActive('bulletList') }" title="Lista" tabindex="-1">•</button>
      <button type="button" @click="toggle('toggleOrderedList')" :class="{ active: isActive('orderedList') }" title="Numerada" tabindex="-1">1.</button>
      <button type="button" @click="toggle('toggleTaskList' in editor.commands ? 'toggleTaskList' : 'toggleBulletList')" title="Checklist" tabindex="-1">☐</button>
      <span class="rte__sep"></span>
      <button type="button" @click="toggle('toggleCode')" :class="{ active: isActive('code') }" title="Inline code" tabindex="-1">&lt;/&gt;</button>
      <button type="button" @click="toggle('toggleCodeBlock')" :class="{ active: isActive('codeBlock') }" title="Bloque de código" tabindex="-1">{ }</button>
      <button type="button" @click="toggle('toggleBlockquote')" :class="{ active: isActive('blockquote') }" title="Cita" tabindex="-1">&ldquo;</button>
    </div>
    <EditorContent :editor="editor" class="rte__editor" :data-placeholder="placeholder" />
  </div>
</template>
