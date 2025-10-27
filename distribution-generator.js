import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

function parseSummaryReport(filepath) {
  console.log('📖 Reading summary report...');
  
  try {
    const content = readFileSync(filepath, 'utf-8');
    const lines = content.split('\n');
    
    const artists = [];
    let currentArtist = null;
    let currentCollections = [];
    let pendingCollectionName = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      
      // Check for artist header
      if (trimmedLine.startsWith('ARTIST: ')) {
        // Save previous artist if exists
        if (currentArtist) {
          artists.push({
            name: currentArtist,
            collections: [...currentCollections],
            uniqueHolders: 0 // Will be set later
          });
        }
        
        // Start new artist
        currentArtist = trimmedLine.replace('ARTIST: ', '');
        currentCollections = [];
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
      
      // Check for contract line (we can skip this)
      if (trimmedLine.startsWith('Contract: 0x') && currentArtist) {
        continue;
      }
      
      // Check for holders count
      if (trimmedLine.startsWith('Holders: ') && currentArtist && pendingCollectionName) {
        const holdersMatch = trimmedLine.match(/Holders: ([\d,]+)/);
        if (holdersMatch) {
          const holders = parseInt(holdersMatch[1].replace(/,/g, ''));
          currentCollections.push({
            name: pendingCollectionName,
            holders: holders
          });
          pendingCollectionName = null; // Reset for next collection
        }
        continue;
      }
      
      // Check for artist unique holders
      if (trimmedLine.startsWith('ARTIST UNIQUE HOLDERS: ') && currentArtist) {
        const holdersMatch = trimmedLine.match(/ARTIST UNIQUE HOLDERS: ([\d,]+)/);
        if (holdersMatch) {
          const uniqueHolders = parseInt(holdersMatch[1].replace(/,/g, ''));
          artists.push({
            name: currentArtist,
            collections: [...currentCollections],
            uniqueHolders: uniqueHolders
          });
          currentArtist = null;
          currentCollections = [];
          pendingCollectionName = null;
        }
        continue;
      }
    }
    
    console.log(`   Found ${artists.length} artists\n`);
    return artists;
    
  } catch (error) {
    console.error(`❌ Error reading ${filepath}:`, error.message);
    return [];
  }
}

// This function is no longer needed with the improved parser

function generateDistributionReport(artists) {
  let report = `NFT HOLDERS DISTRIBUTION RANKING\n`;
  report += `Generated: ${new Date().toLocaleString()}\n`;
  report += `${'='.repeat(60)}\n\n`;

  // Prepare artist ranking data
  const artistRanking = artists.map(artist => {
    // Find the collection with the most holders
    const topCollection = artist.collections.reduce((max, collection) => 
      collection.holders > max.holders ? collection : max, 
      { name: 'N/A', holders: 0 }
    );

    return {
      artistName: artist.name,
      uniqueHolders: artist.uniqueHolders,
      totalCollections: artist.collections.length,
      topCollection: topCollection
    };
  });

  // Sort by unique holders (descending)
  artistRanking.sort((a, b) => b.uniqueHolders - a.uniqueHolders);

  // Generate ranking report
  report += `ARTIST RANKING BY UNIQUE HOLDERS\n`;
  report += `${'-'.repeat(60)}\n\n`;

  artistRanking.forEach((artist, index) => {
    const rank = index + 1;
    report += `${rank.toString().padStart(2)}. ${artist.artistName}\n`;
    report += `    Unique Holders: ${artist.uniqueHolders.toLocaleString()}\n`;
    report += `    Collections: ${artist.totalCollections}\n`;
    report += `    Top Collection: ${artist.topCollection.name}\n`;
    report += `    Top Collection Holders: ${artist.topCollection.holders.toLocaleString()}\n\n`;
  });

  // Add statistics
  report += `${'='.repeat(60)}\n`;
  report += `DISTRIBUTION STATISTICS\n`;
  report += `${'-'.repeat(30)}\n`;
  
  const totalArtists = artistRanking.length;
  const avgHolders = Math.round(artistRanking.reduce((sum, artist) => sum + artist.uniqueHolders, 0) / totalArtists);
  const medianHolders = artistRanking[Math.floor(totalArtists / 2)].uniqueHolders;
  const topArtist = artistRanking[0];
  const bottomArtist = artistRanking[totalArtists - 1];

  report += `Total Artists: ${totalArtists}\n`;
  report += `Average Holders per Artist: ${avgHolders.toLocaleString()}\n`;
  report += `Median Holders: ${medianHolders.toLocaleString()}\n`;
  report += `Highest: ${topArtist.artistName} (${topArtist.uniqueHolders.toLocaleString()} holders)\n`;
  report += `Lowest: ${bottomArtist.artistName} (${bottomArtist.uniqueHolders.toLocaleString()} holders)\n\n`;

  // Top 10 Collections across all artists
  const allCollections = [];
  artists.forEach(artist => {
    artist.collections.forEach(collection => {
      allCollections.push({
        artistName: artist.name,
        collectionName: collection.name,
        holders: collection.holders
      });
    });
  });

  allCollections.sort((a, b) => b.holders - a.holders);
  
  report += `TOP 10 COLLECTIONS BY HOLDERS\n`;
  report += `${'-'.repeat(30)}\n`;
  allCollections.slice(0, 10).forEach((collection, index) => {
    const rank = index + 1;
    report += `${rank.toString().padStart(2)}. ${collection.collectionName}\n`;
    report += `    Artist: ${collection.artistName}\n`;
    report += `    Holders: ${collection.holders.toLocaleString()}\n\n`;
  });

  return report;
}

function main() {
  console.log('🚀 Starting Distribution Generator\n');
  console.log('='.repeat(50) + '\n');

  const summaryFile = join('wallets', 'summary-report.txt');
  
  // Parse the summary report
  const artists = parseSummaryReport(summaryFile);
  
  if (artists.length === 0) {
    console.log('❌ No artists found in summary report');
    process.exit(1);
  }

  // Generate distribution report
  console.log('📈 Generating distribution ranking...');
  const distributionReport = generateDistributionReport(artists);
  
  // Write distribution file
  const distributionFile = join('wallets', 'distribution.txt');
  writeFileSync(distributionFile, distributionReport);
  
  console.log(`📊 Distribution report created: ${distributionFile}`);
  console.log('🎉 Done! Check your wallets folder for the distribution ranking.');
}

main();