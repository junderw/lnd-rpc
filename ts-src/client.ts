import * as assert from 'assert'
import * as path from 'path'
import * as fs from 'fs'
import * as grpc from 'grpc'
import * as protoLoader from '@grpc/proto-loader'
import * as lnPayReq from 'bolt11'
import { RpcResponse } from './types'

export class LightningRpc {
  meta: grpc.Metadata
  mainRpc: any
  unlockerRpc: any
  domainPort: string
  credentials: grpc.ChannelCredentials
  lnrpc: any

  constructor (tls_cert: string, macaroon_hex: string, domain_port?: string) {
    this.domainPort = domain_port || '127.0.0.1:10009'

    tls_cert = tls_cert.replace("-----BEGIN CERTIFICATE-----","-----BEGIN CERTIFICATE-----\n")
    tls_cert = tls_cert.replace("-----END CERTIFICATE-----","\n-----END CERTIFICATE-----")

    this.credentials = grpc.credentials.createSsl(Buffer.from(tls_cert, 'utf8'))

    const meta = new grpc.Metadata()
    meta.add('macaroon', macaroon_hex)
    this.meta = meta

    const protoData = protoLoader.loadSync(path.join(__dirname, '/rpc.proto'))
    const lnrpcDescriptor = grpc.loadPackageDefinition(protoData)
    this.lnrpc = lnrpcDescriptor.lnrpc

    this.mainRpc = null
    this.unlockerRpc = new this.lnrpc.WalletUnlocker(this.domainPort, this.credentials)
  }

  static fromStrings (tls_cert: string, macaroon_hex: string, domain_port?: string): LightningRpc {
    return new LightningRpc(tls_cert.replace(/[\r\n]/g, ''), macaroon_hex, domain_port)
  }

  static fromFilePaths (tls_cert_path: string, macaroon_path: string, domain_port?: string): LightningRpc {
    const tls_cert = fs.readFileSync(tls_cert_path).toString('utf8').replace(/[\r\n]/g, '')
    const macaroon_hex = fs.readFileSync(macaroon_path).toString('hex')
    return new LightningRpc(tls_cert, macaroon_hex, domain_port)
  }

  toMain(): void {
    this.unlockerRpc = null
    this.mainRpc = new this.lnrpc.Lightning(this.domainPort, this.credentials)
  }

  toUnlocker(): void {
    this.mainRpc = null
    this.unlockerRpc = new this.lnrpc.WalletUnlocker(this.domainPort, this.credentials)
  }

  async create(walletPw: string, aezeedPw?: string): Promise<RpcResponse> {
    assert(this.unlockerRpc, 'create requires toUnlocker()')
    assert(walletPw, 'create requires a wallet unlock password')
    if (aezeedPw === undefined) aezeedPw = 'aezeed'
    const result = await genSeed(this.unlockerRpc, aezeedPw)
    const cipherSeedMnemonic = result.cipherSeedMnemonic
    await initWallet(this.unlockerRpc, walletPw, cipherSeedMnemonic, aezeedPw)
    return { seed: cipherSeedMnemonic.join(' ') }
  }

  async unlock( password: string ): Promise<RpcResponse> {
    assert(this.unlockerRpc, 'unlock requires toUnlocker()')
    assert(password, 'unlock requires password')
    return new Promise((resolve, reject) => {
      this.unlockerRpc.unlockWallet(
        { walletPassword: Buffer.from(password,'utf8') },
        this.meta,
        promiseFunction(resolve, reject)
      )
    })
  }

  async send( payment_request: string ): Promise<RpcResponse> {
    assert(this.mainRpc, 'send requires toMain()')
    let res = await this.sendPayment({ payment_request })
    return Object.assign(res, { decodedPayReq: lnPayReq.decode(payment_request) })
  }

  async open( node_pubkey_string: string, local_funding_amount: number, push_sat: number ): Promise<RpcResponse> {
    assert(this.mainRpc, 'open requires toMain()')
    let opts = {node_pubkey_string, local_funding_amount}
    if (push_sat !== undefined) opts = Object.assign(opts, { push_sat })
    return this.openChannel(opts)
  }

  async request( satoshis: number ): Promise<RpcResponse> {
    assert(this.mainRpc, 'request requires toMain()')
    return this.addInvoice({ value: satoshis })
  }

  async check( r_hash_str: string ): Promise<RpcResponse> {
    assert(this.mainRpc, 'check requires toMain()')
    return this.lookupInvoice({ r_hash_str })
  }

  async getInfo (opts: any): Promise<RpcResponse> {
    assert(this.mainRpc, 'getInfo requires toMain()')
    return new Promise((resolve, reject) => {
      this.mainRpc.getInfo(opts || {}, this.meta, promiseFunction(resolve, reject))
    })
  }

  async listChannels (opts: any): Promise<Array<any>> {
    assert(this.mainRpc, 'listChannels requires toMain()')
    return new Promise((resolve, reject) => {
      this.mainRpc.listChannels(opts || {}, this.meta, promiseFunction(resolve, reject))
    })
  }

  async channelBalance (opts: any): Promise<RpcResponse> {
    assert(this.mainRpc, 'channelBalance requires toMain()')
    return new Promise((resolve, reject) => {
      this.mainRpc.channelBalance(opts || {}, this.meta, promiseFunction(resolve, reject))
    })
  }

  async channelBandwidth (): Promise<RpcResponse> {
    assert(this.mainRpc, 'channelBandwidth requires toMain()')
    return this.listChannels({active_only: true})
      .then((channels: Array<any>) => ({
        bandwidth: channels.reduce((total, item) => { return total + item.remote_balance }, 0)
      }))
  }

  async walletBalance (opts: any): Promise<RpcResponse> {
    assert(this.mainRpc, 'walletBalance requires toMain()')
    opts = opts || {}
    if (opts.witness_only === undefined) opts = Object.assign(opts, {witness_only: true})
    return new Promise((resolve, reject) => {
      this.mainRpc.walletBalance(opts, this.meta, promiseFunction(resolve, reject))
    })
  }

  async newAddress (opts: any): Promise<RpcResponse> {
    assert(this.mainRpc, 'newAddress requires toMain()')
    opts = opts || {}
    if (opts.type === undefined) opts = Object.assign(opts, {type: 'np2wkh'})
    return new Promise((resolve, reject) => {
      this.mainRpc.newAddress(opts, this.meta, promiseFunction(resolve, reject))
    })
  }

  async openChannel (opts: any): Promise<RpcResponse> {
    assert(this.mainRpc, 'openChannel requires toMain()')
    assert(opts, 'openChannel requires opts')
    assert(opts.node_pubkey_string, 'openChannel requires opts.node_pubkey_string')
    assert(opts.local_funding_amount, 'openChannel requires opts.local_funding_amount')
    return new Promise((resolve, reject) => {
      this.mainRpc.openChannelSync(opts, this.meta, promiseFunction(resolve, reject))
    })
  }

  async sendPayment (opts: any): Promise<RpcResponse> {
    assert(this.mainRpc, 'sendPayment requires toMain()')
    assert(opts, 'sendPayment requires opts')
    assert(opts.payment_request, 'sendPayment requires opts.payment_request')
    return new Promise((resolve, reject) => {
      this.mainRpc.sendPaymentSync(opts, this.meta, promiseFunction(resolve, reject))
    })
  }

  async addInvoice (opts: any): Promise<RpcResponse> {
    assert(this.mainRpc, 'addInvoice requires toMain()')
    assert(opts, 'addInvoice requires opts')
    assert(opts.value, 'addInvoice requires opts.value')
    return new Promise((resolve, reject) => {
      this.mainRpc.addInvoice(opts, this.meta, promiseFunction(resolve, reject))
    })
  }

  async lookupInvoice (opts: any): Promise<RpcResponse> {
    assert(this.mainRpc, 'lookupInvoice requires toMain()')
    assert(opts, 'lookupInvoice requires opts')
    assert(opts.r_hash_str, 'lookupInvoice requires opts.r_hash_str')
    return new Promise((resolve, reject) => {
      this.mainRpc.lookupInvoice(opts, this.meta, promiseFunction(resolve, reject))
    })
  }

  async decodePayReq (opts: any): Promise<RpcResponse> {
    assert(this.mainRpc, 'decodePayReq requires toMain()')
    assert(opts, 'decodePayReq requires opts')
    assert(opts.pay_req, 'decodePayReq requires opts.pay_req')
    return new Promise((resolve, reject) => {
      this.mainRpc.decodePayReq(opts, this.meta, promiseFunction(resolve, reject))
    })
  }
}

function convertBufferToHex (response: RpcResponse) {
  Object.keys(response).forEach(key => {
    if (response[key] instanceof Buffer) {
      response[key] = (<Buffer>response[key]).toString('hex')
    }
  })
  return response
}

function promiseFunction (resolve: (res: any)=>void, reject: (err: any)=>void) {
  return (err: Error, response: RpcResponse) => {
    if (err) reject(err)
    else resolve(convertBufferToHex(response))
  }
}

async function genSeed(rpc: any, aezeedPw?: string, entropy?: Buffer): Promise<RpcResponse> {
  if (aezeedPw === undefined) aezeedPw = 'aezeed'
  return new Promise((resolve, reject) => {
    rpc.genSeed(
      {
        aezeedPassphrase: Buffer.from(aezeedPw!,'utf8'),
        seedEntropy: entropy
      },
      promiseFunction(resolve, reject)
    )
  })
}

async function initWallet(rpc: any, walletPw: string, aezeed: Array<string>, aezeedPw?: string): Promise<RpcResponse> {
  if (aezeedPw === undefined) aezeedPw = 'aezeed'
  return new Promise((resolve, reject) => {
    rpc.initWallet(
      {
        walletPassword: Buffer.from(walletPw,'utf8'),
        cipherSeedMnemonic: aezeed,
        aezeedPassphrase: Buffer.from(aezeedPw!,'utf8')
      },
      promiseFunction(resolve, reject)
    )
  })
}
