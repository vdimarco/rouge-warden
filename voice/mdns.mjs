// Advertises the relay on the local network as _wristagent._tcp so the phone can offer Connect.
// DNS-SD over mDNS, as in RFC 6763. The phone uses Android Network Service Discovery.
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const mdns = require("multicast-dns");

export const SERVICE = "_wristagent._tcp.local";

export function serviceRecords({ ip, port, url, token, instance = "WristRelay", host = "wrist-relay.local" }) {
  const name = `${instance}.${SERVICE}`;
  return [
    { name: SERVICE, type: "PTR", ttl: 120, data: name },
    { name, type: "SRV", ttl: 120, data: { priority: 0, weight: 0, port, target: host } },
    { name, type: "TXT", ttl: 120, data: [`u=${url}`, `k=${token}`] },
    { name: host, type: "A", ttl: 120, data: ip },
  ];
}

export function advertise({ ip, port, url, token }) {
  const answers = serviceRecords({ ip, port, url, token });
  const server = mdns({ reuseAddr: true, loopback: true });
  const interesting = (name) => {
    const lowered = String(name || "").toLowerCase();
    return lowered === SERVICE || lowered.endsWith("." + SERVICE) || lowered === "_services._dns-sd._udp.local";
  };
  const send = () => server.respond({ answers });
  server.on("query", (query) => {
    const questions = query.questions || [];
    if (!questions.some((question) => interesting(question.name))) return;
    send();
  });
  send();
  const timer = setInterval(send, 15000);
  timer.unref?.();
  return {
    stop() {
      clearInterval(timer);
      server.destroy();
    },
  };
}
