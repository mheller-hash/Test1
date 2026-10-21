import React, { useState, useEffect } from 'react';
import { Folder, FileText, Plus, Search, Download, Trash2 } from 'lucide-react';
import { collection, deleteDoc, doc, onSnapshot } from 'firebase/firestore';
import { deleteObject, ref } from 'firebase/storage';
import { db, auth, storage } from '../firebase';
import { AddFolderModal } from './Modals/AddFolderModal';
import { AddFileModal } from './Modals/AddFileModal';

export const FilesSection: React.FC = () => {
  const [folders, setFolders] = useState<any[]>([]);
  const [files, setFiles] = useState<any[]>([]);
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [isFileModalOpen, setIsFileModalOpen] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;
    const foldersRef = collection(db, `users/${uid}/folders`);
    const filesRef = collection(db, `users/${uid}/files`);

    const unsubscribeFolders = onSnapshot(foldersRef, (snapshot) => {
      setFolders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubscribeFiles = onSnapshot(filesRef, (snapshot) => {
      setFiles(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => { unsubscribeFolders(); unsubscribeFiles(); };
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900">Meine Dateien</h2>
        <div className="flex gap-2">
          <button onClick={() => setIsFolderModalOpen(true)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl flex items-center gap-2 cursor-pointer">
            <Plus className="w-3.5 h-3.5" /> Neuer Ordner
          </button>
          <button onClick={() => setIsFileModalOpen(true)} className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-xl flex items-center gap-2 cursor-pointer">
            <Plus className="w-3.5 h-3.5" /> Datei hinzufügen
          </button>
        </div>
      </div>

      {folders.length === 0 && files.length === 0 ? (
        <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl">
          <p className="text-slate-500 text-sm">Keine Dateien oder Ordner gefunden.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {folders.map(f => (
            <div key={f.id} className="p-4 bg-white border border-slate-200 rounded-xl flex items-center gap-3">
              <Folder className="w-6 h-6 text-amber-500" />
              <span className="text-sm font-medium text-slate-900">{f.name}</span>
            </div>
          ))}
          {files.map(f => (
            <div key={f.id} className="p-4 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 overflow-hidden">
                <FileText className="w-6 h-6 text-slate-400 shrink-0" />
                <div className="overflow-hidden">
                  <p className="text-sm font-medium text-slate-900 truncate">{f.name}</p>
                  <p className="text-[10px] text-slate-500">{f.size} • {f.type}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a href={f.downloadURL} target="_blank" rel="noopener noreferrer" className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors">
                  <Download className="w-4 h-4" />
                </a>
                <button 
                  onClick={async () => {
                    try {
                      await deleteObject(ref(storage, f.storagePath));
                      await deleteDoc(doc(db, `users/${auth.currentUser?.uid}/files`, f.id));
                    } catch (e) { console.error(e); }
                  }}
                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {isFolderModalOpen && <AddFolderModal onClose={() => setIsFolderModalOpen(false)} />}
      {isFileModalOpen && <AddFileModal onClose={() => setIsFileModalOpen(false)} />}
    </div>
  );
};
