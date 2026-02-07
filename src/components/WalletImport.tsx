import { useState } from 'react';
import { useSolana } from '../context/SolanaContext';
import bs58 from 'bs58';
import './WalletImport.css';

const WalletImport = () => {
  const { connectWallet, isConnected } = useSolana();
  const [privateKeyInput, setPrivateKeyInput] = useState('');
  const [showInput, setShowInput] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importMethod, setImportMethod] = useState<'paste' | 'file'>('paste');

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    setIsImporting(true);

    try {
      const text = await file.text();
      const keypairData = JSON.parse(text);

      if (!Array.isArray(keypairData) || keypairData.length !== 64) {
        setError('Invalid keypair file. Expected JSON array with 64 numbers.');
        setIsImporting(false);
        return;
      }

      // Validate all values are valid bytes
      if (keypairData.some((b: any) => b < 0 || b > 255 || isNaN(b))) {
        setError('Invalid keypair format. All values must be bytes (0-255).');
        setIsImporting(false);
        return;
      }

      // Convert to Uint8Array and import
      const privateKeyBytes = Uint8Array.from(keypairData);
      connectWallet(privateKeyBytes);

      // Clear file input
      event.target.value = '';
      setShowInput(false);
      
    } catch (err: any) {
      setError(err.message || 'Failed to read keypair file. Make sure it\'s a valid JSON file.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleImport = async () => {
    setError(null);
    
    if (!privateKeyInput.trim()) {
      setError('Please enter a private key');
      return;
    }

    setIsImporting(true);

    try {
      // Parse private key - can be:
      // 1. JSON array: [1,2,3,...]
      // 2. Comma-separated: "1,2,3,..."
      // 3. Base58 string (if using Solana CLI format)
      let privateKeyArray: number[];

      // Try parsing as JSON array
      if (privateKeyInput.trim().startsWith('[')) {
        privateKeyArray = JSON.parse(privateKeyInput.trim());
      } 
      // Try parsing as comma-separated
      else if (privateKeyInput.includes(',')) {
        privateKeyArray = privateKeyInput.split(',').map(s => parseInt(s.trim(), 10));
      }
      // Try parsing as base58 (Solana CLI format)
      else {
        try {
          const decoded = bs58.decode(privateKeyInput.trim());
          if (decoded.length === 64) {
            privateKeyArray = Array.from(decoded);
          } else {
            setError('Invalid base58 private key length. Expected 64 bytes.');
            setIsImporting(false);
            return;
          }
        } catch {
          setError('Invalid format. Please provide as JSON array [1,2,3,...], comma-separated values, or base58 string');
          setIsImporting(false);
          return;
        }
      }

      // Validate array length (Solana private keys are 64 bytes)
      if (privateKeyArray.length !== 64) {
        setError('Invalid private key length. Solana private keys must be 64 numbers (bytes).');
        setIsImporting(false);
        return;
      }

      // Validate all values are valid bytes (0-255)
      if (privateKeyArray.some(b => b < 0 || b > 255 || isNaN(b))) {
        setError('Invalid private key format. All values must be bytes (0-255).');
        setIsImporting(false);
        return;
      }

      // Convert to Uint8Array
      const privateKeyBytes = Uint8Array.from(privateKeyArray);

      // Connect wallet with private key
      connectWallet(privateKeyBytes);

      // Clear input
      setPrivateKeyInput('');
      setShowInput(false);
      
    } catch (err: any) {
      setError(err.message || 'Failed to import private key. Please check the format.');
    } finally {
      setIsImporting(false);
    }
  };

  if (isConnected) {
    return null; // Don't show import if already connected
  }

  return (
    <div className="wallet-import">
      {!showInput ? (
        <button 
          onClick={() => setShowInput(true)}
          className="import-wallet-btn"
        >
          🔑 Import Existing Wallet (Private Key)
        </button>
      ) : (
        <div className="import-form">
          <div className="import-header">
            <h4>Import Wallet from Private Key</h4>
            <button 
              onClick={() => {
                setShowInput(false);
                setPrivateKeyInput('');
                setError(null);
                setImportMethod('paste');
              }}
              className="close-btn"
            >
              ✕
            </button>
          </div>

          <div className="security-warning">
            ⚠️ <strong>Security Warning:</strong> Never share your private key. 
            It gives full control of your wallet. This key is only used in your browser 
            and never sent to any server.
          </div>

          <div className="import-method-selector">
            <button
              onClick={() => setImportMethod('file')}
              className={`method-btn ${importMethod === 'file' ? 'active' : ''}`}
            >
              📁 Upload Keypair File
            </button>
            <button
              onClick={() => setImportMethod('paste')}
              className={`method-btn ${importMethod === 'paste' ? 'active' : ''}`}
            >
              📋 Paste Private Key
            </button>
          </div>

          {importMethod === 'file' ? (
            <div className="file-upload-section">
              <label htmlFor="keypair-file" className="file-upload-label">
                <div className="file-upload-box">
                  <div className="file-upload-icon">📁</div>
                  <div className="file-upload-text">
                    <strong>Click to select keypair file</strong>
                    <span>or drag and drop</span>
                  </div>
                  <div className="file-upload-hint">
                    Select your wallet-keypair.json file
                  </div>
                </div>
                <input
                  id="keypair-file"
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileUpload}
                  disabled={isImporting}
                  className="file-input"
                />
              </label>
              {isImporting && (
                <div className="importing-status">
                  ⏳ Reading keypair file...
                </div>
              )}
            </div>
          ) : (

            <div className="form-group">
              <label htmlFor="private-key">
                Private Key (JSON array or comma-separated)
              </label>
              <textarea
                id="private-key"
                value={privateKeyInput}
                onChange={(e) => setPrivateKeyInput(e.target.value)}
                placeholder='[1,2,3,...] or "1,2,3,..."'
                className="private-key-input"
                rows={3}
                disabled={isImporting}
              />
              <small className="form-hint">
                Format: JSON array <code>[1,2,3,...]</code>, comma-separated <code>1,2,3,...</code>, or base58 string
                <br />
                Your private key is 64 bytes (numbers 0-255)
              </small>
            </div>

            <button
              onClick={handleImport}
              disabled={isImporting || !privateKeyInput.trim()}
              className="import-btn"
            >
              {isImporting ? 'Importing...' : 'Import Wallet'}
            </button>
          )}

          <div className="help-text">
            <p><strong>How to get your private key:</strong></p>
            <ul>
              <li><strong>Solana CLI:</strong> Check <code>~/.config/solana/id.json</code> or use <code>node scripts/export-private-key.js</code></li>
              <li><strong>From keypair file:</strong> Read the JSON file and copy the array (64 numbers)</li>
              <li><strong>Base58 format:</strong> Some tools export as base58 string (also supported)</li>
              <li><strong>⚠️ Never share your private key or commit it to git!</strong></li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default WalletImport;
