"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const web3 = __importStar(require("@solana/web3.js"));
const dotenv = __importStar(require("dotenv"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const bs58_1 = __importDefault(require("bs58"));
// Load environment variables
dotenv.config();
// Use a directory the user has access to
const homeDir = os.homedir();
const logDir = path.join(homeDir, "logs", "solana-airdrop");
// Create log directory if it doesn't exist
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}
// Configuration
const AIRDROP_INTERVAL_HOURS = parseInt(process.env.AIRDROP_INTERVAL_HOURS || "3", 10);
const AIRDROP_AMOUNT_SOL = parseFloat(process.env.AIRDROP_AMOUNT_SOL || "1");
const RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 5000;
// Setup logger
const logger = {
    log: (message) => {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] ${message}`;
        console.log(logMessage);
        const logFile = path.join(logDir, `airdrop-${new Date().toISOString().split("T")[0]}.log`);
        fs.appendFileSync(logFile, logMessage + "\n");
    },
    error: (message, error) => {
        const timestamp = new Date().toISOString();
        const errorDetails = error ? `\n${error.stack || error}` : "";
        const logMessage = `[${timestamp}] ERROR: ${message}${errorDetails}`;
        console.error(logMessage);
        const logFile = path.join(logDir, `airdrop-errors-${new Date().toISOString().split("T")[0]}.log`);
        fs.appendFileSync(logFile, logMessage + "\n");
    },
};
// Creates a keypair from a seed phrase or private key
function createKeypairFromSeed(seedOrPrivateKey) {
    try {
        const uIntPrivateKey = bs58_1.default.decode(seedOrPrivateKey);
        return web3.Keypair.fromSecretKey(uIntPrivateKey);
    }
    catch (e) {
        logger.error("Error creating keypair from seed", e);
        throw e;
    }
}
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Validate environment variables
            const privateKeyString = process.env.WALLET_PRIVATE_KEY;
            if (!privateKeyString) {
                throw new Error("WALLET_PRIVATE_KEY environment variable is not set");
            }
            // Generate keypair directly instead of trying to parse the existing key
            // This will create a new keypair for testing purposes
            const keypair = createKeypairFromSeed(privateKeyString);
            const publicKey = keypair.publicKey;
            logger.log(`WARNING: Using a generated keypair instead of the provided private key`);
            logger.log(`If you need to use a specific private key, you may need to format it correctly`);
            // Connect to Solana devnet
            const connection = new web3.Connection("http://127.0.0.1:8899");
            // Log wallet information
            logger.log(`Starting Solana airdrop service`);
            logger.log(`Wallet public key: ${publicKey.toString()}`);
            logger.log(`Airdrop interval: ${AIRDROP_INTERVAL_HOURS} hours`);
            logger.log(`Airdrop amount: ${AIRDROP_AMOUNT_SOL} SOL`);
            logger.log(`Log directory: ${logDir}`);
            // Schedule airdrop
            scheduleAirdrop(connection, publicKey);
        }
        catch (error) {
            logger.error("Failed to initialize airdrop service", error);
            process.exit(1);
        }
    });
}
function scheduleAirdrop(connection, publicKey) {
    // Convert hours to milliseconds
    const intervalMs = AIRDROP_INTERVAL_HOURS * 60 * 60 * 1000;
    // Execute initial airdrop
    requestAirdrop(connection, publicKey);
    // Schedule recurring airdrops
    setInterval(() => {
        requestAirdrop(connection, publicKey);
    }, intervalMs);
}
function requestAirdrop(connection, publicKey) {
    return __awaiter(this, void 0, void 0, function* () {
        // Convert SOL to lamports (1 SOL = 1 billion lamports)
        const lamports = web3.LAMPORTS_PER_SOL * AIRDROP_AMOUNT_SOL;
        for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
            try {
                logger.log(`Requesting airdrop of ${AIRDROP_AMOUNT_SOL} SOL to ${publicKey.toString()}`);
                // Request airdrop
                const signature = yield connection.requestAirdrop(publicKey, lamports);
                logger.log(`Airdrop requested with signature: ${signature}`);
                // Wait for confirmation
                logger.log("Waiting for transaction confirmation...");
                yield connection.confirmTransaction(signature, "confirmed");
                // Get updated balance
                const balance = yield connection.getBalance(publicKey);
                const balanceInSol = balance / web3.LAMPORTS_PER_SOL;
                logger.log(`Airdrop successful! Current balance: ${balanceInSol} SOL`);
                return;
            }
            catch (error) {
                if (attempt < RETRY_ATTEMPTS) {
                    logger.error(`Airdrop attempt ${attempt} failed, retrying in ${RETRY_DELAY_MS / 1000} seconds...`, error);
                    yield new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
                }
                else {
                    logger.error(`All airdrop attempts failed`, error);
                }
            }
        }
    });
}
// Handle process signals
process.on("SIGINT", () => {
    logger.log("Service stopped by user");
    process.exit(0);
});
process.on("SIGTERM", () => {
    logger.log("Service terminated");
    process.exit(0);
});
// Start the application
main().catch((err) => {
    logger.error("Unhandled error in main process", err);
    process.exit(1);
});
