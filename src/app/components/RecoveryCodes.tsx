import { useState } from 'react';
import { GhostButton } from './Ui';

export function RecoveryCodes({ codes, handle }: { codes: string[]; handle: string }) {
  const [copied, setCopied] = useState(false);
  const text = `The Golden Run — recovery codes for ${handle}\nEach code works once. Keep them somewhere safe and private.\n\n${codes.join('\n')}\n`;
  return (
    <div>
      <ol className="grid grid-cols-2 gap-2 rounded-xl border border-gold/30 bg-midnight/80 p-4 font-[var(--font-accent)] text-sm tracking-wide text-gold-bright">
        {codes.map((c) => (
          <li key={c} className="tabular-nums">
            {c}
          </li>
        ))}
      </ol>
      <div className="mt-3 flex flex-wrap gap-2">
        <GhostButton
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              setCopied(true);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? 'Copied ✓' : 'Copy codes'}
        </GhostButton>
        <GhostButton
          onClick={() => {
            const a = document.createElement('a');
            a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
            a.download = `goldenrun-recovery-${handle}.txt`;
            a.click();
            URL.revokeObjectURL(a.href);
          }}
        >
          Download .txt
        </GhostButton>
      </div>
    </div>
  );
}
