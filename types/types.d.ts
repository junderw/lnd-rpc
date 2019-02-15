/// <reference types="node" />
import { PaymentRequestObject } from 'bolt11';
import * as Long from 'long';
export declare type RpcResponse = {
    [key: string]: any;
};
export declare type CreateResponse = {
    seed: string;
};
export declare type RestoreResponse = {};
export declare type UnlockResponse = {};
export declare type ChangePasswordResponse = {};
declare type Hop = {
    chanId: Long;
    chanCapacity: Long;
    expiry: number;
    amtToForwardMsat: Long;
    feeMsat: Long;
    pubKey?: string;
};
declare type Route = {
    totalTimeLock: number;
    totalFeesMsat: Long;
    totalAmtMsat: Long;
    hops: Array<Hop>;
};
export declare type SendResponse = {
    paymentError: string;
    paymentPreimage: Buffer;
    paymentRoute: Route;
    decodedPayReq?: PaymentRequestObject;
};
export declare type ChannelPoint = {
    fundingTxidBytes?: Buffer;
    fundingTxidStr?: string;
    outputIndex: number;
};
export declare type RequestResponse = {
    rHash: Buffer;
    paymentRequest: string;
    addIndex: Long;
};
declare type HopHint = {
    nodeId: string;
    chanId: Long;
    feeBaseMsat: number;
    feeProportionalMillionths: number;
    cltvExpiryDelta: number;
};
declare type RouteHint = {
    hopHints: Array<HopHint>;
};
export declare type Invoice = {
    memo?: string;
    receipt?: Buffer;
    rPreimage?: Buffer;
    rHash?: Buffer;
    value?: Long;
    settled?: boolean;
    creationDate?: Long;
    settleDate?: Long;
    paymentRequest?: string;
    descriptionHash?: Buffer;
    expiry?: Long;
    fallbackAddr?: string;
    cltvExpiry?: Long;
    routeHints?: Array<RouteHint>;
    private?: boolean;
    addIndex?: Long;
    settleIndex?: Long;
    amtPaidSat?: Long;
    amtPaidMsat?: Long;
};
export declare type GetInfoResponse = {
    identityPubkey: string;
    alias: string;
    numPendingChannels?: number;
    numActiveChannels?: number;
    numPeers?: number;
    blockHeight?: number;
    blockHash: string;
    syncedToChain?: boolean;
    testnet?: boolean;
    chains: Array<string>;
    uris?: Array<string>;
    bestHeaderTimestamp: Long;
    version: string;
    numInactiveChannels?: number;
};
declare type HTLC = {
    incoming: boolean;
    amount: Long;
    hashLock: Buffer;
    expirationHeight: number;
};
declare type Channel = {
    active: boolean;
    remotePubkey: string;
    channelPoint: string;
    chanId: Long;
    capacity: Long;
    localBalance: Long;
    remoteBalance: Long;
    commitFee: Long;
    commitWeight: Long;
    feePerKw: Long;
    unsettledBalance: Long;
    totalSatoshisSent: Long;
    totalSatoshisReceived: Long;
    numUpdates: Long;
    pendingHtlcs: Array<HTLC>;
    csvDelay: number;
    private: boolean;
};
export declare type ListChannelsResponse = {
    channels: Array<Channel>;
};
export declare type ListChannelsRequest = {
    activeOnly?: boolean;
    inactiveOnly?: boolean;
    publicOnly?: boolean;
    privateOnly?: boolean;
};
export declare type OpenChannelRequest = {
    nodePubkey?: Buffer;
    nodePubkeyString?: string;
    localFundingAmount: Long;
    pushSat?: Long;
    targetConf?: number;
    satPerByte?: Long;
    private?: boolean;
    minHtlcMsat?: Long;
    remoteCsvDelay?: number;
    minConfs?: number;
    spendUnconfirmed?: boolean;
};
declare type FeeLimit = {
    fixed?: Long;
    percent?: Long;
};
export declare type SendRequest = {
    dest?: Buffer;
    destString?: string;
    amt?: Long;
    paymentHash?: Buffer;
    paymentHashString?: number;
    paymentRequest?: string;
    finalCltvDelta?: number;
    feeLimit?: FeeLimit;
};
export declare type PaymentHash = {
    rHashStr?: string;
    rHash?: Buffer;
};
export declare type ChannelBalanceResponse = {
    balance: Long;
    pendingOpenBalance: Long;
};
export declare type ChannelBandwidthResponse = {
    bandwidth: Long;
};
export declare type WalletBalanceResponse = {
    totalBalance: Long;
    confirmedBalance: Long;
    unconfirmedBalance: Long;
};
export declare type NewAddressResponse = {
    address: string;
};
export declare type NewAddressRequest = {
    type: string | number;
};
export declare type PayReq = {
    destination: string;
    paymentHash: string;
    numSatoshis: Long;
    timestamp: Long;
    expiry: Long;
    description: string;
    descriptionHash: string;
    fallbackAddr: string;
    cltvExpiry: Long;
    routeHints: Array<RouteHint>;
};
export declare type PayReqString = {
    payReq: string;
};
export {};
