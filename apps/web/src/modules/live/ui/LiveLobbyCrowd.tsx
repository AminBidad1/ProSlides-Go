import { useMemo } from "react";

interface LiveLobbyCrowdParticipant {
  id: string;
  name: string;
  avatar?: string;
  color?: string;
}

type LiveLobbyCrowdProps = {
  participants: readonly LiveLobbyCrowdParticipant[];
  total: number;
  hiddenIds?: ReadonlySet<string>;
  onToggleHidden?: (participantId: string) => void;
  className?: string;
  emptyTitle?: string;
  emptyDescription?: string;
};

const MAX_VISIBLE = 36;
const SLOT_COUNT = 48;

const lobbyHash = (value: string) => {
  let hash = 2166136261;
  for (const char of value) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const radicalInverse = (index: number, base: number) => {
  let value = 0;
  let factor = 1 / base;
  let remaining = index;
  while (remaining > 0) {
    value += factor * (remaining % base);
    remaining = Math.floor(remaining / base);
    factor /= base;
  }
  return value;
};

// A low-discrepancy layout looks organic without the pile-ups caused by raw
// random coordinates. Slots are intentionally not aligned to rows or columns.
const LOBBY_SLOTS = Array.from({ length: SLOT_COUNT }, (_, index) => ({
  left: 7 + radicalInverse(index + 1, 2) * 86,
  top: 8 + radicalInverse(index + 1, 3) * 78,
}));

export function LiveLobbyCrowd({
  participants,
  total,
  hiddenIds,
  onToggleHidden,
  className = "",
  emptyTitle = "منتظر اولین نفر هستیم",
  emptyDescription = "با ورود شرکت‌کنندگان، نام و آواتارشان اینجا ظاهر می‌شود.",
}: LiveLobbyCrowdProps) {
  const visible = useMemo(
    () => participants.slice(0, MAX_VISIBLE),
    [participants],
  );

  const placed = useMemo(() => {
    const occupied = new Set<number>();
    const assignments = new Map<string, number>();

    // Stable id ordering makes placement deterministic across clients while the
    // oversized slot pool keeps collisions rare. Only colliding ids can move
    // when a new participant arrives.
    for (const participant of [...visible].sort((a, b) =>
      a.id.localeCompare(b.id),
    )) {
      let slot = lobbyHash(participant.id) % SLOT_COUNT;
      let attempts = 0;
      while (occupied.has(slot) && attempts < SLOT_COUNT) {
        slot = (slot + 1) % SLOT_COUNT;
        attempts += 1;
      }
      assignments.set(participant.id, slot);
      occupied.add(slot);
    }

    return visible.map((participant) => {
      const slot = assignments.get(participant.id) ?? 0;
      const point = LOBBY_SLOTS[slot];
      return {
        participant,
        left: point.left,
        top: point.top,
        rotate: (lobbyHash(participant.id + ":r") % 9) - 4,
        delay: lobbyHash(participant.id + ":d") % 130,
      };
    });
  }, [visible]);

  return (
    <section
      className={`relative min-h-[26rem] overflow-hidden rounded-[2.5rem] border border-white/10 bg-white/[0.045] shadow-2xl backdrop-blur sm:min-h-[34rem] ${className}`}
      aria-label="شرکت‌کنندگان حاضر در لابی"
    >
      <style>{`
        @keyframes live-lobby-arrive {
          0% { opacity: 0; scale: .68; filter: blur(8px); }
          70% { opacity: 1; scale: 1.08; filter: blur(0); }
          100% { opacity: 1; scale: 1; filter: blur(0); }
        }
        .live-lobby-card {
          animation: live-lobby-arrive 580ms cubic-bezier(.2,.9,.25,1.15) both;
        }
        @media (max-width: 639px) {
          .live-lobby-entry:nth-child(n+21) { display: none; }
        }
        @media (prefers-reduced-motion: reduce) {
          .live-lobby-card { animation: none !important; }
        }
      `}</style>

      <div
        className="absolute -start-20 top-[8%] h-64 w-64 rounded-full bg-white/[0.04] blur-3xl"
        aria-hidden="true"
      />
      <div
        className="absolute -end-24 bottom-[7%] h-72 w-72 rounded-full bg-white/[0.055] blur-3xl"
        aria-hidden="true"
      />

      {visible.length === 0 ? (
        <div className="absolute inset-0 grid place-items-center px-8 text-center">
          <div>
            <p className="text-5xl" aria-hidden="true">
              👋
            </p>
            <p className="mt-5 text-2xl font-black">{emptyTitle}</p>
            <p className="mt-2 text-sm leading-6 text-[color:var(--live-muted)]">
              {emptyDescription}
            </p>
          </div>
        </div>
      ) : (
        <div role="list">
          {placed.map(({ participant, left, top, rotate, delay }, index) => {
            const hidden = hiddenIds?.has(participant.id) ?? false;
            const cardContent = (
              <>
                <span
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/10 text-xl sm:h-10 sm:w-10 sm:text-2xl"
                  aria-hidden="true"
                >
                  {participant.avatar || "🙂"}
                </span>
                <span
                  className="max-w-24 truncate text-xs font-black sm:max-w-40 sm:text-sm"
                  dir="auto"
                  style={participant.color ? { color: participant.color } : undefined}
                >
                  {hidden ? "••••" : participant.name}
                </span>
              </>
            );

            return (
              <div
                key={participant.id}
                role="listitem"
                className="live-lobby-entry absolute"
                style={{
                  left: `${left}%`,
                  top: `${top}%`,
                  transform: `translate(-50%, -50%) rotate(${rotate}deg)`,
                  zIndex: placed.length - index,
                }}
              >
                {onToggleHidden ? (
                  <button
                    type="button"
                    onClick={() => onToggleHidden(participant.id)}
                    aria-pressed={hidden}
                    aria-label={
                      hidden
                        ? `نمایش نام ${participant.name}`
                        : `پنهان کردن نام ${participant.name}`
                    }
                    className="live-lobby-card flex items-center gap-2 rounded-2xl border border-white/15 bg-black/35 px-2.5 py-2 shadow-xl backdrop-blur-md transition-[background-color,border-color] hover:border-white/30 hover:bg-black/45 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/35"
                    style={{ animationDelay: `${delay}ms` }}
                  >
                    {cardContent}
                  </button>
                ) : (
                  <div
                    className="live-lobby-card flex items-center gap-2 rounded-2xl border border-white/15 bg-black/35 px-2.5 py-2 shadow-xl backdrop-blur-md"
                    style={{ animationDelay: `${delay}ms` }}
                  >
                    {cardContent}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-4 bottom-4 flex justify-center">
        <p className="rounded-full border border-white/10 bg-black/40 px-4 py-2 text-xs font-bold text-white/75 shadow-lg backdrop-blur">
          {Number(total).toLocaleString("fa-IR")} نفر وارد شده‌اند
        </p>
      </div>
    </section>
  );
}
