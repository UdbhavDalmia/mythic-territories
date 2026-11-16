import React from 'react';

/**
 * Heraldic Animated Faction Banner Component
 * Depicts the Frost and Ash elemental factions with living SVG heraldry,
 * spinning crystalline/flaming crests, glowing seams, and cloth pennants.
 */

function SnowflakeCrest({ factionKey = 'frost' }) {
  return (
    <>
      <g className="v-spin">
        {[0, 60, 120, 180, 240, 300].map((a) => (
          <g key={a} transform={`rotate(${a} 110 176)`} stroke="#e6f7ff" strokeWidth="4" strokeLinecap="round" fill="none">
            <line x1="110" y1="176" x2="110" y2="108" />
            <polyline points="110,128 98,116" />
            <polyline points="110,128 122,116" />
            <polyline points="110,148 101,140" />
            <polyline points="110,148 119,140" />
          </g>
        ))}
      </g>
      <circle cx="110" cy="176" r="9" fill="#050d1a" stroke="#bfe9ff" strokeWidth="3" />
    </>
  );
}

function FlameCrest({ factionKey = 'ash' }) {
  const outerGradId = `v-flame-outer-${factionKey}`;
  const innerGradId = `v-flame-inner-${factionKey}`;
  return (
    <>
      <defs>
        <linearGradient id={outerGradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe3c7" />
          <stop offset="0.45" stopColor="#ff8a3d" />
          <stop offset="1" stopColor="#b8360f" />
        </linearGradient>
        <linearGradient id={innerGradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff6e8" />
          <stop offset="1" stopColor="#ffb347" />
        </linearGradient>
      </defs>
      <g className="v-flame">
        <path
          d="M110 96 C128 124 152 142 150 182 C148 214 128 234 110 234 C92 234 72 214 70 182 C68 158 82 148 90 128 C94 140 100 146 105 146 C102 128 104 112 110 96 Z"
          fill={`url(#${outerGradId})`}
          stroke="#ffe3c7"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
      </g>
      <g className="v-flame-in">
        <path
          d="M110 152 C122 170 132 178 130 198 C128 214 118 224 110 224 C102 224 92 214 90 198 C88 182 100 172 110 152 Z"
          fill={`url(#${innerGradId})`}
        />
      </g>
    </>
  );
}

const FrostOrnament = (
  <g className="v-orn" fill="#bfe9ff" fillOpacity="0.8">
    <circle cx="110" cy="300" r="3" />
    <circle cx="98" cy="306" r="2.2" />
    <circle cx="122" cy="306" r="2.2" />
  </g>
);

const AshOrnament = (
  <g className="v-orn" fill="#ff8a3d">
    <circle cx="62" cy="120" r="2.4" fillOpacity="0.9" />
    <circle cx="156" cy="96" r="1.8" fillOpacity="0.8" />
    <circle cx="170" cy="150" r="2.6" fillOpacity="0.7" />
    <circle cx="50" cy="188" r="1.6" fillOpacity="0.8" />
    <circle cx="168" cy="236" r="2" fillOpacity="0.7" />
    <circle cx="70" cy="262" r="2.2" fillOpacity="0.8" />
    <circle cx="110" cy="290" r="2.6" fillOpacity="0.9" />
    <circle cx="96" cy="304" r="1.6" fillOpacity="0.7" />
    <circle cx="126" cy="308" r="1.8" fillOpacity="0.7" />
  </g>
);

export const FACTION_BANNER_CONFIGS = {
  frost: {
    key: 'frost',
    name: 'Frost Domain',
    cloth: ['#14639c', '#0b3d68', '#072543'],
    rim: ['#e6f7ff', '#35d6f5'],
    glow: '#35d6f5',
    rod: '#bfe9ff',
    inner: '#bfe9ff',
    crack: '#bfe9ff',
    crackOpacity: 0.35,
    clothPath: 'M22 16 H198 V345 L110 415 L22 345 Z',
    innerPath: 'M36 30 H184 V338 L110 396 L36 338 Z',
    cracks: ['22,250 52,262 60,290 84,300', '198,220 170,236 164,262 142,270', '110,415 112,380 100,356'],
    Crest: SnowflakeCrest,
    ornament: FrostOrnament,
    accentRgb: '53, 214, 245'
  },
  snow: {
    key: 'frost',
    name: 'Frost Domain',
    cloth: ['#14639c', '#0b3d68', '#072543'],
    rim: ['#e6f7ff', '#35d6f5'],
    glow: '#35d6f5',
    rod: '#bfe9ff',
    inner: '#bfe9ff',
    crack: '#bfe9ff',
    crackOpacity: 0.35,
    clothPath: 'M22 16 H198 V345 L110 415 L22 345 Z',
    innerPath: 'M36 30 H184 V338 L110 396 L36 338 Z',
    cracks: ['22,250 52,262 60,290 84,300', '198,220 170,236 164,262 142,270', '110,415 112,380 100,356'],
    Crest: SnowflakeCrest,
    ornament: FrostOrnament,
    accentRgb: '53, 214, 245'
  },
  ash: {
    key: 'ash',
    name: 'Ash Domain',
    cloth: ['#3a2a26', '#1f1512', '#120b09'],
    rim: ['#ffe3c7', '#ff8a3d'],
    glow: '#ff8a3d',
    rod: '#6b5a54',
    inner: '#ffb347',
    crack: '#ff8a3d',
    crackOpacity: 0.75,
    clothPath: 'M22 16 H198 V352 L180 374 L162 354 L142 396 L122 362 L108 408 L90 364 L68 390 L50 356 L34 378 L22 356 Z',
    innerPath: 'M36 30 H184 V330 H36 Z',
    cracks: ['22,230 50,246 58,276 82,290', '198,200 172,218 166,248 144,258', '60,340 72,316 66,300'],
    Crest: FlameCrest,
    ornament: AshOrnament,
    accentRgb: '255, 138, 61'
  }
};

export default function FactionBanner({ faction = 'frost', className = '', idPrefix = '' }) {
  const normKey = faction === 'ash' ? 'ash' : 'frost';
  const cfg = FACTION_BANNER_CONFIGS[normKey];
  const Crest = cfg.Crest;
  const pfx = idPrefix ? `${idPrefix}-${normKey}` : normKey;

  const clothGradId = `v-cloth-${pfx}`;
  const rimGradId = `v-rim-${pfx}`;
  const glowGradId = `v-glow-${pfx}`;

  return (
    <div 
      className={`v-banner v-theme-${normKey} ${className}`} 
      aria-hidden="true"
      style={{ '--accent-rgb': cfg.accentRgb }}
    >
      <svg viewBox="0 0 220 430" width="100%" height="100%" className="overflow-visible">
        <defs>
          <linearGradient id={clothGradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={cfg.cloth[0]} />
            <stop offset="0.6" stopColor={cfg.cloth[1]} />
            <stop offset="1" stopColor={cfg.cloth[2]} />
          </linearGradient>
          <linearGradient id={rimGradId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={cfg.rim[0]} />
            <stop offset="1" stopColor={cfg.rim[1]} />
          </linearGradient>
          <radialGradient id={glowGradId} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor={cfg.glow} stopOpacity="0.55" />
            <stop offset="1" stopColor={cfg.glow} stopOpacity="0" />
          </radialGradient>
        </defs>

        <rect x="2" y="2" width="216" height="14" rx="7" fill={`url(#${rimGradId})`} />
        <circle cx="4" cy="9" r="9" fill={cfg.rod} />
        <circle cx="216" cy="9" r="9" fill={cfg.rod} />

        <path d={cfg.clothPath} fill={`url(#${clothGradId})`} stroke={`url(#${rimGradId})`} strokeWidth="3" strokeLinejoin="round" />
        <path d={cfg.innerPath} fill="none" stroke={cfg.inner} strokeOpacity="0.4" strokeWidth="1.5" strokeDasharray="2 5" />

        <circle className="v-glow" cx="110" cy="176" r="88" fill={`url(#${glowGradId})`} />
        <Crest factionKey={pfx} />

        <g className="v-cracks" stroke={cfg.crack} strokeOpacity={cfg.crackOpacity} strokeWidth="1.4" fill="none" strokeLinejoin="round">
          {cfg.cracks.map((p) => <polyline key={p} points={p} />)}
        </g>
        {cfg.ornament}
      </svg>
    </div>
  );
}
