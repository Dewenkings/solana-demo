import {
  SystemProgram,
  LAMPORTS_PER_SOL,
  Transaction,
  PublicKey,
} from '@solana/web3.js'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { useState } from 'react'

interface SendSOLProps {
  onSuccess?: () => void
}

const SendSOL = ({ onSuccess }: SendSOLProps) => {
  const [recipient, setRecipient] = useState<string>('')
  const [amount, setAmount] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [signature, setSignature] = useState<string | null>(null)

  const { connection } = useConnection()
  const { publicKey, sendTransaction } = useWallet()

  const handleSend = async () => {
    if (!publicKey) return

    setError(null)
    setSignature(null)

    // 校验金额
    const parsedAmount = parseFloat(amount)
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Please enter a valid amount greater than 0')
      return
    }

    // 校验地址
    let recipientPublicKey: PublicKey
    try {
      recipientPublicKey = new PublicKey(recipient.trim())
    } catch {
      setError('Invalid recipient address')
      return
    }

    // 不能转给自己（虽然技术上可以，但通常没有意义且容易误操作）
    if (recipientPublicKey.equals(publicKey)) {
      setError('Cannot send to yourself')
      return
    }

    setIsLoading(true)

    try {
      // lamports 必须是整数，所以 Math.round
      const amountInLamports = Math.round(parsedAmount * LAMPORTS_PER_SOL)

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: recipientPublicKey,
          lamports: amountInLamports,
        })
      )

      const sig = await sendTransaction(transaction, connection)
      setSignature(sig)

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
      console.error('Send failed:', err)
      setError(err.message || 'Transaction failed')
    } finally {
      setIsLoading(false)
    }
  }

  const isFormValid =
    recipient.trim().length > 0 && amount.length > 0 && parseFloat(amount) > 0

  return (
    <div className="border-t border-slate-800 pt-4 space-y-3">
      <p className="text-sm text-slate-400 mb-2">Send SOL</p>

      <div className="space-y-2">
        <input
          type="text"
          placeholder="Recipient address"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors"
        />
        <div className="relative">
          <input
            type="number"
            step="0.000000001"
            min="0"
            placeholder="Amount (SOL)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 pr-12 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-medium">
            SOL
          </span>
        </div>
      </div>

      <button
        onClick={handleSend}
        disabled={!isFormValid || isLoading}
        className="w-full py-2.5 px-4 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
      >
        {isLoading ? 'Sending...' : 'Send SOL'}
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

export default SendSOL
