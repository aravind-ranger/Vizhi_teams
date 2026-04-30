import React, { useState, useEffect } from 'react';
import {
  ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon,
  X, Bell, MapPin, Clock, MessageSquare, ShieldAlert,
  PartyPopper, Coffee, Users, List, Grid, Edit3, Trash2
} from 'lucide-react';
import {
  format, addMonths, subMonths, startOfMonth, endOfMonth,
  startOfWeek, endOfWeek, isSameMonth, isSameDay, addDays,
  eachDayOfInterval, parseISO, isPast, isToday as isDateToday
} from 'date-fns';
import { db } from '../firebase.ts';
import { collection, query, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { useAuthStore } from '../store/useAuthStore';
import { useTitle } from '../hooks/useTitle';
import { toast } from 'react-hot-toast';

interface CalendarEvent {
  id: string;
  date: string;
  title: string;
  type: 'holiday' | 'meeting' | 'event';
  description: string;
  created_by: string;
}

const CalendarPage: React.FC = () => {
  const { user } = useAuthStore();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit' | 'view'>('view');
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [formData, setFormData] = useState<{
    title: string;
    type: 'holiday' | 'meeting' | 'event';
    description: string;
  }>({
    title: '',
    type: 'event',
    description: ''
  });

  useTitle('Calendar');

  useEffect(() => {
    const q = query(collection(db, 'calendar_events'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setEvents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CalendarEvent)));
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const goToToday = () => {
    const today = new Date();
    setCurrentMonth(today);
    setSelectedDate(today);
  };

  const handleDateClick = (day: Date) => {
    setSelectedDate(day);
    const dayEvent = events.find(e => e.date === format(day, 'yyyy-MM-dd'));
    if (dayEvent) {
      setSelectedEvent(dayEvent);
      setModalMode(user?.role === 'admin' ? 'edit' : 'view');
      setFormData({
        title: dayEvent.title,
        type: dayEvent.type,
        description: dayEvent.description
      });
      setShowModal(true);
    } else if (user?.role === 'admin') {
      setModalMode('add');
      setFormData({ title: '', type: 'event', description: '' });
      setShowModal(true);
    }
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (modalMode === 'add') {
        await addDoc(collection(db, 'calendar_events'), {
          ...formData,
          date: format(selectedDate, 'yyyy-MM-dd'),
          created_by: user?.id,
          created_at: serverTimestamp()
        });

        await addDoc(collection(db, 'notifications'), {
          user_id: 'all',
          title: `New ${formData.type.toUpperCase()} Announced!`,
          message: `${user?.name} announced: ${formData.title} for ${format(selectedDate, 'MMM d')}`,
          type: 'announcement',
          is_read: false,
          created_at: serverTimestamp()
        });
        toast.success('Announcement posted!');
      } else if (modalMode === 'edit' && selectedEvent) {
        await updateDoc(doc(db, 'calendar_events', selectedEvent.id), {
          ...formData,
          updated_at: serverTimestamp()
        });
        toast.success('Announcement updated!');
      }
      setShowModal(false);
    } catch (err) {
      console.error(err);
      toast.error('Failed to save announcement');
    }
  };

  const deleteEvent = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this announcement?')) return;
    try {
      await deleteDoc(doc(db, 'calendar_events', id));
      toast.success('Announcement removed');
      setShowModal(false);
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete');
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'holiday': return <Coffee className="w-5 h-5" />;
      case 'meeting': return <Users className="w-5 h-5" />;
      default: return <PartyPopper className="w-5 h-5" />;
    }
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case 'holiday': return 'text-rose-500 bg-rose-50 border-rose-100';
      case 'meeting': return 'text-indigo-500 bg-indigo-50 border-indigo-100';
      default: return 'text-amber-500 bg-amber-50 border-amber-100';
    }
  };

  // Rendering logic for cells
  const renderGrid = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);
    const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

    return (
      <div className="grid grid-cols-7 gap-px bg-gray-200 dark:bg-white/5 rounded-[32px] overflow-hidden border border-gray-100 dark:border-white/10 shadow-xl">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} className="bg-gray-50/50 dark:bg-white/5 py-4 text-center">
            <span className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">{d}</span>
          </div>
        ))}
        {calendarDays.map((day, i) => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const dayEvent = events.find(e => e.date === dateStr);
          const isSelected = isSameDay(day, selectedDate);
          const isCurrentMonth = isSameMonth(day, monthStart);
          const isToday = isDateToday(day);

          return (
            <div
              key={i}
              onClick={() => handleDateClick(day)}
              className={`relative h-32 p-4 transition-all cursor-pointer group hover:z-10 ${!isCurrentMonth ? 'bg-gray-50/30 dark:bg-white/[0.02]' : 'bg-white dark:bg-[#151b2b]'
                } ${isSelected ? 'ring-2 ring-primary ring-inset z-10' : 'hover:bg-primary/5'}`}
            >
              <div className="flex justify-between items-start">
                <span className={`text-sm font-black ${isToday ? 'w-7 h-7 bg-primary text-white rounded-full flex items-center justify-center' :
                    isCurrentMonth ? 'text-text-primary' : 'text-text-muted'
                  }`}>
                  {format(day, 'd')}
                </span>
              </div>
              {dayEvent && (
                <div className={`mt-2 p-2 rounded-xl border text-[10px] font-black truncate shadow-sm ${getEventColor(dayEvent.type)}`}>
                  {dayEvent.title}
                </div>
              )}
              {user?.role === 'admin' && !dayEvent && isSelected && (
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-primary/5">
                  <div className="bg-white p-2 rounded-full shadow-lg scale-90 group-hover:scale-100 transition-transform">
                    <Plus className="w-4 h-4 text-primary" />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderList = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

    return (
      <div className="space-y-4 max-h-[700px] overflow-y-auto pr-4 scrollbar-hide">
        {days.map((day, i) => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const dayEvent = events.find(e => e.date === dateStr);
          const isToday = isDateToday(day);

          return (
            <div
              key={i}
              onClick={() => handleDateClick(day)}
              className={`p-6 rounded-[32px] border-2 transition-all cursor-pointer flex items-center justify-between ${dayEvent
                  ? `${getEventColor(dayEvent.type)} scale-[1.01] shadow-md`
                  : isToday
                    ? 'bg-primary/5 border-primary text-primary'
                    : 'bg-white dark:bg-white/5 border-transparent dark:border-white/5 hover:border-gray-100'
                }`}
            >
              <div className="flex items-center space-x-6">
                <div className="text-center w-12">
                  <span className="block text-[10px] font-black uppercase tracking-widest opacity-60">{format(day, 'EEE')}</span>
                  <span className="block text-xl font-black">{format(day, 'd')}</span>
                </div>
                <div>
                  <h4 className="font-bold text-sm">{dayEvent ? dayEvent.title : isToday ? 'Today' : 'No announcements'}</h4>
                  {dayEvent && <p className="text-[10px] font-medium opacity-80 mt-1 line-clamp-1">{dayEvent.description}</p>}
                </div>
              </div>
              {dayEvent ? (
                <div className="w-10 h-10 rounded-xl bg-white/50 flex items-center justify-center">
                  {getEventIcon(dayEvent.type)}
                </div>
              ) : (
                user?.role === 'admin' && <Plus className="w-5 h-5 opacity-20" />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto space-y-12 animate-slide-up pb-12 px-4">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div>
          <h2 className="text-5xl font-black text-text-primary tracking-tighter leading-none">
            {format(currentMonth, 'MMMM')} <span className="text-primary">{format(currentMonth, 'yyyy')}</span>
          </h2>
          <p className="text-sm font-bold text-text-muted mt-4 flex items-center">
            <CalendarIcon className="w-4 h-4 mr-2 text-primary" />
            VizhiTeams Events & Holiday Calendar
          </p>
        </div>

        <div className="flex items-center space-x-3 glass p-2 rounded-3xl shadow-xl border-none">
          <div className="flex bg-gray-100 dark:bg-white/5 p-1 rounded-2xl">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-primary shadow-sm text-primary dark:text-white' : 'text-text-muted'}`}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-xl transition-all ${viewMode === 'list' ? 'bg-white dark:bg-primary shadow-sm text-primary dark:text-white' : 'text-text-muted'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
          <div className="h-8 w-px bg-gray-100 dark:bg-white/10 mx-2" />
          <div className="flex items-center">
            <button onClick={prevMonth} className="p-2 hover:bg-gray-50 dark:hover:bg-white/5 rounded-xl text-text-muted transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button onClick={goToToday} className="px-4 py-2 text-[10px] font-black text-primary uppercase tracking-widest hover:bg-primary/5 rounded-xl transition-all">
              {format(selectedDate, 'MMMM yyyy')}
            </button>
            <button onClick={nextMonth} className="p-2 hover:bg-gray-50 dark:hover:bg-white/5 rounded-xl text-text-muted transition-colors">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-12">
        <div className="xl:col-span-3">
          <div className="glass rounded-[40px] overflow-hidden border-none shadow-sm">
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-7 gap-px bg-gray-200 dark:bg-white/5">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                  <div key={d} className="bg-gray-50/50 dark:bg-white/5 py-4 text-center">
                    <span className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">{d}</span>
                  </div>
                ))}
                {eachDayOfInterval({
                  start: startOfWeek(startOfMonth(currentMonth)),
                  end: endOfWeek(endOfMonth(currentMonth))
                }).map((day, i) => {
                  const dateStr = format(day, 'yyyy-MM-dd');
                  const dayEvent = events.find(e => e.date === dateStr);
                  const isSelected = isSameDay(day, selectedDate);
                  const isCurrentMonth = isSameMonth(day, startOfMonth(currentMonth));
                  const isToday = isDateToday(day);

                  return (
                    <div
                      key={i}
                      onClick={() => handleDateClick(day)}
                      className={`relative h-32 p-4 transition-all cursor-pointer group hover:z-10 ${!isCurrentMonth ? 'bg-gray-50/30 dark:bg-white/[0.02]' : 'bg-white dark:bg-[#151b2b]'
                        } ${isSelected ? 'ring-2 ring-primary ring-inset z-10' : 'hover:bg-primary/5'}`}
                    >
                      <div className="flex justify-between items-start">
                        <span className={`text-sm font-black ${isToday ? 'w-7 h-7 bg-primary text-white rounded-full flex items-center justify-center' :
                            isCurrentMonth ? 'text-text-primary' : 'text-text-muted'
                          }`}>
                          {format(day, 'd')}
                        </span>
                      </div>
                      {dayEvent && (
                        <div className={`mt-2 p-2 rounded-xl border text-[10px] font-black truncate shadow-sm ${getEventColor(dayEvent.type)}`}>
                          {dayEvent.title}
                        </div>
                      )}
                      {user?.role === 'admin' && !dayEvent && isSelected && (
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-primary/5">
                          <div className="bg-white dark:bg-primary p-2 rounded-full shadow-lg scale-90 group-hover:scale-100 transition-transform">
                            <Plus className="w-4 h-4 text-primary dark:text-white" />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 space-y-4 max-h-[700px] overflow-y-auto scrollbar-hide">
                {eachDayOfInterval({
                  start: startOfMonth(currentMonth),
                  end: endOfMonth(currentMonth)
                }).map((day, i) => {
                  const dateStr = format(day, 'yyyy-MM-dd');
                  const dayEvent = events.find(e => e.date === dateStr);
                  const isToday = isDateToday(day);

                  return (
                    <div
                      key={i}
                      onClick={() => handleDateClick(day)}
                      className={`p-6 rounded-[32px] border-2 transition-all cursor-pointer flex items-center justify-between ${dayEvent
                          ? `${getEventColor(dayEvent.type)} scale-[1.01] shadow-md`
                          : isToday
                            ? 'bg-primary/5 border-primary text-primary'
                            : 'bg-white dark:bg-white/5 border-transparent dark:border-white/5 hover:border-gray-100'
                        }`}
                    >
                      <div className="flex items-center space-x-6">
                        <div className="text-center w-12">
                          <span className="block text-[10px] font-black uppercase tracking-widest opacity-60">{format(day, 'EEE')}</span>
                          <span className="block text-xl font-black">{format(day, 'd')}</span>
                        </div>
                        <div>
                          <h4 className="font-bold text-sm">{dayEvent ? dayEvent.title : isToday ? 'Today' : 'No announcements'}</h4>
                          {dayEvent && <p className="text-[10px] font-medium opacity-80 mt-1 line-clamp-1">{dayEvent.description}</p>}
                        </div>
                      </div>
                      {dayEvent ? (
                        <div className="w-10 h-10 rounded-xl bg-white/50 dark:bg-white/10 flex items-center justify-center">
                          {getEventIcon(dayEvent.type)}
                        </div>
                      ) : (
                        user?.role === 'admin' && <Plus className="w-5 h-5 opacity-20" />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Announcements */}
        <div className="space-y-8">
          <div className="glass rounded-[40px] p-8 border-none shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 opacity-5">
              <PartyPopper className="w-24 h-24" />
            </div>
            <h3 className="text-xl font-black text-text-primary mb-8 flex items-center">
              <Bell className="w-5 h-5 mr-3 text-primary" />
              Latest Feed
            </h3>
            <div className="space-y-6">
              {events
                .filter(e => !isPast(parseISO(e.date)) || isDateToday(parseISO(e.date)))
                .sort((a, b) => a.date.localeCompare(b.date))
                .slice(0, 4)
                .map(event => (
                  <div
                    key={event.id}
                    onClick={() => handleDateClick(parseISO(event.date))}
                    className="flex items-start space-x-4 group cursor-pointer"
                  >
                    <div className={`mt-1 w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-all group-hover:scale-110 border shadow-sm ${getEventColor(event.type)}`}>
                      {getEventIcon(event.type)}
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-text-primary group-hover:text-primary transition-colors">{event.title}</h4>
                      <div className="flex items-center text-[10px] font-bold text-text-muted mt-1 uppercase tracking-widest">
                        <Clock className="w-3 h-3 mr-1.5" />
                        {format(parseISO(event.date), 'MMM d, yyyy')}
                      </div>
                    </div>
                  </div>
                ))}
              {events.length === 0 && (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-50 dark:bg-white/5 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-dashed border-gray-200 dark:border-white/10">
                    <CalendarIcon className="w-8 h-8 text-gray-300" />
                  </div>
                  <p className="text-xs font-black text-text-muted uppercase tracking-widest">Quiet for now</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-primary p-8 rounded-[40px] text-white shadow-2xl shadow-primary/20 relative overflow-hidden group">
            <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
            <ShieldAlert className="w-8 h-8 mb-6" />
            <h4 className="text-lg font-black leading-tight mb-4">Official Notices & Protocol</h4>
            <p className="text-xs font-medium text-white/80 leading-relaxed">
              All marked holidays and team meetings are synchronized with payroll and attendance. Please ensure your availability status reflects these events.
            </p>
          </div>
        </div>
      </div>

      {/* Unified Modal (Add/Edit/View) */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white dark:bg-glass dark:border dark:border-white/10 rounded-[48px] w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="p-10">
              <div className="flex justify-between items-start mb-10">
                <div>
                  <span className="text-[10px] font-black text-primary uppercase tracking-[0.3em] ml-1">Announcement Protocol</span>
                  <h3 className="text-3xl font-black text-text-primary mt-2">
                    {modalMode === 'add' ? 'New Announcement' : modalMode === 'edit' ? 'Edit Announcement' : 'Announcement Detail'}
                  </h3>
                  <div className="flex items-center text-sm font-bold text-text-muted mt-3 bg-gray-50 dark:bg-white/5 px-4 py-2 rounded-xl w-fit">
                    <CalendarIcon className="w-4 h-4 mr-2 text-primary" />
                    {format(selectedDate, 'EEEE, MMMM d, yyyy')}
                  </div>
                </div>
                <button onClick={() => setShowModal(false)} className="p-4 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-3xl transition-all">
                  <X className="w-6 h-6 text-text-muted" />
                </button>
              </div>

              {modalMode === 'view' ? (
                <div className="space-y-8">
                  <div className={`p-8 rounded-[32px] border ${getEventColor(selectedEvent?.type || 'event')}`}>
                    <div className="flex items-center mb-4">
                      <div className="p-2 bg-white dark:bg-primary rounded-xl shadow-sm mr-4">
                        {getEventIcon(selectedEvent?.type || 'event')}
                      </div>
                      <span className="font-black text-lg uppercase tracking-tighter">{selectedEvent?.title}</span>
                    </div>
                    <p className="text-sm font-bold opacity-80 leading-relaxed">{selectedEvent?.description}</p>
                  </div>
                  <div className="flex items-center justify-center p-4 bg-primary/5 rounded-2xl border border-primary/10">
                    <ShieldAlert className="w-4 h-4 text-primary mr-3" />
                    <span className="text-[10px] font-black text-primary uppercase tracking-widest">This is an official announcement</span>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSaveEvent} className="space-y-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-2">Heading</label>
                    <input
                      type="text" required
                      className="w-full h-16 px-6 bg-gray-50 dark:bg-white/5 rounded-3xl font-bold text-sm border-none focus:ring-4 focus:ring-primary/5 transition-all outline-none text-text-primary"
                      value={formData.title}
                      onChange={e => setFormData({ ...formData, title: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { id: 'event', label: 'Event', icon: PartyPopper },
                      { id: 'holiday', label: 'Holiday', icon: Coffee },
                      { id: 'meeting', label: 'Meeting', icon: Users }
                    ].map(type => (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => setFormData({ ...formData, type: type.id as any })}
                        className={`flex flex-col items-center justify-center p-5 rounded-3xl border-2 transition-all ${formData.type === type.id
                            ? 'bg-primary border-primary text-white shadow-xl shadow-primary/20 scale-[1.02]'
                            : 'bg-white dark:bg-white/5 border-gray-100 dark:border-white/10 text-text-muted hover:border-primary/20 hover:text-primary'
                          }`}
                      >
                        <type.icon className="w-5 h-5 mb-2" />
                        <span className="text-[10px] font-black uppercase tracking-tighter">{type.label}</span>
                      </button>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-2">Message</label>
                    <textarea
                      required
                      className="w-full h-40 px-6 py-5 bg-gray-50 dark:bg-white/5 rounded-[32px] font-bold text-sm border-none focus:ring-4 focus:ring-primary/5 transition-all outline-none resize-none text-text-primary"
                      value={formData.description}
                      onChange={e => setFormData({ ...formData, description: e.target.value })}
                    />
                  </div>

                  <div className="flex gap-4">
                    {modalMode === 'edit' && (
                      <button
                        type="button"
                        onClick={() => deleteEvent(selectedEvent!.id)}
                        className="w-16 h-16 bg-rose-50 dark:bg-rose-900/20 text-rose-500 rounded-3xl flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all shadow-sm"
                      >
                        <Trash2 className="w-6 h-6" />
                      </button>
                    )}
                    <button
                      type="submit"
                      className="flex-1 h-16 bg-primary text-white font-black rounded-3xl shadow-2xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center space-x-3"
                    >
                      <Plus className="w-5 h-5" />
                      <span>{modalMode === 'add' ? 'Post Announcement' : 'Update Announcement'}</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarPage;
