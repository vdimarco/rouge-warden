import { HOSTS, type HostId } from '../engine';

/** The host rule, under the top bar of a host table. */
export function HostBanner({ host }: { host: HostId }) {
  const { name, rule } = HOSTS[host];
  return (
    <p className="host-banner" data-testid="host-banner" data-host={host}>
      <b>{name}</b> {rule}
    </p>
  );
}
