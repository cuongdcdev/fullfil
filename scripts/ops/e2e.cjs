// Mainnet E2E driver (PM only). Acts as a NEAR wallet for test accounts whose keys are in
// ~/.near-credentials/mainnet/<account>.json (never printed). Talks to the v3 HTTP API.
// Run from a dir with near-api-js@5 installed:  node e2e.cjs <cmd> [...]
//   login <account>
//   prepare <buyer> <qrFile> <amountVnd> <rewardUsdc>   -> creates + funds an order
//   register <fulfiller> <bankName> <last4>
//   op <account> <op> '<json fields>'                    -> any auth_call op (claim, sent, cancel, rate...)
//   proof <fulfiller> <orderId> <emlPath>                -> uploads .eml and signs submit_proof
//   order <account> <orderId> | me <account>
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { KeyPair, utils } = require('near-api-js');

const BASE = process.env.FULFIL_URL || 'http://127.0.0.1:3104';
const SESS = path.join(os.tmpdir(), 'fulfil-e2e-sessions.json');
const sessions = fs.existsSync(SESS) ? JSON.parse(fs.readFileSync(SESS, 'utf8')) : {};
const saveSessions = () => fs.writeFileSync(SESS, JSON.stringify(sessions), { mode: 0o600 });

function keyFor(account) {
  const f = path.join(os.homedir(), '.near-credentials', 'mainnet', `${account}.json`);
  return KeyPair.fromString(JSON.parse(fs.readFileSync(f, 'utf8')).private_key);
}
const u32 = (n) => { const b = Buffer.alloc(4); b.writeUInt32LE(n); return b; };
const bstr = (s) => { const b = Buffer.from(s, 'utf8'); return Buffer.concat([u32(b.length), b]); };
function nep413Sign(account, { message, nonce, recipient }) {
  const data = Buffer.concat([u32(2 ** 31 + 413), bstr(message), Buffer.from(nonce, 'base64'), bstr(recipient), Buffer.from([0])]);
  const digest = crypto.createHash('sha256').update(data).digest();
  const kp = keyFor(account);
  const { signature } = kp.sign(digest);
  return { public_key: kp.getPublicKey().toString(), signature: 'ed25519:' + utils.serialize.base_encode(signature) };
}

async function api(account, method, p, body, raw) {
  const headers = {};
  if (account && sessions[account]) headers.cookie = sessions[account];
  let payload;
  if (raw) { headers['content-type'] = 'message/rfc822'; payload = raw; }
  else if (body !== undefined) { headers['content-type'] = 'application/json'; payload = JSON.stringify(body); }
  const r = await fetch(BASE + p, { method, headers, body: payload });
  const set = r.headers.get('set-cookie');
  if (set && account) { sessions[account] = set.split(';')[0]; saveSessions(); }
  const text = await r.text();
  let json; try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 500) }; }
  if (!r.ok) throw new Error(`${method} ${p} -> ${r.status} ${JSON.stringify(json).slice(0, 800)}`);
  return json;
}

async function login(account) {
  const ch = await api(null, 'POST', '/api/v3/auth/challenge', {});
  const sig = nep413Sign(account, { message: ch.message, nonce: ch.nonce, recipient: ch.recipient });
  const r = await api(account, 'POST', '/api/v3/auth/verify', {
    standard: 'nep413', account_id: account, ...sig, message: ch.message, nonce: ch.nonce, recipient: ch.recipient,
  });
  return r;
}
async function signAndSubmit(account, built) {
  const p = built.payload_to_sign;
  const sig = nep413Sign(account, p);
  return api(account, 'POST', '/api/v3/intents/submit', { standard: 'nep413', payload: p, ...sig });
}
async function authCall(account, op, fields) {
  const built = await api(account, 'POST', '/api/v3/intents/build', { kind: 'auth_call', op, ...fields });
  return signAndSubmit(account, built);
}

(async () => {
  const [cmd, ...a] = process.argv.slice(2);
  const show = (x) => console.log(JSON.stringify(x, null, 1).slice(0, 3000));
  if (cmd === 'login') show(await login(a[0]));
  else if (cmd === 'me') show(await api(a[0], 'GET', '/api/v3/me'));
  else if (cmd === 'order') show(await api(a[0], 'GET', `/api/v3/orders/${a[1]}`));
  else if (cmd === 'prepare') {
    const qr = fs.readFileSync(a[1], 'utf8').trim();
    const prep = await api(a[0], 'POST', '/api/v3/orders/prepare', { qr_payload: qr, amount_vnd: Number(a[2]), reward_usdc: a[3] });
    console.log('order', prep.order?.id, 'pay_amount', prep.order?.pay_amount, 'reward', prep.order?.reward);
    const built = prep.payload?.payload_to_sign ? prep.payload : await api(a[0], 'POST', '/api/v3/intents/build', { kind: 'fund', order: prep.order });
    show(await signAndSubmit(a[0], built));
  } else if (cmd === 'register') show(await authCall(a[0], 'register_fulfiller', { bank_bin: a[1], account_last4: a[2] }));
  else if (cmd === 'op') show(await authCall(a[0], a[1], JSON.parse(a[2] || '{}')));
  else if (cmd === 'proof') {
    const eml = fs.readFileSync(a[2]);
    const up = await api(a[0], 'POST', `/api/v3/proofs?order_id=${encodeURIComponent(a[1])}`, undefined, eml);
    console.log('proof sha256', up.sha256, 'size', up.size);
    const built = up.payload?.payload_to_sign ? up.payload : await api(a[0], 'POST', '/api/v3/intents/build', { kind: 'auth_call', op: 'submit_proof', order_id: a[1], proof_sha256: up.sha256 });
    show(await signAndSubmit(a[0], built));
  } else { console.error('unknown cmd'); process.exit(2); }
})().catch((e) => { console.error('ERR', String(e?.message || e).slice(0, 1500)); process.exit(1); });
