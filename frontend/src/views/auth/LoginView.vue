<script setup>
import { ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();

const email = ref('');
const password = ref('');
const error = ref('');

async function submit() {
  error.value = '';
  try {
    await auth.login({ email: email.value, password: password.value });
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/board';
    router.replace(redirect);
  } catch (e) {
    error.value = e.message || 'Error al iniciar sesión';
  }
}
</script>

<template>
  <main class="auth">
    <form class="auth__card" @submit.prevent="submit">
      <h1>TaskBoard <span>AI</span></h1>
      <p class="auth__sub">Iniciá sesión para continuar.</p>

      <label>
        <span>Email</span>
        <input type="email" v-model="email" required autocomplete="email" />
      </label>
      <label>
        <span>Contraseña</span>
        <input type="password" v-model="password" required autocomplete="current-password" minlength="8" />
      </label>

      <p v-if="error" class="auth__error">{{ error }}</p>

      <button type="submit" :disabled="auth.loading">
        {{ auth.loading ? 'Entrando…' : 'Entrar' }}
      </button>

      <p class="auth__alt">
        ¿No tenés cuenta? <RouterLink to="/register">Registrate</RouterLink>
      </p>
    </form>
  </main>
</template>
