import React, { useState, useEffect } from 'react';
import { Plus, Users } from 'lucide-react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { AddTeamMemberModal } from './Modals/AddTeamMemberModal';

export const TeamSection: React.FC = () => {
  const [members, setMembers] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(collection(db, `users/${auth.currentUser.uid}/teamMembers`), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      setMembers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Teammitglieder</h2>
        <button onClick={() => setIsModalOpen(true)} className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-xl flex items-center gap-2 cursor-pointer">
          <Plus className="w-3.5 h-3.5" /> Mitglied hinzufügen
        </button>
      </div>

      {members.length === 0 ? (
        <div className="p-12 text-center bg-zinc-950 border border-zinc-800 rounded-2xl">
          <p className="text-zinc-500 text-sm">Keine Teammitglieder hinzugefügt.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {members.map(m => (
            <div key={m.id} className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl flex items-center gap-3">
              <Users className="w-6 h-6 text-zinc-500" />
              <div>
                <div className="font-bold text-sm text-white">{m.name}</div>
                <div className="text-xs text-zinc-500">{m.role}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && <AddTeamMemberModal onClose={() => setIsModalOpen(false)} />}
    </div>
  );
};
