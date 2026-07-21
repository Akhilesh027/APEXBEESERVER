module.exports = {
  apps: [
    {
      name: 'apexbee-api',
      script: './dist/server.js',
      exec_mode: 'cluster',
      instances: 2,
      max_memory_restart: '1G',
      env_staging: {
        NODE_ENV: 'staging',
        PORT: 5500,
        PROCESS_TYPE: 'api',
        ALLOW_REDIS_MEMORY_MOCK: 'false',
        ENABLE_SOCKET_REDIS: 'true',
        ENABLE_BULLMQ_WORKERS: 'true',
      },
    },
    {
      name: 'apexbee-worker',
      script: './dist/server.js',
      exec_mode: 'fork',
      instances: 1,
      max_memory_restart: '1G',
      env_staging: {
        NODE_ENV: 'staging',
        PROCESS_TYPE: 'worker',
        ALLOW_REDIS_MEMORY_MOCK: 'false',
        ENABLE_SOCKET_REDIS: 'true',
        ENABLE_BULLMQ_WORKERS: 'true',
      },
    },
  ],
};
