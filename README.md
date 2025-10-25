# ETH Wallet Grabber

Fetches all NFT holders from a smart contract using Alchemy API.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file:
```bash
cp .env.example .env
```

3. Add your Alchemy API key to `.env`:
```
ALCHEMY_API_KEY=your_actual_api_key
```

Get your API key from: https://dashboard.alchemy.com/

## Usage

Run the script:
```bash
npm start
```

## Configuration

Edit `fetch-holders.js` to customize:

- **Contract Address** (line 72):
  ```javascript
  const contractAddress = '0x471e6dc70cc55da6430f221637d7372eb5080ad2';
  ```

- **Network** (line 8):
  ```javascript
  network: Network.BASE_MAINNET, // or Network.ETH_MAINNET
  ```

- **Output File** (line 75):
  ```javascript
  const outputFile = 'holders.csv';
  ```

## Output

The script will create a `holders.csv` file with all unique wallet addresses (one per line).

If the file already exists, new addresses will be merged and duplicates removed.
