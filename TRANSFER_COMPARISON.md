# 跨链转账四步法对比：Solana SOL / SPL Token vs EVM ETH / ERC-20

> 用同一套"四步法"思维模型，理解 Solana 和 EVM 在原生币与 Token 转账上的差异。

---

## 核心思维模型：交易四步法

无论哪条链、哪种资产，链上转账永远遵循这四步：

```
┌─────────────────┐
│ 1. 构造调用数据  │  ← 告诉链"我要做什么"
└────────┬────────┘
         ▼
┌─────────────────┐
│ 2. 组装交易体    │  ← 把调用数据打包成可签名格式
└────────┬────────┘
         ▼
┌─────────────────┐
│ 3. 签名          │  ← 弹出钱包，用户确认授权
└────────┬────────┘
         ▼
┌─────────────────┐
│ 4. 广播 & 确认   │  ← 发到网络，等待执行结果
└─────────────────┘
```

**API 名字会变，但这四步永远不变。**

---

## 场景一：Solana 原生 SOL 转账（最简单）

```tsx
import { SystemProgram, LAMPORTS_PER_SOL, Transaction } from '@solana/web3.js'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'

const { publicKey, sendTransaction } = useWallet()
const { connection } = useConnection()

// ========== 步骤 1：构造调用数据 ==========
// 为什么用 SystemProgram？
// → SOL 是 Solana 原生资产，由 SystemProgram 管理
const instruction = SystemProgram.transfer({
  fromPubkey: publicKey,           // 我的地址
  toPubkey: new PublicKey(recipient), // 对方地址
  lamports: Math.round(amount * LAMPORTS_PER_SOL), // 精度 9，单位 lamports
})

// ========== 步骤 2：组装交易体 ==========
const transaction = new Transaction().add(instruction)

// ========== 步骤 3：签名（钱包弹出）==========
// 为什么用 sendTransaction？
// → 它自动设置 feePayer + recentBlockhash + 弹出钱包签名 + 广播
const signature = await sendTransaction(transaction, connection)

// ========== 步骤 4：广播 & 确认 ==========
const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
await connection.confirmTransaction(
  { signature, blockhash, lastValidBlockHeight },
  'confirmed'
)
```

**为什么最简单？**
- SOL 直接存在钱包地址的 `lamports` 字段里
- 转账只需要改两个 Account 的余额
- 不需要"创建接收账户"——Solana 地址天然存在

---

## 场景二：Solana SPL Token（USDC）转账（最复杂）

```tsx
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
} from '@solana/spl-token'
import { PublicKey, Transaction } from '@solana/web3.js'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'

const USDC_MINT = new PublicKey('Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr') // Devnet USDC

const { publicKey, sendTransaction } = useWallet()
const { connection } = useConnection()

// ========== 步骤 1：构造调用数据 ==========

// 1.1 找到"你的 USDC 钱包"和"对方的 USDC 钱包"
// 为什么需要 ATA？
// → USDC 余额不存于你的地址，而是存在独立的 ATA（Associated Token Account）
const fromATA = await getAssociatedTokenAddress(USDC_MINT, publicKey)
const toATA = await getAssociatedTokenAddress(USDC_MINT, new PublicKey(recipient))

// 1.2 检查对方有没有 USDC ATA
// 为什么需要检查？
// → 如果对方从来没收过 USDC，他的 ATA 还不存在，必须先创建
const toAccountInfo = await connection.getAccountInfo(toATA)

const transaction = new Transaction()

if (!toAccountInfo) {
  // 1.3 【SPL 特有】创建对方的 ATA
  // 谁付费？→ 发送方（payer: publicKey）
  transaction.add(
    createAssociatedTokenAccountInstruction(
      publicKey,           // payer：谁出创建费
      toATA,               // 新 ATA 地址
      new PublicKey(recipient), // 新 ATA 的 owner
      USDC_MINT            // 什么 Token 的 ATA
    )
  )
}

// 1.4 添加转账指令
// 为什么用 createTransferInstruction？
// → 这是 SPL Token 的标准转账指令，不是 SystemProgram
const decimals = 6
const [whole, fraction = ''] = amount.split('.')
const fractionPadded = fraction.padEnd(decimals, '0').slice(0, decimals)
const amountInSmallestUnit = BigInt(whole + fractionPadded) // 避免浮点！

transaction.add(
  createTransferInstruction(
    fromATA,               // 从谁的 ATA 扣
    toATA,                 // 放到谁的 ATA
    publicKey,             // 授权签名者（= ATA 的 owner）
    amountInSmallestUnit   // 转账金额（整数）
  )
)

// ========== 步骤 2：组装交易体 ==========
// Transaction 已经在上面组装好了

// ========== 步骤 3：签名（钱包弹出）==========
const signature = await sendTransaction(transaction, connection)

// ========== 步骤 4：广播 & 确认 ==========
const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
await connection.confirmTransaction(
  { signature, blockhash, lastValidBlockHeight },
  'confirmed'
)
```

**为什么比 SOL 复杂？**

| 差异点 | SOL | USDC |
|--------|-----|------|
 管理程序 | `SystemProgram` | `TokenProgram` |
| 余额位置 | 钱包地址的 `lamports` | 独立的 ATA 账户 |
| 是否需要创建接收账户 | 不需要 | 对方没有 ATA 时需要先创建 |
| 涉及账户数 | 2 个 | 4-5 个 |
| 精度 | 9 位（lamports） | 代币自定义（USDC = 6） |

---

## 场景三：EVM ETH 转账（中等）

```tsx
import { useAccount, useSendTransaction, useWaitForTransactionReceipt } from 'wagmi'
import { parseEther } from 'viem'

const { address } = useAccount()
const { sendTransaction } = useSendTransaction()

// ========== 步骤 1：构造调用数据 ==========
// 为什么这么简单？
// → ETH 转账是 EVM 原生操作，不需要指定 Program/Instruction
const txHash = sendTransaction({
  to: recipient,           // 对方地址
  value: parseEther(amount), // 精度 18，wei 为单位
})

// ========== 步骤 2：组装交易体 ==========
// wagmi 自动组装（fee、gasLimit、nonce、chainId...）

// ========== 步骤 3：签名（钱包弹出）==========
// sendTransaction 内部自动弹出 MetaMask

// ========== 步骤 4：广播 & 确认 ==========
const { isLoading, isSuccess } = useWaitForTransactionReceipt({ hash: txHash })
```

**为什么比 Solana SOL 还简单？**
- EVM 是"状态树"模型，ETH 直接存在地址的 balance 里
- 不需要显式声明访问哪些账户
- wagmi 把步骤 2/3 完全封装了

---

## 场景四：EVM ERC-20（USDC）转账（中等）

```tsx
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseUnits } from 'viem'

const USDC_ABI = [{
  "inputs": [
    { "name": "to", "type": "address" },
    { "name": "value", "type": "uint256" }
  ],
  "name": "transfer",
  "outputs": [{ "name": "", "type": "bool" }],
  "stateMutability": "nonpayable",
  "type": "function"
}]

const USDC_ADDRESS = '0xA0b86a33E6441e0A421e56E46dE4b9fC4e2f4b1A' // 示例地址

const { writeContract } = useWriteContract()

// ========== 步骤 1：构造调用数据 ==========
// 为什么需要 ABI？
// → EVM 合约交互需要知道函数的签名和参数格式
writeContract({
  address: USDC_ADDRESS,
  abi: USDC_ABI,
  functionName: 'transfer',
  args: [
    recipient,                          // 对方地址
    parseUnits(amount, 6),              // USDC 精度 6
  ],
})

// ========== 步骤 2/3：组装 + 签名 ==========
// wagmi 自动处理

// ========== 步骤 4：确认 ==========
const { isSuccess } = useWaitForTransactionReceipt({ hash: txHash })
```

**为什么比 Solana SPL 简单？**
- EVM 不需要"创建接收账户"——USDC 余额存在合约内部的 `mapping(address => uint256)`
- 对方的地址天然可以持有任何 ERC-20，不需要预先创建 ATA

---

## 四步法横向对比总表

| 步骤 | Solana SOL | Solana SPL (USDC) | EVM ETH | EVM ERC-20 (USDC) |
|------|-----------|-------------------|---------|-------------------|
| **1. 构造数据** | `SystemProgram.transfer` | `createTransferInstruction` + 可能 `createAssociatedTokenAccountInstruction` | `sendTransaction({ to, value })` | `writeContract({ abi, functionName, args })` |
| **为什么** | SOL 在地址里 | USDC 在 ATA 里，可能需创建 | ETH 在地址 balance 里 | USDC 在合约 mapping 里 |
| **2. 组装** | `new Transaction().add(instruction)` | 同上 + 多指令 | wagmi 自动 | wagmi 自动 |
| **3. 签名** | `wallet.sendTransaction(tx, connection)` | 同上 | `sendTransaction()` 内部 | `writeContract()` 内部 |
| **4. 确认** | `connection.confirmTransaction` | 同上 | `useWaitForTransactionReceipt` | 同上 |

---

## 核心差异总结

```
┌────────────────────────────────────────────────────────────┐
│  账户模型决定了转账的复杂度                                 │
├────────────────────────────────────────────────────────────┤
│  Solana: 每个资产都有独立账户（ATA）                        │
│  → 转账前需要"找到"双方账户，可能没有则先创建               │
│  → 交易需要显式列出所有涉及的 Account                       │
├────────────────────────────────────────────────────────────┤
│  EVM: 资产余额存在地址的 storage / 合约 mapping 里          │
│  → 只需要知道对方地址，不需要预先创建账户                   │
│  → 交易不需要显式列出访问的账户（运行时动态发现）           │
└────────────────────────────────────────────────────────────┘
```

**记住这个，换任何链都能推导：**
1. 资产存在哪里？→ 地址里 / 独立账户里 / 合约 mapping 里
2. 对方是否需要"预先存在"？→ 决定了是否需要创建步骤
3. 交易是否需要显式声明访问对象？→ 决定了账户模型的设计哲学

---

*最后更新：2026-04-18*
