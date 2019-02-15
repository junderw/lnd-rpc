import { CreateResponse, RestoreResponse, UnlockResponse, ChangePasswordResponse, SendResponse, ChannelPoint, RequestResponse, Invoice, GetInfoResponse, ListChannelsResponse, ChannelBalanceResponse, ChannelBandwidthResponse, WalletBalanceResponse, NewAddressResponse, PayReq, ListChannelsRequest, NewAddressRequest, OpenChannelRequest, SendRequest, PaymentHash, PayReqString } from './types';
export declare class LightningRpc {
    private __meta;
    private __mainRpc;
    private __unlockerRpc;
    private __domainPort;
    private __credentials;
    private __lnrpc;
    constructor(tls_cert: string, macaroon_hex: string, domain_port?: string);
    static fromStrings(tls_cert: string, macaroon_hex: string, domain_port?: string): LightningRpc;
    static fromFilePaths(tls_cert_path: string, macaroon_path: string, domain_port?: string): LightningRpc;
    toMain(): void;
    toUnlocker(): void;
    create(walletPw: string, aezeedPw?: string): Promise<CreateResponse>;
    restore(aezeedStr: string, walletPw: string, aezeedPw?: string): Promise<RestoreResponse>;
    unlock(password: string): Promise<UnlockResponse>;
    changePassword(currentPassword: string, newPassword: string): Promise<ChangePasswordResponse>;
    send(payment_request: string): Promise<SendResponse>;
    open(node_pubkey_string: string, local_funding_amount: number, push_sat: number): Promise<ChannelPoint>;
    request(satoshis: number): Promise<RequestResponse>;
    check(r_hash_str: string): Promise<Invoice>;
    getInfo(): Promise<GetInfoResponse>;
    listChannels(opts: ListChannelsRequest): Promise<ListChannelsResponse>;
    channelBalance(): Promise<ChannelBalanceResponse>;
    channelBandwidth(): Promise<ChannelBandwidthResponse>;
    walletBalance(): Promise<WalletBalanceResponse>;
    newAddress(opts: NewAddressRequest): Promise<NewAddressResponse>;
    openChannel(opts: OpenChannelRequest): Promise<ChannelPoint>;
    sendPayment(opts: SendRequest): Promise<SendResponse>;
    addInvoice(opts: Invoice): Promise<RequestResponse>;
    lookupInvoice(opts: PaymentHash): Promise<Invoice>;
    decodePayReq(opts: PayReqString): Promise<PayReq>;
}
