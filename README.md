# lnd-rpc

This library is for accessing LND via grpc using NodeJS.

Written in TypeScript. JS files committed for versioning history.

## LND Version Targeted

`0.5.2-beta`

## Warning

This library is still under heavy development. Breaking changes in patch updates will be common, so please do not use `^` based dependencies. If possible specify an exact version.

ie. Your package.json should use `"lnd-rpc": "0.0.5",` instead of `"lnd-rpc": "^0.0.5",`

## Pull Requests Welcome

I am aware that a month ago someone made a library similar to this that uses a generator to automate type definition generation.

Down the road this library might do something similar, but for now this is primarily focused on creating a usable, easy to understand interface for communicating with LND through helper functions that simplify the usage for the library consumer.

When making a pull request, edit the TypeScript in ts-src and then run `npm run build` to make sure the changes are reflected in the definitions and the JS files. Check the diff for anything you didn't intend, then submit the pull request. type definitions and JS files must also be committed.

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

// OR check which service LND is currently serving
async function checkService() {
  // 'main' OR 'unlocker' OR it throws an Error if it can't find a listening server
  console.log(await LndRpc.getRemoteService())
  // 'main' OR 'unlocker'. It is not async.
  // If remote and local are mismatched, you can use toMain() or toUnlocker()
  // to switch your local to match the server.
  console.log(LndRpc.getLocalService())

  // true OR false. This will let you know if there is no listening server
  console.log(await LndRpc.isServerDown())
}
checkService().catch(console.error)
```
