/// <reference types="node" />
import { PaymentRequestObject } from 'bolt11';
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
    chan_id: number;
    chan_capacity: number;
    expiry: number;
    amt_to_forward_msat: number;
    fee_msat: number;
    pub_key?: string;
};
declare type Route = {
    total_time_lock: number;
    total_fees_msat: number;
    total_amt_msat: number;
    hops: Array<Hop>;
};
export declare type SendResponse = {
    payment_error: string;
    payment_preimage: Buffer;
    payment_route: Route;
    decodedPayReq?: PaymentRequestObject;
};
export declare type ChannelPoint = {
    funding_txid_bytes?: Buffer;
    funding_txid_str?: string;
    output_index: number;
};
export declare type RequestResponse = {
    r_hash: Buffer;
    payment_request: string;
    add_index: number;
};
declare type HopHint = {
    node_id: string;
    chan_id: number;
    fee_base_msat: number;
    fee_proportional_millionths: number;
    cltv_expiry_delta: number;
};
declare type RouteHint = {
    hop_hints: Array<HopHint>;
};
export declare type Invoice = {
    memo?: string;
    receipt?: Buffer;
    r_preimage?: Buffer;
    r_hash?: Buffer;
    value?: number;
    settled?: boolean;
    creation_date?: number;
    settle_date?: number;
    payment_request?: string;
    description_hash?: Buffer;
    expiry?: number;
    fallback_addr?: string;
    cltv_expiry?: number;
    route_hints?: Array<RouteHint>;
    private?: boolean;
    add_index?: number;
    settle_index?: number;
    amt_paid_sat?: number;
    amt_paid_msat?: number;
};
export declare type GetInfoResponse = {
    identity_pubkey: string;
    alias: string;
    num_pending_channels: number;
    num_active_channels: number;
    num_peers: number;
    block_height: number;
    block_hash: string;
    synced_to_chain: boolean;
    testnet: boolean;
    chains: Array<string>;
    uris: Array<string>;
    best_header_timestamp: number;
    version: string;
    num_inactive_channels: number;
};
declare type HTLC = {
    incoming: boolean;
    amount: number;
    hash_lock: Buffer;
    expiration_height: number;
};
declare type Channel = {
    active: boolean;
    remote_pubkey: string;
    channel_point: string;
    chan_id: number;
    capacity: number;
    local_balance: number;
    remote_balance: number;
    commit_fee: number;
    commit_weight: number;
    fee_per_kw: number;
    unsettled_balance: number;
    total_satoshis_sent: number;
    total_satoshis_received: number;
    num_updates: number;
    pending_htlcs: Array<HTLC>;
    csv_delay: number;
    private: boolean;
};
export declare type ListChannelsResponse = {
    channels: Array<Channel>;
};
export declare type ListChannelsRequest = {
    active_only?: boolean;
    inactive_only?: boolean;
    public_only?: boolean;
    private_only?: boolean;
};
export declare type OpenChannelRequest = {
    node_pubkey?: Buffer;
    node_pubkey_string?: string;
    local_funding_amount: number;
    push_sat?: number;
    target_conf?: number;
    sat_per_byte?: number;
    private?: boolean;
    min_htlc_msat?: number;
    remote_csv_delay?: number;
    min_confs?: number;
    spend_unconfirmed?: boolean;
};
declare type FeeLimit = {
    fixed?: number;
    percent?: number;
};
export declare type SendRequest = {
    dest?: Buffer;
    dest_string?: string;
    amt?: number;
    payment_hash?: Buffer;
    payment_hash_string?: number;
    payment_request?: string;
    final_cltv_delta?: number;
    fee_limit?: FeeLimit;
};
export declare type PaymentHash = {
    r_hash_str?: string;
    r_hash?: Buffer;
};
export declare type ChannelBalanceResponse = {
    balance: number;
    pending_open_balance: number;
};
export declare type ChannelBandwidthResponse = {
    bandwidth: number;
};
export declare type WalletBalanceResponse = {
    total_balance: number;
    confirmed_balance: number;
    unconfirmed_balance: number;
};
export declare type NewAddressResponse = {
    address: string;
};
export declare type NewAddressRequest = {
    type: string | number;
};
export declare type PayReq = {
    destination: string;
    payment_hash: string;
    num_satoshis: number;
    timestamp: number;
    expiry: number;
    description: string;
    description_hash: string;
    fallback_addr: string;
    cltv_expiry: number;
    route_hints: Array<RouteHint>;
};
export declare type PayReqString = {
    pay_req: string;
};
export {};
