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

  // Terminal animation state
  const checks = [
    { label: 'V2 Phunk', met: ownsV2 },
    { label: 'EtherPhunk', met: ownsEther },
    { label: 'Missing Phunk', met: ownsMissing },
    { label: 'DystoPhunk', met: ownsDysto },
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

  useEffect(() => {
    if (isConnected) {
      setTimeout(() => setMatrixFade(true), 400); // fade Matrix after connect
    } else {
      setMatrixFade(false);
    }
  }, [isConnected]);

  useEffect(() => {
    if (!isConnected) return;

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
      setShowCheckResult(false);
      const checkTimer = setTimeout(() => setShowCheckResult(true), 900);
      const nextTimer = setTimeout(() => {
        setShowCheckResult(false);
        setShowResults(true);
      }, 1800);
      return () => {
        clearTimeout(checkTimer);
        clearTimeout(nextTimer);
      };
    }
  }, [checkingIndex, isConnected]);

  useEffect(() => {
    setShowResults(false);
    setCheckingIndex(0);
    setShowCheckResult(false);
  }, [isConnected, address]);

  useEffect(() => {
    if (!hasMounted || !isConnected || !address) return;

    // ERC-721 checks (separate try/catch)
    (async () => {
      try {
        const ethProvider = new ethers.providers.Web3Provider(window.ethereum);
        const v2 = new ethers.Contract(V2_PHUNKS_CONTRACT, ERC721_ABI, ethProvider);
        const v2Bal = await v2.balanceOf(address);
        setOwnsV2(v2Bal.gte(1));
        // ...other ERC-721 checks if needed...
      } catch (err) {
        setOwnsV2(false);
        // ...set other ERC-721 states to false if needed...
      }
    })();

    // Use the connected address if available, otherwise use a test address for debugging
    const fetchAddress = address ? address.toLowerCase() : '0x78d3aaf8e3cd4b350635c79b7021bd76144c582c';
    let cancelled = false;
    (async () => {
      let allResults = [];
      let pageKey = undefined;
      let hasMore = true;
      while (hasMore) {
        const url = `/api/ethscriptions?owner=${fetchAddress}` + (pageKey ? `&page_key=${pageKey}` : '');
        console.log('Fetching URL:', url);
        const response = await fetch(url);
        const data = await response.json();
        console.log('API response', data);
        allResults = allResults.concat(data.result || []);
        hasMore = data.pagination?.has_more;
        pageKey = data.pagination?.page_key;
      }
      console.log('AllResults:', allResults);
      if (!cancelled) {
        setRawEthscriptionsApi(allResults);
        const userEthscriptionContentShas = allResults
          .map(e => e.content_sha?.toLowerCase().replace(/^0x/, ''))
          .filter(Boolean);
        console.log('userEthscriptionContentShas:', userEthscriptionContentShas);
        setUserEthscriptionContentShas(userEthscriptionContentShas);
        // Update Phunk ownership booleans
        setOwnsDysto(userEthscriptionContentShas.some(id => dystoPhunkIdSet.has(id)));
        setOwnsEther(userEthscriptionContentShas.some(id => etherPhunkIdSet.has(id)));
        setOwnsMissing(userEthscriptionContentShas.some(id => missingPhunkIdSet.has(id)));
        console.log('ownsDysto:', userEthscriptionContentShas.some(id => dystoPhunkIdSet.has(id)));
        console.log('ownsEther:', userEthscriptionContentShas.some(id => etherPhunkIdSet.has(id)));
        console.log('ownsMissing:', userEthscriptionContentShas.some(id => missingPhunkIdSet.has(id)));

        // After fetching allResults
        const imageEthscriptions = allResults.filter(e =>
          e.content_uri && e.content_uri.startsWith('data:image')
        );

        // If you want to filter for specific hashes (e.g., only Phunks)
        const phunkHashes = new Set([
          ...Array.from(dystoPhunkIdSet),
          ...Array.from(etherPhunkIdSet),
          ...Array.from(missingPhunkIdSet),
        ]);
        const ownedPhunkEthscriptions = allResults.filter(e =>
          e.content_sha && phunkHashes.has(e.content_sha.toLowerCase().replace(/^0x/, ''))
        );
      }
    })();
    return () => { cancelled = true; };
  }, [hasMounted, isConnected, address]);

  // Minimal direct fetch test
  useEffect(() => {
    if (!hasMounted) return;
    (async () => {
      let allResults = [];
      let pageKey = undefined;
      let hasMore = true;
      const address = '0x78d3aaf8e3cd4b350635c79b7021bd76144c582c';
      while (hasMore) {
        const url = `/api/ethscriptions?owner=${address}` + (pageKey ? `&page_key=${pageKey}` : '');
        const response = await fetch(url);
        const data = await response.json();
        allResults = allResults.concat(data.result || []);
        hasMore = data.pagination?.has_more;
        pageKey = data.pagination?.page_key;
      }
      setRawEthscriptionsApi(allResults);
      setAllEthscriptions(allResults);
      console.log('Fetched allResults:', allResults);
    })();
  }, [hasMounted]);

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

  // Find owned EtherPhunks
  const ownedEtherPhunks = etherPhunks.collection_items.filter(item =>
    userEthscriptionContentShas.includes(item.sha?.toLowerCase())
  );
  // Find owned Missing Phunks
  const ownedMissingPhunks = Array.isArray((missingPhunks as any).collection_items)
    ? (missingPhunks as any).collection_items.filter((item: any) =>
        userEthscriptionContentShas.includes(item.sha?.toLowerCase())
      )
    : [];
  // Find owned DystoPhunks
  const ownedDystoPhunks = Array.isArray((dystoPhunks as any).collection_items)
    ? (dystoPhunks as any).collection_items.filter((item: any) =>
        userEthscriptionContentShas.includes(item.sha?.toLowerCase())
      )
    : [];

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
      <div><b>dystoPhunkIdSet:</b> {JSON.stringify(Array.from(dystoPhunkIdSet))}</div>
      <div><b>etherPhunkIdSet:</b> {JSON.stringify(Array.from(etherPhunkIdSet))}</div>
      <div><b>missingPhunkIdSet:</b> {JSON.stringify(Array.from(missingPhunkIdSet))}</div>
      <div><b>Owns Dysto:</b> {String(ownsDysto)}</div>
      <div><b>Owns Ether:</b> {String(ownsEther)}</div>
      <div><b>Owns Missing:</b> {String(ownsMissing)}</div>
      <div><b>Owned EtherPhunks:</b> {JSON.stringify(ownedEtherPhunks.map(p => p.sha))}</div>
      <div><b>Owned Missing Phunks:</b> {JSON.stringify(ownedMissingPhunks.map(p => p.sha))}</div>
      <div><b>Owned DystoPhunks:</b> {JSON.stringify(ownedDystoPhunks.map(p => p.sha))}</div>
      <div><b>Raw Ethscriptions API:</b> {JSON.stringify(rawEthscriptionsApi)}</div>
      <div>
        <h3>Your Ethscriptions:</h3>
        <ul style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {rawEthscriptionsApi && rawEthscriptionsApi.map(e => (
            <li key={e.content_sha} style={{ listStyle: 'none' }}>
              <div style={{ fontSize: 10 }}>{e.content_sha}</div>
              {e.content_uri && e.content_uri.startsWith('data:image') && (
                <img src={e.content_uri} alt={e.content_sha} style={{ width: 64, height: 64, objectFit: 'contain', background: '#eee' }} />
              )}
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

  const imageEthscriptions = rawEthscriptionsApi.filter(e =>
    e.content_uri && e.content_uri.startsWith('data:image')
  );

  const phunkHashes = new Set([
    ...Array.from(dystoPhunkIdSet),
    ...Array.from(etherPhunkIdSet),
    ...Array.from(missingPhunkIdSet),
  ]);

  const ownedPhunkEthscriptions = rawEthscriptionsApi.filter(e =>
    e.content_sha && phunkHashes.has(e.content_sha.toLowerCase().replace(/^0x/, ''))
  );

  return (
    <>
      {showDebug && debugBlock}
      {debugButton}
      <MatrixBackground />
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
        }}
      >
        <div className="text-lg mb-4" style={{ color: '#0ff' }}>
          $ ./phunk-check.sh
        </div>
        {!showResults ? (
          <ul className="space-y-2">
            {checks.slice(0, checkingIndex + 1).map((req, i) => (
              <li key={req.label}>
                <span style={{ color: '#0ff' }}>
                  $ checking for {req.label}...<span className="animate-pulse">_</span>
                </span>
                {showCheckResult && i === checkingIndex ? (
                  <div style={{ color: req.met ? '#0f0' : '#f00', marginLeft: '2rem', fontWeight: 'bold' }}>
                    {req.label}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <ul className="space-y-2">
            {checks.map(req => (
              <li key={req.label} className="flex items-center text-xl">
                <span style={{ color: req.met ? '#0f0' : '#f00', marginRight: '1rem' }}>
                  {req.met ? '✔' : '✖'}
                </span>
                <span style={{ color: req.met ? '#0f0' : '#f00' }}>{req.label}</span>
              </li>
            ))}
          </ul>
        )}
        {/* Show owned Phunks after checkmarks */}
        <div style={{ color: 'white', marginTop: 24, textAlign: 'left', width: '100%' }}>
          <h3 style={{ color: '#0ff', marginBottom: 4 }}>Owned V2 Phunks:</h3>
          {ownsV2 ? (
            <div>You own at least one V2 Phunk! (ERC-721)</div>
          ) : (
            <div style={{ color: '#f00' }}>None detected.</div>
          )}
          <h3 style={{ color: '#0ff', margin: '16px 0 4px 0' }}>Owned EtherPhunks:</h3>
          {ownedEtherPhunks.length > 0 ? (
            <ul>
              {ownedEtherPhunks.map(phunk => (
                <li key={phunk.sha} style={{ marginBottom: 4 }}>
                  #{phunk.name || phunk.id || phunk.sha}
                  {'image_url' in phunk && phunk.image_url ? (
                    <img src={phunk.image_url as string} alt={phunk.name as string} style={{ width: 40, verticalAlign: 'middle', marginLeft: 8 }} />
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <div style={{ color: '#f00' }}>None detected.</div>
          )}
          <h3 style={{ color: '#0ff', margin: '16px 0 4px 0' }}>Owned Missing Phunks:</h3>
          {ownedMissingPhunks.length > 0 ? (
            <ul>
              {ownedMissingPhunks.map(phunk => (
                <li key={phunk.sha} style={{ marginBottom: 4 }}>
                  #{phunk.name || phunk.id || phunk.sha}
                  {'image_url' in phunk && phunk.image_url ? (
                    <img src={phunk.image_url as string} alt={phunk.name as string} style={{ width: 40, verticalAlign: 'middle', marginLeft: 8 }} />
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <div style={{ color: '#f00' }}>None detected.</div>
          )}
          <h3 style={{ color: '#0ff', margin: '16px 0 4px 0' }}>Owned DystoPhunks:</h3>
          {ownedDystoPhunks.length > 0 ? (
            <ul>
              {ownedDystoPhunks.map(phunk => (
                <li key={phunk.sha} style={{ marginBottom: 4 }}>
                  #{phunk.name || phunk.id || phunk.sha}
                  {'image_url' in phunk && phunk.image_url ? (
                    <img src={phunk.image_url as string} alt={phunk.name as string} style={{ width: 40, verticalAlign: 'middle', marginLeft: 8 }} />
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <div style={{ color: '#f00' }}>None detected.</div>
          )}
        </div>
        {/* Show all owned Ethscriptions (images if available) */}
        <div style={{ marginTop: 24, width: '100%' }}>
          <h3 style={{ color: '#0ff' }}>All Ethscriptions You Own ({rawEthscriptionsApi.length}):</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {rawEthscriptionsApi.map(e => (
              <div key={e.content_sha} style={{ width: 80, textAlign: 'center', fontSize: 10 }}>
                {e.content_uri && e.content_uri.startsWith('data:image') ? (
                  <img src={e.content_uri} alt={e.content_sha} style={{ width: 64, height: 64, objectFit: 'contain', background: '#eee' }} />
                ) : (
                  <div style={{ width: 64, height: 64, background: '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    No image
                  </div>
                )}
                <div style={{ wordBreak: 'break-all' }}>{e.content_sha?.slice(0, 8)}...</div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h3>Image Ethscriptions You Own ({imageEthscriptions.length}):</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {imageEthscriptions.map(e => (
              <div key={e.content_sha} style={{ width: 80, textAlign: 'center', fontSize: 10 }}>
                <img src={e.content_uri} alt={e.content_sha} style={{ width: 64, height: 64, objectFit: 'contain', background: '#eee' }} />
                <div style={{ wordBreak: 'break-all' }}>{e.content_sha?.slice(0, 8)}...</div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h3>Phunk Ethscriptions You Own ({ownedPhunkEthscriptions.length}):</h3>
          <ul>
            {ownedPhunkEthscriptions.map(e => (
              <li key={e.content_sha}>{e.content_sha}</li>
            ))}
          </ul>
        </div>
        {showResults && (
          <button
            className="mt-8 px-6 py-2 rounded bg-black border border-green-400 text-green-400 font-mono hover:bg-green-900"
            onClick={() => disconnect()}
            style={{ marginTop: '2rem' }}
          >
            exit
          </button>
        )}
      </div>
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