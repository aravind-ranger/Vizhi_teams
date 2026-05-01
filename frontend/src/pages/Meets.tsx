import React, { useState, useEffect, useRef } from 'react';
import {
  Video, Users, Calendar, Search,
  FileText, Upload, X, File, Link as LinkIcon, MessageSquare, Send, MoreVertical, Trash2, Pencil, Image
} from 'lucide-react';
import { db } from '../firebase.ts';
import { collection, query, getDocs, orderBy, doc, updateDoc, addDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { useAuthStore } from '../store/useAuthStore';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';

interface MeetMessage {
  id: string;
  sender_id: string;
  sender_name: string;
  text: string;
  created_at: any;
  is_deleted?: boolean;
  is_edited?: boolean;
}

interface MeetContent {
  type: 'pdf' | 'image';
  data: string;
  file_name: string;
  added_by: string;
  added_at: any;
}

interface Meet {
  id: string;
  title: string;
  description: string;
  host_id: string;
  host_name: string;
  audience: string;
  selected_members: string[];
  link: string;
  created_at: any;
  contents?: MeetContent[];
  messages?: MeetMessage[];
}

const Meets: React.FC = () => {
  const { user } = useAuthStore();
  const [meets, setMeets] = useState<Meet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMeet, setSelectedMeet] = useState<Meet | null>(null);

  // Content Modal State
  const [showContentModal, setShowContentModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Chat State
  const [users, setUsers] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editMsgText, setEditMsgText] = useState('');
  const [activeChatMenu, setActiveChatMenu] = useState<string | null>(null);

  // Meeting Deletion
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showMaterialDeleteConfirm, setShowMaterialDeleteConfirm] = useState<{ meetId: string; materialIdx: number } | null>(null);

  useEffect(() => {
    fetchMeets();
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const snap = await getDocs(collection(db, 'users'));
      setUsers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMeets = async () => {
    try {
      const q = query(collection(db, 'meets'), orderBy('created_at', 'desc'));
      const snap = await getDocs(q);
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Meet[];
      setMeets(data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load meeting logs');
    } finally {
      setIsLoading(false);
    }
  };

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayMeets = meets.filter(m => {
    if (!m.created_at) return false;
    const dateStr = format(m.created_at.toDate ? m.created_at.toDate() : new Date(m.created_at), 'yyyy-MM-dd');
    return dateStr === todayStr;
  });

  const handleUploadContent = async () => {
    if (!selectedMeet || !selectedFile) {
      toast.error('Please select a file');
      return;
    }

    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(selectedFile.type)) {
      toast.error('Only PDF, JPG, and PNG files are allowed');
      return;
    }

    const MAX_SIZE = 2 * 1024 * 1024; // 2MB
    if (selectedFile.size > MAX_SIZE) {
      toast.error('File too large. Max size is 2MB');
      return;
    }

    setIsUploading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(selectedFile);
      });

      const fileType: 'pdf' | 'image' = selectedFile.type === 'application/pdf' ? 'pdf' : 'image';
      const newContent: MeetContent = {
        type: fileType,
        data: base64,
        file_name: selectedFile.name,
        added_by: user?.name || 'Unknown',
        added_at: new Date()
      };

      const updatedContents = [...(selectedMeet.contents || []), newContent];
      await updateDoc(doc(db, 'meets', selectedMeet.id), { contents: updatedContents });

      toast.success('File uploaded successfully!');
      const updatedMeet = { ...selectedMeet, contents: updatedContents };
      setSelectedMeet(updatedMeet);
      setMeets(meets.map(m => m.id === updatedMeet.id ? updatedMeet : m));
      setShowContentModal(false);
      setSelectedFile(null);
    } catch (err) {
      console.error(err);
      toast.error('Failed to upload file');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteMaterial = async () => {
    if (!showMaterialDeleteConfirm || !selectedMeet) return;
    const { materialIdx } = showMaterialDeleteConfirm;
    try {
      const updatedContents = [...(selectedMeet.contents || [])];
      updatedContents.splice(materialIdx, 1);

      await updateDoc(doc(db, 'meets', selectedMeet.id), {
        contents: updatedContents
      });

      toast.success('Material deleted');
      setSelectedMeet(prev => prev ? { ...prev, contents: updatedContents } : null);
      setShowMaterialDeleteConfirm(null);
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete material');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
      if (!allowedTypes.includes(file.type)) {
        toast.error('Only PDF, JPG, and PNG files are allowed');
        e.target.value = '';
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleDeleteMeeting = async (meetId: string) => {
    try {
      await deleteDoc(doc(db, 'meets', meetId));
      toast.success('Meeting deleted');
      setMeets(meets.filter(m => m.id !== meetId));
      setSelectedMeet(null);
      setShowDeleteConfirm(null);
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete meeting');
    }
  };

  const handleDeleteMessage = async (msgId: string) => {
    if (!selectedMeet) return;
    const updatedMessages = (selectedMeet.messages || []).map(m =>
      m.id === msgId ? { ...m, is_deleted: true, text: '' } : m
    );
    await updateDoc(doc(db, 'meets', selectedMeet.id), { messages: updatedMessages });
    const updatedMeet = { ...selectedMeet, messages: updatedMessages };
    setSelectedMeet(updatedMeet);
    setMeets(meets.map(m => m.id === updatedMeet.id ? updatedMeet : m));
    setActiveChatMenu(null);
  };

  const handleEditMessage = async (msgId: string) => {
    if (!selectedMeet || !editMsgText.trim()) return;
    const updatedMessages = (selectedMeet.messages || []).map(m =>
      m.id === msgId ? { ...m, text: editMsgText.trim(), is_edited: true } : m
    );
    await updateDoc(doc(db, 'meets', selectedMeet.id), { messages: updatedMessages });
    const updatedMeet = { ...selectedMeet, messages: updatedMessages };
    setSelectedMeet(updatedMeet);
    setMeets(meets.map(m => m.id === updatedMeet.id ? updatedMeet : m));
    setEditingMsgId(null);
    setEditMsgText('');
  };

  const handleChatInputChange = (val: string) => {
    setChatInput(val);
    const lastAt = val.lastIndexOf('@');
    if (lastAt !== -1 && lastAt === val.length - 1) {
      setShowMentionDropdown(true);
      setMentionFilter('');
    } else if (lastAt !== -1) {
      const afterAt = val.substring(lastAt + 1);
      if (!afterAt.includes(' ')) {
        setShowMentionDropdown(true);
        setMentionFilter(afterAt.toLowerCase());
      } else {
        setShowMentionDropdown(false);
      }
    } else {
      setShowMentionDropdown(false);
    }
  };

  const insertMention = (name: string) => {
    const lastAt = chatInput.lastIndexOf('@');
    const before = chatInput.substring(0, lastAt);
    setChatInput(before + '@' + name + ' ');
    setShowMentionDropdown(false);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !selectedMeet || !user) return;

    const newMessage: MeetMessage = {
      id: Date.now().toString(),
      sender_id: user.id,
      sender_name: user.name,
      text: chatInput.trim(),
      created_at: new Date()
    };

    try {
      const updatedMessages = [...(selectedMeet.messages || []), newMessage];
      await updateDoc(doc(db, 'meets', selectedMeet.id), { messages: updatedMessages });

      // Handle Mentions
      const sentNotifs = new Set<string>();

      // Handle @everyone
      if (chatInput.includes('@everyone')) {
        const everyoneNotifs = users
          .filter(u => u.id !== user.id)
          .map(u => {
            sentNotifs.add(u.id);
            return addDoc(collection(db, 'notifications'), {
              user_id: u.id,
              title: 'Meeting Mention 💬',
              message: `${user.name} has mentioned you in ${selectedMeet.title}`,
              type: 'system',
              is_read: false,
              created_at: serverTimestamp()
            });
          });
        await Promise.all(everyoneNotifs);
      }

      // Handle individual @mentions (handling names with spaces)
      const individualMentions = users.filter(u => 
        u.id !== user.id && 
        !sentNotifs.has(u.id) && 
        chatInput.toLowerCase().includes(`@${u.name.toLowerCase()}`)
      );

      if (individualMentions.length > 0) {
        const individualNotifs = individualMentions.map(u => 
          addDoc(collection(db, 'notifications'), {
            user_id: u.id,
            title: 'Meeting Mention 💬',
            message: `${user.name} has mentioned you in ${selectedMeet.title}`,
            type: 'system',
            is_read: false,
            created_at: serverTimestamp()
          })
        );
        await Promise.all(individualNotifs);
      }

      const updatedMeet = { ...selectedMeet, messages: updatedMessages };
      setSelectedMeet(updatedMeet);
      setMeets(meets.map(m => m.id === updatedMeet.id ? updatedMeet : m));
      setChatInput('');
      setShowMentionDropdown(false);

      setTimeout(() => {
        if (chatScrollRef.current) {
          chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
        }
      }, 100);
    } catch (err) {
      console.error(err);
      toast.error('Failed to send message');
    }
  };

  return (
    <div className="space-y-10 animate-slide-up max-w-[1400px] mx-auto pb-20">
      {!selectedMeet ? (
        <>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h2 className="text-3xl font-black text-text-primary tracking-tight">Meeting Logs</h2>
              <p className="text-text-muted mt-1 font-medium">Record and track all your team meetings and materials</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="bg-primary/10 px-6 py-4 rounded-2xl border border-primary/20 flex items-center space-x-4 shadow-sm">
                <div className="p-2 bg-white rounded-xl shadow-sm">
                  <Video className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-primary">Today's Meetings</p>
                  <p className="text-2xl font-black text-slate-900 dark:text-white">{todayMeets.length}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {isLoading ? (
              [1, 2, 3].map(i => <div key={i} className="skeleton h-60 rounded-[40px]" />)
            ) : meets.length === 0 ? (
              <div className="col-span-full glass p-20 text-center rounded-[40px] border-dashed border-2 border-gray-200 dark:border-white/10">
                <Video className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-text-primary mb-2">No Meetings Logged</h3>
                <p className="text-text-muted font-medium">Create sprint meetings to see them appear here.</p>
              </div>
            ) : (
              meets.map((meet) => {
                const date = meet.created_at?.toDate ? meet.created_at.toDate() : new Date();
                return (
                  <div
                    key={meet.id}
                    onClick={() => setSelectedMeet(meet)}
                    className="group bg-white dark:bg-glass border border-gray-100 dark:border-white/10 p-8 rounded-[40px] shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all cursor-pointer relative overflow-hidden flex flex-col"
                  >
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex flex-col space-y-1">
                        <span className="text-[10px] font-black text-primary uppercase tracking-widest bg-primary/5 px-2.5 py-1.5 rounded-xl w-fit">
                          {meet.audience === 'all' ? 'All Members' : 'Individual'}
                        </span>
                        <h3 className="text-xl font-black text-text-primary mt-3 line-clamp-1">{meet.title}</h3>
                      </div>
                    </div>

                    <p className="text-sm text-text-muted mb-6 line-clamp-2">{meet.description || 'No description provided.'}</p>

                    <div className="flex items-center justify-between pt-6 border-t border-gray-50 dark:border-white/5 mt-auto">
                      <div className="flex items-center text-xs font-bold text-text-secondary">
                        <Users className="w-4 h-4 mr-2" />
                        Host: {meet.host_name}
                      </div>
                      <div className="text-[10px] font-black text-text-muted uppercase tracking-widest">
                        {format(date, 'MMM d, h:mm a')}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      ) : (
        // Detailed Meeting View
        <div className="bg-white dark:bg-glass border border-gray-100 dark:border-white/10 rounded-[40px] shadow-sm p-10 animate-scale-up">
          <div className="flex justify-between items-start mb-10 border-b border-gray-100 dark:border-white/10 pb-8">
            <div>
              <button
                onClick={() => setSelectedMeet(null)}
                className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center hover:underline mb-4"
              >
                ← Back to Logs
              </button>
              <h2 className="text-3xl font-black text-text-primary">{selectedMeet.title}</h2>
              <p className="text-text-muted mt-2 font-medium max-w-2xl">{selectedMeet.description}</p>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowContentModal(true)}
                className="px-6 h-12 bg-primary text-white rounded-xl font-black shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center space-x-2"
              >
                <Upload className="w-4 h-4" />
                <span>Upload</span>
              </button>
              {user?.role === 'admin' && (
                <button
                  onClick={() => setShowDeleteConfirm(selectedMeet.id)}
                  className="p-3 hover:bg-danger/10 rounded-xl transition-colors group"
                >
                  <Trash2 className="w-5 h-5 text-text-muted group-hover:text-danger transition-colors" />
                </button>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Meeting Materials</h3>
            {(!selectedMeet.contents || selectedMeet.contents.length === 0) ? (
              <div className="p-10 border-2 border-dashed border-gray-100 dark:border-white/10 rounded-[30px] text-center">
                <FileText className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-sm font-bold text-text-muted">No materials uploaded yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {selectedMeet.contents.map((content, idx) => (
                  <div key={idx} className="p-5 bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-2xl flex items-center space-x-4">
                    <div className={`p-3 rounded-xl ${content.type === 'pdf' ? 'bg-red-100 text-red-500' : 'bg-emerald-100 text-emerald-500'}`}>
                      {content.type === 'pdf' ? <File className="w-5 h-5" /> : <Image className="w-5 h-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{content.file_name || (content.type === 'pdf' ? 'PDF Document' : 'Image')}</p>
                      <p className="text-[10px] text-text-muted">By {content.added_by}</p>
                    </div>
                    <div className="flex items-center space-x-3">
                      <a href={content.data} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-primary hover:underline flex items-center space-x-1">
                        <LinkIcon className="w-3 h-3" />
                        <span>View</span>
                      </a>
                      {user?.role === 'admin' && (
                        <button
                          onClick={() => setShowMaterialDeleteConfirm({ meetId: selectedMeet.id, materialIdx: idx })}
                          className="p-2 hover:bg-danger/10 rounded-lg text-text-muted hover:text-danger transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Chat Section */}
          <div className="mt-10 pt-10 border-t border-gray-100 dark:border-white/10">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6">Meeting Chat</h3>
            <div className="bg-gray-50 dark:bg-black/20 rounded-[30px] border border-gray-100 dark:border-white/5 overflow-hidden flex flex-col h-[400px]">
              <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-6 space-y-4">
                {(!selectedMeet.messages || selectedMeet.messages.length === 0) ? (
                  <div className="h-full flex flex-col items-center justify-center text-center">
                    <MessageSquare className="w-8 h-8 text-gray-300 dark:text-gray-600 mb-2" />
                    <p className="text-xs font-bold text-text-muted">No messages yet. Start the conversation!</p>
                  </div>
                ) : (
                  selectedMeet.messages.map((msg, idx) => {
                    const isMe = msg.sender_id === user?.id;
                    const isAdmin = user?.role === 'admin';
                    const date = msg.created_at?.toDate ? msg.created_at.toDate() : new Date(msg.created_at);
                    if (msg.is_deleted) {
                      return (
                        <div key={msg.id || idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                          <div className="max-w-[75%] rounded-2xl p-3 bg-gray-100 dark:bg-white/5 border border-dashed border-gray-200 dark:border-white/10 flex items-center space-x-2">
                            <Trash2 className="w-3 h-3 text-gray-400" />
                            <p className="text-xs italic text-gray-400">This message was deleted</p>
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div key={msg.id || idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'} group`}>
                        <div className={`relative max-w-[75%] rounded-2xl p-4 shadow-sm ${isMe ? 'bg-primary text-white rounded-tr-none' : 'bg-white dark:bg-glass border border-gray-100 dark:border-white/10 text-slate-800 dark:text-white rounded-tl-none'}`}>
                          {!isMe && <p className="text-[10px] font-black text-primary mb-1">{msg.sender_name}</p>}
                          {editingMsgId === msg.id ? (
                            <div className="space-y-2">
                              <textarea value={editMsgText} onChange={e => setEditMsgText(e.target.value)} className="w-full p-2 text-sm bg-white dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-lg text-slate-800 dark:text-white outline-none" rows={2} />
                              <div className="flex space-x-2">
                                <button onClick={() => setEditingMsgId(null)} className="px-3 py-1 text-[10px] font-bold bg-white/20 rounded-lg hover:bg-white/30">Cancel</button>
                                <button onClick={() => handleEditMessage(msg.id)} className="px-3 py-1 text-[10px] font-bold bg-success text-white rounded-lg">Save</button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm font-medium whitespace-pre-wrap">{msg.text}</p>
                          )}
                          <div className="flex items-center justify-end space-x-2 mt-2">
                            {msg.is_edited && <span className={`text-[8px] italic ${isMe ? 'text-white/60' : 'text-text-muted'}`}>(edited)</span>}
                            <p className={`text-[9px] font-bold ${isMe ? 'text-white/70' : 'text-text-muted'}`}>{format(date, 'h:mm a')}</p>
                          </div>
                          {(isMe || isAdmin) && !editingMsgId && (
                            <div className="absolute -top-2 right-2 hidden group-hover:flex items-center space-x-1 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-gray-100 dark:border-white/10 p-1">
                              {isMe && (
                                <button onClick={() => { setEditingMsgId(msg.id); setEditMsgText(msg.text); }} className="p-1 hover:bg-primary/10 rounded transition-colors">
                                  <Pencil className="w-3 h-3 text-primary" />
                                </button>
                              )}
                              <button onClick={() => handleDeleteMessage(msg.id)} className="p-1 hover:bg-danger/10 rounded transition-colors">
                                <Trash2 className="w-3 h-3 text-danger" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="p-4 bg-white dark:bg-glass border-t border-gray-100 dark:border-white/5 relative">
                {showMentionDropdown && (
                  <div className="absolute bottom-full left-4 mb-2 w-64 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-gray-100 dark:border-white/10 py-2 max-h-48 overflow-y-auto z-10">
                    <button onClick={() => insertMention('everyone')} className="w-full text-left px-4 py-2 text-xs font-bold text-primary hover:bg-primary/5 dark:hover:bg-white/5 transition-colors">@everyone</button>
                    {users.filter(u => u.id !== user?.id && (!mentionFilter || u.name.toLowerCase().includes(mentionFilter))).map(u => (
                      <button key={u.id} onClick={() => insertMention(u.name)} className="w-full text-left px-4 py-2 text-xs font-bold text-text-secondary dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">{u.name}</button>
                    ))}
                  </div>
                )}
                <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => handleChatInputChange(e.target.value)}
                    placeholder="Type a message... (Use @ to mention)"
                    className="flex-1 h-12 bg-gray-50 dark:bg-white/5 border-none rounded-xl px-4 text-sm font-medium text-text-primary outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                  <button
                    type="submit"
                    disabled={!chatInput.trim()}
                    className="w-12 h-12 flex items-center justify-center bg-primary text-white rounded-xl shadow-md shadow-primary/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
                  >
                    <Send className="w-5 h-5 ml-1" />
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* File Upload Modal */}
      {showContentModal && (
        <div
          onClick={() => { setShowContentModal(false); setSelectedFile(null); }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        >
          <div onClick={(e) => e.stopPropagation()} className="bg-white dark:bg-glass rounded-[40px] shadow-2xl w-full max-w-md overflow-hidden animate-scale-up border border-border dark:border-white/10">
            <div className="px-8 py-6 border-b border-border dark:border-white/10 flex justify-between items-center bg-gray-50/50 dark:bg-white/5">
              <h3 className="text-xl font-black text-text-primary">Upload File</h3>
              <button onClick={() => { setShowContentModal(false); setSelectedFile(null); }} className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-xl transition-colors">
                <X className="w-5 h-5 text-text-muted" />
              </button>
            </div>
            <div className="p-8 space-y-6">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-36 border-2 border-dashed border-gray-200 dark:border-white/10 hover:border-primary/50 bg-gray-50 dark:bg-white/5 rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-colors"
              >
                <input type="file" accept=".pdf,.jpg,.jpeg,.png" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                <Upload className="w-6 h-6 text-gray-400 mb-2" />
                <p className="text-sm font-bold text-text-secondary">{selectedFile ? selectedFile.name : 'Click to select PDF or Image'}</p>
                <p className="text-[10px] text-text-muted mt-1">Accepts: PDF, JPG, PNG</p>
              </div>
              <div className="flex space-x-3 pt-4">
                <button onClick={() => { setShowContentModal(false); setSelectedFile(null); }} disabled={isUploading} className="flex-1 h-14 bg-gray-100 dark:bg-white/5 text-text-muted font-black rounded-2xl hover:bg-gray-200 dark:hover:bg-white/10 transition-colors disabled:opacity-50">Cancel</button>
                <button onClick={handleUploadContent} disabled={isUploading || !selectedFile} className="flex-1 h-14 bg-primary text-white font-black rounded-2xl hover:bg-primary-hover shadow-lg shadow-primary/20 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center">
                  {isUploading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Upload'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Meeting Confirmation */}
      {showDeleteConfirm && (
        <div onClick={() => setShowDeleteConfirm(null)} className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div onClick={(e) => e.stopPropagation()} className="bg-white dark:bg-glass rounded-[30px] shadow-2xl w-full max-w-sm p-8 border border-border dark:border-white/10 text-center animate-scale-up">
            <Trash2 className="w-12 h-12 text-danger mx-auto mb-4" />
            <h3 className="text-xl font-black text-text-primary mb-2">Delete Meeting?</h3>
            <p className="text-sm text-text-muted mb-8">Are you sure to delete <span className="font-bold text-text-primary">"{selectedMeet?.title}"</span>? This cannot be undone.</p>
            <div className="flex space-x-3">
              <button onClick={() => setShowDeleteConfirm(null)} className="flex-1 h-12 bg-gray-100 dark:bg-white/5 text-text-muted font-black rounded-2xl hover:bg-gray-200 dark:hover:bg-white/10 transition-colors">No</button>
              <button onClick={() => handleDeleteMeeting(showDeleteConfirm)} className="flex-1 h-12 bg-danger text-white font-black rounded-2xl hover:bg-danger/80 shadow-lg shadow-danger/20 transition-all active:scale-95">Yes, Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Material Confirmation */}
      {showMaterialDeleteConfirm && (
        <div onClick={() => setShowMaterialDeleteConfirm(null)} className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div onClick={(e) => e.stopPropagation()} className="bg-white dark:bg-glass rounded-[30px] shadow-2xl w-full max-w-sm p-8 border border-border dark:border-white/10 text-center animate-scale-up">
            <Trash2 className="w-12 h-12 text-danger mx-auto mb-4" />
            <h3 className="text-xl font-black text-text-primary mb-2">Delete Material?</h3>
            <p className="text-sm text-text-muted mb-8">Are you sure you want to delete this material? This action cannot be undone.</p>
            <div className="flex space-x-3">
              <button onClick={() => setShowMaterialDeleteConfirm(null)} className="flex-1 h-12 bg-gray-100 dark:bg-white/5 text-text-muted font-black rounded-2xl hover:bg-gray-200 dark:hover:bg-white/10 transition-colors">No</button>
              <button onClick={handleDeleteMaterial} className="flex-1 h-12 bg-danger text-white font-black rounded-2xl hover:bg-danger/80 shadow-lg shadow-danger/20 transition-all active:scale-95">Yes, Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Meets;

