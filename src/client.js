"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const path = require("path");
const fs = require("fs");
const grpc = require("grpc");
const protoLoader = require("@grpc/proto-loader");
const Long = require("long");
const lnPayReq = require("bolt11");
class LightningRpc {
    constructor(tlsCert, macaroonHex, domainPort) {
        this.__domainPort = domainPort || '127.0.0.1:10009';
        tlsCert = tlsCert.replace("-----BEGIN CERTIFICATE-----", "-----BEGIN CERTIFICATE-----\n");
        tlsCert = tlsCert.replace("-----END CERTIFICATE-----", "\n-----END CERTIFICATE-----");
        this.__credentials = grpc.credentials.createSsl(Buffer.from(tlsCert, 'utf8'));
        const meta = new grpc.Metadata();
        meta.add('macaroon', macaroonHex);
        this.__meta = meta;
        const protoData = protoLoader.loadSync(path.join(__dirname, '/rpc.proto'));
        const lnrpcDescriptor = grpc.loadPackageDefinition(protoData);
        this.__lnrpc = lnrpcDescriptor.lnrpc;
        this.__mainRpc = null;
        this.__unlockerRpc = new this.__lnrpc.WalletUnlocker(this.__domainPort, this.__credentials);
    }
    static fromStrings(tlsCert, macaroonHex, domainPort) {
        return new LightningRpc(tlsCert.replace(/[\r\n]/g, ''), macaroonHex, domainPort);
    }
    static fromFilePaths(tlsCertPath, macaroonPath, domainPort) {
        const tlsCert = fs.readFileSync(tlsCertPath).toString('utf8').replace(/[\r\n]/g, '');
        const macaroonHex = fs.readFileSync(macaroonPath).toString('hex');
        return new LightningRpc(tlsCert, macaroonHex, domainPort);
    }
    async waitForReady() {
        let client;
        if (this.__unlockerRpc === null)
            client = this.__mainRpc;
        else if (this.__mainRpc === null)
            client = this.__unlockerRpc;
        await awaitConnection(client, 40); // 40 retries x 500 ms
    }
    async toMain() {
        this.__unlockerRpc.close();
        this.__unlockerRpc = null;
        this.__mainRpc = new this.__lnrpc.Lightning(this.__domainPort, this.__credentials);
        await awaitConnection(this.__mainRpc, 40); // 40 retries x 500 ms
    }
    async toUnlocker() {
        this.__mainRpc.close();
        this.__mainRpc = null;
        this.__unlockerRpc = new this.__lnrpc.WalletUnlocker(this.__domainPort, this.__credentials);
        await awaitConnection(this.__unlockerRpc, 40); // 40 retries x 500 ms
    }
    // WalletUnlocker service helper functions. Used for the gRPC server started at
    // boot time for LND. Once a wallet has been unlocked/created/restored, toMain()
    // should be called and the Lightning service should be used.
    // (LND actually shuts down this gRPC server, and creates a new one, so toMain()
    // must be called to get node-gRPC to re-connect to the new server.)
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
    async restore(aezeedStr, walletPw, aezeedPw) {
        assert(this.__unlockerRpc, 'restore requires toUnlocker()');
        assert(aezeedStr, 'restore requires aezeed phrase');
        assert(walletPw, 'restore requires a wallet unlock password');
        if (aezeedPw === undefined)
            aezeedPw = 'aezeed';
        const cipherSeedMnemonic = aezeedStr.split(/\s+/);
        return initWallet(this.__unlockerRpc, walletPw, cipherSeedMnemonic, aezeedPw);
    }
    async unlock(password) {
        assert(this.__unlockerRpc, 'unlock requires toUnlocker()');
        assert(password, 'unlock requires password');
        return new Promise((resolve, reject) => {
            this.__unlockerRpc.unlockWallet({ walletPassword: Buffer.from(password, 'utf8') }, promiseFunction(resolve, reject));
        });
    }
    async changePassword(currentPassword, newPassword) {
        assert(this.__unlockerRpc, 'changePassword requires toUnlocker()');
        assert(currentPassword, 'changePassword requires oldPassword');
        assert(newPassword, 'changePassword requires oldPassword');
        return new Promise((resolve, reject) => {
            this.__unlockerRpc.changePassword({
                currentPassword: Buffer.from(currentPassword, 'utf8'),
                newPassword: Buffer.from(newPassword, 'utf8')
            }, promiseFunction(resolve, reject));
        });
    }
    // Lightning service helper functions. Primarily just offering them all in
    // async / await, but for some of the more common operations I will create
    // helper functions for convenience.
    async send(paymentRequest) {
        assert(this.__mainRpc, 'send requires toMain()');
        let res = await this.sendPayment({ paymentRequest });
        return Object.assign(res, { decodedPayReq: lnPayReq.decode(paymentRequest) });
    }
    async open(nodePubkeyString, localFundingAmount, pushSat) {
        assert(this.__mainRpc, 'open requires toMain()');
        let opts = { nodePubkeyString, localFundingAmount: Long.fromNumber(localFundingAmount) };
        if (pushSat !== undefined)
            opts = Object.assign(opts, { pushSat });
        return this.openChannel(opts);
    }
    async request(satoshis) {
        assert(this.__mainRpc, 'request requires toMain()');
        return this.addInvoice({ value: Long.fromNumber(satoshis) });
    }
    async check(rHashStr) {
        assert(this.__mainRpc, 'check requires toMain()');
        return this.lookupInvoice({ rHashStr });
    }
    async channelBandwidth() {
        assert(this.__mainRpc, 'channelBandwidth requires toMain()');
        return this.listChannels({ activeOnly: true })
            .then(response => ({
            bandwidth: response.channels.reduce((total, item) => { return total.add(item.remoteBalance); }, Long.fromInt(0))
        }));
    }
    // Lightning service direct RPC calls
    async getInfo() {
        assert(this.__mainRpc, 'getInfo requires toMain()');
        return new Promise((resolve, reject) => {
            this.__mainRpc.getInfo({}, this.__meta, promiseFunction(resolve, reject));
        });
    }
    async listChannels(opts) {
        assert(this.__mainRpc, 'listChannels requires toMain()');
        return new Promise((resolve, reject) => {
            this.__mainRpc.listChannels(opts || {}, this.__meta, promiseFunction(resolve, reject));
        });
    }
    async channelBalance() {
        assert(this.__mainRpc, 'channelBalance requires toMain()');
        return new Promise((resolve, reject) => {
            this.__mainRpc.channelBalance({}, this.__meta, promiseFunction(resolve, reject));
        });
    }
    async walletBalance() {
        assert(this.__mainRpc, 'walletBalance requires toMain()');
        return new Promise((resolve, reject) => {
            this.__mainRpc.walletBalance({}, this.__meta, promiseFunction(resolve, reject));
        });
    }
    async newAddress(opts) {
        assert(this.__mainRpc, 'newAddress requires toMain()');
        opts = opts || {};
        if (opts.type === undefined) {
            opts = Object.assign(opts, { type: 1 });
        }
        else {
            switch (opts.type) {
                case 'p2wkh':
                    opts.type = 0;
                    break;
                case 'np2wkh':
                    opts.type = 1;
                    break;
                case 0:
                    break;
                case 1:
                    break;
                default:
                    throw new Error('newAddress type must be np2wkh or p2wkh');
            }
        }
        return new Promise((resolve, reject) => {
            this.__mainRpc.newAddress(opts, this.__meta, promiseFunction(resolve, reject));
        });
    }
    async openChannel(opts) {
        assert(this.__mainRpc, 'openChannel requires toMain()');
        assert(opts, 'openChannel requires opts');
        assert(opts.nodePubkey || opts.nodePubkeyString, 'openChannel requires nodePubkey or string');
        assert(opts.localFundingAmount, 'openChannel requires opts.localFundingAmount');
        return new Promise((resolve, reject) => {
            this.__mainRpc.openChannelSync(opts, this.__meta, promiseFunction(resolve, reject));
        });
    }
    async sendPayment(opts) {
        assert(this.__mainRpc, 'sendPayment requires toMain()');
        assert(opts, 'sendPayment requires opts');
        assert(opts.paymentRequest, 'sendPayment requires opts.paymentRequest');
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
        assert(opts.rHashStr, 'lookupInvoice requires opts.rHashStr');
        return new Promise((resolve, reject) => {
            this.__mainRpc.lookupInvoice(opts, this.__meta, promiseFunction(resolve, reject));
        });
    }
    async decodePayReq(opts) {
        assert(this.__mainRpc, 'decodePayReq requires toMain()');
        assert(opts, 'decodePayReq requires opts');
        assert(opts.payReq, 'decodePayReq requires opts.payReq');
        return new Promise((resolve, reject) => {
            this.__mainRpc.decodePayReq(opts, this.__meta, promiseFunction(resolve, reject));
        });
    }
}
exports.LightningRpc = LightningRpc;
async function awaitConnection(client, maxRetries) {
    let retries = 0;
    while (!(await awaitReadyClient(client, 500))) {
        if (retries >= maxRetries)
            throw new Error('Couldn\'t connect to the gRPC server.');
        await sleep(500);
        retries++;
    }
}
async function awaitReadyClient(client, timeout) {
    return (new Promise((resolve, reject) => {
        client.waitForReady(timeout, promiseFunction(resolve, reject));
    })).then(() => true, () => false);
}
async function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}
function convertBufferToHex(response) {
    if (typeof response !== 'object')
        return response;
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
