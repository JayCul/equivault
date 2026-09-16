import { NavLink, Link, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useApp } from '../contexts/AppContext';
import { EquiVaultWordmark } from './Logo';
import { Button, cx, Pill, Spinner } from './ui';
import { truncateHex } from '../lib/format';

const NAV = [
  { to: '/offerings', label: 'Offerings' },
  { to: '/portfolio', label: 'Portfolio' },
  { to: '/issue', label: 'Issue' },
  { to: '/verify', label: 'Verify' },
];

/**
 * A permanent, unmissable statement that the market is not real. It sits above
 * the header rather than inside a dismissible toast so it cannot be missed.
 */
const SimulationBanner = () => (
  <div className="border-b border-gold-500/20 bg-gold-500/[0.07] px-4 py-1.5 text-center">
    <p className="text-[0.72rem] tracking-wide text-gold-200/90">
      Simulated market for demonstration only. Fictional companies, simulated shares, no real
      securities, no money, and nothing here is investment advice.
    </p>
  </div>
);

const WalletButton = () => {
  const { mode, wallet, connect, disconnect } = useApp();

  if (wallet.kind === 'connecting') {
    return (
      <Button variant="secondary" size="sm" disabled>
        <Spinner /> Connecting
      </Button>
    );
  }

  if (wallet.kind === 'connected') {
    return (
      <button
        type="button"
        onClick={disconnect}
        title="Disconnect wallet"
        className="group flex items-center gap-2 rounded-md border border-cream-500/20 px-3 py-1.5 transition-colors hover:border-danger-400/40"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-verify-400" />
        <span className="tnum text-[0.78rem] text-cream-300 group-hover:text-danger-400">
          {truncateHex(wallet.wallet.shieldedAddress, 8, 4)}
        </span>
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {mode === 'demo' ? <Pill tone="gold">Demo mode</Pill> : null}
      <Button variant="secondary" size="sm" onClick={() => void connect()}>
        Connect wallet
      </Button>
    </div>
  );
};

export const Header = () => {
  const location = useLocation();
  const onLanding = location.pathname === '/';

  return (
    <header
      className={cx(
        'sticky top-0 z-40 border-b backdrop-blur-xl transition-colors',
        onLanding ? 'border-transparent bg-ink-950/60' : 'border-cream-500/12 bg-ink-950/85',
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-6 px-5 sm:px-8">
        <Link to="/" className="shrink-0" aria-label="EquiVault home">
          <EquiVaultWordmark />
        </Link>

        <nav className="hidden flex-1 items-center gap-1 md:flex">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cx(
                  'rounded-md px-3 py-1.5 text-[0.85rem] transition-colors',
                  isActive ? 'text-gold-300' : 'text-cream-300 hover:text-cream-50',
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <WalletButton />
        </div>
      </div>

      {/* Mobile nav */}
      <nav className="flex gap-1 overflow-x-auto border-t border-cream-500/10 px-4 py-2 md:hidden">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cx(
                'shrink-0 rounded-md px-3 py-1 text-[0.8rem]',
                isActive ? 'text-gold-300' : 'text-cream-300',
              )
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </header>
  );
};

export const Footer = () => (
  <footer className="mt-24 border-t border-cream-500/12 py-10">
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-5 sm:px-8 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-col gap-1">
        <EquiVaultWordmark markSize={24} />
        <p className="text-[0.75rem] text-cream-600">
          This project is built on the Midnight Network.
        </p>
      </div>
      <p className="max-w-md text-[0.72rem] leading-relaxed text-cream-600">
        Educational demonstration of privacy-preserving allocation. Not a securities offering, not a
        brokerage, not financial advice.
      </p>
    </div>
  </footer>
);

export const Layout = ({ children }: { children: ReactNode }) => (
  <div className="flex min-h-dvh flex-col">
    <SimulationBanner />
    <Header />
    <main className="flex-1">{children}</main>
    <Footer />
  </div>
);
