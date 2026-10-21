import React, { useState, useRef } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, auth, storage } from '../../firebase';
import { X, Upload, File } from 'lucide-react';

export const AddFileModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !auth.currentUser) return;
    setLoading(true);
    setError(null);
    
    const uid = auth.currentUser.uid;
    const storageRef = ref(storage, `user_uploads/${uid}/${Date.now()}_${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on('state_changed', 
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setProgress(progress);
      },
      (error) => {
        setError('Upload fehlgeschlagen: ' + error.message);
        setLoading(false);
      },
      async () => {
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          await addDoc(collection(db, `users/${uid}/files`), {
            name: file.name,
            size: (file.size / 1024 / 1024).toFixed(2) + ' MB',
            type: file.type,
            storagePath: storageRef.fullPath,
            downloadURL,
            createdAt: serverTimestamp(),
          });
          onClose();
        } catch (e: any) {
          setError('Metadaten konnten nicht gespeichert werden: ' + e.message);
        } finally {
          setLoading(false);
        }
      }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">Datei hochladen</h3>
          <button type="button" onClick={onClose}><X className="w-4 h-4" /></button>
        </div>
        
        <div 
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center cursor-pointer hover:border-rose-400 transition-colors"
        >
          <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
          <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="text-xs text-slate-600">{file ? file.name : 'Datei auswählen'}</p>
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}
        {loading && (
          <div className="w-full bg-slate-100 rounded-full h-2">
            <div className="bg-rose-600 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}
        
        <button type="submit" disabled={loading || !file} className="w-full py-3 bg-rose-600 text-white font-semibold rounded-xl text-sm cursor-pointer disabled:bg-slate-300">
          {loading ? `Wird hochgeladen (${Math.round(progress)}%)...` : 'Hochladen'}
        </button>
      </form>
    </div>
  );
};
