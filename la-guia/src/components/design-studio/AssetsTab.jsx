import React, { useEffect, useRef, useState } from 'react';
import { useProducts } from '../../context/ProductsContext.jsx';
import EmptyState from '../EmptyState.jsx';

export default function AssetsTab({ productId }) {
  const { productAssets, loadProductAssets, uploadProductAsset, deleteProductAsset } = useProducts();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);

  const assets = productAssets[productId] || [];

  useEffect(() => {
    loadProductAssets(productId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const handleUpload = async (e) => {
    const files = [...(e.target.files || [])];
    if (!files.length) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of files) {
        await uploadProductAsset(productId, file);
      }
    } catch (err) {
      setError('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div style={{ maxWidth: 1080 }}>
      <div className="card-raised" style={{ padding: 18, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span className="card-title" style={{ display: 'block' }}>Product Media Bin</span>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>
              Store high-res photoshoot images, factory BTS videos, and packaging artwork directly on this product.
            </div>
          </div>
          <input ref={fileRef} type="file" multiple style={{ display: 'none' }} onChange={handleUpload} />
          <button className="btn btn-primary" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? <><i className="ph ph-spinner ph-spin" /> Uploading…</> : <><i className="ph ph-upload-simple" /> Upload Files</>}
          </button>
        </div>
        {error && <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 12 }}>{error}</div>}
      </div>

      {assets.length === 0 ? (
        <EmptyState icon="ph-folder-open" color="var(--c-design)" title="No assets uploaded yet" sub="Keep all your final imagery and media files organized right where the product lives." />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
          {assets.map(a => {
            const isImage = a.file_type?.startsWith('image/');
            const isVideo = a.file_type?.startsWith('video/');
            
            return (
              <div key={a.id} className="card-raised card-hover" style={{ overflow: 'hidden', position: 'relative' }}>
                <button
                  onClick={() => deleteProductAsset(a)}
                  title="Delete file"
                  style={{ position: 'absolute', top: 8, right: 8, zIndex: 10, width: 24, height: 24, borderRadius: '50%', background: 'rgba(20,17,12,0.65)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <i className="ph ph-trash" style={{ fontSize: 12 }} />
                </button>
                
                <div style={{ width: '100%', aspectRatio: '1/1', background: 'var(--bg-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {isImage ? (
                    <img src={a.file_url} alt={a.file_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : isVideo ? (
                    <video src={a.file_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} controls />
                  ) : (
                    <i className="ph ph-file" style={{ fontSize: 40, color: 'var(--ink-4)' }} />
                  )}
                </div>
                <div style={{ padding: '10px 12px' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={a.file_name}>
                    {a.file_name}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                    <div style={{ fontSize: 10.5, color: 'var(--ink-4)', fontFamily: 'var(--mono)' }}>
                      {new Date(a.created_at).toLocaleDateString()}
                    </div>
                    <a href={a.file_url} target="_blank" rel="noreferrer" style={{ fontSize: 11, fontWeight: 600 }}>Open <i className="ph ph-arrow-square-out" /></a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}