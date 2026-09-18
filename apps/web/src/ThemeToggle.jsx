import { Moon, Sun } from 'lucide-react';
import { useAppTheme } from './app-theme';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useAppTheme();
  const label = theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro';
  return <button type="button" className="pirat-theme-toggle" onClick={toggleTheme} aria-label={label} title={label}>
    {theme === 'dark' ? <Sun size={19} aria-hidden="true"/> : <Moon size={19} aria-hidden="true"/>}
  </button>;
}
