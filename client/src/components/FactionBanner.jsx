import React from 'react';

/**
 * Heraldic Animated Faction Banner Component
 * Depicts the Frost and Ash elemental factions with living SVG heraldry,
 * spinning crystalline/flaming crests, glowing seams, forged finials,
 * realistic cloth fold shading, and living wave physics.
 */

/* ── Crest Components ──────────────────────────────────────────────────────── */

function SnowflakeCrest({ factionKey = 'frost', detailed = false }) {
  return (
    <>
      {detailed && (
        <g className="v-rune-ring" stroke="#7dd3fc" strokeWidth="1" strokeDasharray="3 4" fill="none" opacity="0.6">
          <circle cx="110" cy="176" r="64" />
          <circle cx="110" cy="176" r="54" strokeWidth="0.8" />
          <polygon points="110,116 114,122 110,128 106,122" fill="#bae6fd" stroke="none" />
          <polygon points="110,224 114,230 110,236 106,230" fill="#bae6fd" stroke="none" />
          <polygon points="50,176 56,180 50,184 44,180" fill="#bae6fd" stroke="none" />
          <polygon points="170,176 176,180 170,184 164,180" fill="#bae6fd" stroke="none" />
        </g>
      )}
      <g className="v-spin">
        {[0, 60, 120, 180, 240, 300].map((a) => (
          <g key={a} transform={`rotate(${a} 110 176)`} stroke="#e6f7ff" strokeWidth="3.5" strokeLinecap="round" fill="none">
            <line x1="110" y1="176" x2="110" y2="108" />
            <polyline points="110,128 98,116" />
            <polyline points="110,128 122,116" />
            <polyline points="110,148 101,140" />
            <polyline points="110,148 119,140" />
          </g>
        ))}
      </g>
      <circle cx="110" cy="176" r="10" fill="#050d1a" stroke="#bfe9ff" strokeWidth="2.5" />
      <polygon points="110,170 115,176 110,182 105,176" fill="#7dd3fc" />
    </>
  );
}

function FlameCrest({ factionKey = 'ash', detailed = false }) {
  const outerGradId = `v-flame-outer-${factionKey}`;
  const innerGradId = `v-flame-inner-${factionKey}`;
  const hornGradId = `v-flame-horn-${factionKey}`;

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
          <stop offset="0.6" stopColor="#ffb347" />
          <stop offset="1" stopColor="#ea580c" />
        </linearGradient>
        <linearGradient id={hornGradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#451a03" />
          <stop offset="1" stopColor="#1c1917" />
        </linearGradient>
      </defs>

      {detailed && (
        <g opacity="0.85">
          <path d="M72 176 C65 140 78 110 92 98 C88 120 85 145 88 176 Z" fill={`url(#${hornGradId})`} stroke="#f97316" strokeWidth="1" />
          <path d="M148 176 C155 140 142 110 128 98 C132 120 135 145 132 176 Z" fill={`url(#${hornGradId})`} stroke="#f97316" strokeWidth="1" />
          <path d="M78 226 L110 236 L142 226 L136 218 L110 224 L84 218 Z" fill="#292524" stroke="#f97316" strokeWidth="1.2" />
        </g>
      )}

      <g className="v-flame">
        <path
          d="M110 96 C128 124 152 142 150 182 C148 214 128 234 110 234 C92 234 72 214 70 182 C68 158 82 148 90 128 C94 140 100 146 105 146 C102 128 104 112 110 96 Z"
          fill={`url(#${outerGradId})`}
          stroke="#ffe3c7"
          strokeWidth="2.2"
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

/* ── Ornaments ─────────────────────────────────────────────────────────────── */

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

/**
 * FactionBanner
 */
export default function FactionBanner({ faction = 'frost', className = '', idPrefix = '', options = null }) {
  const normKey = faction === 'ash' ? 'ash' : 'frost';
  const cfg = FACTION_BANNER_CONFIGS[normKey];
  const Crest = cfg.Crest;
  const pfx = idPrefix ? `${idPrefix}-${normKey}` : normKey;

  // Resolve customization options (user choices applied as permanent defaults)
  let savedOpts = {};
  if (!options && typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('mt_banner_options');
      if (raw) savedOpts = JSON.parse(raw);
    } catch (e) {
      // ignore
    }
  }

  const effectiveOpts = {
    rodStyle: 'fantasy',       // Forged fantasy spearheads & curved horns
    fabricFolds: true,         // Realistic cloth depth & crease shading
    fabricWave: true,          // Living fabric wave
    waveSpeed: 'storm',        // Storm wave intensity (user choice!)
    tassels: true,             // Metallic fringe tassels along the hem
    detailedCrest: false,      // Clean classic crest (user choice!)
    particles: true,           // Emitted elemental particles
    ...savedOpts,
    ...(options || {})
  };

  const clothGradId = `v-cloth-${pfx}`;
  const rimGradId = `v-rim-${pfx}`;
  const glowGradId = `v-glow-${pfx}`;
  const foldsGradId = `v-folds-${pfx}`;
  const drapeGradId = `v-drape-${pfx}`;
  const rodGradId = `v-rod-${pfx}`;

  return (
    <div 
      className={`v-banner v-theme-${normKey} ${effectiveOpts.fabricWave ? `v-wave-${effectiveOpts.waveSpeed}` : ''} ${className}`} 
      aria-hidden="true"
      style={{ '--accent-rgb': cfg.accentRgb }}
    >
      <svg viewBox="0 0 220 430" width="100%" height="100%" className="overflow-visible select-none">
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

          {/* Realistic Fabric Crease & Volumetric Fluted Column Folds Shading */}
          <linearGradient id={foldsGradId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#000000" stopOpacity="0.48" />
            <stop offset="6%" stopColor="#000000" stopOpacity="0.32" />
            <stop offset="13%" stopColor="#ffffff" stopOpacity="0.14" />
            <stop offset="24%" stopColor="#000000" stopOpacity="0.44" />
            <stop offset="35%" stopColor="#ffffff" stopOpacity="0.18" />
            <stop offset="47%" stopColor="#000000" stopOpacity="0.30" />
            <stop offset="53%" stopColor="#000000" stopOpacity="0.30" />
            <stop offset="65%" stopColor="#ffffff" stopOpacity="0.18" />
            <stop offset="76%" stopColor="#000000" stopOpacity="0.44" />
            <stop offset="87%" stopColor="#ffffff" stopOpacity="0.14" />
            <stop offset="94%" stopColor="#000000" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.48" />
          </linearGradient>

          {/* Vertical Drape & Weight Shadowing */}
          <linearGradient id={drapeGradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#000000" stopOpacity="0.45" />
            <stop offset="9%" stopColor="#ffffff" stopOpacity="0.10" />
            <stop offset="55%" stopColor="#000000" stopOpacity="0.0" />
            <stop offset="85%" stopColor="#000000" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.60" />
          </linearGradient>

          {/* Forged Rod Metallic / Obsidian Gradient */}
          <linearGradient id={rodGradId} x1="0" y1="0" x2="0" y2="1">
            {normKey === 'frost' ? (
              <>
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="35%" stopColor="#bae6fd" />
                <stop offset="70%" stopColor="#0284c7" />
                <stop offset="100%" stopColor="#0369a1" />
              </>
            ) : (
              <>
                <stop offset="0%" stopColor="#fdba74" />
                <stop offset="25%" stopColor="#78350f" />
                <stop offset="70%" stopColor="#292524" />
                <stop offset="100%" stopColor="#1c1917" />
              </>
            )}
          </linearGradient>
        </defs>

        {/* ── 1. Hanging Suspension Rod & Forged Finials ────────────────────────── */}
        {effectiveOpts.rodStyle === 'fantasy' && (
          <g className="v-rod-fantasy">
            {/* Main Forged Crossbar */}
            <rect x="8" y="4" width="204" height="11" rx="5.5" fill={`url(#${rodGradId})`} stroke={normKey === 'frost' ? '#bae6fd' : '#f97316'} strokeWidth="1.2" />

            {/* Frost: Chiseled Crystal Spearhead Finials */}
            {normKey === 'frost' && (
              <>
                {/* Left Spearhead Finial */}
                <polygon points="8,9.5 -8,2 -16,9.5 -8,17" fill="#e0f2fe" stroke="#38bdf8" strokeWidth="1.5" />
                <line x1="-16" y1="9.5" x2="8" y2="9.5" stroke="#ffffff" strokeWidth="1" />
                <polygon points="8,9.5 -8,9.5 -8,2" fill="#7dd3fc" opacity="0.6" />
                {/* Right Spearhead Finial */}
                <polygon points="212,9.5 228,2 236,9.5 228,17" fill="#e0f2fe" stroke="#38bdf8" strokeWidth="1.5" />
                <line x1="212" y1="9.5" x2="236" y2="9.5" stroke="#ffffff" strokeWidth="1" />
                <polygon points="212,9.5 228,9.5 228,17" fill="#7dd3fc" opacity="0.6" />
                {/* Decorative suspension rings */}
                <circle cx="36" cy="9.5" r="3" fill="#0369a1" stroke="#bae6fd" strokeWidth="1" />
                <circle cx="184" cy="9.5" r="3" fill="#0369a1" stroke="#bae6fd" strokeWidth="1" />
              </>
            )}

            {/* Ash: Volcanic Horn & Spiked Iron Finials */}
            {normKey === 'ash' && (
              <>
                {/* Left Curved Horn Finial */}
                <path d="M8 9.5 C-4 9.5 -14 4 -16 -4 C-10 1 -4 6 8 6 Z" fill="#1c1917" stroke="#f97316" strokeWidth="1.2" />
                <circle cx="8" cy="9.5" r="4.5" fill="#ea580c" stroke="#fef08a" strokeWidth="1" />
                {/* Right Curved Horn Finial */}
                <path d="M212 9.5 C224 9.5 234 4 236 -4 C230 1 224 6 212 6 Z" fill="#1c1917" stroke="#f97316" strokeWidth="1.2" />
                <circle cx="212" cy="9.5" r="4.5" fill="#ea580c" stroke="#fef08a" strokeWidth="1" />
                {/* Wrapped Spiked Iron Bands */}
                <line x1="42" y1="2" x2="42" y2="17" stroke="#f97316" strokeWidth="2.5" />
                <line x1="178" y1="2" x2="178" y2="17" stroke="#f97316" strokeWidth="2.5" />
              </>
            )}
          </g>
        )}

        {effectiveOpts.rodStyle === 'ornate' && (
          <g className="v-rod-ornate">
            <rect x="4" y="3" width="212" height="12" rx="6" fill={`url(#${rodGradId})`} stroke={`url(#${rimGradId})`} strokeWidth="1.5" />
            <circle cx="6" cy="9" r="8" fill={normKey === 'frost' ? '#7dd3fc' : '#ea580c'} stroke="#ffffff" strokeWidth="1.5" />
            <circle cx="214" cy="9" r="8" fill={normKey === 'frost' ? '#7dd3fc' : '#ea580c'} stroke="#ffffff" strokeWidth="1.5" />
          </g>
        )}

        {effectiveOpts.rodStyle === 'minimal' && (
          <g className="v-rod-minimal">
            <rect x="2" y="2" width="216" height="14" rx="7" fill={`url(#${rimGradId})`} />
            <circle cx="4" cy="9" r="9" fill={cfg.rod} />
            <circle cx="216" cy="9" r="9" fill={cfg.rod} />
          </g>
        )}

        {/* ── 2. Cloth Body with Living Supple Wave ────────────────────────────── */}
        <g className="v-cloth-body">
          {/* Main Colored Tapestry */}
          <path d={cfg.clothPath} fill={`url(#${clothGradId})`} stroke={`url(#${rimGradId})`} strokeWidth="3" strokeLinejoin="round" />

          {/* Realistic Fabric Creases & Volumetric Column Shading */}
          {effectiveOpts.fabricFolds && (
            <>
              {/* Vertical Column Folds */}
              <path
                d={cfg.clothPath}
                fill={`url(#${foldsGradId})`}
                style={{ mixBlendMode: 'multiply' }}
                opacity="0.9"
              />
              {/* Vertical Drape & Gravity Weight Shading */}
              <path
                d={cfg.clothPath}
                fill={`url(#${drapeGradId})`}
                style={{ mixBlendMode: 'multiply' }}
                opacity="0.8"
              />
              {/* Hanging Gathers / Puckers just beneath the bar */}
              <path
                d="M22 16 Q36 26 50 16 Q64 26 78 16 Q94 26 110 16 Q126 26 142 16 Q156 26 170 16 Q184 26 198 16"
                fill="none"
                stroke="#000000"
                strokeWidth="2.2"
                opacity="0.4"
              />
            </>
          )}

          {/* Inner Heraldic Stitched Trim */}
          <path d={cfg.innerPath} fill="none" stroke={cfg.inner} strokeOpacity="0.45" strokeWidth="1.6" strokeDasharray="3 5" />

          {/* Elemental Atmosphere Glow Circle */}
          <circle className="v-glow" cx="110" cy="176" r="88" fill={`url(#${glowGradId})`} />

          {/* Central Heraldic Insignia */}
          <Crest factionKey={pfx} detailed={effectiveOpts.detailedCrest} />

          {/* Living Volcanic / Permafrost Seam Cracks */}
          <g className="v-cracks" stroke={cfg.crack} strokeOpacity={cfg.crackOpacity} strokeWidth="1.4" fill="none" strokeLinejoin="round">
            {cfg.cracks.map((p) => <polyline key={p} points={p} />)}
          </g>

          {/* Star Ornaments */}
          {cfg.ornament}

          {/* ── 3. Hanging Fringe Tassels ──────────────────────────────────────── */}
          {effectiveOpts.tassels && (
            <g className="v-tassels" stroke={normKey === 'frost' ? '#bae6fd' : '#f97316'} strokeWidth="1.5" strokeLinecap="round">
              {normKey === 'frost' ? (
                <>
                  {/* Silver Crystal Pendants at pointed V-tip */}
                  <line x1="110" y1="415" x2="110" y2="426" />
                  <polygon points="110,428 113,423 110,420 107,423" fill="#e0f2fe" stroke="none" />
                  <line x1="66" y1="380" x2="66" y2="389" opacity="0.75" />
                  <line x1="154" y1="380" x2="154" y2="389" opacity="0.75" />
                </>
              ) : (
                <>
                  {/* Scorched Copper Fringe Drop Beads */}
                  <line x1="108" y1="408" x2="108" y2="418" />
                  <circle cx="108" cy="420" r="2.5" fill="#f97316" stroke="none" />
                  <line x1="142" y1="396" x2="142" y2="405" opacity="0.8" />
                  <line x1="68" y1="390" x2="68" y2="399" opacity="0.8" />
                </>
              )}
            </g>
          )}

          {/* ── 4. Emitted Elemental Micro-Particles ───────────────────────────── */}
          {effectiveOpts.particles && normKey === 'frost' && (
            <g className="v-particles-frost" opacity="0.85">
              <circle className="v-banner-spark v-spark-snow" cx="42" cy="130" r="1.8" fill="#e0f2fe" style={{ animationDelay: '0s' }} />
              <circle className="v-banner-spark v-spark-snow" cx="178" cy="170" r="1.4" fill="#bae6fd" style={{ animationDelay: '-1.4s' }} />
              <circle className="v-banner-spark v-spark-snow" cx="95" cy="275" r="1.6" fill="#e0f2fe" style={{ animationDelay: '-2.5s' }} />
              <circle className="v-banner-spark v-spark-snow" cx="138" cy="345" r="1.3" fill="#bae6fd" style={{ animationDelay: '-0.8s' }} />
              <circle className="v-banner-spark v-spark-snow" cx="62" cy="230" r="1.5" fill="#e0f2fe" style={{ animationDelay: '-3.1s' }} />
            </g>
          )}

          {effectiveOpts.particles && normKey === 'ash' && (
            <g className="v-particles-ash" opacity="0.9">
              <circle className="v-banner-spark v-spark-ember" cx="68" cy="360" r="2.0" fill="#f97316" style={{ animationDelay: '0s' }} />
              <circle className="v-banner-spark v-spark-ember" cx="140" cy="370" r="1.6" fill="#fbbf24" style={{ animationDelay: '-1.2s' }} />
              <circle className="v-banner-spark v-spark-ember" cx="108" cy="390" r="2.2" fill="#ef4444" style={{ animationDelay: '-2.1s' }} />
              <circle className="v-banner-spark v-spark-ember" cx="50" cy="320" r="1.5" fill="#f97316" style={{ animationDelay: '-0.7s' }} />
              <circle className="v-banner-spark v-spark-ember" cx="170" cy="310" r="1.8" fill="#f59e0b" style={{ animationDelay: '-2.7s' }} />
            </g>
          )}
        </g>
      </svg>
    </div>
  );
}
