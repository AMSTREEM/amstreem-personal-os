import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './auth/AuthProvider';
import { App } from './App';
import '@fontsource-variable/inter/wght.css';
import { PwaUpdatePrompt } from './components/PwaUpdatePrompt';
import { AtlasMotionProvider } from './design/MotionPreferenceProvider';
import './styles.css';
import './design/tokens.css';
import '@fontsource-variable/inter';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 20_000, retry: 1, refetchOnWindowFocus: false },
    mutations: { retry: 0 }
  }
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PwaUpdatePrompt />
    <AtlasMotionProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter><AuthProvider><App /></AuthProvider></BrowserRouter>
      </QueryClientProvider>
    </AtlasMotionProvider>
  </React.StrictMode>
);

