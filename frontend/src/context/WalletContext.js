import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';

const WalletContext = createContext(null);

export function WalletProvider({ children }) {
  const [account, setAccount] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const checkConnection = useCallback(async () => {
    if (window.ethereum) {
      try {
        const web3Provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await web3Provider.listAccounts();
        if (accounts.length > 0) {
          const signer = await web3Provider.getSigner();
          const network = await web3Provider.getNetwork();
          setProvider(web3Provider);
          setSigner(signer);
          setAccount(accounts[0].address);
          setChainId(Number(network.chainId));
          setIsConnected(true);
        } else {
          setProvider(null);
          setSigner(null);
          setAccount(null);
          setChainId(null);
          setIsConnected(false);
        }
      } catch (error) {
        console.error('Failed to check wallet connection:', error);
      }
    }
  }, []);

  useEffect(() => {
    checkConnection();

    if (window.ethereum) {
      const handleAccountsChanged = (accounts) => {
        if (!accounts || accounts.length === 0) {
          setProvider(null);
          setSigner(null);
          setAccount(null);
          setChainId(null);
          setIsConnected(false);
        } else {
          checkConnection();
        }
      };

      const handleChainChanged = () => {
        checkConnection();
      };

      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);

      return () => {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      };
    }
  }, [checkConnection]);

  const connect = async () => {
    if (!window.ethereum) {
      throw new Error('MetaMask or Web3 wallet extension is not installed. Please install MetaMask to interact with the blockchain.');
    }

    setIsConnecting(true);
    try {
      const web3Provider = new ethers.BrowserProvider(window.ethereum);
      await web3Provider.send('eth_requestAccounts', []);
      const signer = await web3Provider.getSigner();
      const network = await web3Provider.getNetwork();
      const address = await signer.getAddress();

      setProvider(web3Provider);
      setSigner(signer);
      setAccount(address);
      setChainId(Number(network.chainId));
      setIsConnected(true);
      return { address, chainId: Number(network.chainId), signer };
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      throw error;
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnect = () => {
    setProvider(null);
    setSigner(null);
    setAccount(null);
    setChainId(null);
    setIsConnected(false);
  };

  const switchNetwork = async (targetChainId) => {
    if (!window.ethereum) return;
    const hexChainId = `0x${Number(targetChainId).toString(16)}`;
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: hexChainId }],
      });
      await checkConnection();
    } catch (error) {
      if (error.code === 4902 || error?.data?.originalError?.code === 4902) {
        try {
          const isSepolia = Number(targetChainId) === 11155111;
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: hexChainId,
              chainName: isSepolia ? 'Ethereum Sepolia Testnet' : 'Hardhat Localhost',
              nativeCurrency: {
                name: isSepolia ? 'Sepolia Ether' : 'Localhost ETH',
                symbol: isSepolia ? 'SEP' : 'GO',
                decimals: 18
              },
              rpcUrls: [
                isSepolia
                  ? 'https://ethereum-sepolia-rpc.publicnode.com'
                  : 'http://127.0.0.1:8545'
              ],
              blockExplorerUrls: isSepolia ? ['https://sepolia.etherscan.io'] : [],
            }],
          });
          await checkConnection();
        } catch (addError) {
          console.error('Failed to add network:', addError);
          throw addError;
        }
      } else {
        throw error;
      }
    }
  };

  const isSepolia = chainId === 11155111;
  const isLocal = chainId === 31337;
  const isSupportedNetwork = isSepolia || isLocal;
  const networkName = isSepolia
    ? 'Ethereum Sepolia'
    : isLocal
    ? 'Hardhat Localhost'
    : chainId
    ? `Chain ID ${chainId}`
    : 'Disconnected';

  const value = {
    account,
    provider,
    signer,
    chainId,
    isSepolia,
    isLocal,
    isSupportedNetwork,
    networkName,
    isConnected,
    isConnecting,
    connect,
    disconnect,
    switchNetwork,
    checkConnection,
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}