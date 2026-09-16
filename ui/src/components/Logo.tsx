/**
 * The EquiVault mark: a gold shield with a keyhole, rising bars breaking out of
 * it, and a swoosh underneath. Drawn as SVG so it stays crisp at every size and
 * can inherit the page's gold gradient.
 */

type MarkProps = {
  readonly size?: number;
  readonly className?: string;
  readonly idPrefix?: string;
};

export const EquiVaultMark = ({ size = 40, className, idPrefix = 'ev' }: MarkProps) => {
  const gradId = `${idPrefix}-gold`;
  const gradSoft = `${idPrefix}-gold-soft`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="EquiVault"
    >
      <defs>
        <linearGradient id={gradId} x1="6" y1="4" x2="58" y2="60" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F5A623" />
          <stop offset="0.5" stopColor="#FFD965" />
          <stop offset="1" stopColor="#FFC837" />
        </linearGradient>
        <linearGradient id={gradSoft} x1="20" y1="50" x2="56" y2="18" gradientUnits="userSpaceOnUse">
          <stop stopColor="#D98A0F" />
          <stop offset="1" stopColor="#FFD965" />
        </linearGradient>
      </defs>

      {/* Shield, open on the right so the bars can break out of it */}
      <path
        d="M31 5.5 11.5 12.4v15.9c0 12.3 8 21.4 19.5 25.6 2.2-.8 4.3-1.8 6.2-3l-4.6-3.4c-9-3.9-14.6-11.1-14.6-19.2V16.6L31 12.1l9.4 3.3 3.9-6.1L31 5.5Z"
        fill={`url(#${gradId})`}
      />

      {/* Keyhole */}
      <circle cx="30.8" cy="27" r="4.4" fill="#0A0A0B" />
      <path d="M28.9 29.6h3.8l1.3 8.6h-6.4l1.3-8.6Z" fill="#0A0A0B" />
      <circle cx="30.8" cy="27" r="2.6" fill={`url(#${gradId})`} />

      {/* Rising bars */}
      <rect x="29.5" y="38" width="5.4" height="10.5" rx="1" fill={`url(#${gradSoft})`} />
      <rect x="36.6" y="31.5" width="5.4" height="17" rx="1" fill={`url(#${gradSoft})`} />
      <rect x="43.7" y="24" width="5.4" height="24.5" rx="1" fill={`url(#${gradId})`} />

      {/* Arrow head on the growth curve */}
      <path
        d="M43.4 17.8 57 14.4l-3.4 13.6-3.9-4.6-6.1 5.2-2.5-3 6.1-5.2-3.8-2.6Z"
        fill={`url(#${gradId})`}
      />

      {/* Swoosh */}
      <path
        d="M10 45.5c6.8 7.4 18.6 12 30.4 11.2 7.9-.5 13.6-3.2 15.6-6.9-.5 5.6-7.4 10-17.7 10.7C25.4 61.3 12.4 55 8.2 46.4c-.4-.9.1-1.6 1.8-.9Z"
        fill={`url(#${gradSoft})`}
        opacity="0.9"
      />
    </svg>
  );
};

type WordmarkProps = {
  readonly className?: string;
  readonly markSize?: number;
  readonly showTagline?: boolean;
};

export const EquiVaultWordmark = ({
  className = '',
  markSize = 30,
  showTagline = false,
}: WordmarkProps) => (
  <span className={`inline-flex items-center gap-2.5 ${className}`}>
    <EquiVaultMark size={markSize} />
    <span className="flex flex-col leading-none">
      <span className="text-[1.05rem] font-bold tracking-[-0.02em]">
        <span className="text-cream-50">Equi</span>
        <span className="text-gradient-gold">Vault</span>
      </span>
      {showTagline ? (
        <span className="mt-1 text-[0.6rem] tracking-[0.18em] text-cream-500 uppercase">
          Private IPO access for everyone
        </span>
      ) : null}
    </span>
  </span>
);
