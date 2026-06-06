import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

const redisUrl = process.env.REDIS_URL;
const isPlaceholder = !redisUrl || redisUrl.includes('yourredisinstance');
const useRedis = !isPlaceholder;

if (!useRedis) {
  console.log('ℹ️ Redis está desativado (URL ausente ou padrão de exemplo). O cache foi desativado e as consultas serão enviadas diretamente ao banco de dados.');
}

export const redisClient = useRedis
  ? createClient({ url: redisUrl })
  : null;

if (redisClient) {
  redisClient.on('error', (err) => console.error('Redis Client Error', err));
  redisClient.on('connect', () => console.log('🔌 Connected to Redis successfully.'));

  // Conectar ao inicializar o backend
  (async () => {
    try {
      await redisClient.connect();
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
    }
  })();
}

export const cache = {
  get: async (key: string): Promise<string | null> => {
    if (!redisClient || !redisClient.isOpen) return null;
    try {
      return await redisClient.get(key);
    } catch (err) {
      return null;
    }
  },
  set: async (key: string, value: string, ttlSeconds?: number): Promise<void> => {
    if (!redisClient || !redisClient.isOpen) return;
    try {
      if (ttlSeconds) {
        await redisClient.set(key, value, { EX: ttlSeconds });
      } else {
        await redisClient.set(key, value);
      }
    } catch (err) {
      // Ignora falhas silenciosamente no cache
    }
  },
  del: async (key: string): Promise<void> => {
    if (!redisClient || !redisClient.isOpen) return;
    try {
      await redisClient.del(key);
    } catch (err) {
      // Ignora falhas silenciosamente no cache
    }
  },
  delByPattern: async (pattern: string): Promise<void> => {
    if (!redisClient || !redisClient.isOpen) return;
    try {
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) {
        await redisClient.del(keys);
      }
    } catch (err) {
      // Ignora falhas silenciosamente no cache
    }
  }
};
