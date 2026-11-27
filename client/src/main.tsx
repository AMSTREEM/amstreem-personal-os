import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './auth/AuthProvider';
import { MotionConfig } from 'motion/react';
import { App } from './App';
import '@fontsource-variable/geist/wght.css';
import '@fontsource-variable/geist-mono/wght.css';
import '@fontsource-variable/fraunces';
import './styles.css';
import './styles/atlas-rooms.css';
import './styles/atlas-renaissance.css';
import './design/tokens.css';
import './design/themes.css';
import './design/containment.css';
import './design/shadcn-map.css';
import './design/fx.css';
import './design/components.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 20_000, retry: 1, refetchOnWindowFocus: false },
    mutations: { retry: 0 }
  }
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MotionConfig reducedMotion="user">
      <QueryClientProvider client={queryClient}>
        <BrowserRouter><AuthProvider><App /></AuthProvider></BrowserRouter>
      </QueryClientProvider>
    </MotionConfig>
  </React.StrictMode>
);