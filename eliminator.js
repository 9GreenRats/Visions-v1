import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const PROGRESS_FILE = 'wallets/eliminator-progress.json';
const COMPILATION_FILE = 'compilation.txt';

function loadProgress() {
    if (existsSync(PROGRESS_FILE)) {
        try {
            const progress = JSON.parse(readFileSync(PROGRESS_FILE, 'utf-8'));
            console.log('📋 Resuming from previous progress...');
            return progress;
        } catch (error) {
            console.log('⚠️  Progress file corrupted, starting fresh...');
        }
    }
    return {
        processedArtists: [],
        eliminatedCollections: [],
        totalWallets: new Set(),
        startTime: new Date().toISOString()
    };
}

function saveProgress(progress) {
    writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

function parseSummaryReport() {
    console.log('📖 Reading summary report for collection data...');

    const summaryFile = join('wallets', 'summary-report.txt');
    const content = readFileSync(summaryFile, 'utf-8');
    const lines = content.split('\n');

    const artistCollections = {};
    let currentArtist = null;
    let pendingCollectionName = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();

        // Check for artist header
        if (trimmedLine.startsWith('ARTIST: ')) {
            currentArtist = trimmedLine.replace('ARTIST: ', '').toLowerCase();
            artistCollections[currentArtist] = [];
            pendingCollectionName = null;
            continue;
        }

        // Check for collection name
        if (line.startsWith('  ') &&
            !trimmedLine.startsWith('Contract:') &&
            !trimmedLine.startsWith('Holders:') &&
            !trimmedLine.startsWith('ARTIST') &&
            !trimmedLine.startsWith('COLLECTIONS:') &&
            currentArtist &&
            trimmedLine.length > 0) {
            pendingCollectionName = trimmedLine;
            continue;
        }

        // Check for holders count
        if (trimmedLine.startsWith('Holders: ') && currentArtist && pendingCollectionName) {
            const holdersMatch = trimmedLine.match(/Holders: ([\d,]+)/);
            if (holdersMatch) {
                const holders = parseInt(holdersMatch[1].replace(/,/g, ''));
                artistCollections[currentArtist].push({
                    name: pendingCollectionName,
                    holders: holders
                });
                pendingCollectionName = null;
            }
        }
    }

    console.log(`   Found collections for ${Object.keys(artistCollections).length} artists\n`);
    return artistCollections;
}

function getCollectionFolderName(collectionName) {
    return collectionName
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function processArtist(artistName, artistCollections, progress) {
    const artistFolder = join('wallets', artistName.toLowerCase());

    if (!existsSync(artistFolder)) {
        console.log(`⚠️  No folder found for ${artistName}`);
        return;
    }

    console.log(`🎨 Processing ${artistName}...`);

    // Get collections for this artist
    const collections = artistCollections[artistName.toLowerCase()] || [];

    // Find collections with less than 10 holders
    const collectionsToEliminate = collections.filter(col => col.holders < 10);
    const collectionsToKeep = collections.filter(col => col.holders >= 10);

    if (collectionsToEliminate.length > 0) {
        console.log(`   🗑️  Eliminating ${collectionsToEliminate.length} collections with <10 holders:`);
        collectionsToEliminate.forEach(col => {
            console.log(`      - ${col.name} (${col.holders} holders)`);
            progress.eliminatedCollections.push({
                artist: artistName,
                collection: col.name,
                holders: col.holders
            });
        });
    }

    if (collectionsToKeep.length === 0) {
        console.log(`   ❌ No collections remaining for ${artistName} after elimination`);
        return;
    }

    console.log(`   ✅ Keeping ${collectionsToKeep.length} collections with ≥10 holders`);

    // Process only collections that should be kept
    let totalWalletsAdded = 0;

    for (const collection of collectionsToKeep) {
        const collectionFolderName = getCollectionFolderName(collection.name);
        const collectionFolder = join(artistFolder, collectionFolderName);
        const holdersFile = join(collectionFolder, 'holders.csv');

        if (existsSync(holdersFile)) {
            try {
                const wallets = readFileSync(holdersFile, 'utf-8')
                    .split('\n')
                    .map(line => line.trim())
                    .filter(line => line.length > 0 && line.startsWith('0x'));

                wallets.forEach(wallet => {
                    progress.totalWallets.add(wallet);
                });

                totalWalletsAdded += wallets.length;
                console.log(`      ✓ ${collection.name}: ${wallets.length} wallets`);

            } catch (error) {
                console.log(`      ❌ Error reading ${collection.name}: ${error.message}`);
            }
        } else {
            console.log(`      ⚠️  No holders.csv found for ${collection.name}`);
        }
    }

    console.log(`   📊 Total wallets added from ${artistName}: ${totalWalletsAdded}`);
}

function generateCompilation(progress) {
    console.log('\n📝 Generating compilation.txt...');

    const walletArray = Array.from(progress.totalWallets).sort();

    let compilation = `NFT HOLDERS COMPILATION (COLLECTIONS WITH ≥10 HOLDERS)\n`;
    compilation += `Generated: ${new Date().toLocaleString()}\n`;
    compilation += `Total Unique Wallets: ${walletArray.length.toLocaleString()}\n`;
    compilation += `Eliminated Collections: ${progress.eliminatedCollections.length}\n`;
    compilation += `${'='.repeat(60)}\n\n`;

    // Add eliminated collections summary
    if (progress.eliminatedCollections.length > 0) {
        compilation += `ELIMINATED COLLECTIONS (< 10 HOLDERS):\n`;
        compilation += `${'-'.repeat(40)}\n`;
        progress.eliminatedCollections.forEach(item => {
            compilation += `${item.artist}: ${item.collection} (${item.holders} holders)\n`;
        });
        compilation += `\n${'='.repeat(60)}\n\n`;
    }

    compilation += `WALLET ADDRESSES:\n`;
    compilation += `${'-'.repeat(20)}\n`;
    walletArray.forEach(wallet => {
        compilation += `${wallet}\n`;
    });

    writeFileSync(COMPILATION_FILE, compilation);
    console.log(`✅ Compilation saved to ${COMPILATION_FILE}`);
    console.log(`   Total wallets: ${walletArray.length.toLocaleString()}`);
    console.log(`   Eliminated collections: ${progress.eliminatedCollections.length}`);
}

function main() {
    console.log('🚀 Starting NFT Collection Eliminator\n');
    console.log('='.repeat(50) + '\n');

    // Load progress
    const progress = loadProgress();

    // Parse summary report to get collection holder counts
    const artistCollections = parseSummaryReport();

    // Get list of artist folders
    const walletsDir = 'wallets';
    const artistFolders = readdirSync(walletsDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

    console.log(`📁 Found ${artistFolders.length} artist folders\n`);

    // Process each artist
    for (const artistName of artistFolders) {
        if (progress.processedArtists.includes(artistName)) {
            console.log(`⏭️  Skipping already processed artist: ${artistName}`);
            continue;
        }

        try {
            processArtist(artistName, artistCollections, progress);
            progress.processedArtists.push(artistName);

            // Save progress every 10 artists
            if (progress.processedArtists.length % 10 === 0) {
                // Convert Set to Array for JSON serialization
                const progressToSave = {
                    ...progress,
                    totalWallets: Array.from(progress.totalWallets)
                };
                saveProgress(progressToSave);
                console.log(`💾 Progress saved (${progress.processedArtists.length}/${artistFolders.length} artists)`);
            }

        } catch (error) {
            console.error(`❌ Error processing ${artistName}:`, error.message);
            continue;
        }
    }

    // Generate final compilation
    generateCompilation(progress);

    // Final progress save
    const finalProgress = {
        ...progress,
        totalWallets: Array.from(progress.totalWallets),
        completedAt: new Date().toISOString()
    };
    saveProgress(finalProgress);

    console.log('\n🎉 Elimination complete!');
    console.log(`📊 Final Stats:`);
    console.log(`   - Processed artists: ${progress.processedArtists.length}`);
    console.log(`   - Eliminated collections: ${progress.eliminatedCollections.length}`);
    console.log(`   - Total unique wallets: ${progress.totalWallets.size.toLocaleString()}`);
    console.log(`   - Compilation saved to: ${COMPILATION_FILE}`);
}

main();