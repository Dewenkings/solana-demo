import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { useState } from 'react'
import { LAMPORTS_PER_SOL } from '@solana/web3.js'

interface AirDropProps {
  onSuccess?: () => void
}

export const Airdrop = ({ onSuccess }: AirDropProps) => {
  const { connection } = useConnection()
  const { publicKey } = useWallet()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleAirdrop = async () => {
    if (!publicKey) return

    setError(null)
    setIsLoading(true)

    try {
      const signature = await connection.requestAirdrop(
        publicKey,
        LAMPORTS_PER_SOL
      )

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()

      await connection.confirmTransaction(
        {
          signature,
          blockhash,
          lastValidBlockHeight,
        },
        'confirmed'
      )

      onSuccess?.()
    } catch (err) {
      console.error('Failed to airdrop:', err)
      setError(err.message || 'Airdrop failed')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="pt-2">
      <button
        onClick={handleAirdrop}
        disabled={isLoading || !publicKey}
        className="w-full py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
      >
        {isLoading ? 'Requesting...' : 'Request 1 Devnet SOL'}
      </button>
      {error && <div className="mt-2 text-xs text-red-400">{error}</div>}
    </div>
  )
}
