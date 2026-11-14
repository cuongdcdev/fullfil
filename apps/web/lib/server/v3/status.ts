import { escrowBackend, type MockConfig } from "./escrow";
import { verifierCode as defaultVerifierCode, type VerifierCode } from "./verifier-code";
import { browserUserAgent, escrowContract, intentsContract, mode, oneClickUrl, outlayerUrl } from "./config";

export type PublicStatus = {
  mode: "mock" | "live";
  network: "mainnet" | "testnet";
  escrow_contract: string;
  intents_contract: string;
  paused: boolean | null;
  relayer: { account: string | null; configured: boolean };
  kinds: { kind: string; enabled: boolean; access: "open" | "approved" | "allowlist"; verifier: string | null; verifier_code: VerifierCode | null }[];
  verifier: { project: string | null; configured: boolean };
  services: { id: string; name: string; state: "reachable" | "unreachable" | "not_checked" }[];
  checked_at: string;
};

function projectId(source: string): string | null {
  try {
    const parsed = JSON.parse(source) as { Project?: { project_id?: string } };
    return parsed.Project?.project_id ?? null;
  } catch {
    return null;
  }
}

async function reachable(url: string): Promise<"reachable" | "unreachable"> {
  const cached = probeCache.get(url);
  if (cached && cached.expires > Date.now()) return cached.value;
  const value = await probeOnce(url);
  probeCache.set(url, { value, expires: Date.now() + 30_000 });
  return value;
}

const probeCache = new Map<string, { value: "reachable" | "unreachable"; expires: number }>();

async function probeOnce(url: string): Promise<"reachable" | "unreachable"> {
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { "User-Agent": browserUserAgent },
      signal: AbortSignal.timeout(3500),
      cache: "no-store",
    });
    // Any HTTP answer, even 401/404, proves the host is up.
    return res.status < 500 ? "reachable" : "unreachable";
  } catch {
    return "unreachable";
  }
}

export async function publicStatus(
  probe: typeof reachable = reachable,
  codeCheck: (project: string) => Promise<VerifierCode> = defaultVerifierCode,
): Promise<PublicStatus> {
  const live = mode() === "live";
  let config: MockConfig | null = null;
  try {
    config = await (escrowBackend() as unknown as { get_config(): Promise<MockConfig> }).get_config();
  } catch {
    config = null;
  }
  const escrow = escrowContract();
  const globalProject = config?.verifier_source ? projectId(config.verifier_source) : null;
  const baseKinds = Object.entries(config?.kinds ?? {}).map(([kind, c]) => ({
    kind,
    enabled: c.enabled,
    access: c.access === "open" ? ("open" as const) : c.access === "approved" ? ("approved" as const) : ("allowlist" as const),
    // Each kind names its own OutLayer worker on chain; fall back to the global one.
    verifier: c.enabled ? (projectId((c as { verifier_source?: string }).verifier_source ?? "") ?? globalProject) : null,
  }));
  // Live only: mock projects have no OutLayer code to check.
  const kinds = await Promise.all(baseKinds.map(async (k) => ({
    ...k,
    verifier_code: live && k.verifier ? await codeCheck(k.verifier).catch(() => null) : null,
  })));
  const [oneClick, outlayer] = live
    ? await Promise.all([probe(`${oneClickUrl().replace(/\/$/, "")}/v0/tokens`), probe(outlayerUrl())])
    : (["not_checked", "not_checked"] as const);
  return {
    mode: mode(),
    network: escrow.endsWith(".testnet") ? "testnet" : "mainnet",
    escrow_contract: escrow,
    intents_contract: config?.intents_contract ?? intentsContract(),
    paused: config ? config.paused : null,
    relayer: { account: config?.relayer ?? null, configured: Boolean(process.env.OUTLAYER_API_KEY) },
    kinds,
    verifier: (() => {
      const projects = [...new Set(kinds.map((k) => k.verifier).filter((v): v is string => Boolean(v)))];
      const project = projects.length ? projects.join(", ") : globalProject;
      return { project, configured: Boolean(project) };
    })(),
    services: [
      { id: "oneclick", name: "NEAR Intents 1Click (swap quotes)", state: oneClick },
      { id: "outlayer", name: "OutLayer (verifier and relayer)", state: outlayer },
    ],
    checked_at: new Date().toISOString(),
  };
}
