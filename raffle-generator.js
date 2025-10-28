import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Raffle Generator Script
 * Randomly selects half the wallets from master-holders.csv and saves them to raffle.csv
 */

function generateRaffle() {
    try {
        // Read the master holders file
        const masterHoldersPath = path.join(__dirname, 'wallets', 'master-holders.csv');
        const raffleOutputPath = path.join(__dirname, 'wallets', 'raffle.csv');
        
        if (!fs.existsSync(masterHoldersPath)) {
            console.error('❌ master-holders.csv not found in wallets directory');
            return;
        }

        // Read and parse the CSV file
        const fileContent = fs.readFileSync(masterHoldersPath, 'utf8');
        const wallets = fileContent
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0); // Remove empty lines

        console.log(`📊 Total wallets in master-holders.csv: ${wallets.length}`);

        if (wallets.length === 0) {
            console.error('❌ No wallets found in master-holders.csv');
            return;
        }

        // Calculate how many wallets to select (half, rounded up)
        const raffleSize = Math.ceil(wallets.length / 2);
        console.log(`🎲 Selecting ${raffleSize} wallets for raffle`);

        // Shuffle the array using Fisher-Yates algorithm for true randomness
        const shuffledWallets = [...wallets];
        for (let i = shuffledWallets.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffledWallets[i], shuffledWallets[j]] = [shuffledWallets[j], shuffledWallets[i]];
        }

        // Select the first half of shuffled wallets
        const raffleWinners = shuffledWallets.slice(0, raffleSize);

        // Write to raffle.csv
        const raffleContent = raffleWinners.join('\n');
        fs.writeFileSync(raffleOutputPath, raffleContent);

        console.log(`✅ Raffle generated successfully!`);
        console.log(`📁 Output saved to: ${raffleOutputPath}`);
        console.log(`🎯 Selected ${raffleWinners.length} wallets out of ${wallets.length} total`);
        
        // Show first few winners as preview
        console.log('\n🏆 First 5 raffle winners:');
        raffleWinners.slice(0, 5).forEach((wallet, index) => {
            console.log(`   ${index + 1}. ${wallet}`);
        });
        
        if (raffleWinners.length > 5) {
            console.log(`   ... and ${raffleWinners.length - 5} more`);
        }

    } catch (error) {
        console.error('❌ Error generating raffle:', error.message);
    }
}

// Run the raffle generator
console.log('🎰 Starting Raffle Generator...\n');
generateRaffle();

export { generateRaffle };