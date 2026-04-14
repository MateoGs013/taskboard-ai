import fp from 'fastify-plugin';
import { pool, query, withTransaction, closePool } from '../config/db.js';

export default fp(async (fastify) => {
  fastify.decorate('db', { pool, query, withTransaction });
  fastify.addHook('onClose', async () => {
    await closePool();
  });
}, { name: 'db' });
