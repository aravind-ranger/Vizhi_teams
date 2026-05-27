const { initializeApp, cert } = require('firebase-admin/app');
const { FieldValue, getFirestore, Timestamp } = require('firebase-admin/firestore');

const parseServiceAccount = () => {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error('Missing FIREBASE_SERVICE_ACCOUNT_JSON secret.');
  }

  try {
    return JSON.parse(raw);
  } catch {
    try {
      return JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
    } catch (error) {
      throw new Error(`FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON or base64 JSON: ${error.message}`);
    }
  }
};

const serviceAccount = parseServiceAccount();
initializeApp({
  credential: cert(serviceAccount),
  projectId: process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id,
});

const db = getFirestore();

const dayKey = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const monthKey = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
};

const dayBounds = (date) => {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
};

const toDate = (value) => {
  if (!value) return null;
  return value.toDate ? value.toDate() : new Date(value);
};

const isApprovedLeaveForDay = (leave, date) => {
  const from = toDate(leave.from_date);
  const to = toDate(leave.to_date);
  if (!from || !to || Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return false;

  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const fromDay = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const toDay = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();
  return day >= fromDay && day <= toDay;
};

async function runMarkDailyAbsences() {
  const now = new Date();
  const { start, end } = dayBounds(now);
  const key = dayKey(now);

  const [usersSnap, attendanceSnap, leavesSnap] = await Promise.all([
    db.collection('users').where('is_active', '==', true).get(),
    db.collection('attendance')
      .where('created_at', '>=', Timestamp.fromDate(start))
      .where('created_at', '<', Timestamp.fromDate(end))
      .get(),
    db.collection('leaves').where('status', '==', 'approved').get(),
  ]);

  const usersWithAttendance = new Set(
    attendanceSnap.docs.map((doc) => doc.data().user_id).filter(Boolean),
  );
  const approvedLeaves = leavesSnap.docs.map((doc) => doc.data());
  let batch = db.batch();
  let writes = 0;
  let absentCount = 0;

  for (const userDoc of usersSnap.docs) {
    const user = userDoc.data();
    if (user.role === 'admin' || usersWithAttendance.has(userDoc.id)) continue;
    if (approvedLeaves.some((leave) => leave.user_id === userDoc.id && isApprovedLeaveForDay(leave, now))) continue;

    const attendanceId = `${userDoc.id}_${key}`;
    const attendanceRef = db.collection('attendance').doc(attendanceId);
    batch.set(attendanceRef, {
      user_id: userDoc.id,
      user_name: user.name || 'Employee',
      check_in: null,
      check_out: null,
      scheduled_checkout: null,
      status: 'absent',
      early_exit: false,
      duration_minutes: 0,
      work_location: 'office',
      total_break_ms: 0,
      auto_marked: true,
      day_key: key,
      month_key: monthKey(now),
      created_at: Timestamp.fromDate(now),
      updated_at: FieldValue.serverTimestamp(),
    }, { merge: false });

    const auditRef = db.collection('audit_logs').doc(`${attendanceId}_auto_absent`);
    batch.set(auditRef, {
      user_id: userDoc.id,
      user_name: user.name || 'Employee',
      action: 'auto_absent',
      details: `${user.name || 'Employee'} was auto-marked absent after the end-of-day sweep`,
      created_at: FieldValue.serverTimestamp(),
    }, { merge: true });

    writes += 2;
    absentCount += 1;

    if (writes >= 450) {
      await batch.commit();
      batch = db.batch();
      writes = 0;
    }
  }

  if (writes > 0) await batch.commit();
  console.log(`Daily absence sweep completed. Auto-marked ${absentCount} employee(s) absent for ${key}.`);
}

runMarkDailyAbsences().catch((error) => {
  console.error('Daily absence sweep failed:', error);
  process.exitCode = 1;
});
