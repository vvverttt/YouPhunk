'use client';

import { useState, useEffect, useRef } from 'react';
import { WagmiConfig, createConfig, http, useAccount, useConnect, useDisconnect } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { mainnet } from 'wagmi/chains';
import { RainbowKitProvider, ConnectButton } from '@rainbow-me/rainbowkit';
import Image from 'next/image';
import { ethers } from 'ethers';
import '@rainbow-me/rainbowkit/styles.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// @ts-ignore
import dystoPhunks from '../data/dysto-phunks.json';
// @ts-ignore
import etherPhunks from '../data/ether-phunks.json';
// @ts-ignore
import missingPhunks from '../data/missing-phunks.json';

const V2_PHUNKS_CONTRACT = '0xf07468eAd8cf26c752C676E43C814FEe9c8CF402';
const V3_PHUNKS_CONTRACT = '0xb7D405BEE01C70A9577316C1B9C2505F146e8842';
const V1_PHUNKS_CONTRACT = '0xA82F3a61F002F83Eba7D184c50bB2a8B359cA1cE';
const WRAPPED_V1_PHUNKS_CONTRACT = '0x235d49774139c218034c0571Ba8f717773eDD923';
const ERC721_ABI = [
  'function balanceOf(address owner) view returns (uint256)'
];

const wagmiConfig = createConfig({
  connectors: [injected()],
  chains: [mainnet],
  transports: {
    [mainnet.id]: http(),
  },
});

const queryClient = new QueryClient();

// Use .sha from your JSONs (which matches content_sha from the API)
// @ts-ignore
const dystoPhunkIdSet = new Set(dystoPhunks.collection_items.map(item => item.sha?.toLowerCase()));
// @ts-ignore
const etherPhunkIdSet = new Set(etherPhunks.collection_items.map(item => item.sha?.toLowerCase()));
// @ts-ignore
const missingPhunkIdSet = new Set(missingPhunks.collection_items.map(item => item.sha?.toLowerCase()));

const allowedAddresses = [
  '0x78d3aaf8e3cd4b350635c79b7021bd76144c582c', // your wallet or others
  // add more addresses as needed
];

function useHasMounted() {
  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => {
    setHasMounted(true);
  }, []);
  return hasMounted;
}

function MatrixBackground() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let width = window.innerWidth;
    let height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
    const fontSize = 28;
    let columns = Math.ceil(width / fontSize) + 2;
    let drops = Array(columns).fill(1).map(() => Math.random() * (height / fontSize));

    function handleResize() {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
      columns = Math.ceil(width / fontSize) + 2;
      drops = Array(columns).fill(1).map(() => Math.random() * (height / fontSize));
    }
    window.addEventListener('resize', handleResize);

    function draw() {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#0f0';
      ctx.font = fontSize + 'px monospace';
      for (let i = 0; i < drops.length; i++) {
        const text = String.fromCharCode(0x30A0 + Math.random() * 96);
        const drift = Math.sin(Date.now() / 1000 + i) * 2;
        ctx.fillText(text, i * fontSize + drift, drops[i] * fontSize);
        if (drops[i] * fontSize > height && Math.random() > 0.995) {
          drops[i] = 0;
        }
        drops[i] += 0.5;
      }
    }
    let animationId;
    function animate() {
      draw();
      animationId = requestAnimationFrame(animate);
    }
    animate();
    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);
  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        display: 'block',
      }}
    />
  );
}

function Gate() {
  const hasMounted = useHasMounted();
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();

  // State for each requirement
  const [ownsV2, setOwnsV2] = useState(false);
  const [ownsV3, setOwnsV3] = useState(false);
  const [ownsV1, setOwnsV1] = useState(false);
  const [ownsWrappedV1, setOwnsWrappedV1] = useState(false);
  const [ownsDysto, setOwnsDysto] = useState(false);
  const [ownsEther, setOwnsEther] = useState(false);
  const [ownsMissing, setOwnsMissing] = useState(false);
  const [allEthscriptions, setAllEthscriptions] = useState([]);
  const [userEthscriptionContentShas, setUserEthscriptionContentShas] = useState<string[]>([]);
  const [rawEthscriptionsApi, setRawEthscriptionsApi] = useState<any[]>([]);
  const [showDebug, setShowDebug] = useState(false);

  // Temporary concise debug output for wallet and SHA matching
  const [showTempDebug, setShowTempDebug] = useState(true);
  useEffect(() => {
    setShowTempDebug(true);
    const t = setTimeout(() => setShowTempDebug(false), 15000);
    return () => clearTimeout(t);
  }, [address]);

  // Find owned EtherPhunks (must match sha and current_owner)
  const ownedEtherPhunks = Array.isArray((etherPhunks as any)?.collection_items)
    ? (etherPhunks as any).collection_items.filter((item: any) =>
        rawEthscriptionsApi.some(e =>
          e.content_sha?.toLowerCase().replace(/^0x/, '') === item.sha?.toLowerCase().slice(-64) &&
          e.current_owner?.toLowerCase() === address?.toLowerCase()
        )
      )
    : [];
  // Find owned Missing Phunks (must match sha and current_owner)
  const ownedMissingPhunks = Array.isArray((missingPhunks as any)?.collection_items)
    ? (missingPhunks as any).collection_items.filter((item: any) =>
        rawEthscriptionsApi.some(e =>
          e.content_sha?.toLowerCase().replace(/^0x/, '') === item.sha?.toLowerCase().slice(-64) &&
          e.current_owner?.toLowerCase() === address?.toLowerCase()
        )
      )
    : [];
  // Find owned DystoPhunks (must match sha and current_owner)
  const ownedDystoPhunks = Array.isArray((dystoPhunks as any)?.collection_items)
    ? (dystoPhunks as any).collection_items.filter((item: any) =>
        rawEthscriptionsApi.some(e =>
          e.content_sha?.toLowerCase().replace(/^0x/, '') === item.sha?.toLowerCase().slice(-64) &&
          e.current_owner?.toLowerCase() === address?.toLowerCase()
        )
      )
    : [];

  // Animation state for highlighting
  const [highlightedSection, setHighlightedSection] = useState<number | null>(null);

  // Update checks array to only show label (no count)
  const checks = [
    { label: 'V2 Phunk', met: ownsV2 },
    { label: 'EtherPhunk', met: ownedEtherPhunks.length > 0 },
    { label: 'Missing Phunk', met: ownedMissingPhunks.length > 0 },
    { label: 'DystoPhunk', met: ownedDystoPhunks.length > 0 },
  ];
  const [showResults, setShowResults] = useState(false);
  const [checkingIndex, setCheckingIndex] = useState(0);
  const [showCheckResult, setShowCheckResult] = useState(false);
  const [matrixFade, setMatrixFade] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [typedMessage, setTypedMessage] = useState('');
  const [showCursor, setShowCursor] = useState(true);
  const [phase, setPhase] = useState<'pre-blink' | 'typing' | 'post-blink'>('pre-blink');
  const splashMessage = 'You Need A Phunk';

  // Track if all requirements are met
  const allChecksMet = checks.every(c => c.met);
  // Track if check animation is finished
  const [checksComplete, setChecksComplete] = useState(false);

  useEffect(() => {
    if (isConnected) {
      setTimeout(() => setMatrixFade(true), 400); // fade Matrix after connect
    } else {
      setMatrixFade(false);
    }
  }, [isConnected]);

  // Only start check animation after data is loaded and validated
  const dataReady = typeof ownsV2 === 'boolean' && Array.isArray(ownedEtherPhunks) && Array.isArray(ownedMissingPhunks) && Array.isArray(ownedDystoPhunks);
  useEffect(() => {
    if (!dataReady) return;
    setChecksComplete(false);
    setCheckingIndex(0);
    setShowCheckResult(false);
  }, [isConnected, address, dataReady]);

  // Fix: Ensure last checkmark stays visible after animation completes
  useEffect(() => {
    if (!dataReady) return;
    if (!checksComplete) {
    if (checkingIndex < checks.length - 1) {
      setShowCheckResult(false);
      const checkTimer = setTimeout(() => setShowCheckResult(true), 900);
      const nextTimer = setTimeout(() => {
        setShowCheckResult(false);
        setCheckingIndex(checkingIndex + 1);
      }, 1800);
      return () => {
        clearTimeout(checkTimer);
        clearTimeout(nextTimer);
      };
    } else if (checkingIndex === checks.length - 1) {
        setShowCheckResult(true); // Keep last check visible
      const nextTimer = setTimeout(() => {
          setChecksComplete(true);
      }, 1800);
      return () => {
        clearTimeout(nextTimer);
      };
    }
    }
  }, [checkingIndex, checksComplete, checks.length, dataReady]);

  // Reset animation on reload/connect
  useEffect(() => {
    setChecksComplete(false);
    setCheckingIndex(0);
    setShowCheckResult(false);
  }, [isConnected, address]);

  // Enter button state
  const [showGif, setShowGif] = useState(false);

  useEffect(() => {
    if (!hasMounted || !isConnected || !address) {
      setOwnsV2(false);
      return;
    }
    (async () => {
      const V2_PHUNKS_CONTRACT = '0xf07468eAd8cf26c752C676E43C814FEe9c8CF402';
      const ERC721_ABI = [
        'function balanceOf(address owner) view returns (uint256)'
      ];
      if (!window.ethereum) {
        console.error('No injected Ethereum provider found (is MetaMask installed?)');
        return;
      }
      try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const v2 = new ethers.Contract(V2_PHUNKS_CONTRACT, ERC721_ABI, provider);
        const v2Bal = await v2.balanceOf(address);
        console.log('[V2 CHECK] V2 Phunk balance:', v2Bal.toString(), 'for address:', address);
        setOwnsV2(v2Bal.gte(1));
      } catch (err) {
        console.error('[V2 CHECK] Error:', err);
        setOwnsV2(false);
      }
    })();
  }, [hasMounted, isConnected, address]);

  useEffect(() => {
    if (!hasMounted || !isConnected || !address) {
      setRawEthscriptionsApi([]);
      setUserEthscriptionContentShas([]);
      setOwnsDysto(false);
      setOwnsEther(false);
      setOwnsMissing(false);
      return;
    }

    // Only fetch for the connected address
    const fetchAddress = address.toLowerCase();
    let cancelled = false;
    (async () => {
      let allResults = [];
      let pageKey = undefined;
      let hasMore = true;
      while (hasMore) {
        const url = `https://api.ethscriptions.com/v2/ethscriptions?current_owner=${fetchAddress}` + (pageKey ? `&page_key=${pageKey}` : '');
        console.log('Fetching URL:', url);
        const response = await fetch(url);
        const data = await response.json();
        
        // Handle both array and paginated response formats
        const results = Array.isArray(data) ? data : (data.result || []);
        allResults = allResults.concat(results);
        
        hasMore = data.pagination?.has_more;
        pageKey = data.pagination?.page_key;
      }
      console.log('AllResults:', allResults);
      if (!cancelled) {
        setRawEthscriptionsApi(allResults);
        
        // Extract content_sha from ethscriptions (remove 0x prefix and lowercase)
        const userEthscriptionContentShas = allResults
          .map(e => e.content_sha?.toLowerCase().replace(/^0x/, ''))
          .filter(Boolean);
        setUserEthscriptionContentShas(userEthscriptionContentShas);
        
        // Update Phunk ownership booleans
        setOwnsDysto(
          Array.isArray((dystoPhunks as any)?.collection_items) &&
          (dystoPhunks as any).collection_items.some((item: any) =>
            rawEthscriptionsApi.some(e =>
              e.content_sha?.toLowerCase().replace(/^0x/, '') === item.sha?.toLowerCase().slice(-64) &&
              e.current_owner?.toLowerCase() === address?.toLowerCase()
            )
          )
        );
        setOwnsEther(
          Array.isArray((etherPhunks as any)?.collection_items) &&
          (etherPhunks as any).collection_items.some((item: any) =>
            rawEthscriptionsApi.some(e =>
              e.content_sha?.toLowerCase().replace(/^0x/, '') === item.sha?.toLowerCase().slice(-64) &&
              e.current_owner?.toLowerCase() === address?.toLowerCase()
            )
          )
        );
        setOwnsMissing(
          Array.isArray((missingPhunks as any)?.collection_items) &&
          (missingPhunks as any).collection_items.some((item: any) =>
            rawEthscriptionsApi.some(e =>
              e.content_sha?.toLowerCase().replace(/^0x/, '') === item.sha?.toLowerCase().slice(-64) &&
              e.current_owner?.toLowerCase() === address?.toLowerCase()
            )
          )
        );
      }
    })();
    
    return () => { 
      cancelled = true; 
    };
  }, [hasMounted, isConnected, address]);

  useEffect(() => {
    if (showSplash) {
      setTypedMessage('');
      setShowCursor(true);
      let preBlinkCount = 0;
      let preBlinkTimer;
      let typeInterval;
      let postBlinkCount = 0;
      let postBlinkTimer;
      // Pre-typing blink (6 times = 3 full on/off cycles)
      const preBlink = () => {
        setShowCursor((prev) => !prev);
        preBlinkCount++;
        if (preBlinkCount < 12) { // 6 full blinks (on/off)
          preBlinkTimer = setTimeout(preBlink, 400);
        } else {
          setShowCursor(true);
          // Start typing
          let i = 0;
          typeInterval = setInterval(() => {
            if (i < splashMessage.length) {
              setTypedMessage(splashMessage.slice(0, i + 1));
              i++;
            } else {
              clearInterval(typeInterval);
              setShowCursor(true);
              // Post-typing blink (3 times)
              const postBlink = () => {
                setShowCursor((prev) => !prev);
                postBlinkCount++;
                if (postBlinkCount < 6) { // 3 full on/off cycles
                  postBlinkTimer = setTimeout(postBlink, 400);
                } else {
                  setShowCursor(true);
                  setTimeout(() => setShowSplash(false), 400);
                }
              };
              postBlink();
            }
          }, 100);
        }
      };
      preBlink();
      return () => {
        clearTimeout(preBlinkTimer);
        clearInterval(typeInterval);
        clearTimeout(postBlinkTimer);
      };
    }
  }, [showSplash]);

  // Extra debug: print first 5 EtherPhunks and first 5 user ethscriptions SHAs, and comparison
  const debugCompare = Array.isArray((etherPhunks as any)?.collection_items) && rawEthscriptionsApi.length > 0 ? (
    <div style={{ color: '#ff0', fontSize: 11, margin: '8px 0' }}>
      <div><b>First 5 EtherPhunks SHAs:</b> {(etherPhunks as any).collection_items.slice(0,5).map((item: any) => item.sha).join(', ')}</div>
      <div><b>First 5 userEthscriptionContentShas:</b> {userEthscriptionContentShas.slice(0,5).join(', ')}</div>
      <div><b>Comparison (first 5):</b></div>
      {(etherPhunks as any).collection_items.slice(0,5).map((item: any, idx: number) => {
        const sha = item.sha?.toLowerCase().slice(-64);
        const match = userEthscriptionContentShas.slice(0,5).some(s => s.replace(/^0x/, '') === sha.replace(/^0x/, ''));
        return <div key={idx}>{sha} match: {match ? 'YES' : 'NO'}</div>;
      })}
    </div>
  ) : null;

  // Extra deep debug: print full and sliced sha, and compare to all userEthscriptionContentShas
  const deepDebugCompare = Array.isArray((etherPhunks as any)?.collection_items) && rawEthscriptionsApi.length > 0 ? (
    <div style={{ color: '#ff0', fontSize: 11, margin: '8px 0' }}>
      <div><b>First 5 EtherPhunks full sha:</b></div>
      {(etherPhunks as any).collection_items.slice(0,5).map((item: any, idx: number) => (
        <div key={idx}>
          <div>full: {item.sha}</div>
          <div>last64: {item.sha?.toLowerCase().slice(-64)}</div>
          <div>Matches any userEthscriptionContentSha?: {
            userEthscriptionContentShas.some(s => s.replace(/^0x/, '') === item.sha?.toLowerCase().slice(-64)) ? 'YES' : 'NO'
          }</div>
        </div>
      ))}
      <div><b>First 5 content_sha from API:</b></div>
      {rawEthscriptionsApi.slice(0,5).map((e, i) => (
        <div key={i}>{e.content_sha}</div>
      ))}
    </div>
  ) : null;

  // Debug output toggleable (for troubleshooting)
  const debugBlock = (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      maxHeight: '40vh',
      overflowY: 'auto',
      background: 'rgba(0,0,0,0.9)',
      color: '#0f0',
      fontSize: 12,
      zIndex: 9999,
      padding: 12,
      borderBottom: '2px solid #0f0',
      boxShadow: '0 2px 8px rgba(0,255,0,0.3)',
      fontFamily: 'monospace',
    }}>
      <div><b>Wallet:</b> {address}</div>
      <div><b>userEthscriptionContentShas:</b> {JSON.stringify(userEthscriptionContentShas)}</div>
      <div><b>etherPhunkIdSet:</b> {JSON.stringify(Array.from(etherPhunkIdSet))}</div>
      <div><b>missingPhunkIdSet:</b> {JSON.stringify(Array.from(missingPhunkIdSet))}</div>
      <div><b>dystoPhunkIdSet:</b> {JSON.stringify(Array.from(dystoPhunkIdSet))}</div>
      <div><b>DystoPhunks collection_items count:</b> {Array.isArray((dystoPhunks as any)?.collection_items) ? (dystoPhunks as any).collection_items.length : 0}</div>
      <div><b>Matched EtherPhunks:</b> {userEthscriptionContentShas.filter(id => etherPhunkIdSet.has(id)).join(', ')}</div>
      <div><b>Matched MissingPhunks:</b> {userEthscriptionContentShas.filter(id => missingPhunkIdSet.has(id)).join(', ')}</div>
      <div><b>Matched DystoPhunks:</b> {userEthscriptionContentShas.filter(id => dystoPhunkIdSet.has(id)).join(', ')}</div>
      <div><b>All EtherPhunks sha:</b> {JSON.stringify(Array.from(etherPhunkIdSet))}</div>
      <div><b>All MissingPhunks sha:</b> {JSON.stringify(Array.from(missingPhunkIdSet))}</div>
      <div><b>All DystoPhunks sha:</b> {JSON.stringify(Array.from(dystoPhunkIdSet))}</div>
      <div><b>Raw Ethscriptions API:</b> {JSON.stringify(rawEthscriptionsApi)}</div>
      <div>
        <h3>Your Ethscriptions:</h3>
        <ul style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {rawEthscriptionsApi && rawEthscriptionsApi.map((e, i) => (
            <li key={e.content_sha ? `sha-${e.content_sha}` : `idx-${i}`} style={{ listStyle: 'none' }}>
              <div style={{ fontSize: 10 }}>{e.content_sha}</div>
              {e.content_uri && e.content_uri.startsWith('data:image') && (
                <img
                  src={e.content_uri}
                  alt={e.content_sha}
                  style={{
                    width: 96,
                    height: 96,
                    objectFit: 'contain',
                    background: 'transparent',
                    borderRadius: 4,
                    boxShadow: 'none',
                    display: 'block'
                  }}
                />
              )}
              <div style={{ fontSize: 10 }}>mimetype: {e.media_type || e.mime_type || e.mimetype || 'unknown'}</div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );

  const debugButton = (
    <button
      onClick={() => setShowDebug(!showDebug)}
      style={{
        position: 'fixed',
        top: '10px',
        right: '10px',
        zIndex: 10000,
        background: 'rgba(0,0,0,0.8)',
        color: '#0f0',
        border: '1px solid #0f0',
        padding: '8px 12px',
        borderRadius: '4px',
        fontFamily: 'monospace',
        fontSize: '12px',
        cursor: 'pointer',
        transition: 'all 0.2s',
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.background = 'rgba(0,255,0,0.2)';
        e.currentTarget.style.boxShadow = '0 0 10px #0f0';
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.background = 'rgba(0,0,0,0.8)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {showDebug ? 'Hide Debug' : 'Show Debug'}
    </button>
  );

  // Add debug output for counts
  const phunkDebugCounts = (
    <div style={{ color: '#ff0', fontSize: 13, margin: '8px 0', fontFamily: 'monospace' }}>
      <div><b>Total ethscriptions fetched from API:</b> {rawEthscriptionsApi.length}</div>
      <div><b>Total EtherPhunks in local JSON:</b> {etherPhunks.collection_items.length}</div>
      <div><b>Matched EtherPhunks (displayed):</b> {ownedEtherPhunks.length}</div>
    </div>
  );

  // Highlight section as each check completes
  useEffect(() => {
    if (showCheckResult && checkingIndex < checks.length) {
      setHighlightedSection(checkingIndex);
      const t = setTimeout(() => setHighlightedSection(null), 700);
      return () => clearTimeout(t);
    }
  }, [showCheckResult, checkingIndex]);

  // Terminal check animation rendering (compact, terminal style)
  const renderTerminalChecks = () => (
    <div style={{
      background: 'rgba(0,0,0,0.92)',
      border: '1px solid #0f0',
      borderRadius: 4,
      padding: '12px 18px 8px 18px',
      minWidth: 260,
      maxWidth: 320,
      margin: '0 auto',
      fontFamily: 'monospace',
      fontSize: 15,
      color: '#0ff',
      boxShadow: '0 0 12px #0f08',
      marginBottom: 0,
      marginTop: 12,
    }}>
      {checks.map((check, idx) => {
        if (idx > checkingIndex) return null;
        const isCurrent = idx === checkingIndex;
        const showMark = idx < checkingIndex || (isCurrent && showCheckResult);
        return (
          <div key={check.label} style={{ display: 'flex', alignItems: 'center', minHeight: 22, borderBottom: '1px solid #033', padding: '0 0 2px 0' }}>
            <span style={{ color: '#0ff', minWidth: 0, flex: 1, textAlign: 'left' }}>{check.label}</span>
            <span style={{ minWidth: 24, textAlign: 'right', fontWeight: 'bold', fontSize: 18 }}>
              {showMark ? (
                check.met ? (
                  <span style={{ color: '#0f0' }}>✔</span>
                ) : (
                  <span style={{ color: '#f00' }}>✗</span>
                )
              ) : (
                <span style={{ color: '#033' }}>...</span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );

  // Debug for EtherPhunk 3885
  const etherPhunk3885 = Array.isArray((etherPhunks as any)?.collection_items)
    ? (etherPhunks as any).collection_items.find((p: any) => p.id === 3885 || p.id === '3885')
    : undefined;
  const sha3885 = etherPhunk3885?.sha?.toLowerCase();
  const sha3885last64 = sha3885?.slice(-64);
  const api3885 = rawEthscriptionsApi.find(e => e.content_sha?.toLowerCase().replace(/^0x/, '') === sha3885last64);
  const [show3885Debug, setShow3885Debug] = useState(true);
  useEffect(() => {
    setShow3885Debug(true);
    const t = setTimeout(() => setShow3885Debug(false), 20000);
    return () => clearTimeout(t);
  }, [address]);

  // Debug for all expected MissingPhunks
  const expectedMissingPhunks = Array.isArray((missingPhunks as any)?.collection_items)
    ? (missingPhunks as any).collection_items.filter((item: any) =>
        [10082, 10007, 10196, 10197, 10169, 10164, 10185].includes(Number(item.id))
      )
    : [];
  const [showMissingDebug, setShowMissingDebug] = useState(true);
  useEffect(() => {
    setShowMissingDebug(true);
    const t = setTimeout(() => setShowMissingDebug(false), 30000);
    return () => clearTimeout(t);
  }, [address]);

  if (!hasMounted) {
    return null;
  }

  if (showSplash) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-white" style={{ background: '#000' }}>
        <MatrixBackground />
        <div className="text-3xl font-mono text-green-400" style={{ zIndex: 1, position: 'relative', letterSpacing: '0.1em', minHeight: '2.5em' }}>
          <span style={{ display: 'inline-block', minWidth: '1ch' }}>
            {typedMessage}
            <span style={{ visibility: showCursor ? 'visible' : 'hidden' }}>|</span>
          </span>
        </div>
        {/* Debug UI for dev only */}
        {showDebug && debugBlock}
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-white">
        <MatrixBackground />
        <ConnectButton />
        {showDebug && debugBlock}
        {debugButton}
      </div>
    );
  }

  console.log('userEthscriptionContentShas', userEthscriptionContentShas);
  console.log('etherPhunkIdSet', Array.from(etherPhunkIdSet));
  console.log('missingPhunkIdSet', Array.from(missingPhunkIdSet));
  console.log('Owned EtherPhunks:', ownedEtherPhunks.map(p => p.sha));
  console.log('Owned Missing Phunks:', ownedMissingPhunks.map(p => p.sha));

  // Only show image ethscriptions with image data
  const imageEthscriptions = rawEthscriptionsApi.filter(e =>
    e.content_uri && e.content_uri.startsWith('data:image')
  );

  // Only show phunk ethscriptions with image data
  const phunkHashes = new Set([
    ...Array.from(dystoPhunkIdSet),
    ...Array.from(etherPhunkIdSet),
    ...Array.from(missingPhunkIdSet),
  ]);
  const ownedPhunkEthscriptions = rawEthscriptionsApi.filter(e =>
    e.content_sha && phunkHashes.has(e.content_sha.toLowerCase().replace(/^0x/, '')) && e.content_uri && e.content_uri.startsWith('data:image')
  );

  return (
    <>
      {showDebug && debugBlock}
      {debugButton}
      <MatrixBackground />
      {phunkDebugCounts}
      {/* If not past the gate, show gate UI. If past, show next page only. */}
      {!showGif ? (
      <div
        className="flex flex-col items-center justify-center min-h-screen"
        style={{
          position: 'relative',
          zIndex: 1,
          fontFamily: 'monospace',
          color: '#0f0',
          background: 'rgba(0,0,0,0.85)',
          borderRadius: '8px',
          padding: '2rem 3rem',
          boxShadow: '0 0 40px #0f0a',
          marginTop: '4rem',
          minWidth: 320,
          opacity: matrixFade ? 1 : 0,
          transition: 'opacity 1.2s',
            maxHeight: '90vh',
            overflowY: 'auto',
        }}
      >
        <div className="text-lg mb-4" style={{ color: '#0ff' }}>
          $ ./phunk-check.sh
        </div>
          {/* Terminal check animation only, no grid/images */}
          {renderTerminalChecks()}
          {/* Show lab.gif above the ENTER button if all checks are met and animation is complete */}
          {checksComplete && allChecksMet && (
            null
          )}
        </div>
      ) : (
        <div style={{ marginTop: 40, textAlign: 'center' }}>
          <img src="/lab.gif" alt="Phunk Lab GIF" style={{ maxWidth: 400, borderRadius: 12, boxShadow: '0 0 24px #0f0a' }} />
          {/* Add any additional next-page content here */}
        </div>
        )}
    </>
  );
}

export default function Home() {
  return (
    <WagmiConfig config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <Gate />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiConfig>
  );
} 