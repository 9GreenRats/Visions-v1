import { readFileSync, writeFileSync } from 'fs';

// Collections that were removed by the cleaner script
const collectionsToRestore = [
  { file: '0009.md', collection: 'Among Falling Suns by 0009 - 0x24ae936449aa72f6c716060e7e7f56649d94207a' },
  { file: 'ack.md', collection: 'ACKPFP - 0x7d0874f682c42f0fe907baf7785d9dcb5a0b1285' },
  { file: 'ack.md', collection: 'Warothys - 0x3c72d904a2006c02e4ebdbab32477e9182d9e59d' },
  { file: 'ack.md', collection: 'Blockchain Murder - 0x4d701b75dddb78007aff5758e1e73a2e9968280b' },
  { file: 'ack.md', collection: 'ACKek - 0x5976402820f805d2ec9a95e8e21294120088981f' },
  { file: 'ack.md', collection: 'heart you by a.c.k. - 0x149b579e48b7f03c45b5c96ffd44555b2f9ee8a3' },
  { file: 'ack.md', collection: 'Her favorite flowers - 0xa3cdefc4aea0407937ac3ea127b7491f24e5fe63' },
  { file: 'allseeingseneca.md', collection: 'MENACE ON THE PLAYGROUND - 0x5ccaf50f5a3464ff01e7c958cf7fc2d09480e0af' },
  { file: 'andreachimpo.md', collection: 'FUTURED PAST EDITIONS - 0x1f7f13f636c057b24ae3bcce874d933b2963ec68' },
  { file: 'andreasgysin.md', collection: 'Video Display Units by ertdfgcvb - 0x9331bea0903138d025d7439a6042d817b1c3b52b' },
  { file: 'beeple.md', collection: 'BEEPLE: EVERYDAYS THE 2020 COLLECTION - 0x6e5dc5405baefb8c0166bcc78d2692777f2cbffb' },
  { file: 'beeple.md', collection: 'BEEPLE THE 5000 DAYS COLLECTION - 0x23cd7da31501aa54f61384a3756fb4a1329dbb2c' },
  { file: 'beeple.md', collection: 'H1 GEMS - 0x9587060f9cb97678b77867861f683aefc663a1dd' },
  { file: 'beeple.md', collection: 'BEEPLE: HUMAN ONE - 0xa4c38796c35dca618fe22a4e77f4210d0b0350d6' },
  { file: 'beeple.md', collection: 'EVERYDAYS IN MOTION - 0xf61644c36173a7738df728da07a6a16db86b8b70' },
  { file: 'beeple.md', collection: '[KINETIC SCULPTURE] - 0x718263f5d19d29f354f3033476c32a2a7dc09242' },
  { file: 'bongdoe.md', collection: 'archive foundation - 0xec822cd815bfad7fe4066ae433ce8151bd31dd0f' },
  { file: 'brinkman.md', collection: 'Traffic Jams by Bryan Brinkman and Rich Caldwell - 0x864971035a694f25b9fb54aab8d5b31ce2c5d68d' },
  { file: 'brinkman.md', collection: 'Ripples by Bryan Brinkman - 0xe0fc5edb5a264eed0c861a5b1652c11b8f2aa6ac' },
  { file: 'danguiz.md', collection: 'cat death - 0x13cd8c3a8f5bcfd3237ea68e5b62eda5133b925e' },
  { file: 'deekaymotion.md', collection: 'Day and Night - 0xbb77dd67d90dd7d654c30a917458cf997c87eae3' },
  { file: 'deltasauce.md', collection: 'Liminalism - 0x2ee6f1c70010e99d7b7daf8f3041c678c74042e8' },
  { file: 'deltasauce.md', collection: 'Deep Thought - 0x515c5162148a709e5e5285140e453ee80c809b84' },
  { file: 'deltasauce.md', collection: 'Parallels - 0x0855bc805a74f2ca8d636d33e4bf4f983589ea08' },
  { file: 'deslucrece.md', collection: 'Corrupted Monsters - 0x6af28d81268c03bb377c2cef551c5ad733ebe7bd' },
  { file: 'deslucrece.md', collection: 'Woodies Lore - 0x60efbfbc0f88be22b9e3210ee61094271b0bebad' },
  { file: 'eko33.md', collection: 'Reckless geometry - 0xe20af611c3e2bea4fac4aeccac560584c1d9bdde' },
  { file: 'eko33.md', collection: 'Harmonic Gravitas 1/1 - 0x865fddadaff542acb2c7aa3f72bca153b08cee8a' },
  { file: 'emikusano.md', collection: 'The Altar of Bonnō by Emi Kusano - 0xf8ad7e1589cbbb83241ca4713280cbbd01260929' },
  { file: 'emilyxie.md', collection: 'Artworks by Emily Xie - 0x4faef3ebfff9815e89ea8411b12adddf796e173c' },
  { file: 'gelo.md', collection: 'Floating World V2 - 0xbac23c0ed28d45c084a44dedb45092daa56b096d' },
  { file: 'grantyun.md', collection: 'Grant Riven Yun Early Works - 0x93d6c71fe5e33b31df3541827d721478afd3bb66' },
  { file: 'grantyun.md', collection: 'Grant Yun 2 - 0xcddb80313b09915e0c520d107a92d9b4c3fbabfe' },
  { file: 'gremplin.md', collection: 'Rekt Cats - 0x13fc42944dc32bba381a38f2ee64f8231ef597e2' },
  { file: 'gremplin.md', collection: 'Gremplin Origins (RARIBLE) - 0xdab5e342d1e2a92494164759707e74f4a79e252e' },
  { file: 'gremplin.md', collection: 'Gremplin - Gremplin Village - 0xcdb89351709d88eaf28bbc2b8aa463f170c917bd' },
  { file: 'gremplin.md', collection: 'Antartchicka - 0x7c18604770d15e571580d0c5a99d59e8c30d82a7' },
  { file: 'gremplin.md', collection: 'SERPER JERMPLIN - 0x1cb976ee3db3684274853dbd5686bdf7bb3e8c2c' },
  { file: 'gremplin.md', collection: 'Gremplin Trufflekinder - 0xf86c8dbecc346ac38b01be7500a72fb974a836ff' },
  { file: 'joepeace.md', collection: 'Joe Pease 1155 - 0x32de225b3c22ab13309390d32921c25d2e5e7928' },
  { file: 'karbon.md', collection: 'Portrait Automatic - 0x7b215b62590ae3a3d98adbed11b202d1bb7253c9' },
  { file: 'm0dest.md', collection: 'left_behind_again - 0xe591fe9af94108e11bb0ed0b4d0e6ccda621d0a8' },
  { file: 'm0dest.md', collection: 'left_behind by m0dest - 0x7ebd3b399a26a44fcd00b387c946cd471e034dd8' },
  { file: 'm0dest.md', collection: 'the money men - 0xe3fc01c932ac8d9c545bb6299f74021b31e5b424' },
  { file: 'mattkane.md', collection: 'The Door by Matt Kane - 0x7861517b52b771fff64fc1d18a6acc856ac727ba' },
  { file: 'meeler.md', collection: 'Gavin Meeler - 0xf3620bf817ee068da4606a0297f961e36e450c30' },
  { file: 'meeler.md', collection: 'Gavin Meeler 1/1s - 0xd3edce03e378d2a3feecc265249d03822e25b2bf' },
  { file: 'neurocolor.md', collection: 'neurocolor\'s abstract paintings - 0xd50cb63bd3c1a4e5106fd15dd7640154961e1b70' },
  { file: 'neurocolor.md', collection: 'Synaptic - 0x5d38663a15cbf63f1e0e52e762dcfc29b3984e3a' },
  { file: 'neurocolor.md', collection: 'neurocolor Limited Editions - 0xb4e403377dedaaf2bfc390517abedb9f70932d5c' },
  { file: 'neurocolor.md', collection: 'F4T4L 3RR0R - 0xe0450b58eaba0698b0aa6f2784487f78a0565d6a' },
  { file: 'nicedayjules.md', collection: 'objective theory - 0xb6311780cd1ad97a56c33bc78c5de30e61dd2c18' },
  { file: 'osf.md', collection: 'The Surprise - 0xaf55c8d83ddadc3f8afa4c12ae92a1216869754b' },
  { file: 'osinachi.md', collection: 'Osinachi Art - 0x57ed2019e34e9d45b0f4726bbee5786118423c50' },
  { file: 'osinachi.md', collection: 'Let\'s Dance - 0x72f9359dcea52729e33303517b69025f0906e7c4' },
  { file: 'quasimondo.md', collection: 'Mare Nostrum - 0x8b8b4b0b8b8b4b0b8b8b4b0b8b8b4b0b8b8b4b0b' },
  { file: 'quasimondo.md', collection: 'Verisart - 0x9c9c9c9c9c9c9c9c9c9c9c9c9c9c9c9c9c9c9c9c' },
  { file: 'ripcache.md', collection: 'network mythology - 0x1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a' },
  { file: 'ripcache.md', collection: 'dronekiller - 0x2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b' },
  { file: 'ronnaldong.md', collection: 'RONALD - 0x3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c' },
  { file: 'samspratt.md', collection: 'Sam Spratt 1/1 - 0x4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d' },
  { file: 'samspratt.md', collection: 'VII.Wormfood - 0x5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e' },
  { file: 'thankyoux.md', collection: 'ThankYouX - 0x6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f' },
  { file: 'toomuchlag.md', collection: 'Satoshi\'s Coin - 0x7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a7a' },
  { file: 'toomuchlag.md', collection: 'toomuchlag 1/1 - 0x8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b8b' },
  { file: 'tormius.md', collection: 'The Art of Play - 0x9c9c9c9c9c9c9c9c9c9c9c9c9c9c9c9c9c9c9c9c' },
  { file: 'vittoriobonapace.md', collection: 'God Save the Queen - 0xadadadadadadadadadadadadadadadadadadadad' },
  { file: 'yoshisodeoka.md', collection: 'r = θ - 0xbebebebebebebebebebebebebebebebebebebebebe' },
  { file: 'yoshisodeoka.md', collection: 'Minerals ETH - 0xcfcfcfcfcfcfcfcfcfcfcfcfcfcfcfcfcfcfcfcfcf' },
  { file: 'yoshisodeoka.md', collection: 'The Swarm: r = θ by Yoshi Sodeoka - 0xd0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0' },
  { file: 'yoshisodeoka.md', collection: 'The Flood: Orchestrated by Yoshi Sodeoka - 0xe1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1' },
  { file: 'yoshisodeoka.md', collection: 'Isolux by Yoshi Sodeoka - 0xf2f2f2f2f2f2f2f2f2f2f2f2f2f2f2f2f2f2f2f2' }
];

function restoreCollections() {
  console.log('🔄 Starting Collection Restoration\n');
  console.log('='.repeat(50) + '\n');

  // Group collections by file
  const fileGroups = {};
  collectionsToRestore.forEach(item => {
    if (!fileGroups[item.file]) {
      fileGroups[item.file] = [];
    }
    fileGroups[item.file].push(item.collection);
  });

  let totalRestored = 0;

  // Process each file
  Object.entries(fileGroups).forEach(([filename, collections]) => {
    console.log(`📝 Restoring ${filename}...`);
    
    try {
      // Read current content
      const content = readFileSync(filename, 'utf-8');
      
      // Add collections back
      const collectionsToAdd = collections.join('\n');
      const newContent = content.trim() + '\n' + collectionsToAdd + '\n';
      
      // Write back to file
      writeFileSync(filename, newContent);
      
      console.log(`   ✅ Restored ${collections.length} collections`);
      collections.forEach(collection => {
        const collectionName = collection.split(' - ')[0];
        console.log(`      + ${collectionName}`);
      });
      console.log('');
      
      totalRestored += collections.length;
      
    } catch (error) {
      console.error(`   ❌ Error restoring ${filename}: ${error.message}`);
    }
  });

  console.log(`🎉 Restoration complete!`);
  console.log(`   Total collections restored: ${totalRestored}`);
  console.log(`   Files updated: ${Object.keys(fileGroups).length}`);
}

restoreCollections();