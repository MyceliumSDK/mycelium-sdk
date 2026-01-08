export const logState = (message: string, data?: unknown) => {
  console.log(`📝 ${message}${data ? `: ${data}` : ''}`);
  console.log();
};

export const logResult = (message: string, data?: unknown) => {
  console.log(`🎉 ${message}${data ? `: ${data}` : ''}`);
  console.log();
};

export const logError = (message: string, data?: unknown) => {
  console.log(`❌ ${message}${data ? `: ${data}` : ''}`);
  console.log();
};
