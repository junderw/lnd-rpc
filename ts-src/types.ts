import { PaymentRequestObject } from 'bolt11'
import * as Long from 'long'

export type RpcResponse = {
  [key: string]: any
}

export type CreateResponse = {
  seed: string
}

export type RestoreResponse = {}
export type UnlockResponse = {}
export type ChangePasswordResponse = {}

type Hop = {
  chanId: Long
  chanCapacity: Long
  expiry: number
  amtToForwardMsat: Long
  feeMsat: Long
  pubKey?: string
}

type Route = {
  totalTimeLock: number
  totalFeesMsat: Long
  totalAmtMsat: Long
  hops: Array<Hop>
}

export type SendResponse = {
  paymentError: string
  paymentPreimage: Buffer
  paymentRoute: Route
  decodedPayReq?: PaymentRequestObject
}

export type ChannelPoint = {
  fundingTxidBytes?: Buffer
  fundingTxidStr?: string
  outputIndex: number
}

export type RequestResponse = {
  rHash: Buffer
  paymentRequest: string
  addIndex: Long
}

type HopHint = {
  nodeId: string
  chanId: Long
  feeBaseMsat: number
  feeProportionalMillionths: number
  cltvExpiryDelta: number
}

type RouteHint = {
  hopHints: Array<HopHint>
}

export type Invoice = {
  memo?: string
  receipt?: Buffer
  rPreimage?: Buffer
  rHash?: Buffer
  value?: Long
  settled?: boolean
  creationDate?: Long
  settleDate?: Long
  paymentRequest?: string
  descriptionHash?: Buffer
  expiry?: Long
  fallbackAddr?: string
  cltvExpiry?: Long
  routeHints?: Array<RouteHint>
  private?: boolean
  addIndex?: Long
  settleIndex?: Long
  amtPaidSat?: Long
  amtPaidMsat?: Long
}

export type GetInfoResponse = {
  identityPubkey: string
  alias: string
  numPendingChannels?: number
  numActiveChannels?: number
  numPeers?: number
  blockHeight?: number
  blockHash: string
  syncedToChain?: boolean
  testnet?: boolean
  chains: Array<string>
  uris?: Array<string>
  bestHeaderTimestamp: Long
  version: string
  numInactiveChannels?: number
}

type HTLC = {
  incoming: boolean
  amount: Long
  hashLock: Buffer
  expirationHeight: number
}

type Channel = {
  active: boolean
  remotePubkey: string
  channelPoint: string
  chanId: Long
  capacity: Long
  localBalance: Long
  remoteBalance: Long
  commitFee: Long
  commitWeight: Long
  feePerKw: Long
  unsettledBalance: Long
  totalSatoshisSent: Long
  totalSatoshisReceived: Long
  numUpdates: Long
  pendingHtlcs: Array<HTLC>
  csvDelay: number
  private: boolean
}

export type ListChannelsResponse = {
  channels: Array<Channel>
}

export type ListChannelsRequest = {
  activeOnly?: boolean
  inactiveOnly?: boolean
  publicOnly?: boolean
  privateOnly?: boolean
}

export type OpenChannelRequest = {
  nodePubkey?: Buffer
  nodePubkeyString?: string
  localFundingAmount: Long
  pushSat?: Long
  targetConf?: number
  satPerByte?: Long
  private?: boolean
  minHtlcMsat?: Long
  remoteCsvDelay?: number
  minConfs?: number
  spendUnconfirmed?: boolean
}

type FeeLimit = {
  fixed?: Long
  percent?: Long
}

export type SendRequest = {
  dest?: Buffer
  destString?: string
  amt?: Long
  paymentHash?: Buffer
  paymentHashString?: number
  paymentRequest?: string
  finalCltvDelta?: number
  feeLimit?: FeeLimit
}

export type PaymentHash = {
  rHashStr?: string
  rHash?: Buffer
}

export type ChannelBalanceResponse = {
  balance: Long
  pendingOpenBalance: Long
}

export type ChannelBandwidthResponse = {
  bandwidth: Long
}

export type WalletBalanceResponse = {
  totalBalance: Long
  confirmedBalance: Long
  unconfirmedBalance: Long
}

export type NewAddressResponse = {
  address: string
}

export type NewAddressRequest = {
  type: string | number
}

export type PayReq = {
  destination: string
  paymentHash: string
  numSatoshis: Long
  timestamp: Long
  expiry: Long
  description: string
  descriptionHash: string
  fallbackAddr: string
  cltvExpiry: Long
  routeHints: Array<RouteHint>
}

export type PayReqString = {
  payReq: string
}
