import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

function parseCollectionsFromSummary(filepath) {
  console.log('📖 Reading summary report for collections...');
  
  try {
    const content = readFileSync(filepath, 'utf-8');
    const lines = content.split('\n');
    
    const collections = [];
    let currentArtist = null;
    let pendingCollectionName = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      
      // Check for artist header
      if (trimmedLine.startsWith('ARTIST: ')) {
        currentArtist = trimmedLine.replace('ARTIST: ', '');
        pendingCollectionName = null;
        continue;
      }
      
      // Check for collection name (indented with 2 spaces, not a contract or holders line)
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
      
      // Check for contract line - extract contract address
      let contractAddress = null;
      if (trimmedLine.startsWith('Contract: 0x') && currentArtist) {
        contractAddress = trimmedLine.replace('Contract: ', '');
        continue;
      }
      
      // Check for holders count
      if (trimmedLine.startsWith('Holders: ') && currentArtist && pendingCollectionName) {
        const holdersMatch = trimmedLine.match(/Holders: ([\d,]+)/);
        if (holdersMatch) {
          const holders = parseInt(holdersMatch[1].replace(/,/g, ''));
          
          // Find the contract address (should be the previous non-empty line)
          let contract = 'N/A';
          for (let j = i - 1; j >= 0; j--) {
            const prevLine = lines[j].trim();
            if (prevLine.startsWith('Contract: 0x')) {
              contract = prevLine.replace('Contract: ', '');
              break;
            }
          }
          
          collections.push({
            name: pendingCollectionName,
            artist: currentArtist,
            contract: contract,
            holders: holders
          });
          pendingCollectionName = null;
        }
        continue;
      }
    }
    
    console.log(`   Found ${collections.length} collections\n`);
    return collections;
    
  } catch (error) {
    console.error(`❌ Error reading ${filepath}:`, error.message);
    return [];
  }
}

function generateCollectionRanking(collections) {
  let report = `NFT COLLECTIONS RANKING BY UNIQUE HOLDERS\n`;
  report += `Generated: ${new Date().toLocaleString()}\n`;
  report += `${'='.repeat(80)}\n\n`;

  // Sort collections by holders (descending)
  const sortedCollections = [...collections].sort((a, b) => b.holders - a.holders);

  // Generate simple ranking report
  sortedCollections.forEach((collection, index) => {
    const rank = index + 1;
    report += `${rank.toString().padStart(3)}. ${collection.name}\n`;
    report += `     Contract: ${collection.contract}\n`;
    report += `     Unique Holders: ${collection.holders.toLocaleString()}\n\n`;
  });

  return report;
}

function main() {
  console.log('🚀 Starting Collection Ranker\n');
  console.log('='.repeat(50) + '\n');

  const summaryFile = join('wallets', 'summary-report.txt');
  
  // Parse collections from the summary report
  const collections = parseCollectionsFromSummary(summaryFile);
  
  if (collections.length === 0) {
    console.log('❌ No collections found in summary report');
    process.exit(1);
  }

  // Generate collection ranking report
  console.log('📊 Generating collection ranking...');
  const rankingReport = generateCollectionRanking(collections);
  
  // Write ranking file
  const rankingFile = join('wallets', 'collection-ranking.txt');
  writeFileSync(rankingFile, rankingReport);
  
  console.log(`📈 Collection ranking created: ${rankingFile}`);
  console.log('🎉 Done! Check your wallets folder for the collection ranking.');
}

main();