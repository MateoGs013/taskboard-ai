<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const auth = useAuthStore();

const name = ref('');
const email = ref('');
const password = ref('');
const error = ref('');

async function submit() {
  error.value = '';
  try {
    await auth.register({ name: name.value, email: email.value, password: password.value });
    router.replace('/board');
  } catch (e) {
    error.value = e.message || 'Error al crear la cuenta';
  }
}
</script>

<template>
  <main class="auth">
    <form class="auth__card" @submit.prevent="submit">
      <h1>Crear cuenta</h1>
      <p class="auth__sub">Primer paso para organizar tu trabajo.</p>

      <label>
        <span>Nombre</span>
        <input type="text" v-model="name" required minlength="1" />
      </label>
      <label>
        <span>Email</span>
        <input type="email" v-model="email" required autocomplete="email" />
      </label>
      <label>
        <span>Contraseña</span>
        <input type="password" v-model="password" required autocomplete="new-password" minlength="8" />
        <small>Mínimo 8 caracteres.</small>
      </label>

      <p v-if="error" class="auth__error">{{ error }}</p>

      <button type="submit" :disabled="auth.loading">
        {{ auth.loading ? 'Creando…' : 'Crear cuenta' }}
      </button>

      <p class="auth__alt">
        ¿Ya tenés cuenta? <RouterLink to="/login">Iniciá sesión</RouterLink>
      </p>
    </form>
  </main>
</template>
