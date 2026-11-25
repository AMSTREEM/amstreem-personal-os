import { useQuery, useQueryClient } from '@tanstack/react-query';
import { QuranMushafReader } from '../components/QuranMushafReader';
import { api } from '../lib/api';

export function QuranPage() {
  const client = useQueryClient();
  const settings = useQuery({ queryKey: ['settings'], queryFn: () => api<Record<string, string>>('/settings') });
  return <QuranMushafReader
    autoOpen
    settings={settings.data || {}}
    settingsReady={settings.isFetched}
    onLogged={() => {
      void client.invalidateQueries({ queryKey: ['deen'] });
      void client.invalidateQueries({ queryKey: ['rhythm-summary'] });
      void client.invalidateQueries({ queryKey: ['overview'] });
    }}
  />;
}
