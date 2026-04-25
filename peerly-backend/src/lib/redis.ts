import Redis from 'ioredis';
import { config } from '../config';
import { logger } from './logger';

const redis = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
});

redis.on('error', (err) => logger.error('Redis error', { message: err.message }));

export default redis;
