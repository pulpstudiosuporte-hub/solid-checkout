export const permissionLabels = {
  'users.read': 'Consultar usuários', 'users.manage': 'Bloquear e reativar clientes',
  'billing.manage': 'Gerenciar benefícios comerciais', 'support.read': 'Entrar em suporte de consulta',
  'support.write': 'Entrar em suporte de manutenção', 'audit.read': 'Consultar histórico de acessos',
  'operations.read': 'Consultar operações', 'operations.manage': 'Reprocessar operações',
  'content.manage': 'Gerenciar novidades e conteúdo',
};
export const platformPagePermission = { 'Usuários': 'users.read', 'Operações': 'operations.read', 'Conteúdo': 'content.manage', 'Equipe e permissões': 'roles.manage', 'Histórico de acessos': 'audit.read' };
export const canPlatform = (user, permission) => Boolean(user?.platformAdmin || user?.platformPermissions?.includes(permission));
export const canPlatformPage = (user, page) => Boolean(platformPagePermission[page] && canPlatform(user, platformPagePermission[page]));
export const supportPages = ['Início', 'Análises', 'Pedidos', 'Carrinhos', 'ChromaSense', 'Produtos', 'Webhooks', 'Checkouts', 'Logística', 'Order bumps', 'Cupons', 'Configurações'];
