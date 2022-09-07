const XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
const config = require("./config/config");

const { Secp256k1HdWallet
} = require("@cosmjs/amino");
const {
    SigningStargateClient,
    GasPrice
} = require("@cosmjs/stargate");
const {
    stringToPath
} = require("@cosmjs/crypto");

const valMnemonic = process.env.FAUCET_MNEMONIC;
const msgSendTypeUrl = "/cosmos.bank.v1beta1.MsgMultiSend";
const {
    MsgMultiSend,
    fromPartial
} = require("cosmjs-types/cosmos/bank/v1beta1/tx");
const Long = require("long")


/*
OsmoJS test for voting
*/
const { getSigningOsmosisClient, osmosis, cosmos } = require('osmojs');
//const { SigningStargateClient } = require('@cosmjs/stargate');


const messages = {
    // osmosis
    // ...osmosis.gamm.v1beta1.MessageComposer.withTypeUrl,
    // ...osmosis.superfluid.MessageComposer.withTypeUrl,
    // ...osmosis.lockup.MessageComposer.withTypeUrl,
    // cosmos
    // ...cosmos.distribution.v1beta1.MessageComposer.fromPartial,
    // ...cosmos.bank.v1beta1.MessageComposer.fromPartial,
    // ...cosmos.staking.v1beta1.MessageComposer.fromPartial,
    ...cosmos.gov.v1beta1.MessageComposer.fromPartial
};

//   const osmoClient = SigningStargateClient = await getSigningOsmosisClient({
//     rpcEndpoint: rpc,
//     signer // OfflineSigner
//   });

/*
    Redis Connection
    Default no credential to local host
 */
const redis = require('ioredis')
const client = redis.createClient({
    host: config.redisHost,
    port: config.redisPort,
})
client.on('connect', function () {
    console.log('Redis connected');
});


/*
    Remove whitespaces from string
 */
function trimWhiteSpaces(data) {
    return data.split(' ').join('');
}

/*
    Compose message
 */
function msg(inputs, outputs) {
    return {
        typeUrl: msgSendTypeUrl,
        value: MsgMultiSend.fromPartial({
            inputs: [{
                address: trimWhiteSpaces(inputs), //fromAddress
                coins: [{
                    denom: config.DENOM,
                    amount: (outputs.length * parseInt(config.AMOUNT)).toString(),
                },],
            },],
            outputs: outputs, //toAddress
        }),
    }
}

/*
    Compose vote message
 */
function votemsg(inputs, outputs) {
    return {
        typeUrl: msgSendTypeUrl,
        value: MsgMultiSend.fromPartial({
            inputs: [{
                address: trimWhiteSpaces(inputs), //fromAddress
                coins: [{
                    denom: config.DENOM,
                    amount: (outputs.length * parseInt(config.AMOUNT)).toString(),
                },],
            },],
            outputs: outputs, //toAddress
        }),
    }
}

/*
    Sign and broadcast message
 */
async function signAndBroadcast(wallet, signerAddress, msgs, fee, memo = '') {
    const cosmJS = await SigningStargateClient.connectWithSigner(config.rpcEndpoint, wallet);
    return await cosmJS.signAndBroadcast(signerAddress, msgs, fee, memo); //DeliverTxResponse, 0 iff success
}

async function processTransaction(wallet, addr, msgs) {
    try {
        let faucetQueue
        faucetQueue = await getFaucetQueue();
        const response = await signAndBroadcast(
            wallet,
            addr,
            [msgs], {
            "amount": [{
                amount: (parseInt(config.gas) * GasPrice.fromString(config.gas_price).amount).toString(),
                denom: config.DENOM
            }],
            "gas": config.gas
        },
            "Thanks for using Osmosis Faucet"
        );
        faucetQueue.forEach(function (address) {
            removeFromQueue(address)
        })
    } catch (err) {
        console.error('Unable to process transaction')
        throw err
    }
}

async function voteTransaction(wallet, addr, msgs) {
    try {
        let faucetQueue
        faucetQueue = await getFaucetQueue();
        const response = await signAndBroadcast(
            wallet,
            addr,
            [msgs], {
            "amount": [{
                amount: (parseInt(config.gas) * GasPrice.fromString(config.gas_price).amount).toString(),
                denom: config.DENOM
            }],
            "gas": config.gas
        },
            "Thanks for using Osmosis Faucet"
        );
        faucetQueue.forEach(function (address) {
            removeFromQueue(address)
        })
    } catch (err) {
        console.error('Unable to process transaction')
        throw err
    }
}


async function MnemonicWalletWithPassphrase(mnemonic) {
    const wallet = await Secp256k1HdWallet.fromMnemonic(mnemonic, {
        prefix: config.prefix,
        bip39Password: '',
        hdPaths: [stringToPath(config.HD_PATH)]
    });
    const [firstAccount] = await wallet.getAccounts();
    return [wallet, firstAccount.address];
}

async function validateAccount(userAddress) {
    let xmlHttp = new XMLHttpRequest();
    xmlHttp.open("GET", config.restEndpoint + "/cosmos/auth/v1beta1/accounts/" + userAddress, false); // false for synchronous request
    xmlHttp.send(null);
    const accountResponse = JSON.parse(xmlHttp.responseText);
    console.log("Account Validation Response")
    console.log(accountResponse)
    return accountResponse
}

async function getFaucetQueue() {
    let faucetQueue
    try {
        faucetQueue = await client.lrange('faucetQueue', 0, -1)
        console.log("Getting Faucet Queue")
        console.log(faucetQueue);
        return faucetQueue
    } catch (err) {
        console.error('Unable to get queue')
        throw err
    }
}

async function getVoteQueue() {
    let voteQueue
    try {
        voteQueue = await client.lrange('voteQueue', 0, -1)
        console.log("Getting Voting Queue")
        console.log(voteQueue);
        return voteQueue
    } catch (err) {
        console.error('Unable to get vote queue')
        throw err
    }
}

async function addToQueue(userAddress) {
    let addQueue
    try {
        addQueue = await client.lpush(['faucetQueue', userAddress])
        console.log(userAddress, "ADDED TO LIST Count:", +addQueue);
    } catch (err) {
        console.error('addQueue: could not increment key')
        throw err
    }
}

async function addToVoteQueue(codeId) {
    let addQueue
    try {
        addQueue = await client.lpush(['voteQueue', codeId])
        console.log(codeId, "Vote added - Count:", +addQueue);
    } catch (err) {
        console.error('addQueue: could not increment key')
        throw err
    }
}

async function removeFromQueue(address) {
    console.log("Removing address" + address)
    let removeFromQueue
    try {
        removeFromQueue = await client.lrem('faucetQueue', -1, address)
        console.log("removeFromQueue")
        console.log(removeFromQueue);
    } catch (err) {
        console.error('isOverLimit: could not increment key')
        throw err
    }

}


async function removeFromVotingQueue(codeId) {
    console.log("Removing code id" + codeId)
    let removeFromQueue
    try {
        removeFromQueue = await client.lrem('voteQueue', -1, codeId)
        console.log("removeFromQueue")
        console.log(removeFromQueue);
    } catch (err) {
        console.error('isOverLimit: could not increment key')
        throw err
    }

}

function runner() {
    setInterval(async function () {

        /*
        Faucet Queue
        */
        let faucetQueue
        faucetQueue = await getFaucetQueue();
        if (faucetQueue.length > 0) {
            try {
                let [wallet, addr] = await MnemonicWalletWithPassphrase(mnemonic);
                let outputs = [];
                faucetQueue.forEach(receiver => outputs.push({
                    address: trimWhiteSpaces(receiver),
                    coins: [{
                        denom: config.DENOM,
                        amount: config.AMOUNT,
                    },],
                }));
                const msgs = msg(addr, outputs);
                await processTransaction(wallet, addr, msgs)

            } catch (e) {
                console.log("Transaction Failed: ", e);
            }
        } else {
            console.log("No Accounts to faucet");
            console.log(config.faucetQueue);
        }

        /*
        Voting Queue
        */

        let voteQueue
        voteQueue = await getVoteQueue();

        if (voteQueue.length > 0) {
            try {
                let [wallet, addr] = await MnemonicWalletWithPassphrase(valMnemonic);

                for (const codeId of voteQueue) {

                    console.log("Voting for" + codeId);

                    const voteMsg = messages.vote({
                        proposalId: "" + codeId + "",
                        voter: addr,
                        option: 1,
                    });

                    console.log(voteMsg)

                    try {
                        const response = await signAndBroadcast(
                            wallet,
                            addr,
                            [voteMsg],
                            {
                                "amount": [{
                                    amount: (parseInt(config.gas) * GasPrice.fromString(config.gas_price).amount).toString(),
                                    denom: config.DENOM
                                }],
                                "gas": config.gas
                            },
                            "Thanks for using Osmosis Faucet"
                        );
                        console.log(response)
                        console.log(response)


                    } catch (err) {
                        console.error('Unable to process transaction')
                        throw err
                    }

                    removeFromVotingQueue(codeId)
                };

                // const msgs = votemsg(addr);
                // await voteTransaction(wallet,addr,msgs)

            } catch (e) {
                console.log("Transaction Failed: ", e);
            }

        } else {
            console.log("No Accounts to faucet");
            console.log(config.faucetQueue);
        }

    }, 7000);
}

function secondsToHms(d) {
    d = Number(d);
    let h = Math.floor(d / 3600);
    let m = Math.floor(d % 3600 / 60);
    let s = Math.floor(d % 3600 % 60);

    let hDisplay = h > 0 ? h + (h == 1 ? " hour, " : " hours ") : "";
    let mDisplay = m > 0 ? m + (m == 1 ? " minute, " : " minutes ") : "";
    let sDisplay = s > 0 ? s + (s == 1 ? " second" : " seconds") : "";
    return hDisplay + mDisplay + sDisplay;
}

async function handleFaucetRequest(req) {
    let userAddress = req.body.address
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress

    try {
        let ipCount
        try {
            ipCount = await client.incr(ip)
        } catch (err) {
            console.error('ipCount: could not increment key')
            throw err
        }
        console.log(`${ip} has value: ${ipCount}`)

        if (ipCount > config.MAX_PER_IP) {
            console.log("Ip is over limits")
            client.expire(ip, config.TIME_LIMIT)
            return JSON.stringify({
                status: "error",
                message: "You have requested " + ipCount + " times. The limit  " + config.MAX_PER_IP + " per " + secondsToHms(config.TIME_LIMIT) + ""
            });
        } else {
            let accountResponse
            accountResponse = await validateAccount(userAddress);

            // If we get any code then report it, except 5 which means no account exist which is fine to send to a new account.
            if (accountResponse.code && accountResponse.code !== 5) {
                return JSON.stringify({
                    status: "error",
                    message: accountResponse.message
                });
            } else if (ipCount < config.MAX_PER_IP) {
                let [wallet, addr] = await MnemonicWalletWithPassphrase(mnemonic);
                await addToQueue(userAddress);
                return JSON.stringify({
                    status: "success",
                    message: "Success, your address " + userAddress + " will receive funds shortly from " + addr + ""
                });
            } else {
                console.log("error")
                console.log(accountResponse);
                return JSON.stringify({
                    status: "error", message: "Your account cannot get funds at this time. "
                });
            }
        }
    } catch (e) {
        console.log(e);
        return JSON.stringify({
            status: "error",
            message: e.toString()
        });
    }

}


async function handleFaucetVote(req) {
    let codeId = req.body.code_id
    let vote = req.body.vote
    // const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress
    const ip = "demo"
    try {
        let voteCount
        try {
            voteCount = await client.incr(ip + '_vote')
        } catch (err) {
            console.error('voteCount: could not increment key')
            throw err
        }
        console.log(`${ip} has value: ${voteCount}`)

        if (voteCount > config.MAX_VOTE_PER_IP) {
            console.log("voteCount is over limits")
            client.expire(ip, config.TIME_LIMIT)
            return JSON.stringify({
                status: "error",
                message: "You have voted " + voteCount + " times. The limit  " + config.MAX_VOTE_PER_IP + " per " + secondsToHms(config.TIME_LIMIT) + ""
            });
        } else {
            if (voteCount < config.MAX_VOTE_PER_IP) {
                await addToVoteQueue(codeId);
                return JSON.stringify({
                    status: "success",
                    message: "Success, your contract " + codeId + " will receive a vote shortly from the faucet"
                });
            } else {
                console.log("error")
                return JSON.stringify({
                    status: "error", message: "Your cannot vote at this time. "
                });
            }
        }
    } catch (e) {
        console.log(e);
        return JSON.stringify({
            status: "error",
            message: e.toString()
        });
    }

}

async function getQueue() {
    let getQueue
    getQueue = await getFaucetQueue();
    console.log(getQueue)
    return getQueue;
}

module.exports = {
    runner,
    handleFaucetRequest,
    handleFaucetVote,
    MnemonicWalletWithPassphrase,
    processTransaction,
    getQueue
};
