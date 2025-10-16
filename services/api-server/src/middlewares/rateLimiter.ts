import rateLimit from '@fastify/rate-limit';

export const rateLimiterConfig = {
  max: 100,
  timeWindow: '1 minute'
};
