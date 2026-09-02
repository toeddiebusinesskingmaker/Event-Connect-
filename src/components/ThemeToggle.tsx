import { Moon, Sun } from 'lucide-react';
import { useTheme } from './ThemeProvider';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex items-center gap-2 bg-white dark:bg-[#202c33] border border-slate-200/60 dark:border-slate-700/60 p-2 rounded-xl shadow-sm">
      <button
        onClick={() => setTheme('light')}
        className={`p-2 rounded-lg transition-all ${theme === 'light' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
        title="Light Mode"
      >
        <Sun className="w-4 h-4" />
      </button>
      <button
        onClick={() => setTheme('dark')}
        className={`p-2 rounded-lg transition-all ${theme === 'dark' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
        title="Dark Mode"
      >
        <Moon className="w-4 h-4" />
      </button>
    </div>
  );
}
