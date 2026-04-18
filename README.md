# Solana Wallet Demo

A React-based Solana wallet interaction demo built with Vite + TypeScript + Tailwind CSS. This project demonstrates core Web3 frontend development patterns on the Solana Devnet.

## Tech Stack

- **Frontend Framework**: React 19 + TypeScript
- **Build Tool**: Vite 8
- **Styling**: Tailwind CSS 4
- **Solana SDK**: `@solana/web3.js` + `@solana/spl-token`
- **Wallet Adapter**: `@solana/wallet-adapter-react` (Phantom / Solflare)
- **Network**: Solana Devnet

## Features

- **Wallet Connection**: Connect via Phantom or Solflare wallet
- **SOL Balance Display**: Real-time balance fetching with loading states
- **Devnet Airdrop**: Request 1 Devnet SOL for testing
- **SOL Transfer**: Send SOL to any address with validation
- **SPL Token Transfer**: Send USDC (Devnet) with automatic ATA creation
- **Transaction Confirmation**: Track transaction status with Explorer links

## Project Structure

```
solona-react-demo/
├── src/
│   ├── main.tsx              # Wallet providers setup
│   ├── App.tsx               # Main layout & balance display
│   ├── SendSOL.tsx           # Native SOL transfer component
│   ├── TransferToken.tsx     # SPL Token (USDC) transfer component
│   ├── AirDropButton.tsx     # Devnet airdrop component
│   ├── vite-env.d.ts         # Environment variable types
│   └── assets/               # Static images
├── .env                      # RPC endpoint config (gitignored)
├── .env.example              # Config template
├── WEB3_PATTERNS.md          # Cross-chain wallet patterns
└── TRANSFER_COMPARISON.md    # SOL vs SPL Token vs EVM comparison
```

## Getting Started

### Prerequisites

- Node.js 18+
- Phantom or Solflare wallet (Devnet mode)

### Installation

```bash
npm install
```

### Configuration

Copy the environment template:

```bash
cp .env.example .env
```

The default `.env` uses Devnet RPC:
```
VITE_SOLANA_RPC_ENDPOINT=https://api.devnet.solana.com
```

### Run Development Server

```bash
npm run dev
```

Open http://localhost:5173 and connect your wallet.

### Build for Production

```bash
npm run build
```

## Core Concepts Demonstrated

### 1. Wallet Connection Flow

```
User clicks "Connect" → Wallet Adapter detects installed wallets
→ Phantom/Solflare popup → User approves → App receives publicKey
```

### 2. Transaction Lifecycle (Four-Step Pattern)

All on-chain operations follow the same pattern:

1. **Construct Instruction**: Define what to do (transfer SOL, transfer USDC, etc.)
2. **Assemble Transaction**: Package instructions into a Transaction object
3. **Sign**: Wallet popup for user authorization
4. **Broadcast & Confirm**: Send to network, wait for confirmation

### 3. Account Model Differences

**SOL Transfer**: Uses `SystemProgram.transfer` directly on wallet addresses.

**SPL Token Transfer**: Requires Associated Token Accounts (ATA). If the recipient has never held the token, their ATA must be created first (rent paid by sender).

See [TRANSFER_COMPARISON.md](./TRANSFER_COMPARISON.md) for detailed cross-chain comparison.

## Testing USDC Transfer

Devnet USDC faucet: https://spl-token-faucet.com/?token-name=USDC

1. Visit the faucet and enter your wallet address
2. Receive test USDC
3. Use the "Transfer USDC" form to send tokens

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_SOLANA_RPC_ENDPOINT` | Solana RPC endpoint | `https://api.devnet.solana.com` |

## References

- [Solana Documentation](https://solana.com/docs)
- [Solana Cookbook](https://solana.com/developers/cookbook)
- [Wallet Adapter](https://github.com/anza-xyz/wallet-adapter)
- [SPL Token Docs](https://spl.solana.com/token)
