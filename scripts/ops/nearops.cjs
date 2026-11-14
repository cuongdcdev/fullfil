// Minimal mainnet ops helper. Keys come from ~/.near-credentials/mainnet/<account>.json (never printed).
// Usage:
//   node nearops.cjs transfer <from> <to> <amountNEAR>
//   node nearops.cjs call <from> <contract> <method> <argsJsonOrFile> [gasTgas=100] [depositYocto=0]
//   node nearops.cjs deploy <account> <wasmPath> [initMethod initArgsFile gasTgas]
//   node nearops.cjs view <contract> <method> [argsJson]
const fs = require('fs');
const os = require('os');
const path = require('path');
const { connect, keyStores, utils, transactions } = require('near-api-js');

const RPC = process.env.NEAR_RPC_URL || 'https://rpc.mainnet.fastnear.com';

async function near() {
  const keyStore = new keyStores.UnencryptedFileSystemKeyStore(path.join(os.homedir(), '.near-credentials'));
  return connect({ networkId: 'mainnet', nodeUrl: RPC, keyStore });
}
const readArgs = (s) => (s && fs.existsSync(s) ? JSON.parse(fs.readFileSync(s, 'utf8')) : JSON.parse(s || '{}'));
const short = (o) => ({
  tx: o.transaction_outcome?.id,
  status: Object.keys(o.status || {})[0],
  failure: o.status?.Failure ? JSON.stringify(o.status.Failure).slice(0, 600) : undefined,
  receipts_failed: (o.receipts_outcome || []).filter((r) => r.outcome.status.Failure).map((r) => JSON.stringify(r.outcome.status.Failure).slice(0, 400)),
  logs: (o.receipts_outcome || []).flatMap((r) => r.outcome.logs).slice(0, 20),
  value: o.status?.SuccessValue ? Buffer.from(o.status.SuccessValue, 'base64').toString().slice(0, 600) : undefined,
});

(async () => {
  const [cmd, ...a] = process.argv.slice(2);
  const n = await near();
  if (cmd === 'transfer') {
    const acc = await n.account(a[0]);
    const r = await acc.sendMoney(a[1], BigInt(utils.format.parseNearAmount(a[2])));
    console.log(JSON.stringify(short(r), null, 1));
  } else if (cmd === 'call') {
    const acc = await n.account(a[0]);
    const r = await acc.functionCall({
      contractId: a[1], methodName: a[2], args: readArgs(a[3]),
      gas: BigInt(a[4] || 100) * 10n ** 12n, attachedDeposit: BigInt(a[5] || 0),
    });
    console.log(JSON.stringify(short(r), null, 1));
  } else if (cmd === 'deploy') {
    const acc = await n.account(a[0]);
    const code = fs.readFileSync(a[1]);
    const actions = [transactions.deployContract(code)];
    if (a[2]) actions.push(transactions.functionCall(a[2], readArgs(a[3]), BigInt(a[4] || 100) * 10n ** 12n, 0n));
    const r = await acc.signAndSendTransaction({ receiverId: a[0], actions });
    console.log(JSON.stringify(short(r), null, 1));
  } else if (cmd === 'batch') {
    // batch <from> <receiver> <actionsJsonFile>: [{method,args,gasTgas,deposit}]
    const acc = await n.account(a[0]);
    const list = readArgs(a[2]);
    const actions = list.map((x) => transactions.functionCall(x.method, x.args || {}, BigInt(x.gasTgas || 30) * 10n ** 12n, BigInt(x.deposit || 0)));
    const r = await acc.signAndSendTransaction({ receiverId: a[1], actions });
    console.log(JSON.stringify(short(r), null, 1));
  } else if (cmd === 'view') {
    const acc = await n.account('dontcare');
    const r = await acc.viewFunction({ contractId: a[0], methodName: a[1], args: readArgs(a[2]) });
    console.log(JSON.stringify(r, null, 1));
  } else {
    console.error('unknown cmd'); process.exit(2);
  }
})().catch((e) => { console.error('ERR', String(e?.message || e).slice(0, 800)); process.exit(1); });
