import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Plus, 
  Search, 
  Filter, 
  Phone, 
  Mail, 
  MapPin, 
  Building2, 
  MoreVertical, 
  Edit2, 
  Trash2, 
  X,
  UserPlus,
  Loader2,
  ExternalLink,
  MessageCircle
} from 'lucide-react';
import { db, auth } from '../firebase';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  query, 
  orderBy,
  serverTimestamp 
} from 'firebase/firestore';
import { Contact } from '../types';
import { format } from 'date-fns';
import { handleFirestoreError, OperationType, cleanData } from '../lib/firestore-utils';

export default function Contacts() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    organization: '',
    email: '',
    phone: '',
    address: '',
    category: 'General',
    notes: ''
  });

  const categories = ['All', 'General', 'Supplier', 'Maintenance', 'Emergency', 'Staff', 'Other'];

  useEffect(() => {
    const q = query(collection(db, 'contacts'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const contactsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Contact[];
      setContacts(contactsData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'contacts');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    try {
      const cleanedData = cleanData(formData);
      if (editingContact) {
        await updateDoc(doc(db, 'contacts', editingContact.id), {
          ...cleanedData,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'contacts'), {
          ...cleanedData,
          authorId: auth.currentUser.uid,
          createdAt: new Date().toISOString()
        });
      }
      closeModal();
    } catch (error) {
      handleFirestoreError(error, editingContact ? OperationType.UPDATE : OperationType.CREATE, editingContact ? `contacts/${editingContact.id}` : 'contacts');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this contact?')) return;
    setIsDeleting(id);
    try {
      await deleteDoc(doc(db, 'contacts', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `contacts/${id}`);
    } finally {
      setIsDeleting(null);
    }
  };

  const openModal = (contact?: Contact) => {
    if (contact) {
      setEditingContact(contact);
      setFormData({
        name: contact.name,
        organization: contact.organization || '',
        email: contact.email || '',
        phone: contact.phone || '',
        address: contact.address || '',
        category: contact.category,
        notes: contact.notes || ''
      });
    } else {
      setEditingContact(null);
      setFormData({
        name: '',
        organization: '',
        email: '',
        phone: '',
        address: '',
        category: 'General',
        notes: ''
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingContact(null);
  };

  const formatWhatsAppNumber = (phone: string) => {
    // Remove all non-numeric characters for wa.me compatibility
    return phone.replace(/\D/g, '');
  };

  const filteredContacts = contacts.filter(contact => {
    const matchesSearch = 
      contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.organization?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.phone?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = selectedCategory === 'All' || contact.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-stone-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif italic text-stone-900">Contacts</h1>
          <p className="text-stone-500 text-sm">Manage your business contacts and suppliers</p>
        </div>
        <button
          onClick={() => openModal()}
          className="flex items-center gap-2 bg-stone-900 text-white px-6 py-3 rounded-xl hover:bg-stone-800 transition-all shadow-lg shadow-stone-200"
        >
          <UserPlus className="w-5 h-5" />
          Add Contact
        </button>
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        <div className="md:col-span-2 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
          <input
            type="text"
            placeholder="Search contacts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900 outline-none transition-all"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900 outline-none transition-all appearance-none"
          >
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredContacts.map((contact) => (
          <div 
            key={contact.id}
            className="bg-white rounded-3xl p-6 border border-stone-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 rounded-2xl bg-stone-50 flex items-center justify-center text-stone-400 group-hover:bg-stone-900 group-hover:text-white transition-all duration-500">
                <Users className="w-6 h-6" />
              </div>
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => openModal(contact)}
                  className="p-2 text-stone-400 hover:text-stone-900 hover:bg-stone-50 rounded-full transition-all"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => handleDelete(contact.id)}
                  disabled={isDeleting === contact.id}
                  className="p-2 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-full transition-all"
                >
                  {isDeleting === contact.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-bold text-stone-900 line-clamp-1">{contact.name}</h3>
                {contact.organization && (
                  <p className="text-sm text-stone-500 flex items-center gap-1.5 mt-0.5">
                    <Building2 className="w-3.5 h-3.5" />
                    {contact.organization}
                  </p>
                )}
              </div>

              <div className="space-y-2.5">
                {contact.phone && (
                  <div className="flex items-center gap-2">
                    <a href={`tel:${contact.phone}`} className="flex-1 flex items-center gap-3 text-sm text-stone-600 hover:text-stone-900 transition-colors">
                      <div className="w-8 h-8 rounded-lg bg-stone-50 flex items-center justify-center">
                        <Phone className="w-4 h-4" />
                      </div>
                      {contact.phone}
                    </a>
                    <a 
                      href={`https://wa.me/${formatWhatsAppNumber(contact.phone)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-8 h-8 rounded-lg bg-green-50 text-green-600 flex items-center justify-center hover:bg-green-600 hover:text-white transition-all"
                      title="WhatsApp"
                    >
                      <MessageCircle className="w-4 h-4" />
                    </a>
                  </div>
                )}
                {contact.email && (
                  <div className="flex items-center gap-2">
                    <a href={`mailto:${contact.email}`} className="flex-1 flex items-center gap-3 text-sm text-stone-600 hover:text-stone-900 transition-colors">
                      <div className="w-8 h-8 rounded-lg bg-stone-50 flex items-center justify-center">
                        <Mail className="w-4 h-4" />
                      </div>
                      <span className="truncate">{contact.email}</span>
                    </a>
                    <a 
                      href={`mailto:${contact.email}`}
                      className="w-8 h-8 rounded-lg bg-stone-50 text-stone-400 flex items-center justify-center hover:bg-stone-900 hover:text-white transition-all"
                      title="Send Email"
                    >
                      <Mail className="w-4 h-4" />
                    </a>
                  </div>
                )}
                {contact.address && (
                  <div className="flex items-start gap-3 text-sm text-stone-600">
                    <div className="w-8 h-8 rounded-lg bg-stone-50 flex items-center justify-center shrink-0">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <span className="line-clamp-2">{contact.address}</span>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-stone-50 flex items-center justify-between">
                <span className="px-3 py-1 rounded-full bg-stone-100 text-stone-600 text-[10px] font-bold uppercase tracking-widest">
                  {contact.category}
                </span>
                {contact.notes && (
                  <div className="group/note relative">
                    <div className="w-8 h-8 rounded-full bg-stone-50 flex items-center justify-center text-stone-400 cursor-help">
                      <MoreVertical className="w-4 h-4" />
                    </div>
                    <div className="absolute bottom-full right-0 mb-2 w-48 p-3 bg-stone-900 text-white text-xs rounded-xl opacity-0 invisible group-hover/note:opacity-100 group-hover/note:visible transition-all z-10">
                      {contact.notes}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredContacts.length === 0 && (
        <div className="text-center py-20 bg-white rounded-[40px] border border-dashed border-stone-200">
          <div className="w-16 h-16 bg-stone-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-stone-300" />
          </div>
          <h3 className="text-lg font-medium text-stone-900">No contacts found</h3>
          <p className="text-stone-500 text-sm">Try adjusting your search or filters</p>
        </div>
      )}

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-[40px] w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
              <div>
                <h2 className="text-2xl font-serif italic text-stone-900">
                  {editingContact ? 'Edit Contact' : 'Add New Contact'}
                </h2>
                <p className="text-stone-500 text-sm">Fill in the details below</p>
              </div>
              <button 
                onClick={closeModal}
                className="p-2 hover:bg-white rounded-full transition-all text-stone-400 hover:text-stone-900 shadow-sm"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-8">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">Full Name *</label>
                  <input
                    required
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900 outline-none transition-all"
                    placeholder="John Doe"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">Organization</label>
                  <input
                    type="text"
                    value={formData.organization}
                    onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900 outline-none transition-all"
                    placeholder="Company Name"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900 outline-none transition-all"
                    placeholder="john@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">Phone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900 outline-none transition-all"
                    placeholder="+27 12 345 6789"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900 outline-none transition-all"
                  >
                    {categories.filter(c => c !== 'All').map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">Address</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900 outline-none transition-all"
                    placeholder="123 Street Name, City"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900 outline-none transition-all h-24 resize-none"
                    placeholder="Additional information..."
                  />
                </div>
              </div>

              <div className="mt-8 flex gap-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-6 py-4 border border-stone-200 rounded-2xl font-bold text-stone-600 hover:bg-stone-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-4 bg-stone-900 text-white rounded-2xl font-bold hover:bg-stone-800 transition-all shadow-xl shadow-stone-200"
                >
                  {editingContact ? 'Save Changes' : 'Add Contact'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
