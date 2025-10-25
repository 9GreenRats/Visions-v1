import { Alchemy, Network } from 'alchemy-sdk';
import { readFileSync, writeFileSync } from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const config = {
  apiKey: process.env.ALCHEMY_API_KEY,
  network: Network.ETH_MAINNET, // Ethereum mainnet for this collection
};

const alchemy = new Alchemy(config);

async function getContractOwners(contractAddress) {
  console.log(`Fetching all NFT owners for contract: ${contractAddress}\n`);

  try {
    const response = await alchemy.nft.getOwnersForContract(contractAddress);
    const owners = response.owners.map(owner => owner.toLowerCase());
    console.log(`Total unique owners found: ${owners.length}\n`);
    return owners;
  } catch (error) {
    console.error('Error fetching owners:', error.message);
    throw error;
  }
}

function readExistingAddresses(filepath) {
  try {
    const content = readFileSync(filepath, 'utf-8');
    const addresses = content
      .split('\n')
      .map(addr => addr.trim().toLowerCase())
      .filter(addr => addr.length > 0);
    console.log(`Existing file has ${addresses.length} addresses\n`);
    return addresses;
  } catch (error) {
    console.log('File not found or empty, starting fresh\n');
    return [];
  }
}

function mergeAndDedupe(existing, newAddresses) {
  const allAddresses = [...existing, ...newAddresses];
  const uniqueAddresses = [...new Set(allAddresses)];

  const duplicatesRemoved = allAddresses.length - uniqueAddresses.length;
  console.log(`Total addresses after merge: ${allAddresses.length}`);
  console.log(`Unique addresses: ${uniqueAddresses.length}`);
  console.log(`Duplicates removed: ${duplicatesRemoved}\n`);

  return uniqueAddresses.sort();
}

function writeAddresses(filepath, addresses) {
  const content = addresses.join('\n') + '\n';
  writeFileSync(filepath, content);
  console.log(`✅ Successfully updated ${filepath}`);
  console.log(`Total addresses in file: ${addresses.length}`);
}

async function main() {
  // Contract address to fetch holders from
  const contractAddress = '0x0a1bbd57033f57e7b6743621b79fcb9eb2ce3676';

  // Output file name
  const outputFile = 'wallets/event-holders.csv';

  try {
    console.log('=== Fetching Contract Holders ===\n');

    // Fetch new owners
    const newOwners = await getContractOwners(contractAddress);

    // Read existing addresses if any
    const existingAddresses = readExistingAddresses(outputFile);

    // Merge and deduplicate
    const mergedAddresses = mergeAndDedupe(existingAddresses, newOwners);

    // Write to file
    writeAddresses(outputFile, mergedAddresses);

    console.log('\n✨ Done!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Script failed:', error.message);
    process.exit(1);
  }
}

main();
