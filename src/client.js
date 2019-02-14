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
        this.domainPort = domain_port || '127.0.0.1:10009';
        tls_cert = tls_cert.replace("-----BEGIN CERTIFICATE-----", "-----BEGIN CERTIFICATE-----\n");
        tls_cert = tls_cert.replace("-----END CERTIFICATE-----", "\n-----END CERTIFICATE-----");
        this.credentials = grpc.credentials.createSsl(Buffer.from(tls_cert, 'utf8'));
        const meta = new grpc.Metadata();
        meta.add('macaroon', macaroon_hex);
        this.meta = meta;
        const protoData = protoLoader.loadSync(path.join(__dirname, '/rpc.proto'));
        const lnrpcDescriptor = grpc.loadPackageDefinition(protoData);
        this.lnrpc = lnrpcDescriptor.lnrpc;
        this.mainRpc = null;
        this.unlockerRpc = new this.lnrpc.WalletUnlocker(this.domainPort, this.credentials);
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
        this.unlockerRpc = null;
        this.mainRpc = new this.lnrpc.Lightning(this.domainPort, this.credentials);
    }
    toUnlocker() {
        this.mainRpc = null;
        this.unlockerRpc = new this.lnrpc.WalletUnlocker(this.domainPort, this.credentials);
    }
    async create(walletPw, aezeedPw) {
        assert(this.unlockerRpc, 'create requires toUnlocker()');
        assert(walletPw, 'create requires a wallet unlock password');
        if (aezeedPw === undefined)
            aezeedPw = 'aezeed';
        const result = await genSeed(this.unlockerRpc, aezeedPw);
        const cipherSeedMnemonic = result.cipherSeedMnemonic;
        await initWallet(this.unlockerRpc, walletPw, cipherSeedMnemonic, aezeedPw);
        return { seed: cipherSeedMnemonic.join(' ') };
    }
    async unlock(password) {
        assert(this.unlockerRpc, 'unlock requires toUnlocker()');
        assert(password, 'unlock requires password');
        return new Promise((resolve, reject) => {
            this.unlockerRpc.unlockWallet({ walletPassword: Buffer.from(password, 'utf8') }, this.meta, promiseFunction(resolve, reject));
        });
    }
    async send(payment_request) {
        assert(this.mainRpc, 'send requires toMain()');
        let res = await this.sendPayment({ payment_request });
        return Object.assign(res, { decodedPayReq: lnPayReq.decode(payment_request) });
    }
    async open(node_pubkey_string, local_funding_amount, push_sat) {
        assert(this.mainRpc, 'open requires toMain()');
        let opts = { node_pubkey_string, local_funding_amount };
        if (push_sat !== undefined)
            opts = Object.assign(opts, { push_sat });
        return this.openChannel(opts);
    }
    async request(satoshis) {
        assert(this.mainRpc, 'request requires toMain()');
        return this.addInvoice({ value: satoshis });
    }
    async check(r_hash_str) {
        assert(this.mainRpc, 'check requires toMain()');
        return this.lookupInvoice({ r_hash_str });
    }
    async getInfo(opts) {
        assert(this.mainRpc, 'getInfo requires toMain()');
        return new Promise((resolve, reject) => {
            this.mainRpc.getInfo(opts || {}, this.meta, promiseFunction(resolve, reject));
        });
    }
    async listChannels(opts) {
        assert(this.mainRpc, 'listChannels requires toMain()');
        return new Promise((resolve, reject) => {
            this.mainRpc.listChannels(opts || {}, this.meta, promiseFunction(resolve, reject));
        });
    }
    async channelBalance(opts) {
        assert(this.mainRpc, 'channelBalance requires toMain()');
        return new Promise((resolve, reject) => {
            this.mainRpc.channelBalance(opts || {}, this.meta, promiseFunction(resolve, reject));
        });
    }
    async channelBandwidth() {
        assert(this.mainRpc, 'channelBandwidth requires toMain()');
        return this.listChannels({ active_only: true })
            .then((channels) => ({
            bandwidth: channels.reduce((total, item) => { return total + item.remote_balance; }, 0)
        }));
    }
    async walletBalance(opts) {
        assert(this.mainRpc, 'walletBalance requires toMain()');
        opts = opts || {};
        if (opts.witness_only === undefined)
            opts = Object.assign(opts, { witness_only: true });
        return new Promise((resolve, reject) => {
            this.mainRpc.walletBalance(opts, this.meta, promiseFunction(resolve, reject));
        });
    }
    async newAddress(opts) {
        assert(this.mainRpc, 'newAddress requires toMain()');
        opts = opts || {};
        if (opts.type === undefined)
            opts = Object.assign(opts, { type: 'np2wkh' });
        return new Promise((resolve, reject) => {
            this.mainRpc.newAddress(opts, this.meta, promiseFunction(resolve, reject));
        });
    }
    async openChannel(opts) {
        assert(this.mainRpc, 'openChannel requires toMain()');
        assert(opts, 'openChannel requires opts');
        assert(opts.node_pubkey_string, 'openChannel requires opts.node_pubkey_string');
        assert(opts.local_funding_amount, 'openChannel requires opts.local_funding_amount');
        return new Promise((resolve, reject) => {
            this.mainRpc.openChannelSync(opts, this.meta, promiseFunction(resolve, reject));
        });
    }
    async sendPayment(opts) {
        assert(this.mainRpc, 'sendPayment requires toMain()');
        assert(opts, 'sendPayment requires opts');
        assert(opts.payment_request, 'sendPayment requires opts.payment_request');
        return new Promise((resolve, reject) => {
            this.mainRpc.sendPaymentSync(opts, this.meta, promiseFunction(resolve, reject));
        });
    }
    async addInvoice(opts) {
        assert(this.mainRpc, 'addInvoice requires toMain()');
        assert(opts, 'addInvoice requires opts');
        assert(opts.value, 'addInvoice requires opts.value');
        return new Promise((resolve, reject) => {
            this.mainRpc.addInvoice(opts, this.meta, promiseFunction(resolve, reject));
        });
    }
    async lookupInvoice(opts) {
        assert(this.mainRpc, 'lookupInvoice requires toMain()');
        assert(opts, 'lookupInvoice requires opts');
        assert(opts.r_hash_str, 'lookupInvoice requires opts.r_hash_str');
        return new Promise((resolve, reject) => {
            this.mainRpc.lookupInvoice(opts, this.meta, promiseFunction(resolve, reject));
        });
    }
    async decodePayReq(opts) {
        assert(this.mainRpc, 'decodePayReq requires toMain()');
        assert(opts, 'decodePayReq requires opts');
        assert(opts.pay_req, 'decodePayReq requires opts.pay_req');
        return new Promise((resolve, reject) => {
            this.mainRpc.decodePayReq(opts, this.meta, promiseFunction(resolve, reject));
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
