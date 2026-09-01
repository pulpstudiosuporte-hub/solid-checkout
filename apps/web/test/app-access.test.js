import { describe, expect, it } from 'vitest';
import { canAccessWithoutActiveStore } from '../src/app-access.js';
import { notificationsEnabledForStore } from '../src/notification-context.js';

describe('acesso ao painel sem loja ativa', () => {
  it.each(['Usuários', 'Operações', 'Conteúdo'])('mantém %s disponível para o administrador da plataforma', page => {
    expect(canAccessWithoutActiveStore(page, true)).toBe(true);
  });

  it('mantém módulos de loja protegidos e não libera páginas administrativas para lojistas', () => {
    expect(canAccessWithoutActiveStore('Início', true)).toBe(false);
    expect(canAccessWithoutActiveStore('Conteúdo', false)).toBe(false);
  });

  it('só habilita notificações quando existe uma loja ativa válida', () => {
    expect(notificationsEnabledForStore('store-public-id')).toBe(true);
    expect(notificationsEnabledForStore()).toBe(false);
    expect(notificationsEnabledForStore('   ')).toBe(false);
  });
});
