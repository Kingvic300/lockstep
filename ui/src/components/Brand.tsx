import { Link } from "../lib/router";

/** Logo mark: three steps on one rail, closed by a lock bar. */
export function Mark(props: { size?: number }) {
  const s = props.size ?? 30;
  return (
    <svg width={s} height={s} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id="ls-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7c83ff" />
          <stop offset="1" stopColor="#3b31c9" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#ls-mark)" />
      <path d="M10 8v14" stroke="#fff" strokeOpacity=".5" strokeWidth="2" strokeLinecap="round" />
      <circle cx="10" cy="8" r="2.6" fill="#fff" />
      <circle cx="10" cy="15" r="2.6" fill="#fff" />
      <rect x="6" y="21" width="20" height="5" rx="2.5" fill="#34d399" />
      <path d="M15 8h10M15 15h7" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function Brand(props: { to?: string }) {
  return (
    <Link to={props.to ?? "/"} className="brand" aria-label="Lockstep home">
      <Mark />
      <span className="brand-word">Lockstep</span>
    </Link>
  );
}
