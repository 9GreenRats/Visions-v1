import { Alchemy, Network } from 'alchemy-sdk';
import { readFileSync, writeFileSync, existsSync, appendFileSync } from 'fs';
import { join } from 'path';
import dotenv from 'dotenv';

dotenv.config();

const config = {
    apiKey: process.env.ALCHEMY_API_KEY,
    network: Network.ETH_MAINNET,
};

const alchemy = new Alchemy(config);

// Activity thresholds (configurable)
const ACTIVITY_THRESHOLDS = {
    MIN_BALANCE_ETH: 0.001,        // Minimum ETH balance to be considered active
    MIN_TRANSACTION_COUNT: 5,      // Minimum transaction count
    DAYS_SINCE_LAST_TX: 90        // Days since last transaction to be considered inactive
};

function loadMasterWallets() {
    console.log('📖 Loading master wallet list...');

    try {
        const masterFile = join('wallets', 'master-holders.csv');
        const content = readFileSync(masterFile, 'utf-8');
        const wallets = content
            .split('\n')
            .map(addr => addr.trim().toLowerCase())
            .filter(addr => addr.length > 0 && addr.startsWith('0x'));

        console.log(`   Found ${wallets.length} unique wallet addresses\n`);
        return wallets;

    } catch (error) {
        console.error(`❌ Error loading master wallets: ${error.message}`);
        return [];
    }
}

function initializeActivityCSV() {
    const csvFile = join('wallets', 'wallet-activity.csv');
    const progressFile = join('wallets', 'activity-progress.json');

    let processedWallets = new Set();
    let totalCleaned = 0;
    let startIndex = 0;

    // Check if we're resuming from a previous run
    if (existsSync(progressFile)) {
        try {
            const progress = JSON.parse(readFileSync(progressFile, 'utf-8'));
            processedWallets = new Set(progress.processedWallets || []);
            totalCleaned = progress.totalCleaned || 0;
            startIndex = progress.lastIndex || 0;

            console.log(`🔄 Resuming from previous run:`);
            console.log(`   Already processed: ${processedWallets.size} wallets`);
            console.log(`   Total cleaned so far: ${totalCleaned}`);
            console.log(`   Starting from index: ${startIndex}\n`);
        } catch (error) {
            console.log('⚠️  Could not load previous progress, starting fresh\n');
        }
    }

    // Initialize CSV with headers if it doesn't exist
    if (!existsSync(csvFile)) {
        const headers = 'wallet_address,eth_balance,transaction_count,last_transaction_date,days_since_last_tx,is_active,activity_score,check_timestamp\n';
        writeFileSync(csvFile, headers);
        console.log(`📄 Created new activity CSV: ${csvFile}\n`);
    } else {
        console.log(`📄 Using existing activity CSV: ${csvFile}\n`);
    }

    return { csvFile, progressFile, processedWallets, totalCleaned, startIndex };
}

async function checkWalletActivity(walletAddress) {
    try {
        // Get ETH balance
        const balance = await alchemy.core.getBalance(walletAddress);
        const ethBalance = parseFloat(balance.toString()) / Math.pow(10, 18);

        // Get transaction count
        const txCount = await alchemy.core.getTransactionCount(walletAddress);

        // Get recent transactions to find last activity
        let lastTxDate = null;
        let daysSinceLastTx = null;

        try {
            const recentTxs = await alchemy.core.getAssetTransfers({
                fromAddress: walletAddress,
                category: ['external', 'internal', 'erc20', 'erc721', 'erc1155'],
                maxCount: 1,
                order: 'desc'
            });

            if (recentTxs.transfers.length > 0) {
                const lastTx = recentTxs.transfers[0];
                lastTxDate = lastTx.metadata?.blockTimestamp || new Date().toISOString();
                const lastTxTime = new Date(lastTxDate);
                const now = new Date();
                daysSinceLastTx = Math.floor((now - lastTxTime) / (1000 * 60 * 60 * 24));
            }
        } catch (txError) {
            // If we can't get transaction history, we'll work with what we have
            console.log(`   ⚠️  Could not fetch transaction history for ${walletAddress}`);
        }

        // Determine activity status
        const isActive = (
            ethBalance >= ACTIVITY_THRESHOLDS.MIN_BALANCE_ETH &&
            txCount >= ACTIVITY_THRESHOLDS.MIN_TRANSACTION_COUNT &&
            (daysSinceLastTx === null || daysSinceLastTx <= ACTIVITY_THRESHOLDS.DAYS_SINCE_LAST_TX)
        );

        // Calculate activity score (0-100)
        let activityScore = 0;
        if (ethBalance >= ACTIVITY_THRESHOLDS.MIN_BALANCE_ETH) activityScore += 30;
        if (txCount >= ACTIVITY_THRESHOLDS.MIN_TRANSACTION_COUNT) activityScore += 30;
        if (daysSinceLastTx !== null && daysSinceLastTx <= ACTIVITY_THRESHOLDS.DAYS_SINCE_LAST_TX) activityScore += 40;

        return {
            walletAddress,
            ethBalance: ethBalance.toFixed(6),
            transactionCount: txCount,
            lastTransactionDate: lastTxDate || 'unknown',
            daysSinceLastTx: daysSinceLastTx || 'unknown',
            isActive,
            activityScore,
            checkTimestamp: new Date().toISOString()
        };

    } catch (error) {
        console.error(`   ❌ Error checking ${walletAddress}: ${error.message}`);
        return {
            walletAddress,
            ethBalance: 'error',
            transactionCount: 'error',
            lastTransactionDate: 'error',
            daysSinceLastTx: 'error',
            isActive: false,
            activityScore: 0,
            checkTimestamp: new Date().toISOString()
        };
    }
}

function writeActivityToCSV(csvFile, activityData) {
    const csvRow = `${activityData.walletAddress},${activityData.ethBalance},${activityData.transactionCount},${activityData.lastTransactionDate},${activityData.daysSinceLastTx},${activityData.isActive},${activityData.activityScore},${activityData.checkTimestamp}\n`;
    appendFileSync(csvFile, csvRow);
}

function updateProgress(progressFile, processedWallets, totalCleaned, currentIndex) {
    const progress = {
        processedWallets: Array.from(processedWallets),
        totalCleaned,
        lastIndex: currentIndex,
        lastUpdate: new Date().toISOString()
    };
    writeFileSync(progressFile, JSON.stringify(progress, null, 2));
}

async function main() {
    console.log('🚀 Starting Wallet Activity Scanner\n');
    console.log('='.repeat(60) + '\n');

    // Load wallet addresses
    const wallets = loadMasterWallets();

    if (wallets.length === 0) {
        console.log('❌ No wallets found to check');
        process.exit(1);
    }

    // Initialize CSV and progress tracking
    const { csvFile, progressFile, processedWallets, totalCleaned, startIndex } = initializeActivityCSV();

    console.log(`🎯 Activity Thresholds:`);
    console.log(`   Min ETH Balance: ${ACTIVITY_THRESHOLDS.MIN_BALANCE_ETH} ETH`);
    console.log(`   Min Transaction Count: ${ACTIVITY_THRESHOLDS.MIN_TRANSACTION_COUNT}`);
    console.log(`   Max Days Since Last TX: ${ACTIVITY_THRESHOLDS.DAYS_SINCE_LAST_TX} days\n`);

    let currentCleaned = totalCleaned;
    let processed = 0;

    // Process wallets starting from where we left off
    for (let i = startIndex; i < wallets.length; i++) {
        const wallet = wallets[i];

        // Skip if already processed
        if (processedWallets.has(wallet)) {
            continue;
        }

        processed++;
        const progress = ((i + 1) / wallets.length * 100).toFixed(1);

        console.log(`🔍 [${i + 1}/${wallets.length}] (${progress}%) Checking: ${wallet}`);

        try {
            // Check wallet activity
            const activityData = await checkWalletActivity(wallet);

            // Write immediately to CSV (crash-safe)
            writeActivityToCSV(csvFile, activityData);

            // Update counters
            processedWallets.add(wallet);
            if (activityData.isActive) {
                currentCleaned++;
            }

            // Log result
            const status = activityData.isActive ? '✅ ACTIVE' : '❌ INACTIVE';
            console.log(`   ${status} | Balance: ${activityData.ethBalance} ETH | TXs: ${activityData.transactionCount} | Score: ${activityData.activityScore}/100`);

            // Update progress every 10 wallets (crash-safe)
            if (processed % 10 === 0) {
                updateProgress(progressFile, processedWallets, currentCleaned, i);
                console.log(`   💾 Progress saved (${currentCleaned} active wallets found so far)\n`);
            }

            // Rate limiting to avoid API limits
            await new Promise(resolve => setTimeout(resolve, 200)); // 200ms delay

        } catch (error) {
            console.error(`   ❌ Failed to process ${wallet}: ${error.message}`);

            // Still write error entry to CSV
            const errorData = {
                walletAddress: wallet,
                ethBalance: 'error',
                transactionCount: 'error',
                lastTransactionDate: 'error',
                daysSinceLastTx: 'error',
                isActive: false,
                activityScore: 0,
                checkTimestamp: new Date().toISOString()
            };
            writeActivityToCSV(csvFile, errorData);
            processedWallets.add(wallet);
        }
    }

    // Final progress update
    updateProgress(progressFile, processedWallets, currentCleaned, wallets.length);

    console.log('\n🎉 Wallet Activity Scan Complete!');
    console.log(`   Total wallets checked: ${wallets.length}`);
    console.log(`   Active wallets found: ${currentCleaned}`);
    console.log(`   Inactive wallets: ${wallets.length - currentCleaned}`);
    console.log(`   Activity rate: ${(currentCleaned / wallets.length * 100).toFixed(1)}%`);
    console.log(`   Results saved to: ${csvFile}`);
    console.log(`   Progress file: ${progressFile}`);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n⚠️  Received interrupt signal. Progress has been saved.');
    console.log('   You can resume by running the script again.');
    process.exit(0);
});

process.on('unhandledRejection', (error) => {
    console.error('❌ Unhandled error:', error.message);
    console.log('   Progress has been saved. You can resume by running the script again.');
    process.exit(1);
});

main();