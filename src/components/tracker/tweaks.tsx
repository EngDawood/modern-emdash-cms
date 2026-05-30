import Icon from './icons';
import { IconBtn } from './primitives';
import { T, type Tweaks, type Lang } from './data';

interface TweaksProps {
  state: Tweaks;
  update: (p: Partial<Tweaks>) => void;
  onClose: () => void;
  lang: Lang;
}

export function TweaksPanel({ state, update, onClose, lang }: TweaksProps) {
  const t = T[lang];
  return (
    <div className="tweaks">
      <div className="tweaks__head">
        <span className="dot" />
        <h4>{t.tweaks}</h4>
        <span style={{ flex: 1 }} />
        <IconBtn icon="x" title="Close" onClick={onClose} />
      </div>
      <div className="tweaks__body">
        <div className="tweak-row">
          <label>{t.accent}</label>
          <div className="swatches">
            {[
              { k: 'amber',  c: '#B8651B' },
              { k: 'moss',   c: '#4F6B35' },
              { k: 'indigo', c: '#3B4B8F' },
              { k: 'rose',   c: '#9B3258' },
            ].map(s => (
              <button
                key={s.k}
                className={`swatch-btn ${state.accent === s.k ? 'is-active' : ''}`}
                style={{ background: s.c }}
                onClick={() => update({ accent: s.k as Tweaks['accent'] })}
                title={s.k}
              />
            ))}
          </div>
        </div>

        <div className="tweak-row">
          <label>{t.density}</label>
          <div className="choicegroup">
            {(['compact', 'comfortable', 'relaxed'] as Tweaks['density'][]).map(d => (
              <button
                key={d}
                className={state.density === d ? 'is-active' : ''}
                onClick={() => update({ density: d })}
              >
                {d === 'compact' ? t.compact : d === 'comfortable' ? t.comfy : t.relaxed}
              </button>
            ))}
          </div>
        </div>

        <div className="tweak-row">
          <label>{t.theme}</label>
          <div className="choicegroup">
            <button className={state.theme === 'light' ? 'is-active' : ''} onClick={() => update({ theme: 'light' })}>
              <Icon name="sun" size={11} /> <span style={{ marginLeft: 4 }}>{t.light}</span>
            </button>
            <button className={state.theme === 'dark' ? 'is-active' : ''} onClick={() => update({ theme: 'dark' })}>
              <Icon name="moon" size={11} /> <span style={{ marginLeft: 4 }}>{t.dark}</span>
            </button>
          </div>
        </div>

        <div className="tweak-row">
          <label>{t.layout_tw}</label>
          <div className="choicegroup">
            <button className={state.layout === 'table' ? 'is-active' : ''} onClick={() => update({ layout: 'table' })}>
              <Icon name="table" size={11} /> <span style={{ marginLeft: 4 }}>{t.table}</span>
            </button>
            <button className={state.layout === 'board' ? 'is-active' : ''} onClick={() => update({ layout: 'board' })}>
              <Icon name="board" size={11} /> <span style={{ marginLeft: 4 }}>{t.board}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
