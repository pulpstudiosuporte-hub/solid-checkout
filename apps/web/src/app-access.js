const platformPagesWithoutStore = new Set(['Usuários', 'Operações', 'Conteúdo']);

export const canAccessWithoutActiveStore = (page, platformAdmin) =>
  platformAdmin === true && platformPagesWithoutStore.has(page);
