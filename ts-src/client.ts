import * as assert from 'assert'
import * as path from 'path'
import * as fs from 'fs'
import * as grpc from 'grpc'
import * as protoLoader from '@grpc/proto-loader'
import * as lnPayReq from 'bolt11'
import { RpcResponse, CreateResponse, RestoreResponse,
        UnlockResponse, ChangePasswordResponse, SendResponse, ChannelPoint,
        RequestResponse, Invoice, GetInfoResponse, ListChannelsResponse,
        ChannelBalanceResponse, ChannelBandwidthResponse, WalletBalanceResponse,
        NewAddressResponse, PayReq, ListChannelsRequest, NewAddressRequest,
        OpenChannelRequest, SendRequest, PaymentHash, PayReqString } from './types'

export class LightningRpc {
  private __meta: grpc.Metadata
  private __mainRpc: any
  private __unlockerRpc: any
  private __domainPort: string
  private __credentials: grpc.ChannelCredentials
  private __lnrpc: any

  constructor (tls_cert: string, macaroon_hex: string, domain_port?: string) {
    this.__domainPort = domain_port || '127.0.0.1:10009'

    tls_cert = tls_cert.replace("-----BEGIN CERTIFICATE-----","-----BEGIN CERTIFICATE-----\n")
    tls_cert = tls_cert.replace("-----END CERTIFICATE-----","\n-----END CERTIFICATE-----")

    this.__credentials = grpc.credentials.createSsl(Buffer.from(tls_cert, 'utf8'))

    const meta = new grpc.Metadata()
    meta.add('macaroon', macaroon_hex)
    this.__meta = meta

    const protoData = protoLoader.loadSync(path.join(__dirname, '/rpc.proto'))
    const lnrpcDescriptor = grpc.loadPackageDefinition(protoData)
    this.__lnrpc = lnrpcDescriptor.lnrpc

    this.__mainRpc = null
    this.__unlockerRpc = new this.__lnrpc.WalletUnlocker(this.__domainPort, this.__credentials)
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
    this.__unlockerRpc = null
    this.__mainRpc = new this.__lnrpc.Lightning(this.__domainPort, this.__credentials)
  }

  toUnlocker(): void {
    this.__mainRpc = null
    this.__unlockerRpc = new this.__lnrpc.WalletUnlocker(this.__domainPort, this.__credentials)
  }

  // WalletUnlocker service helper functions. Used for the gRPC server started at
  // boot time for LND. Once a wallet has been unlocked/created/restored, toMain()
  // should be called and the Lightning service should be used.
  // (LND actually shuts down this gRPC server, and creates a new one, so toMain()
  // must be called to get node-gRPC to re-connect to the new server.)

  async create(walletPw: string, aezeedPw?: string): Promise<CreateResponse> {
    assert(this.__unlockerRpc, 'create requires toUnlocker()')
    assert(walletPw, 'create requires a wallet unlock password')
    if (aezeedPw === undefined) aezeedPw = 'aezeed'
    const result = await genSeed(this.__unlockerRpc, aezeedPw)
    const cipherSeedMnemonic = result.cipherSeedMnemonic
    await initWallet(this.__unlockerRpc, walletPw, cipherSeedMnemonic, aezeedPw)
    return { seed: cipherSeedMnemonic.join(' ') }
  }

  async restore(aezeedStr: string, walletPw: string, aezeedPw?: string): Promise<RestoreResponse> {
    assert(this.__unlockerRpc, 'restore requires toUnlocker()')
    assert(aezeedStr, 'restore requires aezeed phrase')
    assert(walletPw, 'restore requires a wallet unlock password')
    if (aezeedPw === undefined) aezeedPw = 'aezeed'
    const cipherSeedMnemonic = aezeedStr.split(/\s+/)
    return initWallet(this.__unlockerRpc, walletPw, cipherSeedMnemonic, aezeedPw)
  }

  async unlock( password: string ): Promise<UnlockResponse> {
    assert(this.__unlockerRpc, 'unlock requires toUnlocker()')
    assert(password, 'unlock requires password')
    return new Promise((resolve, reject) => {
      this.__unlockerRpc.unlockWallet(
        { walletPassword: Buffer.from(password,'utf8') },
        promiseFunction(resolve, reject)
      )
    })
  }

  async changePassword( currentPassword: string, newPassword: string ): Promise<ChangePasswordResponse> {
    assert(this.__unlockerRpc, 'changePassword requires toUnlocker()')
    assert(currentPassword, 'changePassword requires oldPassword')
    assert(newPassword, 'changePassword requires oldPassword')
    return new Promise((resolve, reject) => {
      this.__unlockerRpc.changePassword(
        {
          currentPassword: Buffer.from(currentPassword,'utf8'),
          newPassword: Buffer.from(newPassword,'utf8')
        },
        promiseFunction(resolve, reject)
      )
    })
  }

  // Lightning service helper functions. Primarily just offering them all in
  // async / await, but for some of the more common operations I will create
  // helper functions for convenience.

  async send( payment_request: string ): Promise<SendResponse> {
    assert(this.__mainRpc, 'send requires toMain()')
    let res = await this.sendPayment({ payment_request })
    return Object.assign(res, { decodedPayReq: lnPayReq.decode(payment_request) })
  }

  async open( node_pubkey_string: string, local_funding_amount: number, push_sat: number ): Promise<ChannelPoint> {
    assert(this.__mainRpc, 'open requires toMain()')
    let opts = {node_pubkey_string, local_funding_amount}
    if (push_sat !== undefined) opts = Object.assign(opts, { push_sat })
    return this.openChannel(opts)
  }

  async request( satoshis: number ): Promise<RequestResponse> {
    assert(this.__mainRpc, 'request requires toMain()')
    return this.addInvoice({ value: satoshis })
  }

  async check( r_hash_str: string ): Promise<Invoice> {
    assert(this.__mainRpc, 'check requires toMain()')
    return this.lookupInvoice({ r_hash_str })
  }

  async getInfo (): Promise<GetInfoResponse> {
    assert(this.__mainRpc, 'getInfo requires toMain()')
    return new Promise((resolve, reject) => {
      this.__mainRpc.getInfo({}, this.__meta, promiseFunction(resolve, reject))
    })
  }

  async listChannels (opts: ListChannelsRequest): Promise<ListChannelsResponse> {
    assert(this.__mainRpc, 'listChannels requires toMain()')
    return new Promise((resolve, reject) => {
      this.__mainRpc.listChannels(opts || {}, this.__meta, promiseFunction(resolve, reject))
    })
  }

  async channelBalance (): Promise<ChannelBalanceResponse> {
    assert(this.__mainRpc, 'channelBalance requires toMain()')
    return new Promise((resolve, reject) => {
      this.__mainRpc.channelBalance({}, this.__meta, promiseFunction(resolve, reject))
    })
  }

  async channelBandwidth (): Promise<ChannelBandwidthResponse> {
    assert(this.__mainRpc, 'channelBandwidth requires toMain()')
    return this.listChannels({active_only: true})
      .then(response => ({
        bandwidth: response.channels.reduce((total, item) => { return total + item.remote_balance }, 0)
      }))
  }

  async walletBalance (): Promise<WalletBalanceResponse> {
    assert(this.__mainRpc, 'walletBalance requires toMain()')
    return new Promise((resolve, reject) => {
      this.__mainRpc.walletBalance({}, this.__meta, promiseFunction(resolve, reject))
    })
  }

  async newAddress (opts: NewAddressRequest): Promise<NewAddressResponse> {
    assert(this.__mainRpc, 'newAddress requires toMain()')
    opts = opts || {}
    if (opts.type === undefined) {
      opts = Object.assign(opts, {type: 1})
    } else {
      switch (opts.type) {
        case 'p2wkh':
          opts.type = 0
          break
        case 'np2wkh':
          opts.type = 1
          break
        case 0:
          break
        case 1:
          break
        default:
          throw new Error('newAddress type must be np2wkh or p2wkh')
      }
    }
    return new Promise((resolve, reject) => {
      this.__mainRpc.newAddress(opts, this.__meta, promiseFunction(resolve, reject))
    })
  }

  async openChannel (opts: OpenChannelRequest): Promise<ChannelPoint> {
    assert(this.__mainRpc, 'openChannel requires toMain()')
    assert(opts, 'openChannel requires opts')
    assert(opts.node_pubkey || opts.node_pubkey_string, 'openChannel requires node_pubkey or string')
    assert(opts.local_funding_amount, 'openChannel requires opts.local_funding_amount')
    return new Promise((resolve, reject) => {
      this.__mainRpc.openChannelSync(opts, this.__meta, promiseFunction(resolve, reject))
    })
  }

  async sendPayment (opts: SendRequest): Promise<SendResponse> {
    assert(this.__mainRpc, 'sendPayment requires toMain()')
    assert(opts, 'sendPayment requires opts')
    assert(opts.payment_request, 'sendPayment requires opts.payment_request')
    return new Promise((resolve, reject) => {
      this.__mainRpc.sendPaymentSync(opts, this.__meta, promiseFunction(resolve, reject))
    })
  }

  async addInvoice (opts: Invoice): Promise<RequestResponse> {
    assert(this.__mainRpc, 'addInvoice requires toMain()')
    assert(opts, 'addInvoice requires opts')
    assert(opts.value, 'addInvoice requires opts.value')
    return new Promise((resolve, reject) => {
      this.__mainRpc.addInvoice(opts, this.__meta, promiseFunction(resolve, reject))
    })
  }

  async lookupInvoice (opts: PaymentHash): Promise<Invoice> {
    assert(this.__mainRpc, 'lookupInvoice requires toMain()')
    assert(opts, 'lookupInvoice requires opts')
    assert(opts.r_hash_str, 'lookupInvoice requires opts.r_hash_str')
    return new Promise((resolve, reject) => {
      this.__mainRpc.lookupInvoice(opts, this.__meta, promiseFunction(resolve, reject))
    })
  }

  async decodePayReq (opts: PayReqString): Promise<PayReq> {
    assert(this.__mainRpc, 'decodePayReq requires toMain()')
    assert(opts, 'decodePayReq requires opts')
    assert(opts.pay_req, 'decodePayReq requires opts.pay_req')
    return new Promise((resolve, reject) => {
      this.__mainRpc.decodePayReq(opts, this.__meta, promiseFunction(resolve, reject))
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
