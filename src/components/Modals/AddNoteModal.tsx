import React, { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { X } from 'lucide-react';

export const AddNoteModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !auth.currentUser) return;
    setLoading(true);
    try {
      await addDoc(collection(db, `users/${auth.currentUser.uid}/notes`), {
        title,
        content,
        createdAt: serverTimestamp(),
      });
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-zinc-950 border border-zinc-800 rounded-3xl p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">Neue Notiz</h3>
          <button type="button" onClick={onClose} className="text-zinc-500 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <input required value={title} onChange={e => setTitle(e.target.value)} placeholder="Titel" className="w-full p-3 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-rose-500" />
        <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Inhalt" className="w-full p-3 bg-zinc-900 border border-zinc-800 rounded-xl text-sm h-32 text-white placeholder:text-zinc-500 focus:outline-none focus:border-rose-500" />
        <button type="submit" disabled={loading} className="w-full py-3 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-xl text-sm transition-colors cursor-pointer">
          {loading ? 'Wird gespeichert...' : 'Speichern'}
        </button>
      </form>
    </div>
  );
};
