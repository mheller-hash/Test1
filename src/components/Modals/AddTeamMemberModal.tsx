import React, { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { X } from 'lucide-react';

export const AddTeamMemberModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !auth.currentUser) return;
    setLoading(true);
    try {
      await addDoc(collection(db, `users/${auth.currentUser.uid}/teamMembers`), {
        name,
        role,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">Mitglied hinzufügen</h3>
          <button type="button" onClick={onClose}><X className="w-4 h-4" /></button>
        </div>
        <input required value={name} onChange={e => setName(e.target.value)} placeholder="Name" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
        <input value={role} onChange={e => setRole(e.target.value)} placeholder="Rolle" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
        <button type="submit" disabled={loading} className="w-full py-3 bg-rose-600 text-white font-semibold rounded-xl text-sm cursor-pointer">
          {loading ? 'Wird hinzugefügt...' : 'Hinzufügen'}
        </button>
      </form>
    </div>
  );
};
