import fs from 'fs';
import path from 'path';

/**
 * Script to extract active wallets from wallet activity CSV
 * and create a clean master list of active wallets
 */

function extractActiveWallets() {
    const inputFile = 'wallets/wallet-activity.csv';
    const outputFile = 'wallets/active-master-list.csv';
    
    try {
        // Read the input CSV file
        console.log('Reading wallet activity data...');
        const csvData = fs.readFileSync(inputFile, 'utf8');
        
        // Split into lines and get header
        const lines = csvData.trim().split('\n');
        const header = lines[0];
        const dataLines = lines.slice(1);
        
        console.log(`Processing ${dataLines.length} wallet records...`);
        
        // Filter for active wallets
        const activeWallets = [];
        let activeCount = 0;
        
        dataLines.forEach((line, index) => {
            const columns = line.split(',');
            
            // Find the is_active column (index 5 based on the structure)
            const isActive = columns[5];
            
            if (isActive === 'true') {
                activeCount++;
                // Extract only the wallet address
                const walletAddress = columns[0];
                activeWallets.push(walletAddress);
            }
        });
        
        console.log(`Found ${activeCount} active wallets out of ${dataLines.length} total wallets`);
        
        // Create clean CSV output with only wallet addresses
        const outputHeader = 'wallet_address';
        const outputLines = [outputHeader];
        
        activeWallets.forEach(walletAddress => {
            outputLines.push(walletAddress);
        });
        
        // Write to output file
        const outputContent = outputLines.join('\n');
        fs.writeFileSync(outputFile, outputContent);
        
        console.log(`✅ Successfully created active master list: ${outputFile}`);
        console.log(`📊 Statistics:`);
        console.log(`   - Total wallets processed: ${dataLines.length}`);
        console.log(`   - Active wallets found: ${activeCount}`);
        console.log(`   - Percentage active: ${((activeCount / dataLines.length) * 100).toFixed(2)}%`);
        
        // Show sample of active wallets
        console.log(`\n📋 Sample of active wallets (first 5):`);
        activeWallets.slice(0, 5).forEach((walletAddress, index) => {
            console.log(`   ${index + 1}. ${walletAddress}`);
        });
        
        return {
            totalProcessed: dataLines.length,
            activeFound: activeCount,
            outputFile: outputFile
        };
        
    } catch (error) {
        console.error('❌ Error processing wallet data:', error.message);
        throw error;
    }
}

// Run the extraction
extractActiveWallets();

export { extractActiveWallets };