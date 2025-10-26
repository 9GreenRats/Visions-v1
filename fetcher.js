import { Alchemy, Network } from 'alchemy-sdk';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import dotenv from 'dotenv';

dotenv.config();

const config = {
  apiKey: process.env.ALCHEMY_API_KEY,
  network: Network.ETH_MAINNET,
};

const alchemy = new Alchemy(config);

function sanitizeFolderName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars except spaces and hyphens
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
}

function parseMarkdownFile(filepath) {
  console.log(`📖 Parsing ${filepath}...`);

  try {
    const content = readFileSync(filepath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());

    const collections = [];

    for (const line of lines) {
      // Clean the line of any carriage returns and whitespace
      const cleanLine = line.replace(/\r/g, '').trim();

      // Match pattern: "Collection Name - 0xaddress"
      const match = cleanLine.match(/^(.+?)\s*-\s*(0x[a-fA-F0-9]{40})$/);
      if (match) {
        const [, name, address] = match;
        collections.push({
          name: name.trim(),
          address: address.toLowerCase(),
          folderName: sanitizeFolderName(name.trim())
        });
      }
    }

    console.log(`   Found ${collections.length} collections\n`);
    return collections;
  } catch (error) {
    console.error(`❌ Error reading ${filepath}:`, error.message);
    return [];
  }
}

async function getContractOwners(contractAddress, collectionName) {
  console.log(`🔍 Fetching holders for: ${collectionName}`);
  console.log(`   Contract: ${contractAddress}`);

  try {
    const response = await alchemy.nft.getOwnersForContract(contractAddress);
    const owners = response.owners.map(owner => owner.toLowerCase());
    console.log(`   ✅ Found ${owners.length} unique holders\n`);
    return owners;
  } catch (error) {
    console.error(`   ❌ Error fetching holders: ${error.message}\n`);
    return [];
  }
}

function ensureDirectoryExists(dirPath) {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}

function readExistingHolders(filepath) {
  try {
    const content = readFileSync(filepath, 'utf-8');
    return content
      .split('\n')
      .map(addr => addr.trim().toLowerCase())
      .filter(addr => addr.length > 0);
  } catch (error) {
    return [];
  }
}

function writeHolders(filepath, holders) {
  const content = holders.join('\n') + '\n';
  writeFileSync(filepath, content);
}

function generateSummaryReport(summaryData, totalUniqueHolders) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  let report = `NFT HOLDERS SUMMARY REPORT\n`;
  report += `Generated: ${new Date().toLocaleString()}\n`;
  report += `${'='.repeat(60)}\n\n`;

  let totalCollections = 0;
  let totalHolders = 0;

  // Artist summaries
  for (const artist of summaryData) {
    report += `ARTIST: ${artist.artistName.toUpperCase()}\n`;
    report += `${'-'.repeat(40)}\n`;

    for (const collection of artist.collectionSummary) {
      report += `  ${collection.name}\n`;
      report += `    Contract: ${collection.address}\n`;
      report += `    Holders: ${collection.holders.toLocaleString()}\n\n`;
      totalCollections++;
      totalHolders += collection.holders;
    }

    report += `  ARTIST UNIQUE HOLDERS: ${artist.uniqueHolders.toLocaleString()}\n`;
    report += `  COLLECTIONS: ${artist.collectionSummary.length}\n\n`;
    report += `${'='.repeat(60)}\n\n`;
  }

  // Overall summary
  report += `OVERALL SUMMARY\n`;
  report += `${'-'.repeat(40)}\n`;
  report += `Total Artists: ${summaryData.length}\n`;
  report += `Total Collections: ${totalCollections}\n`;
  report += `Total Individual Collection Holders: ${totalHolders.toLocaleString()}\n`;
  report += `Total Unique Holders (No Duplicates): ${totalUniqueHolders.toLocaleString()}\n`;
  report += `Duplicate Rate: ${((totalHolders - totalUniqueHolders) / totalHolders * 100).toFixed(1)}%\n\n`;

  const summaryFile = join('wallets', 'summary-report.txt');
  writeFileSync(summaryFile, report);

  console.log(`📊 Summary report created: ${summaryFile}`);
  return summaryFile;
}

function mergeAndDedupe(existing, newHolders) {
  const allHolders = [...existing, ...newHolders];
  const uniqueHolders = [...new Set(allHolders)];
  return uniqueHolders.sort();
}

async function processMarkdownFile(mdFile) {
  const baseName = mdFile.replace('.md', '');
  const collections = parseMarkdownFile(mdFile);

  if (collections.length === 0) {
    console.log(`⚠️  No collections found in ${mdFile}\n`);
    return [];
  }

  // Create artist folder inside wallets directory
  const artistFolder = join('wallets', baseName);
  ensureDirectoryExists(artistFolder);
  console.log(`📁 Created/using folder: ${artistFolder}/\n`);

  const allHolders = [];
  const collectionSummary = [];

  for (const collection of collections) {
    const collectionFolder = join(artistFolder, collection.folderName);
    const holdersFile = join(collectionFolder, 'holders.csv');

    // Create collection subfolder
    ensureDirectoryExists(collectionFolder);

    // Fetch new holders
    const newHolders = await getContractOwners(collection.address, collection.name);

    if (newHolders.length === 0) {
      console.log(`   ⚠️  No holders found, skipping...\n`);
      collectionSummary.push({
        name: collection.name,
        address: collection.address,
        holders: 0
      });
      continue;
    }

    // Read existing holders
    const existingHolders = readExistingHolders(holdersFile);

    // Merge and dedupe
    const mergedHolders = mergeAndDedupe(existingHolders, newHolders);

    // Write to collection file
    writeHolders(holdersFile, mergedHolders);

    console.log(`   💾 Saved ${mergedHolders.length} holders to ${holdersFile}`);
    console.log(`   📊 Added ${mergedHolders.length - existingHolders.length} new holders\n`);

    // Add to summary
    collectionSummary.push({
      name: collection.name,
      address: collection.address,
      holders: mergedHolders.length
    });

    // Add to master list
    allHolders.push(...mergedHolders);
  }

  // Calculate unique holders for this artist
  const uniqueArtistHolders = [...new Set(allHolders)];

  return {
    artistFolder,
    artistName: baseName,
    allHolders,
    uniqueHolders: uniqueArtistHolders.length,
    collectionSummary
  };
}

async function createArtistCSV(artistFolder, artistName, allHolders) {
  if (allHolders.length === 0) {
    console.log(`⚠️  No holders to compile for ${artistName}\n`);
    return;
  }

  const artistFile = join(artistFolder, `${artistName}.csv`);
  const existingArtist = readExistingHolders(artistFile);

  // Dedupe artist list
  const uniqueArtistHolders = mergeAndDedupe(existingArtist, allHolders);

  // Write artist file
  writeHolders(artistFile, uniqueArtistHolders);

  console.log(`🎯 Artist CSV created: ${artistFile}`);
  console.log(`   Total unique holders: ${uniqueArtistHolders.length}`);
  console.log(`   New holders added: ${uniqueArtistHolders.length - existingArtist.length}\n`);
}

function findMarkdownFiles() {
  try {
    const files = readdirSync('.');
    return files.filter(file => file.endsWith('.md'));
  } catch (error) {
    console.error('❌ Error reading directory:', error.message);
    return [];
  }
}

async function main() {
  console.log('🚀 Starting Fetcher Script\n');
  console.log('='.repeat(50) + '\n');

  // Ensure wallets directory exists
  ensureDirectoryExists('wallets');

  // Find all .md files
  const mdFiles = findMarkdownFiles();

  if (mdFiles.length === 0) {
    console.log('❌ No .md files found in current directory');
    process.exit(1);
  }

  console.log(`📋 Found ${mdFiles.length} markdown file(s): ${mdFiles.join(', ')}\n`);

  const allArtistHolders = [];
  const summaryData = [];

  // Process each markdown file
  for (const mdFile of mdFiles) {
    console.log(`🔄 Processing ${mdFile}...`);
    console.log('-'.repeat(30));

    try {
      const result = await processMarkdownFile(mdFile);

      if (result.allHolders && result.allHolders.length > 0) {
        await createArtistCSV(result.artistFolder, result.artistName, result.allHolders);
        // Add to global master list
        allArtistHolders.push(...result.allHolders);
        // Add to summary data
        summaryData.push({
          artistName: result.artistName,
          uniqueHolders: result.uniqueHolders,
          collectionSummary: result.collectionSummary
        });
      }

      console.log(`✅ Completed processing ${mdFile}\n`);

    } catch (error) {
      console.error(`❌ Error processing ${mdFile}:`, error.message);
      console.log('Continuing with next file...\n');
    }
  }

  // Create master list of all artists' holders
  if (allArtistHolders.length > 0) {
    console.log('🎯 Creating master holders list...');
    const masterFile = join('wallets', 'master-holders.csv');
    const existingMaster = readExistingHolders(masterFile);

    // Dedupe global master list
    const uniqueAllHolders = mergeAndDedupe(existingMaster, allArtistHolders);

    // Write global master file
    writeHolders(masterFile, uniqueAllHolders);

    console.log(`🌟 Master holders CSV created: ${masterFile}`);
    console.log(`   Total unique holders across all artists: ${uniqueAllHolders.length}`);
    console.log(`   New holders added: ${uniqueAllHolders.length - existingMaster.length}\n`);

    // Generate summary report
    console.log('📊 Generating summary report...');
    generateSummaryReport(summaryData, uniqueAllHolders.length);
  }

  console.log('🎉 All done! Check your wallets folder for the results and summary report.');
  process.exit(0);
}

// Handle errors gracefully
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled error:', error.message);
  process.exit(1);
});

main();