'use client';
import {
  useEffect,
  useState,
  type ReactNode,
  type ComponentProps,
} from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { Sidebar, SidebarProvider } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { UniversalAskSearch } from './universal-ask-search';

type Theme = 'system' | 'light' | 'dark';
export function ResearchEnvironment({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('system');
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      let selected: Theme = 'system';
      try {
        const stored = localStorage.getItem('helvetic-lens-theme');
        if (stored === 'dark' || stored === 'light') selected = stored;
      } catch {
        /* Device preferences are optional. */
      }
      document.documentElement.dataset.theme = selected;
      document.documentElement.classList.toggle(
        'dark',
        selected === 'dark' || (selected === 'system' && media.matches),
      );
      setTheme(selected);
    };
    apply();
    media.addEventListener('change', apply);
    window.addEventListener('storage', apply);
    return () => {
      media.removeEventListener('change', apply);
      window.removeEventListener('storage', apply);
    };
  }, []);
  function cycle() {
    const next: Theme =
      theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system';
    try {
      localStorage.setItem('helvetic-lens-theme', next);
    } catch {
      /* Still works for this page. */
    }
    document.documentElement.dataset.theme = next;
    document.documentElement.classList.toggle(
      'dark',
      next === 'dark' ||
        (next === 'system' &&
          window.matchMedia('(prefers-color-scheme: dark)').matches),
    );
    setTheme(next);
  }
  const Icon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor;
  return (
    <UniversalAskSearch>
      {children}
      <Button
        className="theme-control"
        variant="outline"
        onClick={cycle}
        aria-label={`Theme: ${theme}. Switch to ${theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system'} theme`}
      >
        <Icon size={17} />
        <span>
          {theme === 'system' ? 'Auto' : theme === 'light' ? 'Light' : 'Dark'}
        </span>
      </Button>
    </UniversalAskSearch>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    const media = window.matchMedia('(min-width: 1100px)');
    const adapt = () => setOpen(media.matches);
    adapt();
    media.addEventListener('change', adapt);
    return () => media.removeEventListener('change', adapt);
  }, []);
  return (
    <SidebarProvider
      open={open}
      onOpenChange={setOpen}
      className="research-app-shell"
    >
      {children}
    </SidebarProvider>
  );
}
export function GlassSidebar({
  children,
  ...props
}: ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar {...props} className="product-sidebar glass-sidebar">
      {children}
    </Sidebar>
  );
}
export function TopNavigation({ children }: { children: ReactNode }) {
  return <header className="workspace-header">{children}</header>;
}
