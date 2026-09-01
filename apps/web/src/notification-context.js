export const notificationsEnabledForStore = storeKey =>
  typeof storeKey === 'string' && storeKey.trim().length > 0;
