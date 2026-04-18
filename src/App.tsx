import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { useEffect, useState } from 'react'
import { Airdrop } from './AirDropButton'
import { LAMPORTS_PER_SOL } from '@solana/web3.js'
import SendSOL from './SendSOL'
import { TransferToken } from './TransferToken'
function App() {
  const { publicKey, connected, disconnecting } = useWallet()
  const { connection } = useConnection()
  const [balance, setBalance] = useState<number | null>(null)

  // 只要钱包已连接但余额还没拿到，就认为是 loading
  const isLoading = publicKey !== null && balance === null

  useEffect(() => {
    if (!publicKey) {
      return
    }

    let cancelled = false

    connection
      .getBalance(publicKey)
      .then((lamports) => {
        if (!cancelled) {
          setBalance(lamports / LAMPORTS_PER_SOL)
        }
      })
      .catch((err) => {
        console.error('Failed to fetch balance:', err)
        if (!cancelled) {
          setBalance(null)
        }
      })

    return () => {
      cancelled = true
    }
  }, [publicKey, connection])

  const refetchBalance = async () => {
    if (!publicKey) return
    // 先把 balance 设回 null 来触发 loading 状态
    setBalance(null)
    try {
      const lamports = await connection.getBalance(publicKey)
      setBalance(lamports / LAMPORTS_PER_SOL)
    } catch (err) {
      console.error('Failed to refetch balance:', err)
      setBalance(null)
    }
  }

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Solana Wallet Demo</h1>
          <p className="text-slate-400">Connect your wallet to view balance</p>
        </div>

        {/* Connect Button */}
        <div className="flex justify-center">
          <WalletMultiButton
            className="!bg-purple-600 !hover:bg-purple-700 !text-white !font-medium !px-6 !py-3 !rounded-xl !transition-colors"
          />
        </div>

        {/* Wallet Info Card */}
        {connected && publicKey && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div>
              <p className="text-sm text-slate-400 mb-1">Wallet Address</p>
              <p className="font-mono text-sm bg-slate-950 px-3 py-2 rounded-lg break-all">
                {publicKey.toString()}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {truncateAddress(publicKey.toString())}
              </p>
            </div>

            <div className="border-t border-slate-800 pt-4">
              <p className="text-sm text-slate-400 mb-1">SOL Balance</p>
              <div className="flex items-baseline gap-2">
                {isLoading || disconnecting ? (
                  <div className="h-8 w-24 bg-slate-800 rounded animate-pulse" />
                ) : (
                  <>
                    <span className="text-3xl font-bold">
                      {balance !== null ? balance.toFixed(4) : '--'}
                    </span>
                    <span className="text-slate-400">SOL</span>
                  </>
                )}
              </div>
            </div>
            <Airdrop onSuccess={refetchBalance} />
            <SendSOL onSuccess={refetchBalance} />
            <TransferToken onSuccess={refetchBalance} />
          </div>
        )}

        {/* Disconnected State */}
        {!connected && !disconnecting && (
          <div className="text-center text-slate-500 text-sm">
            <p>Click the button above to connect with Phantom or Solflare</p>
          </div>
        )}

        {/* Network Badge */}
        <div className="flex justify-center">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-950 text-emerald-400 border border-emerald-900">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Devnet
          </span>
        </div>
      </div>
    </div>
  )
}

export default App
