import { useState } from 'react';
import type { CardSpec } from '../lib/share';
import { shareCard } from '../lib/share';
import { GhostButton } from './Ui';

export function ShareButton({ spec, text, label = 'Share' }: { spec: CardSpec; text: string; label?: string }) {
  const [state, setState] = useState<'idle' | 'busy' | 'copied'>('idle');
  return (
    <GhostButton
      disabled={state === 'busy'}
      onClick={async () => {
        setState('busy');
        const r = await shareCard(spec, text);
        setState(r === 'copied' ? 'copied' : 'idle');
      }}
    >
      {state === 'copied' ? 'Link copied · card saved ✓' : state === 'busy' ? 'Preparing…' : `↗ ${label}`}
    </GhostButton>
  );
}
