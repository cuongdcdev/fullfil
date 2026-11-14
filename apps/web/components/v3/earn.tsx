"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { vnd } from "@/lib/api";
import {
  claimedAtMs,
  earnedUnits,
  formatUsd,
  fulfillerPhase,
  orderTotal,
  friendlyError,
  ratingDone,
  type PublicUserProfile,
  v3,
  type V3Order,
} from "@/lib/v3-client";
import { sampleBankEml } from "@/lib/sample-eml";
import { authCall, signAndSubmit } from "@/lib/wallet/actions";
import { BottomSheet, Button, Card, EmptyState, Stepper, StatusPill } from "@/components/ui/kit";
import { Column, ErrorBox, Loading, Spinner } from "@/components/requester/common";
import { BigButton, CopyButton } from "@/components/earn/common";
import { ProofUpload } from "@/components/earn/proof-upload";
import { Onboarding, BankForm } from "@/components/earn/onboarding";
import { isRegisteredFulfiller, registeredBank, hasDeposit } from "@/lib/earn-gate";
import { activityDate, activityHref, activityKind, activityStatus, activityTitle, type ActivityKind } from "@/lib/activity";
import { WalletError } from "@/lib/wallet";
import { activeCount, buyerLabel, completedJobs, earnedThisWeek, filterCounts, filterJobs, isAgentJob, jobGroup, jobMoney, QR_CLAIM_MINUTES, type JobFilter, type JobGroup } from "@/lib/jobs-card";
import { Coins, ListChecks, MapPin, PiggyBank, QrCode, Smartphone, Store, Globe, type LucideIcon } from "lucide-react";
import { UsdcIcon } from "@/components/ui/usdc-icon";
import { VietQrMark } from "@/components/ui/vietqr-mark";
import { ContactCard } from "./contact-card";
import { PayQr } from "./pay-qr";

/** Same string packages/core parseVietQr stores when the QR has no merchant name (tag 59). */
const UNKNOWN_MERCHANT = "Unknown merchant";
import { useAuth } from "./auth";
import { HowItWorks, SignNote, Stars, WalletActionLabel, useAction, usePolling } from "./common";

const ACTIVE = ["claimed", "sent", "verifying", "proof_rejected", "verified", "under_review"];

function timeUntilDeadline(order: V3Order, now: number): string {
  const deadline = Number(BigInt(order.deadline_ns) / BigInt(1_000_000));
  const minutes = Math.max(0, Math.ceil((deadline - now) / 60_000));
  if (minutes === 0) return "The order deadline has passed.";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const hoursText = hours > 0 ? `${hours} ${hours === 1 ? "hour" : "hours"} ` : "";
  return `${hoursText}${rest} ${rest === 1 ? "minute" : "minutes"} left before the order deadline.`;
}

function PageHeader({ icon: Icon, title, subtitle, children }: { icon: LucideIcon; title: string; subtitle: string; children?: ReactNode }) {
  return (
    <header className="flex items-start gap-3.5">
      <span className="mt-1 grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[var(--lime-tint)] text-lime-deep"><Icon size={24} aria-hidden /></span>
      <div className="grid min-w-0 gap-1">
        <h1 className="h1-title">{title}</h1>
        <p className="text-[15px] leading-relaxed text-muted">{subtitle}</p>
        {children}
      </div>
    </header>
  );
}

function nextAction(order: V3Order): string {
  if (order.kind === "in_person") return order.status === "claimed" ? "Bring the item and scan the buyer's QR" : "Waiting for the check";
  if (order.status === "claimed") return "Pay the shop";
  if (["sent", "proof_rejected"].includes(order.status)) return "Show the bank email as proof";
  if (order.status === "under_review") return "We are checking. Nothing to do";
  return "Waiting for the check";
}

/** Where this job stands: next action and a live deadline countdown. */
function ActiveSummary({ order }: { order: V3Order }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const left = timeUntilDeadline(order, now).replace(" before the order deadline.", "").replace("The order deadline has passed.", "Deadline passed");
  return (
    <dl className="grid grid-cols-2 divide-x divide-line overflow-hidden rounded-2xl border border-line bg-panel text-sm">
      <div className="grid gap-0.5 p-3.5"><dt className="text-xs text-muted">Next action</dt><dd className="font-bold leading-snug">{nextAction(order)}</dd></div>
      <div className="grid gap-0.5 p-3.5"><dt className="text-xs text-muted">Time left</dt><dd className="font-bold tabular-nums leading-snug">{left}</dd></div>
    </dl>
  );
}

function InPersonActive({ order, account, reload }: { order: V3Order; account: string; reload: () => void }) {
  const [meetup, setMeetup] = useState<{ address: string; contact: string } | null>(null);
  const [meetupError, setMeetupError] = useState("");
  const [code, setCode] = useState("");
  const [camera, setCamera] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const videoRef = useRef<HTMLVideoElement>(null);
  const stopRef = useRef<() => void>(() => undefined);
  const { busy, error, run } = useAction();

  useEffect(() => {
    if (order.status !== "claimed" || order.fulfiller !== account) return;
    let active = true;
    v3.inPersonMeetup(order.id).then((value) => active && setMeetup(value))
      .catch(() => active && setMeetupError("Meeting details are unavailable. Try again."));
    return () => { active = false; };
  }, [order.id, order.status, order.fulfiller, account]);
  useEffect(() => () => stopRef.current(), []);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const stopCamera = () => {
    stopRef.current();
    stopRef.current = () => undefined;
    setCamera(false);
  };
  const startCamera = async () => {
    setCamera(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 0));
      const video = videoRef.current;
      if (!video) throw new Error("No camera view");
      const startZxing = async () => {
        const { BrowserQRCodeReader } = await import("@zxing/browser");
        let controls: { stop: () => void } | undefined;
        let finished = false;
        stopRef.current = () => {
          finished = true;
          controls?.stop();
        };
        controls = await new BrowserQRCodeReader().decodeFromVideoDevice(undefined, video, (result) => {
          if (result) {
            setCode(result.getText());
            stopCamera();
          }
        });
        if (finished) controls.stop();
      };
      type Detector = { detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
      const NativeDetector = (window as Window & { BarcodeDetector?: new (options: { formats: string[] }) => Detector }).BarcodeDetector;
      if (NativeDetector) {
        let stream: MediaStream | undefined;
        try {
          const detector = new NativeDetector({ formats: ["qr_code"] });
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
          let stopped = false;
          stopRef.current = () => {
            stopped = true;
            stream?.getTracks().forEach((track) => track.stop());
          };
          video.srcObject = stream;
          await video.play();
          let errors = 0;
          const scan = async () => {
            if (stopped) return;
            try {
              const results = await detector.detect(video);
              errors = 0;
              if (results[0]?.rawValue) {
                setCode(results[0].rawValue);
                stopCamera();
                return;
              }
            } catch {
              errors += 1;
              if (errors >= 3) {
                stopRef.current();
                try {
                  await startZxing();
                } catch {
                  stopCamera();
                  setMeetupError("Camera unavailable. Paste the code instead.");
                }
                return;
              }
            }
            if (!stopped) requestAnimationFrame(() => void scan());
          };
          void scan();
        } catch {
          stream?.getTracks().forEach((track) => track.stop());
          await startZxing();
        }
      } else {
        await startZxing();
      }
    } catch {
      stopCamera();
      setMeetupError("Camera unavailable. Paste the code instead.");
    }
  };
  const confirm = () => run(async () => {
    const payload = await v3.inPersonConfirm(order.id, code.trim());
    await signAndSubmit(payload);
    reload();
  });

  if (order.fulfiller !== account) return <ErrorBox message="This job belongs to someone else." />;
  if (["paid", "closed"].includes(order.status)) return (
    <Card className="grid gap-2 text-center">
      <p className="text-5xl text-good">✓</p>
      <h2 className="text-2xl font-black">You earned {formatUsd(orderTotal(order))}</h2>
      <p>The money is in your balance.</p>
    </Card>
  );
  if (order.status !== "claimed") return <Card>The job is no longer waiting for delivery.</Card>;
  return (
    <>
      <h2 className="text-2xl font-black">Bring the item to the buyer</h2>
      <p className="rounded-xl bg-[var(--warn)] p-3 font-bold text-[var(--warn-fg)] border border-[var(--warn-line)]">
        Hand over the item and scan the buyer&apos;s code before the order deadline.
        {` ${timeUntilDeadline(order, now)}`}
      </p>
      <Card className="grid gap-2">
        <p><strong>Item:</strong> {order.spec_summary?.brand}</p>
        <p><strong>Area:</strong> {order.spec_summary?.masked_beneficiary}</p>
        {meetup ? <>
          <p><strong>Meet at:</strong> {meetup.address}</p>
          <p><strong>Contact:</strong> {meetup.contact}</p>
        </> : <p>Loading meeting details…</p>}
      </Card>
      {meetupError && <ErrorBox message={meetupError} />}
      <p>Check the goods together. Scan the buyer&apos;s QR when you hand over the item. You get paid automatically after the check.</p>
      {camera ? (
        <div className="grid gap-2">
          <video ref={videoRef} className="aspect-square w-full rounded-2xl bg-black object-cover" muted playsInline />
          <button className="min-h-11 text-sm font-bold underline" onClick={stopCamera}>Stop camera</button>
        </div>
      ) : <button className="min-h-12 rounded-lg border border-line font-bold" onClick={() => void startCamera()}>Scan buyer&apos;s QR</button>}
      <label className="grid gap-1 font-bold">Or paste the code
        <input className="min-h-12 rounded-lg border border-line bg-panel px-3 font-mono text-sm" value={code} onChange={(event) => setCode(event.target.value)} autoComplete="off" />
      </label>
      {order.last_reject_reason && <p className="text-sm text-danger">That code did not work. Ask the buyer to check it.</p>}
      <BigButton disabled={busy || !/^[a-f0-9]{64}$/.test(code.trim())} onClick={confirm}>
        {busy ? <WalletActionLabel /> : "Confirm delivery"}
      </BigButton>
      {error && <ErrorBox message={error} />}
      <SignNote />
    </>
  );
}

/** Wait for the profile; show onboarding if there is none. */
function useProfileGate() {
  const { me, refreshMe } = useAuth();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    void refreshMe().finally(() => setReady(true));
  }, [refreshMe]);
  return { ready, me };
}

/* ---------------------------------------------------------------- jobs */

const BUYER_CACHE = new Map<string, Promise<PublicUserProfile | null>>();
/** Public buyer info (no contacts), fetched once per account and shared between cards. */
function useBuyerProfile(account: string): PublicUserProfile | null | undefined {
  const [profile, setProfile] = useState<PublicUserProfile | null | undefined>();
  useEffect(() => {
    let alive = true;
    let pending = BUYER_CACHE.get(account);
    if (!pending) {
      pending = v3.userProfile(account).catch(() => null);
      BUYER_CACHE.set(account, pending);
    }
    void pending.then((value) => alive && setProfile(value));
    return () => { alive = false; };
  }, [account]);
  return profile;
}

const FILTERS: { id: JobFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "nearby", label: "Deliver nearby" },
  { id: "qr", label: "QR payments · Beta" },
  { id: "online", label: "Online" },
];

const GROUP_LABEL: Record<JobGroup, string> = { nearby: "Deliver nearby", qr: "QR payment · Beta", online: "Online order" };
const GROUP_ICON: Record<ActivityKind, LucideIcon> = { nearby: Store, online: Smartphone, memecoin: Coins, local_qr: QrCode };

type Feedback = { tone: "neutral" | "error"; text: string } | null;

function Chip({ children, strong }: { children: ReactNode; strong?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-bold ${strong ? "border-brand bg-brand text-brand-fg" : "border-line bg-soft text-ink"}`}>
      {children}
    </span>
  );
}

function Steps({ steps }: { steps: string[] }) {
  return (
    <p className="text-xs text-muted">
      {steps.map((step, index) => (
        <span key={step}>{index > 0 && <span aria-hidden> → </span>}{step}</span>
      ))}
    </p>
  );
}

function QrLockBox({ qrLock }: { qrLock: "no-bank" | "pending" }) {
  return (
    <div className="grid gap-2 rounded-xl border border-line bg-soft p-3 text-sm">
      <p className="font-bold">
        {qrLock === "no-bank"
          ? "Local QR jobs (Beta) need a VPBank account on your profile."
          : "Waiting for operator approval (Local QR · Beta)."}
      </p>
      <p className="text-muted">
        {qrLock === "no-bank"
          ? "Add your bank, then the operator (the team running Fulfil) approves you once."
          : "The operator (the team running Fulfil) checks your bank details once. No action needed from you."}
      </p>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {qrLock === "no-bank" && <Link href="/earn/earnings#add-bank" className="min-h-11 font-bold underline">Add bank ›</Link>}
        <Link href="/docs#qr-fulfiller" className="min-h-11 font-bold underline">How to get approved ›</Link>
      </div>
    </div>
  );
}

function JobCard({ order, now, qrLock, busy, onAccept, feedback }: {
  order: V3Order;
  now: number;
  qrLock: "no-bank" | "pending" | null;
  busy: boolean;
  onAccept: () => void;
  feedback: Feedback;
}) {
  const group = jobGroup(order);
  const Icon = GROUP_ICON[activityKind(order)];
  const money = jobMoney(order);
  const agent = isAgentJob(order);
  const buyer = useBuyerProfile(order.buyer);
  return (
    <Card className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 text-sm font-bold">
          <Icon size={18} aria-hidden /> {GROUP_LABEL[group]}
        </span>
        {group === "qr" && <Chip>⏱ {QR_CLAIM_MINUTES} min to pay after you accept</Chip>}
        {group === "nearby" && <Chip>⏱ {timeUntilDeadline(order, now).replace(" before the order deadline.", "")}</Chip>}
      </div>

      {group === "nearby" && (
        <div>
          <p className="text-lg font-black">{order.spec_summary?.brand || "Deliver an item"}</p>
          <p className="text-sm text-muted">Area: {order.spec_summary?.masked_beneficiary || "near the buyer"}</p>
        </div>
      )}
      {group === "online" && <p className="text-lg font-black">{activityTitle(order)}</p>}

      <div>
        <p className="text-sm text-muted">{agent ? "Reward paid to the agent" : "You earn"}</p>
        <p className="text-4xl font-black tracking-tight text-good dark:text-brand">{money.reward}</p>
      </div>

      {group === "qr" && (
        <div className="grid gap-1 text-sm">
          <p>
            <strong>You pay {money.payVnd ?? "the shop"}</strong>
            {money.payTo ? <> → {money.payTo}</> : null} <span className="text-muted">(from your own bank)</span>
          </p>
          <p className="text-muted">
            Paid back <strong className="text-ink">{money.payFirst}</strong> + reward = <strong className="text-ink">{money.paidBack} USDC</strong>
          </p>
        </div>
      )}
      {group === "nearby" && (
        <div className="grid gap-1 text-sm">
          <p><strong>You pay first: {money.payFirst}</strong> <span className="text-muted">(for the item)</span></p>
          <p className="text-muted">You get back <strong className="text-ink">{money.paidBack} USDC</strong> with the reward.</p>
        </div>
      )}

      {group === "qr" && <Steps steps={["Pay shop", "Upload bank email", "Get paid"]} />}
      {group === "nearby" && <Steps steps={["Buy item", "Hand over & scan buyer's QR", "Get paid"]} />}

      {!agent && <p className="text-xs text-muted">Buyer: {buyerLabel(order.buyer, buyer)}</p>}

      {agent ? (
        <p className="rounded-xl bg-soft px-3 py-2.5 text-sm leading-relaxed">
          <strong>Done by agents (bots).</strong>{" "}
          <span className="text-muted">Filled automatically, nothing for you to do.</span>{" "}
          <Link href="/docs#agents" className="whitespace-nowrap font-bold underline underline-offset-2">How agents work ›</Link>
        </p>
      ) : group === "qr" && qrLock ? (
        <QrLockBox qrLock={qrLock} />
      ) : (
        <div className="grid gap-2">
          <BigButton disabled={busy} onClick={onAccept}>
            {busy ? <WalletActionLabel /> : "Accept"}
          </BigButton>
          {feedback && (
            <p role="status" className={`rounded-lg p-3 text-sm ${feedback.tone === "error" ? "border border-danger text-danger" : "bg-soft text-muted"}`}>
              {feedback.text}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

function ConfirmSheet({ order, busy, onClose, onConfirm }: {
  order: V3Order | undefined;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const money = order ? jobMoney(order) : undefined;
  const nearby = !!order && jobGroup(order) === "nearby";
  return (
    <BottomSheet open={!!order} onClose={onClose} title={nearby ? "Before you accept: pay for the item" : "Before you accept: pay from your bank"}>
      {order && money && (
        <div className="grid gap-4 text-sm">
          {nearby ? (
            <p>
              You pay for the item first ({money.payFirst}). Hand it over and scan the buyer&apos;s code before the order deadline.
              No code means no pay.
            </p>
          ) : (
            <p>
              You pay {money.payVnd ?? "the shop"} from your own bank first. You have {QR_CLAIM_MINUTES} min after accepting.
              You get {money.paidBack} back after the bank email is checked (OutLayer verifier, an independent checker).
            </p>
          )}
          <Button full className="min-h-14 !text-lg" disabled={busy} onClick={onConfirm}>
            {busy ? <WalletActionLabel /> : "Accept and sign"}
          </Button>
          <Button full variant="ghost" onClick={onClose} disabled={busy}>Not now</Button>
          <SignNote />
        </div>
      )}
    </BottomSheet>
  );
}

function Sidebar({ contactsSet }: { contactsSet: boolean | undefined }) {
  return (
    <aside className="grid content-start gap-4">
      <Card className="grid gap-3">
        <h2 className="text-lg font-black">How earning works</h2>
        <ul className="grid gap-2 text-sm">
          <li><strong>1. You do the task.</strong> Pay a shop or deliver an item.</li>
          <li><strong>2. A checker confirms.</strong> An independent checker (OutLayer verifier) or the buyer&apos;s QR proves it.</li>
          <li><strong>3. Escrow pays you.</strong> Escrow (a safe that holds the money) releases USDC to you.</li>
        </ul>
        <div className="flex flex-wrap gap-x-4 text-sm">
          <Link href="/docs#qr-fulfiller" className="min-h-11 font-bold underline">QR fulfiller guide ›</Link>
          <Link href="/docs#agents" className="min-h-11 font-bold underline">Agents ›</Link>
        </div>
      </Card>
      {contactsSet === false && (
        <Card className="grid gap-2 border-2 border-brand">
          <h2 className="font-black">Finish your profile</h2>
          <p className="text-sm text-muted">Add a contact (Telegram, X or email) so the buyer can reach you after you accept. It stays hidden until then.</p>
          <Link href="/account#profile" className="min-h-11 font-bold underline">Add contacts ›</Link>
        </Card>
      )}
    </aside>
  );
}

export function JobsScreenV3() {
  const { ready, me } = useProfileGate();
  const { session, refreshMe } = useAuth();
  const router = useRouter();
  const account = session?.account_id ?? "";
  const { data, error, reload } = usePolling(
    async () => {
      const [open, mine] = await Promise.all([v3.orders({ status: "funded" }), v3.orders({ account, limit: 100 })]);
      return { open: open.orders, mine: mine.orders };
    },
    10_000,
  );
  const [busyId, setBusyId] = useState("");
  const [confirmId, setConfirmId] = useState("");
  const [feedback, setFeedback] = useState<Record<string, Feedback>>({});
  const [filter, setFilter] = useState<JobFilter>("all");
  const [contactsSet, setContactsSet] = useState<boolean | undefined>();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!ready) return;
    let alive = true;
    v3.myProfile()
      .then((p) => alive && setContactsSet(Object.values(p.contacts ?? {}).some((value) => !!value)))
      .catch(() => undefined);
    return () => { alive = false; };
  }, [ready]);

  if (!ready) return <Column><Loading /></Column>;
  if (!isRegisteredFulfiller(me)) return <Onboarding />;
  // bank_transfer jobs need a bank on the profile and operator approval (contract: kind access "approved").
  const qrLock: "no-bank" | "pending" | null =
    !registeredBank(me) ? "no-bank" : !(me?.profile?.approved ?? me?.approved) ? "pending" : null;

  const jobs = (data?.open ?? []).filter((o) => o.buyer !== account);
  const counts = filterCounts(jobs);
  const shown = filterJobs(jobs, filter);
  const current = (data?.mine ?? []).find((o) => o.fulfiller === account && ACTIVE.includes(o.status));
  const earned = data ? formatUsd(earnedUnits(data.mine, account)) : "…";
  const active = data ? activeCount(data.mine, account, ACTIVE) : 0;
  const confirmOrder = jobs.find((o) => o.id === confirmId);

  const claim = async (o: V3Order) => {
    setBusyId(o.id);
    setFeedback((f) => ({ ...f, [o.id]: null }));
    try {
      await authCall({ op: "claim", order_id: o.id });
      setConfirmId("");
      void refreshMe();
      router.push(`/earn/active?job=${o.id}`);
    } catch (e) {
      setConfirmId("");
      const cancelled = e instanceof WalletError && e.userCancelled;
      setFeedback((f) => ({
        ...f,
        [o.id]: cancelled
          ? { tone: "neutral", text: e instanceof WalletError && !/^You cancelled/.test(e.message) ? e.message : "You cancelled in your wallet. Nothing happened." }
          : { tone: "error", text: friendlyError(e) },
      }));
      setBusyId("");
    }
  };

  return (
    <div className="page">
      <div className="mx-auto grid max-w-[1040px] gap-5">
        <div className="grid gap-2">
          <h1 className="h1-title">Jobs</h1>
          <div className="flex flex-wrap items-center gap-2">
            <Chip strong>Earned {earned}</Chip>
            <Chip>{active} in progress</Chip>
            <Link href="/account#profile" className="min-h-11 content-center px-1 text-sm font-bold underline">Edit your profile and contacts ›</Link>
          </div>
        </div>
        {current && (
          <Link href={`/earn/active?job=${current.id}`} className="block">
            <Card className="flex items-center justify-between gap-3 border-2 border-brand">
              <span className="font-bold">You have a job in progress</span>
              <span className="font-black">Open ›</span>
            </Card>
          </Link>
        )}
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="grid gap-4">
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter jobs">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  role="tab"
                  aria-selected={filter === f.id}
                  onClick={() => setFilter(f.id)}
                  className={`min-h-11 rounded-full border px-4 text-sm font-bold ${filter === f.id ? "border-brand bg-brand text-brand-fg" : "border-line bg-panel text-ink"}`}
                >
                  {f.label} ({counts[f.id]})
                </button>
              ))}
            </div>
            {error && !data ? (
              <ErrorBox message={error} onRetry={reload} />
            ) : !data ? (
              <Loading text="Looking for jobs…" />
            ) : shown.length === 0 ? (
              <EmptyState
                title="No jobs right now"
                hint="New jobs show up here~"
                action={<div className="flex flex-wrap justify-center gap-x-4"><Link href="/docs#qr-fulfiller" className="min-h-11 font-bold underline">QR fulfiller guide ›</Link><Link href="/docs#agents" className="min-h-11 font-bold underline">Agents ›</Link></div>}
              />
            ) : (
              <ul className="grid gap-4 md:grid-cols-2">
                {shown.map((o) => (
                  <li key={o.id} className="grid">
                    <JobCard
                      order={o}
                      now={now}
                      qrLock={qrLock}
                      busy={busyId === o.id}
                      feedback={feedback[o.id] ?? null}
                      onAccept={() => {
                        setFeedback((f) => ({ ...f, [o.id]: null }));
                        setConfirmId(o.id);
                      }}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Sidebar contactsSet={contactsSet} />
        </div>
      </div>
      <ConfirmSheet
        order={confirmOrder}
        busy={!!confirmOrder && busyId === confirmOrder.id}
        onClose={() => setConfirmId("")}
        onConfirm={() => confirmOrder && void claim(confirmOrder)}
      />
    </div>
  );
}

/* -------------------------------------------------------------- active */

function ActiveInner() {
  const { ready, me } = useProfileGate();
  const { session, demoAvailable, refreshMe } = useAuth();
  const params = useSearchParams();
  const account = session?.account_id ?? "";
  const wanted = params.get("job");
  const { data, error, reload } = usePolling(
    async () => {
      if (wanted) return v3.order(wanted);
      const mine = await v3.orders({ account });
      const o = mine.orders.find((x) => x.fulfiller === account && ACTIVE.includes(x.status));
      return o ? v3.order(o.id) : null;
    },
    10_000,
    (d) => !!d && fulfillerPhase(d.order.status).done,
  );
  const { busy, error: actionError, run } = useAction();
  const [stars, setStars] = useState(0);

  if (!ready) return <Column><Loading /></Column>;
  if (!isRegisteredFulfiller(me)) return <Onboarding />;
  if (error && data === undefined) return <Column><ErrorBox message={error} onRetry={reload} /></Column>;
  if (data === undefined) return <Column><Loading /></Column>;
  if (data === null)
    return (
      <Column>
        <PageHeader icon={ListChecks} title="Active jobs" subtitle="Jobs you are working on right now." />
        <EmptyState icon={ListChecks} title="No active jobs" hint="Jobs you accept show up here until they're paid."
          action={<Button href="/earn">Find a job →</Button>} />
      </Column>
    );

  const { order, merchant } = data;
  // A successful claim can precede the next RPC snapshot. An unassigned order
  // is still syncing here; it is not evidence that somebody else owns the job.
  if (order.status === "funded" && !order.fulfiller) {
    return (
      <Column>
        <PageHeader icon={ListChecks} title="Active job" subtitle="Checking the latest job assignment." />
        <Loading text="Checking job assignment…" />
        <p className="text-sm text-muted" role="status">
          This job is not assigned yet. We are checking for updates automatically.
        </p>
        <Button variant="secondary" onClick={reload}>Refresh status</Button>
        <Button variant="ghost" href="/earn">Back to jobs</Button>
      </Column>
    );
  }
  if (order.kind === "in_person") {
    return <Column>
      <PageHeader icon={ListChecks} title="Active job" subtitle="Deliver it, then scan the buyer's QR to get paid." />
      <ActiveSummary order={order} />
      <ContactCard order={order} />
      <InPersonActive order={order} account={account} reload={reload} />
    </Column>;
  }
  const act = (fn: () => Promise<unknown>) =>
    run(async () => {
      await fn();
      reload();
      void refreshMe();
    });

  const sendProof = (file: Blob) =>
    act(async () => {
      const up = await v3.uploadProof(order.id, await file.arrayBuffer());
      await signAndSubmit(up.payload);
    });

  const STEPS = ["Pay the shop", "I sent it", "Show proof", "Get paid"];
  const stepIndex = order.status === "claimed" ? 0 : ["sent", "verifying", "proof_rejected", "verified"].includes(order.status) ? 2 :
    ["paid", "closed"].includes(order.status) || (order.status === "resolved" && order.verdict !== "buyer") ? STEPS.length : 3;

  let body;
  if (order.fulfiller && order.fulfiller !== account) {
    body = <ErrorBox message="This job belongs to someone else." />;
  } else if (order.status === "claimed") {
    body = (
      <>
        <div>
          <p className="text-sm font-bold text-muted">Step 1 of 3</p>
          <h2 className="text-2xl font-black">Pay the shop</h2>
          <p className="text-muted">{merchant?.pay_qr ? "Scan this with your bank app to pay." : "Open your bank app and send this transfer."}</p>
        </div>
        {merchant?.pay_qr && (
          <Card className="grid gap-2">
            <PayQr payload={merchant.pay_qr} orderId={order.id} amountLabel={vnd(order.amount_vnd)} />
          </Card>
        )}
        <details open={!merchant?.pay_qr} className="rounded-xl border border-line">
          <summary className="min-h-12 cursor-pointer p-3 font-bold">
            {merchant?.pay_qr ? "Pay manually instead" : "Transfer details"}
          </summary>
          <div className="grid gap-3 p-3 pt-0">
            <Card className="grid gap-3">
              <Row k="Shop" v={!merchant?.name || merchant.name === UNKNOWN_MERCHANT ? "Shop (name not in QR)" : merchant.name} />
              <Row k="Bank" v={merchant?.bank ?? ""} />
              {merchant && <Row k="Account number" v={merchant.account} copy={merchant.account} big />}
              <Row k="Amount" v={vnd(order.amount_vnd)} copy={String(order.amount_vnd)} big />
            </Card>
            <Card className="grid gap-2 border-2 border-brand text-center">
              <p className="text-sm font-bold text-muted">Transfer note</p>
              <p className="break-all text-4xl font-black tracking-wider">{order.id}</p>
              <p className="font-bold">Put this in the transfer message</p>
              <div className="flex justify-center">
                <CopyButton text={order.id} label="Copy note" />
              </div>
            </Card>
          </div>
        </details>
        <p className="rounded-xl bg-[var(--warn)] p-3 font-bold text-[var(--warn-fg)] border border-[var(--warn-line)]">
          Pay only once.
        </p>
        <BigButton disabled={busy} onClick={() => act(() => authCall({ op: "sent", order_id: order.id }))}>
          {busy ? <WalletActionLabel /> : "I sent the money"}
        </BigButton>
        <SignNote />
      </>
    );
  } else if (order.status === "sent" || order.status === "proof_rejected") {
    body = (
      <>
        <div>
          <p className="text-sm font-bold text-muted">Step 2 of 3</p>
          <h2 className="text-2xl font-black">Show us the proof</h2>
          <p className="text-muted">Send us the email your bank sent you about this transfer.</p>
        </div>
        <ProofUpload
          order={{
            code: order.id,
            amountVnd: order.amount_vnd,
            accountLast4: merchant?.account.slice(-4),
            claimedAt: claimedAtMs(order),
          }}
          busy={busy}
          onSend={(f) => void sendProof(f)}
          onSample={
            demoAvailable
              ? () =>
                  void sendProof(
                    new Blob(
                      [
                        sampleBankEml({
                          code: order.id,
                          amountVnd: order.amount_vnd,
                          accountLast4: merchant?.account.slice(-4) ?? "0000",
                        }),
                      ],
                      { type: "message/rfc822" },
                    ),
                  )
              : undefined
          }
        />
        {busy && <SignNote />}
      </>
    );
  } else if (order.status === "verifying" || order.status === "verified" || order.status === "under_review") {
    body = (
      <Card className="grid justify-items-center gap-3 py-8 text-center">
        <Spinner />
        <p className="text-2xl font-black">Checking your proof…</p>
      </Card>
    );
  } else if (["paid", "closed"].includes(order.status)) {
    body = (
      <Card className="grid gap-3 text-center">
        <p className="text-6xl text-good" aria-hidden>
          ✓
        </p>
        <p className="text-2xl font-black">You earned {formatUsd(orderTotal(order))}</p>
        <p className="text-muted">The money is in your balance.</p>
        {ratingDone(order, account) ? (
          <div className="grid justify-items-center">
            <p className="text-sm text-muted">Your rating</p>
            <Stars value={order.fulfiller_rating ?? 0} />
          </div>
        ) : (
          <div className="grid justify-items-center gap-2">
            <p className="text-sm text-muted">How was the customer? Tap a star.</p>
            <Stars
              value={stars}
              disabled={busy}
              onChange={(n) => {
                setStars(n);
                void act(() => authCall({ op: "rate", order_id: order.id, stars: n }));
              }}
            />
            {busy && <SignNote />}
          </div>
        )}
        <Button full href="/earn">
          Back to jobs
        </Button>
      </Card>
    );
  } else {
    body = (
      <Card className="grid gap-2 py-6 text-center">
        <p className="text-2xl font-black">{fulfillerPhase(order.status).title}</p>
        <Button href="/earn">Back to jobs</Button>
      </Card>
    );
  }

  return (
    <Column>
      <PageHeader icon={ListChecks} title="Active job" subtitle="Follow the steps below until you are paid." />
      <ActiveSummary order={order} />
      <ContactCard order={order} />
      {body}
      {actionError && <ErrorBox message={actionError} />}
      <Card>
        <Stepper steps={STEPS} current={stepIndex} />
      </Card>
    </Column>
  );
}

export function ActiveScreenV3() {
  return (
    <Suspense fallback={<Column><Loading /></Column>}>
      <ActiveInner />
    </Suspense>
  );
}

function Row({ k, v, copy, big }: { k: string; v: string; copy?: string; big?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm text-muted">{k}</p>
        <p className={`break-all font-black ${big ? "text-2xl" : "text-lg"}`}>{v}</p>
      </div>
      {copy && <CopyButton text={copy} />}
    </div>
  );
}

/* ------------------------------------------------------------ earnings */

const KIND_ICONS: Record<ActivityKind, LucideIcon> = { nearby: MapPin, online: Globe, memecoin: Coins, local_qr: QrCode };

export function EarningsScreenV3() {
  const { ready, me } = useProfileGate();
  const { session } = useAuth();
  const account = session?.account_id ?? "";
  const [addBank, setAddBank] = useState(false);
  const [now] = useState(() => Date.now());
  // Deep link: /earn/earnings#add-bank opens the bank form.
  useEffect(() => { if (window.location.hash === "#add-bank") setAddBank(true); }, []);
  const { data, error, reload } = usePolling(() => v3.orders({ account, limit: 100 }), 10_000);

  if (!ready) return <Column><Loading /></Column>;
  if (!isRegisteredFulfiller(me) || !me?.profile) return <Onboarding />;
  const orders: V3Order[] = data?.orders ?? [];
  const mine = completedJobs(orders, account);
  const week = earnedThisWeek(orders, account, now);
  const total = earnedUnits(orders, account);
  const profile = me.profile;
  const bank = registeredBank(me);
  const jobsDone = profile.stats?.jobs_done ?? 0;
  const rating = profile.rating;
  return (
    <Column>
      <PageHeader icon={PiggyBank} title="Earnings" subtitle="Money you have earned from finished jobs." />
      <dl className="grid grid-cols-2 overflow-hidden rounded-2xl border border-line bg-panel sm:grid-cols-4 sm:divide-x sm:divide-line [&>div]:p-3.5 max-sm:[&>div:nth-child(n+3)]:border-t max-sm:[&>div:nth-child(n+3)]:border-line max-sm:[&>div:nth-child(odd)]:border-r max-sm:[&>div:nth-child(odd)]:border-line">
        <div className="grid gap-0.5"><dd className="flex items-center gap-1.5 text-xl font-extrabold tabular-nums"><UsdcIcon size={18} />{formatUsd(total)}</dd><dt className="text-xs text-muted">Total earned</dt></div>
        <div className="grid gap-0.5"><dd className="text-xl font-extrabold tabular-nums">{jobsDone}</dd><dt className="text-xs text-muted">{jobsDone === 1 ? "Job done" : "Jobs done"}</dt></div>
        <div className="grid gap-0.5"><dd className="text-xl font-extrabold tabular-nums">{rating?.avg != null ? `★ ${rating.avg.toFixed(1)}` : "No ratings"}</dd><dt className="text-xs text-muted">Average rating</dt></div>
        <div className="grid gap-0.5"><dd className="text-xl font-extrabold tabular-nums">{formatUsd(week)}</dd><dt className="text-xs text-muted">This week</dt></div>
      </dl>
      {(bank || hasDeposit(profile.bond)) && (
        <Card className="grid gap-2 text-sm">
          {bank && (
            <div className="flex justify-between gap-3">
              <span className="text-muted">Your bank</span>
              <b className="text-right">{bank.name} •••• {bank.last4}<span className="block text-xs font-normal text-muted">{profile.approved ? "Approved for Local QR · Beta" : "Waiting for approval"}</span></b>
            </div>
          )}
          {hasDeposit(profile.bond) && (
            <>
              <p className="font-bold">Security deposit (bond)</p>
              <p className="text-muted">(Money you lock while on a job. You get it back when the job ends well.)</p>
              <div className="flex justify-between"><span className="text-muted">Available</span><b>{formatUsd(profile.bond.available)}</b></div>
              <div className="flex justify-between"><span className="text-muted">In use</span><b>{formatUsd(profile.bond.locked)}</b></div>
            </>
          )}
        </Card>
      )}
      <Button full href="/wallet">
        Withdraw money
      </Button>
      {addBank ? (
        <Card className="grid gap-3">
          <h2 className="text-lg font-black">{bank ? "Change bank (Local QR · Beta)" : "Add bank (for Local QR · Beta)"}</h2>
          <BankForm cta="Save bank" warnApproval={!!bank} onDone={() => setAddBank(false)} />
          <button type="button" className="min-h-11 text-sm text-muted underline" onClick={() => setAddBank(false)}>Cancel</button>
        </Card>
      ) : (
        <button type="button" className="min-h-12 rounded-lg border border-line font-bold" onClick={() => setAddBank(true)}>
          {bank ? "Change bank (Local QR · Beta)" : "Add bank (for Local QR · Beta)"}
        </button>
      )}
      <h2 className="text-lg font-extrabold tracking-tight">Completed jobs</h2>
      {error && !data ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : !data ? (
        <Loading />
      ) : mine.length === 0 ? (
        <EmptyState icon={PiggyBank} title="No earnings yet" hint="Finish your first job to get paid." action={<Button href="/earn">Find a job →</Button>} />
      ) : (
        <ul className="grid gap-2">
          {mine.map((o) => {
            const kind = activityKind(o);
            const Icon = KIND_ICONS[kind];
            const date = activityDate(o, now);
            const status = activityStatus(o, "earning");
            return (
              <li key={o.id}>
                <Link href={activityHref(o, "earning")} className="block rounded-2xl focus-visible:outline-2 focus-visible:outline-brand">
                  <Card className="flex items-center gap-3">
                    {kind === "local_qr" ? <VietQrMark width={64} /> : <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--lime-tint)] text-lime-deep"><Icon size={22} aria-hidden="true" /></span>}
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 break-words font-bold leading-snug">{activityTitle(o)}</span>
                      {date && <span className="block text-sm text-muted" title={date.absolute}>{date.relative}</span>}
                      {kind === "local_qr" && o.amount_vnd > 0 &&
                        <span className="block text-sm text-muted">{new Intl.NumberFormat("vi-VN").format(o.amount_vnd)} ₫</span>}
                    </span>
                    <span className="flex max-w-[45%] min-w-0 flex-col items-end gap-1 text-right">
                      <strong className="inline-flex items-center gap-1 tabular-nums text-good">+{formatUsd(o.reward)} <span className="text-xs font-semibold text-muted">reward</span></strong>
                      <span className="text-xs tabular-nums text-muted">{formatUsd(orderTotal(o))} order</span>
                      <StatusPill tone={status.tone}>{status.label}</StatusPill>
                    </span>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Column>
  );
}
