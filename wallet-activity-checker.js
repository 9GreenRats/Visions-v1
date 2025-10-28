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

// Activity thresholds - 6 months = 180 days
const ACTIVITY_THRESHOLDS = {
  MIN_BALANCE_ETH: 0.001,        // Minimum ETH balance to be considered active
  MIN_TRANSACTION_COUNT: 5,      // Minimum transaction count
  DAYS_SINCE_LAST_TX: 180        // 6 months since last transaction to be considered inactive
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

function initializeCleanedCSV() {
  const cleanedFile = join('wallets', 're-master-holders.csv');
  const progressFile = join('wallets', 're-cleaning-progress.json');
  
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
  
  // Initialize cleaned CSV if it doesn't exist
  if (!existsSync(cleanedFile)) {
    writeFileSync(cleanedFile, '');
    console.log(`📄 Created new re-master holders CSV: ${cleanedFile}\n`);
  } else {
    console.log(`📄 Using existing re-master holders CSV: ${cleanedFile}\n`);
  }
  
  return { cleanedFile, progressFile, processedWallets, totalCleaned, startIndex };
}

async function checkWalletActivity(walletAddress) {
  try {
    // Get ETH balance
    const balance = await alchemy.core.getBalance(walletAddress);
    const ethBalance = parseFloat(balance.toString()) / Math.pow(10, 18);
    
    // Get transaction count
    const txCount = await alchemy.core.getTransactionCount(walletAddress);
    
    // Get recent transactions to find last activity
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
        const lastTxDate = lastTx.metadata?.blockTimestamp || new Date().toISOString();
        const lastTxTime = new Date(lastTxDate);
        const now = new Date();
        daysSinceLastTx = Math.floor((now - lastTxTime) / (1000 * 60 * 60 * 24));
      }
    } catch (txError) {
      // If we can't get transaction history, we'll work with what we have
      console.log(`   ⚠️  Could not fetch transaction history for ${walletAddress}`);
    }
    
    // Determine if wallet is active (within 6 months)
    const isActive = (
      ethBalance >= ACTIVITY_THRESHOLDS.MIN_BALANCE_ETH &&
      txCount >= ACTIVITY_THRESHOLDS.MIN_TRANSACTION_COUNT &&
      (daysSinceLastTx === null || daysSinceLastTx <= ACTIVITY_THRESHOLDS.DAYS_SINCE_LAST_TX)
    );
    
    return {
      walletAddress,
      ethBalance: ethBalance.toFixed(6),
      transactionCount: txCount,
      daysSinceLastTx: daysSinceLastTx || 'unknown',
      isActive
    };
    
  } catch (error) {
    console.error(`   ❌ Error checking ${walletAddress}: ${error.message}`);
    return {
      walletAddress,
      ethBalance: 'error',
      transactionCount: 'error',
      daysSinceLastTx: 'error',
      isActive: false
    };
  }
}

function writeActiveWalletToCSV(cleanedFile, walletAddress) {
  appendFileSync(cleanedFile, walletAddress + '\n');
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
  console.log('🚀 Starting Wallet Activity Checker (6 Month Filter)\n');
  console.log('='.repeat(60) + '\n');
  
  // Load wallet addresses
  const wallets = loadMasterWallets();
  
  if (wallets.length === 0) {
    console.log('❌ No wallets found to check');
    process.exit(1);
  }
  
  // Initialize cleaned CSV and progress tracking
  const { cleanedFile, progressFile, processedWallets, totalCleaned, startIndex } = initializeCleanedCSV();
  
  console.log(`🎯 Activity Thresholds (6 Month Filter):`);
  console.log(`   Min ETH Balance: ${ACTIVITY_THRESHOLDS.MIN_BALANCE_ETH} ETH`);
  console.log(`   Min Transaction Count: ${ACTIVITY_THRESHOLDS.MIN_TRANSACTION_COUNT}`);
  console.log(`   Max Days Since Last TX: ${ACTIVITY_THRESHOLDS.DAYS_SINCE_LAST_TX} days (6 months)\n`);
  
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
      
      // If wallet is active, write immediately to re-master CSV (crash-safe)
      if (activityData.isActive) {
        writeActiveWalletToCSV(cleanedFile, wallet);
        currentCleaned++;
        console.log(`   ✅ PASSED - Written to re-master holders immediately`);
      }
      
      // Update counters
      processedWallets.add(wallet);
      
      // Log result (only for inactive wallets since active ones are logged above)
      if (!activityData.isActive) {
        console.log(`   ❌ FAILED | Balance: ${activityData.ethBalance} ETH | TXs: ${activityData.transactionCount} | Days: ${activityData.daysSinceLastTx}`);
      }
      
      // Update progress every 5 wallets (more frequent saves for crash-safety)
      if (processed % 5 === 0) {
        updateProgress(progressFile, processedWallets, currentCleaned, i);
        console.log(`   💾 Progress saved (${currentCleaned} active wallets written to re-master holders so far)\n`);
      }
      
      // Rate limiting to avoid API limits
      await new Promise(resolve => setTimeout(resolve, 200)); // 200ms delay
      
    } catch (error) {
      console.error(`   ❌ Failed to process ${wallet}: ${error.message}`);
      processedWallets.add(wallet);
    }
  }
  
  // Final progress update
  updateProgress(progressFile, processedWallets, currentCleaned, wallets.length);
  
  console.log('\n🎉 Wallet Activity Check Complete!');
  console.log(`   Total wallets checked: ${wallets.length}`);
  console.log(`   Active wallets (6 months): ${currentCleaned}`);
  console.log(`   Inactive wallets: ${wallets.length - currentCleaned}`);
  console.log(`   Activity rate: ${(currentCleaned / wallets.length * 100).toFixed(1)}%`);
  console.log(`   Re-master holders saved to: ${cleanedFile}`);
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