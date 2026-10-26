import React, { useState, useEffect } from 'react';
import { Plus, FileText } from 'lucide-react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { AddNoteModal } from './Modals/AddNoteModal';

export const NotesSection: React.FC = () => {
  const [notes, setNotes] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(collection(db, `users/${auth.currentUser.uid}/notes`), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      setNotes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Meine Notizen</h2>
        <button onClick={() => setIsModalOpen(true)} className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-xl flex items-center gap-2 cursor-pointer">
          <Plus className="w-3.5 h-3.5" /> Neue Notiz
        </button>
      </div>

      {notes.length === 0 ? (
        <div className="p-12 text-center bg-zinc-950 border border-zinc-800 rounded-2xl">
          <p className="text-zinc-500 text-sm">Noch keine Notizen.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {notes.map(n => (
            <div key={n.id} className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl space-y-2">
              <h3 className="font-bold text-sm text-white">{n.title}</h3>
              <p className="text-xs text-zinc-400 truncate">{n.content}</p>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && <AddNoteModal onClose={() => setIsModalOpen(false)} />}
    </div>
  );
};
