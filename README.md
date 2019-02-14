# lnd-rpc

This library is for accessing LND via grpc using NodeJS.

## Simple usage etc. (Will add more later)

```javascript
const lndRpc = require('lnd-rpc')
const LndRpc = lndRpc.LightningRpc.fromFilePaths(
  '/home/ubuntu/.lnd/tls.cert',
  '/home/ubuntu/.lnd/data/chain/bitcoin/simnet/admin.macaroon'
)

// unlock an existing wallet and getinfo
async function unlockExisting() {
  // default RPC is wallet unlocking service
  await LndRpc.unlock("superP@$$word") // don't use this password :-P

  // toMain() switches RPC from wallet unlocker to the main RPC.
  LndRpc.toMain()

  let results = await LndRpc.getInfo()
  console.log(results)
/* { identityPubkey:
   '02649b6a56e8ebc07df52dda0a2bafdf2eeb909d5647868e0b6493e1783d41e2e5',
  alias: '02649b6a56e8ebc07df5',
  blockHash:
   '683e86bd5c6d110d91b94b97137ba6bfe02dbbdb8e3dff722a669b5d69d77af6',
  chains: [ 'bitcoin' ],
  bestHeaderTimestamp: Long { low: 1401292357, high: 0, unsigned: false },
  version: '0.5.2-beta commit=' } */
}
unlockExisting().catch(console.error)

// OR create a new wallet from scratch
async function createNew() {
  // first arg is the unlock password.
  // second arg is the aezeed password. (optional)
  const { seed } = await LndRpc.create("superP@$$word")
  // seed is your aezeed recovery phrase.
  // you need the aezeed + aezeed password...
  // OR the unlock password + your wallet.db file to unlock your on chain funds.
  // seed = 'above snack regret marine version sketch assist word solve item quality burst detect cake net bulb mammal episode give cherry churn romance tag word'

  // toMain() switches RPC from wallet unlocker to the main RPC.
  LndRpc.toMain()

  let results = await LndRpc.getInfo()
  console.log(results)
/* { identityPubkey:
   '02649b6a56e8ebc07df52dda0a2bafdf2eeb909d5647868e0b6493e1783d41e2e5',
  alias: '02649b6a56e8ebc07df5',
  blockHash:
   '683e86bd5c6d110d91b94b97137ba6bfe02dbbdb8e3dff722a669b5d69d77af6',
  chains: [ 'bitcoin' ],
  bestHeaderTimestamp: Long { low: 1401292357, high: 0, unsigned: false },
  version: '0.5.2-beta commit=' } */
}
createNew().catch(console.error)
```
