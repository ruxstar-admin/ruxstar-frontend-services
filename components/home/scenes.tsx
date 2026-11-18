import styles from "./scenes.module.css";

/**
 * A short cartoon for each business on the home page: three beats on one 9-second loop, with the caption for each beat
 * lighting up in step. Pure SVG and CSS. Every moving piece rests where it ends, so with reduced motion the last frame shows.
 */

export type SceneKind = "pod" | "events" | "coaching" | "turf" | "stays" | "shop" | "freelance";

const C = {
  bg: "#0D0C12",
  raised: "#24222F",
  line: "#2C2A39",
  ink: "#FFFFFF",
  ink2: "#9E9CB0",
  paper: "#F4F2FA",
  yellow: "#EADC05",
  blue: "#33B4FA",
  blueDeep: "#1C7DB8",
  accent: "#B45CF2",
  accentDeep: "#7C3AED",
  ok: "#34C759",
  red: "#FF5A4F",
  skin: "#F1B98C",
  skinDark: "#C68A5E",
  hair: "#2A1F33",
  denim: "#3B4A7A",
  grass: "#1F6B3B",
  grassLight: "#247A44",
};

/** Class names for a moving piece: the shared timing plus its own motion and an optional delay step. */
const a = (...names: string[]) => [styles.a, ...names.map((n) => styles[n])].join(" ");

function Person({
  x,
  y,
  shirt,
  skin = C.skin,
  hair = C.hair,
  arm = "down",
  armClass,
  size = 1,
  flip,
}: {
  x: number;
  y: number;
  shirt: string;
  skin?: string;
  hair?: string;
  arm?: "down" | "up";
  armClass?: string;
  size?: number;
  flip?: boolean;
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -size : size} ${size})`}>
      <ellipse cy="2" rx="20" ry="4" fill={C.bg} opacity="0.6" />
      <rect x="-9" y="-34" width="7" height="34" rx="3.5" fill={C.denim} />
      <rect x="2" y="-34" width="7" height="34" rx="3.5" fill={C.denim} />
      <path d="M-13 -64 L-21 -42" stroke={shirt} strokeWidth="7" strokeLinecap="round" />
      <g className={armClass}>
        <path d={arm === "up" ? "M13 -64 L25 -84" : "M13 -64 L21 -42"} stroke={shirt} strokeWidth="7" strokeLinecap="round" />
      </g>
      <rect x="-15" y="-72" width="30" height="42" rx="13" fill={shirt} />
      <circle cy="-88" r="15" fill={skin} />
      <path d="M-15 -89 a15 15 0 0 1 30 0 c-6 -5 -12 -6 -15 -3 c-4 -3 -10 -2 -15 3z" fill={hair} />
      <circle cx="-5" cy="-87" r="1.8" fill={C.bg} />
      <circle cx="5" cy="-87" r="1.8" fill={C.bg} />
      <path d="M-5 -81 q5 4 10 0" fill="none" stroke={C.bg} strokeWidth="1.6" strokeLinecap="round" />
    </g>
  );
}

function Wheel({ cx }: { cx: number }) {
  return (
    <g transform={`translate(${cx} 0)`}>
      <g className={a("spin")}>
        <circle r="9" fill={C.bg} stroke={C.ink2} strokeWidth="3" />
        <path d="M-5 0h10M0 -5v10" stroke={C.ink2} strokeWidth="2" />
      </g>
    </g>
  );
}

/** A delivery scooter whose wheels touch the ground 9 below `y`. */
function Scooter({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x="-8" y="-46" width="24" height="22" rx="4" fill={C.yellow} />
      <path d="M-3 -36h14" stroke={C.bg} strokeWidth="2" opacity="0.35" />
      <rect x="16" y="-46" width="16" height="22" rx="7" fill={C.accentDeep} />
      <circle cx="26" cy="-54" r="9" fill={C.skin} />
      <path d="M17 -55 a9 9 0 0 1 18 0z" fill={C.blue} />
      <path d="M34 -20 l10 -18 h6" stroke={C.ink} strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="-8" y="-24" width="50" height="13" rx="6.5" fill={C.accent} />
      <Wheel cx={-2} />
      <Wheel cx={42} />
    </g>
  );
}

function House({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M-6 -50 L30 -82 L66 -50z" fill={C.accent} />
      <rect x="0" y="-52" width="60" height="52" rx="4" fill={C.raised} stroke={C.line} strokeWidth="2" />
      <rect x="22" y="-28" width="16" height="28" rx="3" fill={C.yellow} />
      <rect x="6" y="-44" width="12" height="10" rx="2" fill={C.blue} />
      <rect x="42" y="-44" width="12" height="10" rx="2" fill={C.blue} />
    </g>
  );
}

function Tick({ x, y, r = 14 }: { x: number; y: number; r?: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r={r} fill={C.ok} />
      <path
        d={`M${-r * 0.42} 0 l${r * 0.3} ${r * 0.32} l${r * 0.52} ${-r * 0.62}`}
        stroke="#fff"
        strokeWidth={r / 4.5}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  );
}

function Sparkle({ x, y, size = 1, color = C.yellow }: { x: number; y: number; size?: number; color?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${size})`}>
      <path d="M0 -8 L2 -2 L8 0 L2 2 L0 8 L-2 2 L-8 0 L-2 -2z" fill={color} />
    </g>
  );
}

function Ground() {
  return <rect x="0" y="250" width="400" height="3" rx="1.5" fill={C.line} />;
}

function PodScene() {
  return (
    <>
      <Ground />
      <rect x="36" y="60" width="64" height="112" rx="12" fill={C.raised} stroke={C.line} strokeWidth="2" />
      <rect x="43" y="72" width="50" height="88" rx="6" fill={C.bg} />
      <g transform="translate(52 90)">
        <rect width="32" height="40" rx="3" fill={C.paper} />
        <path d="M6 10h20M6 18h20M6 26h12" stroke={C.ink2} strokeWidth="2.5" strokeLinecap="round" />
      </g>

      <g className={a("fly")}>
        <g transform="translate(209 30)">
          <rect width="32" height="40" rx="3" fill={C.paper} />
          <path d="M6 10h20M6 18h20M6 26h12" stroke={C.ink2} strokeWidth="2.5" strokeLinecap="round" />
        </g>
      </g>
      {[0, 1, 2].map((i) => (
        <g key={i} className={a("printOut", `d${i}`)}>
          <g transform={`translate(${190 + i * 6} ${130 + i * 3})`}>
            <rect width="70" height="44" rx="3" fill={C.paper} stroke={C.line} />
            <path d="M10 12h50M10 22h50M10 32h30" stroke={C.ink2} strokeWidth="2.5" strokeLinecap="round" />
          </g>
        </g>
      ))}
      <rect x="176" y="58" width="98" height="16" rx="5" fill={C.blueDeep} />
      <rect x="160" y="70" width="130" height="62" rx="14" fill={C.blue} />
      <rect x="182" y="124" width="86" height="8" rx="4" fill={C.blueDeep} />
      <rect x="174" y="84" width="44" height="9" rx="4.5" fill="#fff" opacity="0.55" />
      <circle cx="254" cy="88" r="5" fill={C.ok} />
      <g className={a("blink")}>
        <circle cx="270" cy="88" r="5" fill={C.yellow} />
      </g>

      <House x={322} y={250} />
      <g className={a("drive")}>
        <Scooter x={246} y={241} />
      </g>
      <g className={a("popLate")}>
        <Tick x={352} y={150} />
      </g>
    </>
  );
}

const QR = ["11011", "10010", "01101", "10011", "11101"];

function EventsScene() {
  return (
    <>
      <Ground />
      <rect x="170" y="36" width="214" height="148" rx="12" fill={C.raised} />
      <path d="M170 48 q18 22 36 0 q18 22 36 0 q18 22 36 0 q18 22 36 0 q18 22 36 0 q18 22 34 0 v-12 h-214z" fill={C.accentDeep} />
      <g className={a("sway")}>
        <path d="M232 36 L200 184 L268 184z" fill={C.yellow} opacity="0.14" />
      </g>
      <g className={a("sway", "d2")}>
        <path d="M330 36 L296 184 L364 184z" fill={C.blue} opacity="0.14" />
      </g>
      <rect x="160" y="180" width="234" height="16" rx="6" fill={C.line} />
      <Person x={278} y={182} shirt={C.accent} arm="up" armClass={a("wave")} hair={C.yellow} />

      <rect x="24" y="118" width="64" height="112" rx="12" fill={C.raised} stroke={C.line} strokeWidth="2" />
      <rect x="31" y="130" width="50" height="88" rx="6" fill={C.bg} />
      <g className={a("rise")}>
        <g transform="translate(18 40)">
          <rect width="132" height="60" rx="8" fill={C.yellow} />
          <circle cx="92" cy="0" r="7" fill="#1A1922" />
          <circle cx="92" cy="60" r="7" fill="#1A1922" />
          <path d="M92 10v40" stroke={C.bg} strokeWidth="2" strokeDasharray="4 4" opacity="0.4" />
          <rect x="12" y="14" width="56" height="8" rx="4" fill={C.bg} opacity="0.85" />
          <rect x="12" y="30" width="40" height="6" rx="3" fill={C.bg} opacity="0.45" />
          <rect x="12" y="42" width="48" height="6" rx="3" fill={C.bg} opacity="0.45" />
          <g className={a("from2")}>
            <g transform="translate(102 14)">
              {QR.flatMap((row, y) =>
                [...row].map((cell, x) =>
                  cell === "1" ? <rect key={`${x}-${y}`} x={x * 6.4} y={y * 6.4} width="5.6" height="5.6" rx="1" fill={C.bg} /> : null,
                ),
              )}
            </g>
          </g>
        </g>
      </g>
      {[
        [158, 34, 1],
        [12, 30, 0.7],
        [160, 108, 0.8],
      ].map(([x, y, s], i) => (
        <g key={i} className={a("twinkle", `d${i}`)}>
          <Sparkle x={x} y={y} size={s} />
        </g>
      ))}
      <g className={a("only3")}>
        <Tick x={140} y={40} r={16} />
      </g>

      {[
        [196, C.blue, C.skinDark],
        [248, C.ok, C.skin],
        [344, C.red, C.skinDark],
      ].map(([x, shirt, skin], i) => (
        <g key={i} className={a("from3")}>
          <g className={a("jump", `d${i}`)}>
            <Person x={x as number} y={272} shirt={shirt as string} skin={skin as string} arm="up" size={0.78} />
          </g>
        </g>
      ))}
      {[180, 214, 250, 286, 322, 356, 230, 340].map((x, i) => (
        <g key={i} className={a("fall", `d${i % 4}`)}>
          <rect x={x} y={20 + (i % 3) * 8} width="7" height="11" rx="2" fill={[C.yellow, C.blue, C.accent, C.ok][i % 4]} />
        </g>
      ))}
    </>
  );
}

function CoachingScene() {
  return (
    <>
      <Ground />
      <rect x="130" y="30" width="240" height="140" rx="10" fill={C.paper} stroke={C.raised} strokeWidth="6" />
      <rect x="150" y="170" width="200" height="7" rx="3.5" fill={C.raised} />
      {[
        ["M152 62 h96", 0],
        ["M152 88 h132", 1],
        ["M152 114 h76", 2],
      ].map(([d, i]) => (
        <path key={i} d={d as string} className={a("write", `d${i}`)} stroke={C.accentDeep} strokeWidth="7" strokeLinecap="round" fill="none" />
      ))}
      {[
        [300, 30, C.blue],
        [320, 46, C.yellow],
        [340, 64, C.ok],
      ].map(([x, h, fill], i) => (
        <g key={i} className={a("grow", `d${i}`)}>
          <rect x={x as number} y={154 - (h as number)} width="14" height={h as number} rx="3" fill={fill as string} />
        </g>
      ))}
      <Person x={84} y={250} shirt={C.blue} arm="up" armClass={a("point")} />

      <g className={a("only2")}>
        <rect x="226" y="186" width="156" height="60" rx="12" fill={C.raised} />
        <rect x="240" y="198" width="60" height="7" rx="3.5" fill={C.ink2} opacity="0.6" />
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <circle key={i} cx={246 + i * 20} cy="226" r="7" fill={C.line} />
        ))}
        {[0, 2, 4].map((i, k) => (
          <circle key={i} cx={246 + i * 20} cy="226" r="7" fill={C.blue} className={a("lightUp", `d${k}`)} />
        ))}
      </g>

      <g className={a("from3")}>
        <Person x={300} y={250} shirt={C.yellow} size={0.75} arm="up" armClass={a("wave")} />
        <g transform="translate(300 172)">
          <path d="M-18 -6 L0 -14 L18 -6 L0 2z" fill={C.bg} />
          <rect x="-9" y="-4" width="18" height="8" rx="2" fill={C.bg} />
        </g>
      </g>
      {[
        [262, 176],
        [338, 166],
      ].map(([x, y], i) => (
        <g key={i} className={a("burst", `d${i}`)}>
          <Sparkle x={x} y={y} />
        </g>
      ))}
    </>
  );
}

const SLOT_TIMES = ["5 PM", "6 PM", "7 PM", "8 PM"];

function TurfScene() {
  return (
    <>
      <rect x="16" y="118" width="368" height="146" rx="16" fill={C.grass} />
      {[0, 2, 4].map((i) => (
        <rect key={i} x={16 + i * 61.3} y="118" width="61.3" height="146" fill={C.grassLight} />
      ))}
      <rect x="30" y="130" width="340" height="122" rx="6" fill="none" stroke="#fff" strokeOpacity="0.5" strokeWidth="3" />
      <path d="M200 130v122" stroke="#fff" strokeOpacity="0.5" strokeWidth="3" />
      <circle cx="200" cy="191" r="22" fill="none" stroke="#fff" strokeOpacity="0.5" strokeWidth="3" />
      <g className={a("net")}>
        <path d="M350 166h22v52h-22M356 166v52M362 166v52M368 166v52M350 179h22M350 192h22M350 205h22" stroke="#fff" strokeOpacity="0.45" strokeWidth="1.5" fill="none" />
      </g>
      <path d="M350 162v60" stroke="#fff" strokeWidth="5" strokeLinecap="round" />

      <rect x="40" y="16" width="320" height="82" rx="14" fill={C.raised} />
      <rect x="56" y="28" width="96" height="8" rx="4" fill={C.ink2} opacity="0.6" />
      {SLOT_TIMES.map((t, i) => (
        <g key={t} transform={`translate(${56 + i * 74} 48)`}>
          <rect width="64" height="34" rx="10" fill={i === 0 ? C.bg : C.line} />
          <text x="32" y="22" textAnchor="middle" className={styles.label} fill={i === 0 ? C.ink2 : C.ink} opacity={i === 0 ? 0.5 : 1}>
            {t}
          </text>
        </g>
      ))}
      <g className={a("pick")}>
        <g transform="translate(204 48)">
          <rect width="64" height="34" rx="10" fill={C.yellow} />
          <text x="32" y="22" textAnchor="middle" className={styles.label} fill={C.bg}>
            7 PM
          </text>
        </g>
      </g>
      <g className={a("tap")}>
        <circle cx="236" cy="65" r="22" fill="none" stroke={C.yellow} strokeWidth="3" />
      </g>
      <g className={a("from2")}>
        <Tick x={352} y={22} r={15} />
      </g>

      <Person x={112} y={250} shirt={C.yellow} hair={C.hair} />
      <g className={a("kick")}>
        <g transform="translate(356 202)">
          <circle r="9" fill="#fff" />
          <path d="M0 -4 L4 -1 L2.5 4 L-2.5 4 L-4 -1z" fill={C.bg} />
        </g>
      </g>
      {[
        [330, 150],
        [384, 160],
        [372, 236],
      ].map(([x, y], i) => (
        <g key={i} className={a("goal", `d${i}`)}>
          <Sparkle x={x} y={y} />
        </g>
      ))}
    </>
  );
}

const WINDOWS = [0, 1, 2].flatMap((col) => [0, 1, 2, 3].map((row) => ({ col, row })));

function StaysScene() {
  return (
    <>
      <Ground />
      <rect x="30" y="46" width="150" height="204" rx="12" fill={C.raised} />
      <rect x="22" y="36" width="166" height="16" rx="6" fill={C.accent} />
      {WINDOWS.map(({ col, row }) => (
        <rect
          key={`${col}-${row}`}
          x={48 + col * 44}
          y={66 + row * 34}
          width="28"
          height="22"
          rx="4"
          fill={(col + row) % 3 === 0 || (col === 2 && row === 2) ? C.bg : C.yellow}
          opacity={(col + row) % 3 === 0 ? 1 : 0.85}
        />
      ))}
      <g className={a("only1")}>
        <g className={a("glow")}>
          <rect x="88" y="96" width="36" height="30" rx="7" fill="none" stroke={C.blue} strokeWidth="3" />
        </g>
      </g>
      <rect x="92" y="100" width="28" height="22" rx="4" fill={C.blue} />
      <rect x="88" y="206" width="34" height="44" rx="4" fill={C.yellow} opacity="0.9" />
      <g className={a("door")}>
        <rect x="88" y="206" width="34" height="44" rx="4" fill={C.accentDeep} />
      </g>

      <g className={a("from2")}>
        <rect x="206" y="24" width="176" height="116" rx="14" fill={C.raised} />
        <rect x="222" y="58" width="10" height="58" rx="4" fill={C.blueDeep} />
        <rect x="230" y="80" width="134" height="22" rx="8" fill={C.blue} />
        <rect x="238" y="70" width="34" height="16" rx="6" fill={C.paper} />
        <rect x="224" y="100" width="144" height="12" rx="4" fill={C.blueDeep} />
        <rect x="228" y="110" width="6" height="12" rx="2" fill={C.blueDeep} />
        <rect x="358" y="110" width="6" height="12" rx="2" fill={C.blueDeep} />
        <rect x="222" y="34" width="98" height="24" rx="12" fill={C.ok} />
        <text x="271" y="50" textAnchor="middle" className={styles.label} fill={C.bg}>
          Bed B · Free
        </text>
      </g>
      <g className={a("popMid")}>
        <Tick x={366} y={36} r={15} />
      </g>

      <g className={a("walk")}>
        <g className={a("stride")}>
          <Person x={156} y={250} shirt={C.ok} flip skin={C.skinDark} />
          <rect x="128" y="214" width="20" height="30" rx="5" fill={C.red} />
          <path d="M134 214 v-6 h8 v6" stroke={C.red} strokeWidth="3" fill="none" />
        </g>
      </g>
    </>
  );
}

function ShopScene() {
  return (
    <>
      <Ground />
      <rect x="24" y="84" width="150" height="166" rx="8" fill={C.raised} />
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i}>
          <rect x={18 + i * 32.4} y="58" width="32.4" height="28" fill={i % 2 ? C.paper : C.red} />
          <circle cx={34.2 + i * 32.4} cy="86" r="16.2" fill={i % 2 ? C.paper : C.red} />
        </g>
      ))}
      <rect x="40" y="132" width="118" height="6" rx="3" fill={C.line} />
      <rect x="40" y="186" width="118" height="6" rx="3" fill={C.line} />
      <circle cx="58" cy="122" r="9" fill={C.red} />
      <rect x="76" y="108" width="16" height="24" rx="3" fill={C.paper} />
      <rect x="100" y="114" width="22" height="18" rx="6" fill="#E0A15A" />
      <rect x="132" y="110" width="16" height="22" rx="4" fill={C.ok} />
      <rect x="50" y="164" width="22" height="22" rx="4" fill={C.blue} />
      <circle cx="94" cy="176" r="10" fill={C.yellow} />
      <rect x="114" y="160" width="16" height="26" rx="3" fill={C.accent} />

      <g className={a("upTo2")}>
        <g className={a("drop", "d0")}>
          <circle cx="232" cy="196" r="12" fill={C.red} />
          <path d="M232 184 q4 -6 9 -5" stroke={C.ok} strokeWidth="3" fill="none" strokeLinecap="round" />
        </g>
        <g className={a("drop", "d1")}>
          <rect x="248" y="170" width="18" height="32" rx="2" fill={C.paper} />
          <rect x="248" y="180" width="18" height="9" fill={C.blue} />
        </g>
        <g className={a("drop", "d2")}>
          <rect x="270" y="186" width="24" height="16" rx="7" fill="#E0A15A" />
        </g>
        <path d="M188 188 h14 l6 12" stroke={C.ink} strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M206 200 H300 L290 234 H216z" fill={C.raised} stroke={C.ink2} strokeWidth="3" strokeLinejoin="round" />
        <circle cx="226" cy="243" r="7" fill={C.bg} stroke={C.ink2} strokeWidth="3" />
        <circle cx="282" cy="243" r="7" fill={C.bg} stroke={C.ink2} strokeWidth="3" />
      </g>

      <g className={a("only2")}>
        <path d="M312 186 h48 l4 64 h-56z" fill="#C98B5E" />
        <path d="M312 186 h48 l-4 10 h-40z" fill="#A9703F" />
        <path d="M326 186 v-8 a10 10 0 0 1 20 0 v8" stroke="#A9703F" strokeWidth="3" fill="none" />
        <Sparkle x={336} y={222} size={1.3} />
      </g>

      <House x={324} y={250} />
      <g className={a("drive")}>
        <Scooter x={246} y={241} />
      </g>
      <g className={a("popLate")}>
        <Tick x={354} y={150} />
      </g>
    </>
  );
}

function FreelanceScene() {
  return (
    <>
      <g className={a("only1")}>
        {[0, 1, 2].map((i) => (
          <g key={i} transform={`translate(${44 + i * 110} 16)`}>
            <rect width="94" height="104" rx="14" fill={C.raised} />
            <circle cx="47" cy="36" r="17" fill={[C.skin, C.skinDark, C.skin][i]} />
            <path d="M30 34 a17 17 0 0 1 34 0 c-8 -6 -14 -6 -17 -3 c-4 -3 -10 -3 -17 3z" fill={C.hair} />
            <rect x="22" y="62" width="50" height="7" rx="3.5" fill={C.ink2} opacity="0.7" />
            {[0, 1, 2, 3, 4].map((s) => (
              <circle key={s} cx={27 + s * 10} cy="84" r="3.5" fill={s < 4 + (i % 2) ? C.yellow : C.line} />
            ))}
          </g>
        ))}
        <g className={a("glow")}>
          <rect x="150" y="12" width="102" height="112" rx="17" fill="none" stroke={C.yellow} strokeWidth="3" />
        </g>
      </g>

      <rect x="60" y="236" width="280" height="10" rx="5" fill={C.raised} />
      <Person x={200} y={236} shirt={C.accent} />
      <rect x="140" y="150" width="120" height="78" rx="8" fill={C.line} />
      <rect x="146" y="156" width="108" height="66" rx="4" fill={C.bg} />
      <rect x="126" y="226" width="148" height="10" rx="5" fill={C.ink2} />
      <g className={a("from2", "d0")}>
        <circle cx="172" cy="188" r="14" fill={C.yellow} />
      </g>
      <g className={a("from2", "d1")}>
        <rect x="194" y="174" width="26" height="28" rx="4" fill={C.blue} />
      </g>
      <g className={a("from2", "d2")}>
        <path d="M228 202 L240 176 L252 202z" fill={C.accent} />
      </g>
      <g className={a("only2")}>
        <g className={a("float")}>
          <rect x="88" y="140" width="40" height="28" rx="8" fill={C.raised} />
          <text x="108" y="159" textAnchor="middle" className={styles.label} fill={C.blue}>
            {"</>"}
          </text>
        </g>
        <g className={a("float", "d2")}>
          <path d="M286 150 l20 -20 l6 6 l-20 20 l-8 2z" fill={C.yellow} />
        </g>
      </g>

      <g className={a("popLate")}>
        <Tick x={312} y={110} r={20} />
      </g>
      {[0, 1, 2].map((i) => (
        <g key={i} className={a("coin", `d${i}`)}>
          <g transform={`translate(${296 + i * 26} 176)`}>
            <circle r="11" fill={C.yellow} />
            <text y="4.5" textAnchor="middle" className={styles.label} fill={C.bg}>
              ₹
            </text>
          </g>
        </g>
      ))}
    </>
  );
}

const SCENES: Record<SceneKind, { art: () => React.JSX.Element; steps: [string, string, string] }> = {
  pod: { art: PodScene, steps: ["Send your file", "The shop prints it", "Delivered to your door"] },
  events: { art: EventsScene, steps: ["Pick your tickets", "Get a QR code", "Walk right in"] },
  coaching: { art: CoachingScene, steps: ["Try a demo class", "Join a batch", "Learn and grow"] },
  turf: { art: TurfScene, steps: ["Pick a free slot", "Pay, and it’s yours", "Play"] },
  stays: { art: StaysScene, steps: ["See which beds are free", "Reserve yours", "Move in"] },
  shop: { art: ShopScene, steps: ["Fill your cart", "The shop packs it", "Delivered to your door"] },
  freelance: { art: FreelanceScene, steps: ["Pick a freelancer", "They do the work", "Approve, and they’re paid"] },
};

/** One business, told as a three-step cartoon. */
export function Scene({ kind }: { kind: SceneKind }) {
  const { art: Art, steps } = SCENES[kind];
  return (
    <div className={styles.scene}>
      <svg className={styles.art} viewBox="0 0 400 280" role="presentation">
        <Art />
      </svg>
      <ol className={styles.steps}>
        {steps.map((step, i) => (
          <li key={step} className={styles.step}>
            <span className={styles.num}>{i + 1}</span>
            {step}
          </li>
        ))}
      </ol>
    </div>
  );
}
