export const BACKEND_HOSTNAME =
  process.env.NODE_ENV === 'dev'
    ? 'http://localhost:3000'
    : 'https://mycelium-cloud-production.up.railway.app';
