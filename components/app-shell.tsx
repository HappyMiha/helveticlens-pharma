'use client';
import {
  useEffect,
  useState,
  type ReactNode,
  type ComponentProps,
} from 'react';
import { Sidebar, SidebarProvider } from '@/components/ui/sidebar';
import { UniversalAskSearch } from './universal-ask-search';
import { ThemeProvider, ThemeControl } from './theme-provider';

export function ResearchEnvironment({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <UniversalAskSearch>
        {children}
        <ThemeControl />
      </UniversalAskSearch>
    </ThemeProvider>
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
