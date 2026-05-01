import 'dotenv/config';
import Redis from 'ioredis';

const url = process.env.REDIS_URL ?? 'redis://localhost:6379 (default)';
console.log('Redis URL:', url);

const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
  connectTimeout: 5000,
});

redis.ping()
  .then((res) => {
    console.log('Redis ping:', res);
    console.log('Status: CONNECTED');
    redis.disconnect();
  })
  .catch((err) => {
    console.error('Redis ping failed:', err.message);
    console.log('Status: UNREACHABLE');
    redis.disconnect();
  });
