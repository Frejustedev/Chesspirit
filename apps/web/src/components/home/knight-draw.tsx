/** Grand cavalier tracé au fil d'or : il se dessine au chargement (CSS uniquement). */
export function KnightDraw() {
  return (
    <svg
      viewBox="0 0 45 45"
      aria-hidden
      className="pointer-events-none absolute -right-24 -top-10 h-[130%] opacity-[0.16] lg:right-[-4%] lg:opacity-[0.2]"
      fill="none"
      stroke="var(--color-gold)"
      strokeWidth={0.35}
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      <path
        pathLength={400}
        style={{
          strokeDasharray: 400,
          ["--len" as string]: 400,
          animation: "draw 3.2s var(--ease-out-soft) both",
        }}
        d="M14.2 35.5c.2-4.8 2.3-8.1 5.4-10.9-2.6.5-5 1.5-6.6 2.9-1.7 1-3.6-.2-3.4-2 .5-3.6 2.4-6.7 5.1-9.4l.9-4.9 2.8 2.6c.9-.3 1.9-.5 2.9-.6L23.9 9l1.6 3.7c5.7 2.1 9.3 7.7 9.3 14.6 0 3-.4 5.7-1 8.2H14.2ZM11 40.5h23a1.5 1.5 0 0 0 1.5-1.5v-1.2a2.3 2.3 0 0 0-2.3-2.3H11.8a2.3 2.3 0 0 0-2.3 2.3V39a1.5 1.5 0 0 0 1.5 1.5Z"
      />
      <path
        pathLength={100}
        style={{
          strokeDasharray: 100,
          ["--len" as string]: 100,
          animation: "draw 2s var(--ease-out-soft) 1.6s both",
        }}
        d="M14.4 24.9c1.3-.6 2.9-1 4.4-1.2M26.3 14.1c2.6 2.4 4 5.7 4 9.6"
      />
    </svg>
  );
}
