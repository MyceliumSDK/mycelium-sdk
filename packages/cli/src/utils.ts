export const getEnv = (env: string): string => {
  const value = process.env[env];
  if (!value) {
    throw new Error(`Environment variable ${env} is not set`);
  }
  return value;
};
