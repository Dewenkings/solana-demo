import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
} from '@solana/spl-token'
import { PublicKey, Transaction } from '@solana/web3.js'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { useState } from 'react'

// Devnet 测试 USDC 的 Mint 地址
// 来源：https://spl-token-faucet.com/?token-name=USDC
const USDC_MINT = new PublicKey('Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr')

interface TransferTokenProps {
  onSuccess?: () => void
}

export const TransferToken = ({ onSuccess }: TransferTokenProps) => {
  const { publicKey, sendTransaction } = useWallet()
  const { connection } = useConnection()

  const [recipient, setRecipient] = useState('')
  const [amount, setAmount] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [signature, setSignature] = useState<string | null>(null)

  const handleTransfer = async () => {
    if (!publicKey) return

    setError(null)
    setSignature(null)

    // 校验地址
    let recipientPublicKey: PublicKey
    try {
      recipientPublicKey = new PublicKey(recipient.trim())
    } catch {
      setError('Invalid recipient address')
      return
    }

    // 校验金额
    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount greater than 0')
      return
    }

    setIsLoading(true)

    try {
      // ========== 步骤 1：构造调用数据 ==========

      // 1.1 找到双方的 USDC ATA（Associated Token Account）
      // 为什么需要 ATA？→ USDC 余额不存于钱包地址，而是存在独立的 ATA 账户
      const fromATA = await getAssociatedTokenAddress(USDC_MINT, publicKey)
      const toATA = await getAssociatedTokenAddress(USDC_MINT, recipientPublicKey)

      // 1.2 检查对方是否已有 USDC ATA
      // 为什么检查？→ 如果对方从未持有过 USDC，ATA 不存在，必须先创建
      const toAccountInfo = await connection.getAccountInfo(toATA)

      const transaction = new Transaction()

      if (!toAccountInfo) {
        // 1.3 【SPL 特有】创建对方的 ATA
        // payer = publicKey（发送方付费，约 0.002039 SOL 租金）
        transaction.add(
          createAssociatedTokenAccountInstruction(
            publicKey,           // payer：谁出创建费
            toATA,               // 新 ATA 地址
            recipientPublicKey,  // 新 ATA 的 owner
            USDC_MINT            // 什么 Token 的 ATA
          )
        )
      }

      // 1.4 添加转账指令
      // USDC 精度 = 6，必须避免浮点数，用字符串拼接转 BigInt
      const decimals = 6
      const [whole, fraction = ''] = amount.split('.')
      const fractionPadded = fraction.padEnd(decimals, '0').slice(0, decimals)
      const amountInSmallestUnit = BigInt(whole + fractionPadded)

      transaction.add(
        createTransferInstruction(
          fromATA,             // 从谁的 ATA 扣
          toATA,               // 放到谁的 ATA
          publicKey,           // 授权签名者（= fromATA 的 owner）
          amountInSmallestUnit // 转账金额（整数，无浮点）
        )
      )

      // ========== 步骤 2：组装交易体 ==========
      // Transaction 已经在上面逐步组装好了

      // ========== 步骤 3：签名（钱包弹出）==========
      // sendTransaction 自动设置 feePayer + recentBlockhash + 弹出钱包签名
      const sig = await sendTransaction(transaction, connection)
      setSignature(sig)

      // ========== 步骤 4：广播 & 确认 ==========
      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash()
      await connection.confirmTransaction(
        { signature: sig, blockhash, lastValidBlockHeight },
        'confirmed'
      )

      onSuccess?.()

      // 成功后清空表单
      setRecipient('')
      setAmount('')
    } catch (err) {
      console.error('Transfer failed:', err)
      setError(err.message || 'Transaction failed')
    } finally {
      setIsLoading(false)
    }
  }

  const isFormValid =
    recipient.trim().length > 0 && amount.length > 0 && parseFloat(amount) > 0

  return (
    <div className="border-t border-slate-800 pt-4 space-y-3">
      <p className="text-sm text-slate-400 mb-2">Transfer USDC (Devnet)</p>

      <div className="space-y-2">
        <input
          type="text"
          placeholder="Recipient address"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          onClick={() => {
            if (!recipient && publicKey) {
              setRecipient(publicKey.toString())
            }
          }}
          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors"
        />
        <div className="relative">
          <input
            type="number"
            step="0.000001"
            min="0"
            placeholder="Amount (USDC)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 pr-14 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-medium">
            USDC
          </span>
        </div>
      </div>

      <button
        onClick={handleTransfer}
        disabled={!isFormValid || isLoading}
        className="w-full py-2.5 px-4 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
      >
        {isLoading ? 'Sending...' : 'Send USDC'}
      </button>

      {error && (
        <div className="text-xs text-red-400 bg-red-950/30 border border-red-900/50 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {signature && (
        <div className="text-xs text-emerald-400 bg-emerald-950/30 border border-emerald-900/50 rounded-lg px-3 py-2 space-y-1">
          <p>Transaction sent successfully!</p>
          <a
            href={`https://explorer.solana.com/tx/${signature}?cluster=devnet`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple-400 hover:text-purple-300 underline break-all"
          >
            View on Explorer
          </a>
        </div>
      )}
    </div>
  )
}
