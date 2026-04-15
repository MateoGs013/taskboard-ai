import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const routes = [
  {
    path: '/',
    redirect: () => (localStorage.getItem('tb.access_token') ? '/app' : '/login'),
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/auth/LoginView.vue'),
    meta: { public: true },
  },
  {
    path: '/register',
    name: 'register',
    component: () => import('@/views/auth/RegisterView.vue'),
    meta: { public: true },
  },
  {
    path: '/app',
    component: () => import('@/views/AppShell.vue'),
    children: [
      { path: '', name: 'home', component: () => import('@/views/HomeView.vue') },
      { path: 'board', name: 'board', component: () => import('@/views/board/BoardView.vue') },
      { path: 'board/:teamId', name: 'board-team', component: () => import('@/views/board/BoardView.vue') },
      { path: 'cycles', name: 'cycles', component: () => import('@/views/cycles/CyclesView.vue') },
      { path: 'workflow', name: 'workflow', component: () => import('@/views/workflow/WorkflowEditor.vue') },
      { path: 'dashboard', name: 'dashboard', component: () => import('@/views/dashboard/DashboardView.vue') },
      { path: 'my', name: 'my-issues', component: () => import('@/views/my/MyIssuesView.vue') },
      { path: 'calendar', name: 'calendar', component: () => import('@/views/calendar/CalendarView.vue') },
      { path: 'activity', name: 'activity', component: () => import('@/views/activity/ActivityView.vue') },
      { path: 'settings', name: 'settings', component: () => import('@/views/settings/SettingsView.vue') },
    ],
  },
  {
    path: '/invite/:token',
    name: 'invite',
    component: () => import('@/views/invite/InviteAccept.vue'),
    meta: { public: true },
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/NotFound.vue'),
    meta: { public: true },
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  if (!auth.initialized) await auth.init();
  if (!to.meta.public && !auth.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } };
  }
  if (to.meta.public && auth.isAuthenticated && ['login', 'register'].includes(to.name)) {
    return { name: 'home' };
  }
});
