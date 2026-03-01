"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Search, Filter, X, Inbox, Clock, CheckCircle2, 
  Bold, Italic, List, Phone, Mail, 
  Calendar, User, FileText, ArrowLeft, Save, Box, LogOut, Lock
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { 
  getFirestore, collection, query, orderBy, onSnapshot, 
  doc, updateDoc, serverTimestamp 
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig.apiKey ? firebaseConfig : {
  apiKey: "placeholder", authDomain: "placeholder", projectId: "placeholder"
});
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'tax-portfolio-prod';

// --- CUSTOM STYLES ---
const styles = `
  /* Rich Text Editor Styles */
  .rich-editor[contenteditable="true"]:empty:before {
    content: attr(placeholder);
    color: #94a3b8;
    pointer-events: none;
    display: block;
  }
  .rich-editor ul {
    list-style-type: disc;
    padding-left: 1.5rem;
    margin-top: 0.5rem;
    margin-bottom: 0.5rem;
  }
  .rich-editor b, .rich-editor strong {
    font-weight: 700;
    color: #0f172a;
  }
  .rich-editor i, .rich-editor em {
    font-style: italic;
  }

  /* Custom Scrollbar for Admin */
  ::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  ::-webkit-scrollbar-track {
    background: transparent;
  }
  ::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 10px;
  }
  ::-webkit-scrollbar-thumb:hover {
    background: #94a3b8;
  }
`;

// --- MAIN APP COMPONENT ---
const App = () => {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedTicket, setSelectedTicket] = useState(null);

  // Authentication Listener
  useEffect(() => {
    // REMOVED signInAnonymously() from here so it doesn't auto-login
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      // Check if the user logged in specifically with a password
      const isPasswordLogin = currentUser && currentUser.providerData.some(provider => provider.providerId === 'password');
      
      if (isPasswordLogin) {
        setUser(currentUser);
      } else {
        // If it's an anonymous user (leftover session) or no user, force them out
        if (currentUser) {
           signOut(auth).catch(console.error);
        }
        setUser(null);
        setTickets([]); // Clear tickets
      }
      setAuthLoading(false);
    });
    return () => unsubscribeAuth();
  }, []);

  // Data Fetching (Only runs if user is authenticated via password)
  useEffect(() => {
    if (!user) return;

    setLoading(true);
    const q = query(
      collection(db, 'artifacts', appId, 'public', 'data', 'inquiries'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
      const fetchedTickets = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setTickets(fetchedTickets);
      setLoading(false);
    }, (err) => {
      console.error("Firestore Error:", err);
      setLoading(false);
    });

    return () => unsubscribeSnapshot();
  }, [user]);

  // Logout Handler
  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  // Derived Stats
  const stats = useMemo(() => {
    return {
      total: tickets.length,
      new: tickets.filter(t => t.status === 'new' || !t.status).length,
      inProgress: tickets.filter(t => t.status === 'in-progress').length,
      resolved: tickets.filter(t => t.status === 'resolved').length,
    };
  }, [tickets]);

  // Filtering Logic
  const filteredTickets = useMemo(() => {
    return tickets.filter(ticket => {
      const matchesStatus = statusFilter === 'all' || (ticket.status || 'new') === statusFilter;
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        ticket.firstname?.toLowerCase().includes(searchLower) ||
        ticket.lastname?.toLowerCase().includes(searchLower) ||
        ticket.email?.toLowerCase().includes(searchLower) ||
        ticket.subject?.toLowerCase().includes(searchLower) ||
        ticket.ticketNumber?.toString().includes(searchLower);
      
      return matchesStatus && matchesSearch;
    });
  }, [tickets, searchTerm, statusFilter]);

  // Update Ticket Logic
  const updateTicket = async (ticketId, updates) => {
    try {
      const ticketRef = doc(db, 'artifacts', appId, 'public', 'data', 'inquiries', ticketId);
      await updateDoc(ticketRef, {
        ...updates,
        lastUpdate: serverTimestamp()
      });
      
      setSelectedTicket(prev => ({ ...prev, ...updates }));
    } catch (error) {
      console.error("Error updating ticket:", error);
      alert("Failed to save changes. Please try again.");
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
         <div className="w-8 h-8 border-4 border-slate-200 border-t-[rgb(83,154,248)] rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen auth={auth} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      <style>{styles}</style>

      {/* Header */}
      <header className="bg-slate-900 text-white px-8 py-4 sticky top-0 z-40 shadow-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[rgb(83,154,248)] rounded-md flex items-center justify-center">
            <Box size={16} className="text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight tracking-tight">SaHiTax Admin</h1>
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">Workspace Dashboard</p>
          </div>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <div className="hidden sm:flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
              <User size={14} className="text-slate-300" />
            </div>
            <span className="font-medium text-slate-300">{user.email}</span>
          </div>
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
            title="Log Out"
          >
            <LogOut size={18} />
            <span className="hidden sm:inline font-medium">Log out</span>
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 pb-24">
        
        {/* KPI Dashboard */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard title="Total Tickets" value={stats.total} icon={<FileText size={20}/>} color="bg-blue-50 text-blue-600 border-blue-200" />
          <StatCard title="New" value={stats.new} icon={<Inbox size={20}/>} color="bg-emerald-50 text-emerald-600 border-emerald-200" />
          <StatCard title="In Progress" value={stats.inProgress} icon={<Clock size={20}/>} color="bg-amber-50 text-amber-600 border-amber-200" />
          <StatCard title="Resolved" value={stats.resolved} icon={<CheckCircle2 size={20}/>} color="bg-slate-100 text-slate-600 border-slate-200" />
        </div>

        {/* Sticky Search & Filter Bar */}
        <div className="sticky top-[72px] z-30 bg-slate-50/95 backdrop-blur-md py-4 border-b border-slate-200 mb-6 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative w-full sm:max-w-md">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by name, email, subject, or ID..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[rgb(83,154,248)] focus:border-transparent transition-all"
            />
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Filter size={18} className="text-slate-400" />
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full sm:w-auto px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-[rgb(83,154,248)] focus:border-transparent cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="new">New</option>
              <option value="in-progress">In Progress</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
        </div>

        {/* Ticket List */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <div className="w-8 h-8 border-4 border-slate-200 border-t-[rgb(83,154,248)] rounded-full animate-spin mb-4"></div>
            Loading tickets...
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="text-center py-20 bg-white border border-dashed border-slate-300 rounded-xl">
            <Inbox size={48} className="mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-bold text-slate-700">No tickets found</h3>
            <p className="text-slate-500 text-sm">Adjust your search or filter criteria.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredTickets.map(ticket => (
              <TicketTile 
                key={ticket.id} 
                ticket={ticket} 
                onClick={() => setSelectedTicket(ticket)} 
              />
            ))}
          </div>
        )}

      </main>

      {/* Ticket Modal Overlay */}
      {selectedTicket && (
        <TicketModal 
          ticket={selectedTicket} 
          onClose={() => setSelectedTicket(null)} 
          onSave={updateTicket}
        />
      )}
    </div>
  );
};


// --- LOGIN SCREEN COMPONENT ---

const LoginScreen = ({ auth }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoggingIn(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError("Invalid admin credentials. Please try again.");
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
        
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-14 h-14 bg-[rgb(83,154,248)] rounded-xl flex items-center justify-center mb-4 shadow-md shadow-blue-200">
            <Lock size={28} className="text-white" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Admin Portal</h2>
          <p className="text-slate-500 text-sm mt-1">Sign in to manage client inquiries</p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg text-center font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Email Address</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full p-3 bg-slate-50 border border-slate-300 rounded-lg text-sm outline-none focus:bg-white focus:border-[rgb(83,154,248)] focus:ring-2 focus:ring-blue-100 transition-all"
              placeholder="admin@sahitax.com"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Password</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full p-3 bg-slate-50 border border-slate-300 rounded-lg text-sm outline-none focus:bg-white focus:border-[rgb(83,154,248)] focus:ring-2 focus:ring-blue-100 transition-all"
              placeholder="••••••••"
            />
          </div>
          <button 
            type="submit"
            disabled={isLoggingIn}
            className="w-full py-3 mt-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold rounded-lg shadow-md transition-all disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isLoggingIn ? 'Authenticating...' : 'Sign In securely'}
          </button>
        </form>

      </div>
    </div>
  );
};


// --- SUB-COMPONENTS ---

const StatCard = ({ title, value, icon, color }) => (
  <div className={`p-5 rounded-xl border bg-white shadow-sm flex flex-col justify-between h-32`}>
    <div className="flex justify-between items-start">
      <h3 className="text-slate-500 text-xs font-bold uppercase tracking-wider">{title}</h3>
      <div className={`p-2 rounded-lg border ${color}`}>
        {icon}
      </div>
    </div>
    <div className="text-4xl font-black text-slate-800">{value}</div>
  </div>
);

const StatusBadge = ({ status }) => {
  const s = status || 'new';
  const styles = {
    'new': 'bg-emerald-100 text-emerald-700 border-emerald-200',
    'in-progress': 'bg-amber-100 text-amber-700 border-amber-200',
    'resolved': 'bg-slate-100 text-slate-600 border-slate-200',
  };
  const labels = {
    'new': 'New',
    'in-progress': 'In Progress',
    'resolved': 'Resolved'
  };

  return (
    <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${styles[s]}`}>
      {labels[s]}
    </span>
  );
};

const TicketTile = ({ ticket, onClick }) => {
  // Created At formatting
  const createdObj = ticket.createdAt?.toDate ? ticket.createdAt.toDate() : new Date();
  const createdDateStr = createdObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const createdTimeStr = createdObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  // Last Updated formatting (fallback to createdObj if missing)
  const updatedObj = ticket.lastUpdate?.toDate ? ticket.lastUpdate.toDate() : createdObj;
  const updatedDateStr = updatedObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const updatedTimeStr = updatedObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  return (
    <div 
      onClick={onClick}
      className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-[rgb(83,154,248)] transition-all cursor-pointer flex flex-col sm:flex-row gap-4 sm:items-center justify-between group"
    >
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center font-bold flex-shrink-0 group-hover:bg-blue-50 group-hover:text-[rgb(83,154,248)] transition-colors">
          {(ticket.firstname?.[0] || 'U').toUpperCase()}
        </div>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-bold text-slate-800 text-base">{ticket.firstname} {ticket.lastname}</h3>
            <StatusBadge status={ticket.status} />
          </div>
          <p className="text-slate-600 text-sm font-medium line-clamp-1">{ticket.subject}</p>
          <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
            <span className="flex items-center gap-1"><Mail size={12}/> {ticket.email}</span>
            <span className="flex items-center gap-1"><Phone size={12}/> {ticket.phone || 'N/A'}</span>
          </div>
        </div>
      </div>
      
      <div className="flex sm:flex-col items-start sm:items-end justify-between gap-2 border-t sm:border-t-0 border-slate-100 pt-3 sm:pt-0 min-w-[150px]">
        <div className="flex flex-col sm:items-end gap-1.5 w-full">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <Calendar size={12} className="text-slate-400"/> 
            <span>Created: <span className="font-medium text-slate-700">{createdDateStr} &middot; {createdTimeStr}</span></span>
          </div>
          <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
            <Clock size={10} className="text-slate-300"/> 
            <span>Updated: {updatedDateStr} &middot; {updatedTimeStr}</span>
          </div>
        </div>
        <div className="text-[10px] text-slate-400 font-mono hidden sm:block mt-1">
          ID: {ticket.ticketNumber || 'UNKNOWN'}
        </div>
      </div>
    </div>
  );
};

// --- TICKET DETAILS MODAL ---
const TicketModal = ({ ticket, onClose, onSave }) => {
  const [localNote, setLocalNote] = useState(ticket.note || '');
  const [localStatus, setLocalStatus] = useState(ticket.status || 'new');
  const [isSaving, setIsSaving] = useState(false);

  // Prevent background scrolling when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'unset'; };
  }, []);

  const hasChanges = localNote !== (ticket.note || '') || localStatus !== (ticket.status || 'new');

  const handleSave = async () => {
    setIsSaving(true);
    let finalStatus = localStatus;
    
    // Auto-update to in-progress if a note is added to a 'new' ticket
    if (ticket.status === 'new' && localStatus === 'new' && localNote !== (ticket.note || '')) {
      finalStatus = 'in-progress';
    }

    await onSave(ticket.id, {
      note: localNote,
      status: finalStatus
    });
    
    setIsSaving(false);
    onClose();
  };

  const dateObj = ticket.createdAt?.toDate ? ticket.createdAt.toDate() : new Date();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}></div>
      
      <div className="relative bg-white w-full max-w-4xl max-h-[95vh] rounded-2xl shadow-2xl flex flex-col animate-fade-in-up">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors">
              <ArrowLeft size={18} />
            </button>
            <div>
              <h2 className="font-bold text-lg text-slate-800 flex items-center gap-3">
                Ticket Details
                <span className="text-xs font-mono text-slate-400 font-normal bg-white px-2 py-0.5 rounded border border-slate-200">
                  #{ticket.ticketNumber}
                </span>
              </h2>
            </div>
          </div>
          <select 
            value={localStatus}
            onChange={(e) => setLocalStatus(e.target.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-bold uppercase tracking-wider outline-none border cursor-pointer transition-colors
              ${localStatus === 'new' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 focus:ring-2 focus:ring-emerald-500' : ''}
              ${localStatus === 'in-progress' ? 'bg-amber-50 text-amber-700 border-amber-200 focus:ring-2 focus:ring-amber-500' : ''}
              ${localStatus === 'resolved' ? 'bg-slate-100 text-slate-600 border-slate-300 focus:ring-2 focus:ring-slate-500' : ''}
            `}
          >
            <option value="new">Status: New</option>
            <option value="in-progress">Status: In Progress</option>
            <option value="resolved">Status: Resolved</option>
          </select>
        </div>

        {/* Modal Body (Scrollable) */}
        <div className="p-6 overflow-y-auto flex-1 grid md:grid-cols-2 gap-8">
          
          {/* Left Column: Client Data */}
          <div className="space-y-8">
            {/* Client Info Card */}
            <div className="bg-slate-50 rounded-xl p-5 border border-slate-100">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <User size={14}/> Client Information
              </h3>
              <div className="space-y-4">
                <div>
                  <div className="text-[10px] uppercase text-slate-400 font-bold mb-1">Full Name</div>
                  <div className="font-medium text-slate-800">{ticket.firstname} {ticket.lastname}</div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-[10px] uppercase text-slate-400 font-bold mb-1">Email Address</div>
                    <div className="font-medium text-slate-800 text-sm break-all">
                      <a href={`mailto:${ticket.email}`} className="text-[rgb(83,154,248)] hover:underline">{ticket.email}</a>
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-slate-400 font-bold mb-1">Phone Number</div>
                    <div className="font-medium text-slate-800 text-sm">
                      {ticket.phone ? <a href={`tel:${ticket.phone}`} className="text-[rgb(83,154,248)] hover:underline">{ticket.phone}</a> : 'N/A'}
                    </div>
                  </div>
                </div>
                <div>
                    <div className="text-[10px] uppercase text-slate-400 font-bold mb-1">Submitted On</div>
                    <div className="font-medium text-slate-800 text-sm">
                      {dateObj.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} at {dateObj.toLocaleTimeString('en-IN')}
                    </div>
                </div>
              </div>
            </div>

            {/* Query Content */}
            <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Inquiry Details</h3>
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
                  <div className="text-[10px] uppercase text-slate-400 font-bold mb-1">Subject</div>
                  <div className="font-bold text-slate-800">{ticket.subject}</div>
                </div>
                <div className="p-4">
                  <div className="text-[10px] uppercase text-slate-400 font-bold mb-2">Message</div>
                  <p className="text-slate-700 text-sm whitespace-pre-wrap leading-relaxed">
                    {ticket.query}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Internal Notes */}
          <div className="flex flex-col h-full min-h-[300px]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <FileText size={14}/> Internal Notes
              </h3>
              <span className="text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-100 hidden md:block">
                Visible to admin only
              </span>
            </div>
            
            {/* Custom Rich Text Editor */}
            <div className="flex-1 flex flex-col">
              <RichTextEditor value={localNote} onChange={setLocalNote} />
              <p className="text-[10px] text-slate-400 mt-2">
                Adding a note to a 'New' ticket will automatically update its status to 'In Progress'.
              </p>
            </div>
          </div>

        </div>

        {/* Modal Footer (Conditional Save Button) */}
        {hasChanges && (
          <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl flex justify-end animate-fade-in-up">
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-500 mr-2">Unsaved changes</span>
              <button 
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
              >
                Discard
              </button>
              <button 
                onClick={handleSave}
                disabled={isSaving}
                className="px-6 py-2 bg-[rgb(83,154,248)] hover:bg-blue-600 text-white text-sm font-bold rounded-lg shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : <><Save size={16}/> Save Updates</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// --- CUSTOM RICH TEXT EDITOR ---
const RichTextEditor = ({ value, onChange }) => {
  const editorRef = useRef(null);

  // Set initial content safely
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || '';
    }
  }, [value]);

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const execCommand = (command) => {
    document.execCommand(command, false, null);
    if (editorRef.current) {
      editorRef.current.focus();
      handleInput();
    }
  };

  return (
    <div className="flex flex-col h-full border border-slate-300 rounded-xl overflow-hidden bg-white focus-within:ring-2 focus-within:ring-[rgb(83,154,248)] focus-within:border-transparent transition-all shadow-sm">
      {/* Toolbar */}
      <div className="bg-slate-50 border-b border-slate-200 p-2 flex gap-1">
        <button 
          type="button" 
          onClick={() => execCommand('bold')} 
          className="p-1.5 text-slate-600 hover:bg-slate-200 hover:text-slate-900 rounded transition-colors"
          title="Bold"
        >
          <Bold size={16}/>
        </button>
        <button 
          type="button" 
          onClick={() => execCommand('italic')} 
          className="p-1.5 text-slate-600 hover:bg-slate-200 hover:text-slate-900 rounded transition-colors"
          title="Italic"
        >
          <Italic size={16}/>
        </button>
        <div className="w-px h-6 bg-slate-300 mx-1 my-auto"></div>
        <button 
          type="button" 
          onClick={() => execCommand('insertUnorderedList')} 
          className="p-1.5 text-slate-600 hover:bg-slate-200 hover:text-slate-900 rounded transition-colors"
          title="Bullet List"
        >
          <List size={16}/>
        </button>
      </div>
      
      {/* Editable Area */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        placeholder="Type your internal notes here... Use the toolbar above for formatting."
        className="rich-editor flex-1 p-4 outline-none text-sm text-slate-700 leading-relaxed min-h-[200px]"
      />
    </div>
  );
};

export default App;