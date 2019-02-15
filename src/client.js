"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const path = require("path");
const fs = require("fs");
const grpc = require("grpc");
const protoLoader = require("@grpc/proto-loader");
const lnPayReq = require("bolt11");
class LightningRpc {
    constructor(tls_cert, macaroon_hex, domain_port) {
        this.__domainPort = domain_port || '127.0.0.1:10009';
        tls_cert = tls_cert.replace("-----BEGIN CERTIFICATE-----", "-----BEGIN CERTIFICATE-----\n");
        tls_cert = tls_cert.replace("-----END CERTIFICATE-----", "\n-----END CERTIFICATE-----");
        this.__credentials = grpc.credentials.createSsl(Buffer.from(tls_cert, 'utf8'));
        const meta = new grpc.Metadata();
        meta.add('macaroon', macaroon_hex);
        this.__meta = meta;
        const protoData = protoLoader.loadSync(path.join(__dirname, '/rpc.proto'));
        const lnrpcDescriptor = grpc.loadPackageDefinition(protoData);
        this.__lnrpc = lnrpcDescriptor.lnrpc;
        this.__mainRpc = null;
        this.__unlockerRpc = new this.__lnrpc.WalletUnlocker(this.__domainPort, this.__credentials);
    }
    static fromStrings(tls_cert, macaroon_hex, domain_port) {
        return new LightningRpc(tls_cert.replace(/[\r\n]/g, ''), macaroon_hex, domain_port);
    }
    static fromFilePaths(tls_cert_path, macaroon_path, domain_port) {
        const tls_cert = fs.readFileSync(tls_cert_path).toString('utf8').replace(/[\r\n]/g, '');
        const macaroon_hex = fs.readFileSync(macaroon_path).toString('hex');
        return new LightningRpc(tls_cert, macaroon_hex, domain_port);
    }
    toMain() {
        this.__unlockerRpc = null;
        this.__mainRpc = new this.__lnrpc.Lightning(this.__domainPort, this.__credentials);
    }
    toUnlocker() {
        this.__mainRpc = null;
        this.__unlockerRpc = new this.__lnrpc.WalletUnlocker(this.__domainPort, this.__credentials);
    }
    async create(walletPw, aezeedPw) {
        assert(this.__unlockerRpc, 'create requires toUnlocker()');
        assert(walletPw, 'create requires a wallet unlock password');
        if (aezeedPw === undefined)
            aezeedPw = 'aezeed';
        const result = await genSeed(this.__unlockerRpc, aezeedPw);
        const cipherSeedMnemonic = result.cipherSeedMnemonic;
        await initWallet(this.__unlockerRpc, walletPw, cipherSeedMnemonic, aezeedPw);
        return { seed: cipherSeedMnemonic.join(' ') };
    }
    async unlock(password) {
        assert(this.__unlockerRpc, 'unlock requires toUnlocker()');
        assert(password, 'unlock requires password');
        return new Promise((resolve, reject) => {
            this.__unlockerRpc.unlockWallet({ walletPassword: Buffer.from(password, 'utf8') }, this.__meta, promiseFunction(resolve, reject));
        });
    }
    async send(payment_request) {
        assert(this.__mainRpc, 'send requires toMain()');
        let res = await this.sendPayment({ payment_request });
        return Object.assign(res, { decodedPayReq: lnPayReq.decode(payment_request) });
    }
    async open(node_pubkey_string, local_funding_amount, push_sat) {
        assert(this.__mainRpc, 'open requires toMain()');
        let opts = { node_pubkey_string, local_funding_amount };
        if (push_sat !== undefined)
            opts = Object.assign(opts, { push_sat });
        return this.openChannel(opts);
    }
    async request(satoshis) {
        assert(this.__mainRpc, 'request requires toMain()');
        return this.addInvoice({ value: satoshis });
    }
    async check(r_hash_str) {
        assert(this.__mainRpc, 'check requires toMain()');
        return this.lookupInvoice({ r_hash_str });
    }
    async getInfo(opts) {
        assert(this.__mainRpc, 'getInfo requires toMain()');
        return new Promise((resolve, reject) => {
            this.__mainRpc.getInfo(opts || {}, this.__meta, promiseFunction(resolve, reject));
        });
    }
    async listChannels(opts) {
        assert(this.__mainRpc, 'listChannels requires toMain()');
        return new Promise((resolve, reject) => {
            this.__mainRpc.listChannels(opts || {}, this.__meta, promiseFunction(resolve, reject));
        });
    }
    async channelBalance(opts) {
        assert(this.__mainRpc, 'channelBalance requires toMain()');
        return new Promise((resolve, reject) => {
            this.__mainRpc.channelBalance(opts || {}, this.__meta, promiseFunction(resolve, reject));
        });
    }
    async channelBandwidth() {
        assert(this.__mainRpc, 'channelBandwidth requires toMain()');
        return this.listChannels({ active_only: true })
            .then((channels) => ({
            bandwidth: channels.reduce((total, item) => { return total + item.remote_balance; }, 0)
        }));
    }
    async walletBalance(opts) {
        assert(this.__mainRpc, 'walletBalance requires toMain()');
        opts = opts || {};
        if (opts.witness_only === undefined)
            opts = Object.assign(opts, { witness_only: true });
        return new Promise((resolve, reject) => {
            this.__mainRpc.walletBalance(opts, this.__meta, promiseFunction(resolve, reject));
        });
    }
    async newAddress(opts) {
        assert(this.__mainRpc, 'newAddress requires toMain()');
        opts = opts || {};
        if (opts.type === undefined)
            opts = Object.assign(opts, { type: 'np2wkh' });
        return new Promise((resolve, reject) => {
            this.__mainRpc.newAddress(opts, this.__meta, promiseFunction(resolve, reject));
        });
    }
    async openChannel(opts) {
        assert(this.__mainRpc, 'openChannel requires toMain()');
        assert(opts, 'openChannel requires opts');
        assert(opts.node_pubkey_string, 'openChannel requires opts.node_pubkey_string');
        assert(opts.local_funding_amount, 'openChannel requires opts.local_funding_amount');
        return new Promise((resolve, reject) => {
            this.__mainRpc.openChannelSync(opts, this.__meta, promiseFunction(resolve, reject));
        });
    }
    async sendPayment(opts) {
        assert(this.__mainRpc, 'sendPayment requires toMain()');
        assert(opts, 'sendPayment requires opts');
        assert(opts.payment_request, 'sendPayment requires opts.payment_request');
        return new Promise((resolve, reject) => {
            this.__mainRpc.sendPaymentSync(opts, this.__meta, promiseFunction(resolve, reject));
        });
    }
    async addInvoice(opts) {
        assert(this.__mainRpc, 'addInvoice requires toMain()');
        assert(opts, 'addInvoice requires opts');
        assert(opts.value, 'addInvoice requires opts.value');
        return new Promise((resolve, reject) => {
            this.__mainRpc.addInvoice(opts, this.__meta, promiseFunction(resolve, reject));
        });
    }
    async lookupInvoice(opts) {
        assert(this.__mainRpc, 'lookupInvoice requires toMain()');
        assert(opts, 'lookupInvoice requires opts');
        assert(opts.r_hash_str, 'lookupInvoice requires opts.r_hash_str');
        return new Promise((resolve, reject) => {
            this.__mainRpc.lookupInvoice(opts, this.__meta, promiseFunction(resolve, reject));
        });
    }
    async decodePayReq(opts) {
        assert(this.__mainRpc, 'decodePayReq requires toMain()');
        assert(opts, 'decodePayReq requires opts');
        assert(opts.pay_req, 'decodePayReq requires opts.pay_req');
        return new Promise((resolve, reject) => {
            this.__mainRpc.decodePayReq(opts, this.__meta, promiseFunction(resolve, reject));
        });
    }
}
exports.LightningRpc = LightningRpc;
function convertBufferToHex(response) {
    Object.keys(response).forEach(key => {
        if (response[key] instanceof Buffer) {
            response[key] = response[key].toString('hex');
        }
    });
    return response;
}
function promiseFunction(resolve, reject) {
    return (err, response) => {
        if (err)
            reject(err);
        else
            resolve(convertBufferToHex(response));
    };
}
async function genSeed(rpc, aezeedPw, entropy) {
    if (aezeedPw === undefined)
        aezeedPw = 'aezeed';
    return new Promise((resolve, reject) => {
        rpc.genSeed({
            aezeedPassphrase: Buffer.from(aezeedPw, 'utf8'),
            seedEntropy: entropy
        }, promiseFunction(resolve, reject));
    });
}
async function initWallet(rpc, walletPw, aezeed, aezeedPw) {
    if (aezeedPw === undefined)
        aezeedPw = 'aezeed';
    return new Promise((resolve, reject) => {
        rpc.initWallet({
            walletPassword: Buffer.from(walletPw, 'utf8'),
            cipherSeedMnemonic: aezeed,
            aezeedPassphrase: Buffer.from(aezeedPw, 'utf8')
        }, promiseFunction(resolve, reject));
    });
}
