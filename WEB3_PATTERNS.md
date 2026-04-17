# Web3 前端开发通用模式

> 基于 Solana + EVM 实际开发经验整理。掌握这些通用思维模式，换任何链都能快速上手。

---

## 一、核心概念：钱包连接 vs 签名

| 操作 | 是否签名 | 说明 |
|------|---------|------|
| 连接钱包（Connect） | **否** | 只是授权网站读取地址和余额 |
| 读取余额/交易记录 | **否** | 纯 RPC 读取，任何人都能查 |
| 转账/合约调用 | **是** | 必须用私钥对交易内容做数学证明 |
| 登录验证（signMessage） | **是** | 对后端给的随机 nonce 签名 |
| 授权额度（Approve） | **是** | 允许某个合约代你操作资产 |

**核心认知**：连接钱包只是"亮出身份证"，签名才是"在纸上签字"，用数学方法证明这个操作是你授权的。

---

## 二、发送交易的通用四步法（跨链通用）

无论 Solana 还是 EVM，发起链上交易的思维模式完全一致：

```
步骤 1: 构造指令/调用数据
   Solana: SystemProgram.transfer({ fromPubkey, toPubkey, lamports })
   EVM:    encodeFunctionData({ abi, functionName, args })

步骤 2: 组装交易体
   Solana: new Transaction().add(instruction)
   EVM:    prepareTransactionRequest({ to, data, value })

步骤 3: 签名（弹出钱包窗口）
   Solana: wallet.sendTransaction(tx, connection)
   EVM:    walletClient.sendTransaction(tx) 或 ethers.sendTransaction

步骤 4: 广播 & 等待确认
   Solana: connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight })
   EVM:    waitForTransactionReceipt({ hash })
```

**关键认知**：API 名字不同，但流程完全一样。学会了这套模型，换任何链都能快速迁移。

---

## 三、防重放攻击机制对比

| 链 | 机制 | 原理 |
|----|------|------|
| **Solana** | `recentBlockhash` | 交易包含最近区块的 hash（有效期约 90 秒/150 个区块）。重放时 blockhash 已过期，网络拒绝。 |
| **EVM** | `nonce` | 每个地址维护递增计数器。交易必须携带正确 nonce，重放时 nonce 已用过，网络拒绝。 |

**核心认知**：Solana 用 blockhash 的时效性防重放，EVM 用地址级别的递增 nonce 防重放，目的相同，实现不同。

---

## 四、Solana 账户模型（与 EVM 的核心差异）

### 4.1 一句话定义

Solana 的状态是**一堆独立的 Account**，EVM 是**一棵全局的状态树**。

### 4.2 Account 的结构

```
Account {
  lamports: number       // 余额（SOL 的最小单位）
  data: Uint8Array       // 数据区（普通用户账户为空，程序数据账户存状态）
  owner: PublicKey       // 这个账户归哪个 Program 管
  executable: boolean    // 是不是可执行程序
}
```

### 4.3 关键认知

- **你的钱包地址 = 一个 Account**，存着你的 SOL（在 `lamports` 字段里）
- **智能合约（Program）也是 Account**，只是 `executable: true`
- **合约的状态不在合约里**，而是存在独立的 **Data Account** 里，由 Program 管理
- **这就是 Solana "代码和数据分离"的设计**

### 4.4 为什么 SPL Token 转账比 SOL 转账更复杂？

**EVM 转 USDC**：
```
你的地址 0xabc... → USDC 合约的 mapping 里 balances[0xabc] -= 50
                     balances[0xdef] += 50
```
USDC 余额存在合约内部的 mapping 里，你的地址本身没有变化。

**Solana 转 USDC**：
```
你的钱包地址 ABC123...                // 只存 SOL
你的 USDC ATA（Associated Token Account） // 独立的 Account，存你的 USDC 余额
对方的 USDC ATA                        // 另一个独立的 Account
```

- 每种 Token，每个用户都有一个独立的 **ATA**
- ATA 的地址通过算法派生：`findAssociatedTokenAddress(mint, owner)`
- 转账时需要告诉 TokenProgram："从我的 ATA 扣钱，放到对方 ATA"
- 如果对方没有 ATA，还要先帮他创建

**核心认知**：EVM 的 Token 余额存在合约 mapping 里，Solana 的 Token 余额存在独立的 ATA 账户里，所以转账涉及的 Account 更多。

### 4.5 为什么交易要"显式声明 Account 列表"？

Solana 交易里的每个 Instruction 都有 `keys` 数组，列出所有会读写的 Account。

**目的：支持并行执行**。

```
Tx1 访问 [A, B]  → 线程 1 执行
Tx2 访问 [C, D]  → 线程 2 执行（与 Tx1 无冲突，并行！）
Tx3 访问 [B, E]  → 线程 3 执行（与 Tx1 冲突在 B，串行）
```

调度器提前知道"谁会冲突"，才能决定哪些能并行跑。EVM 是运行时动态发现，所以只能串行。

**核心认知**：Solana 交易显式声明 Account 是为了让调度器提前判断冲突，实现并行执行；EVM 是串行执行，所以不需要提前声明。

---

## 五、前端开发者的职责边界

### 5.1 需要掌握的核心技能

1. **钱包连接与交互**：useWallet, connect, disconnect, wallet.sendTransaction, signMessage
2. **链上数据读取**：getBalance, getAccountInfo, getTokenAccountsByOwner
3. **交易组装**：SystemProgram.transfer, createTransferInstruction (SPL)
4. **合约交互**：Anchor Program methods / EVM writeContract + readContract
5. **安全常识**：永远不要在前端出现私钥、地址校验、金额校验

### 5.2 不需要深入的方向（后端/合约开发才需要）

- 节点运维（Validator、Geth 搭建）
- 合约深入开发（Rust Anchor 高级特性、Solidity 复杂模式）
- 后端签名逻辑（Keypair.fromSecretKey、sendAndConfirmTransaction + Signer[]）
- 密码学底层（Ed25519、Merkle 树实现）

### 5.3 快速区分"前端 API vs 后端 API"

| 后端用的，前端跳过 | 前端用的 |
|-------------------|---------|
| `Keypair.fromSecretKey()` | `useWallet()` |
| `sendAndConfirmTransaction(tx, [signer])` | `wallet.sendTransaction(tx, connection)` |
| `.env` 里有 `PRIVATE_KEY` | `wallet.signMessage(nonce)` |
| 后台脚本/Cron 自动执行 | `WalletMultiButton` UI 组件 |

**一句话原则**：前端不持有私钥，只负责"组装交易 → 交给钱包弹窗签名 → 发送"。

---

## 六、核心概念问答

### Q1: Solana 和 EVM 的账户模型有什么区别？

> Solana 是"账户模型"，状态由一堆独立的 Account 组成，每个 Account 有 lamports/data/owner/executable 字段。EVM 是"状态树模型"，全局状态由一棵 Merkle Patricia Trie 维护。Solana 的 Program（合约）本身也是 Account，但状态存在独立的 Data Account 里，实现了代码和数据分离；EVM 的合约代码和状态都存在同一个地址下。

### Q2: 为什么 Solana 交易要显式声明 Account 列表？

> 为了支持并行执行。Solana 的调度器需要在执行前知道每个交易会访问哪些 Account，才能判断哪些交易可以并行（访问不同 Account）、哪些必须串行（访问相同 Account）。EVM 是运行时动态发现存储访问，天然串行，所以不需要提前声明。

### Q3: 前端 DApp 如何与钱包交互？Wallet Adapter 做了什么？

> 前端通过 Wallet Adapter（如 @solana/wallet-adapter-react 或 wagmi）与钱包通信。以发送交易为例，Wallet Adapter 内部做了：设置 feePayer → 获取 recentBlockhash → 序列化交易 → 调用钱包注入的 API 弹出确认窗口 → 用户签名 → 通过 RPC 广播到网络。它把不同钱包（Phantom、Solflare、MetaMask）的差异封装掉了，让前端代码统一。

### Q4: 什么是 SPL Token？什么是 ATA？

> SPL Token 是 Solana 上的代币标准（类似 EVM 的 ERC-20）。ATA（Associated Token Account）是每个用户持有每种 Token 的独立账户。EVM 的 Token 余额存在合约内部的 mapping 里；Solana 的 Token 余额存在用户独立的 ATA 里，由 Token Program 管理。ATA 的地址由用户的 Solana 地址和 Token 的 Mint Address 通过算法派生。

### Q5: 如何防止交易被重放？

> Solana 使用 recentBlockhash（最近区块哈希，约 90 秒有效期），交易被重放时 blockhash 已过期，网络拒绝。EVM 使用递增的 nonce，每个地址的 nonce 必须严格递增，重放时 nonce 已用过，网络拒绝。两种机制目的相同：确保同一笔交易只能被执行一次。

### Q6: 连接钱包和签名交易有什么区别？

> 连接钱包只是授权网站读取用户的地址和余额，不涉及资金操作，不需要签名。签名交易是用户用私钥对交易内容进行数学证明，证明"这个操作是我授权的"。任何涉及链上状态变更的操作（转账、合约调用、授权）都需要签名。

### Q7: signMessage 在登录场景中的作用是什么？

> 后端生成一个随机 nonce 发给前端，前端调用 wallet.signMessage(nonce) 让用户签名，然后把 {address, signature, nonce} 发给后端。后端用公钥验证签名是否由该地址的私钥生成，同时检查 nonce 是否过期（防重放）。验证通过后发放 JWT，实现"无需密码的钱包登录"。

---

## 七、常用 API 速查表

### Solana（@solana/web3.js + @solana/wallet-adapter-react）

| 用途 | API |
|------|-----|
| 连接钱包 | `const { publicKey, connected } = useWallet()` |
| 读取 SOL 余额 | `connection.getBalance(publicKey)` |
| 读取 Token 余额 | `getAccount(connection, ataAddress)` |
| 获取 ATA 地址 | `getAssociatedTokenAddress(mint, owner)` |
| 发送 SOL | `SystemProgram.transfer({ fromPubkey, toPubkey, lamports })` |
| 弹出钱包签名并发送 | `wallet.sendTransaction(transaction, connection)` |
| 等待确认 | `connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed')` |
| 签名消息（登录） | `wallet.signMessage(message)` |

### EVM（wagmi + viem）

| 用途 | API |
|------|-----|
| 连接钱包 | `const { address, isConnected } = useAccount()` |
| 读取 ETH 余额 | `useBalance({ address })` |
| 读取合约数据 | `useReadContract({ abi, address, functionName })` |
| 写入合约/转账 | `useWriteContract()` + `writeContract({ abi, address, functionName, args, value })` |
| 等待确认 | `useWaitForTransactionReceipt({ hash })` |
| 签名消息 | `useSignMessage()` |

---

## 八、扩展建议

1. **完成 Solana Demo**：SOL 转账 + SPL Token 余额查询
2. **在同一仓库加 EVM 页面**：用 wagmi + viem 做 ETH 转账，形成对比
3. **对比两个 Demo 写总结**："Solana 用 SystemProgram.transfer + 显式 Account 列表，EVM 用 prepareTransactionRequest + 隐式状态访问"
4. **加钱包登录（signMessage + 后端验签）**：理解非对称签名验证流程

---

*最后更新：2026-04-17*
