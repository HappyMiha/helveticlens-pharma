'use client';
import { useEffect, useState } from 'react';
import { product } from '@/lib/product';
import { useResource } from '@/lib/use-resource';
import type { Investigation } from '@/lib/investigation';
import type { InvestigationPage } from '@/lib/dossier-reading';
import { SourceCard } from './source-card';
import { Button } from './ui/button';
import { NativeSelect, NativeSelectOption } from './ui/native-select';

/** Read the same authorized captures used by research, without copying them. */
export function DossierResearchSources({ dossierId, onOpen }: {
  dossierId: string;
  onOpen: (id: string, anchor?: string) => void;
}) {
  const base = `/products/${product.id}/dossiers/${dossierId}/investigations`;
  const [selected, setSelected] = useState('');
  const [tick, setTick] = useState(0);
  const list = useResource<InvestigationPage>(base, tick);
  const id = list.data?.items.find(item => item.id === selected)?.id || list.data?.items[0]?.id;
  const research = useResource<Investigation>(!list.error && id ? `${base}/${id}` : null, tick);
  const value = !list.error && !research.error && research.data?.id === id ? research.data : null;
  const error = list.error || research.error;
  useEffect(() => {
    const timer = setInterval(() => setTick(n => n + 1), 30000);
    return () => clearInterval(timer);
  }, []);
  return <section aria-label="Research sources" className="dossier-research-sources">
    <div className="section-header">
      <div><h2>Research sources</h2><p className="muted">Originals found and read while investigating your question.</p></div>
      <Button variant="ghost" disabled={list.refreshing || research.refreshing} onClick={() => setTick(n => n + 1)}>Refresh sources</Button>
    </div>
    {error ? <p role="alert">{error} Sources are hidden until access is checked again.</p>
      : !list.data ? <output>Loading research sources…</output>
      : !id ? <p className="muted">Sources will appear here as your research finds them.</p>
      : <>
        {list.data.items.length > 1 && <label>Research episode
          <NativeSelect aria-label="Research episode" value={id} onChange={event => setSelected(event.target.value)}>
            {list.data.items.map(item => <NativeSelectOption key={item.id} value={item.id}>{item.question}</NativeSelectOption>)}
          </NativeSelect>
        </label>}
        {!value ? <output>Loading captured originals…</output> : <>
          <p>{value.sources.length} captured {value.sources.length === 1 ? 'source' : 'sources'} for this question.</p>
          {value.sources.map(source => <SourceCard key={source.id} source={source} value={value}
            idPrefix="dossier-original" onClaim={claim => onOpen(value.id, `claim-${claim}`)} />)}
          {!value.sources.length && <p className="muted">This episode has not captured an original yet.</p>}
          <Button variant="outline" onClick={() => onOpen(value.id)}>Open research and findings</Button>
          {list.data.total > list.data.items.length && <p className="muted">Open the research journal to find older episodes and their sources.</p>}
        </>}
      </>}
  </section>;
}
