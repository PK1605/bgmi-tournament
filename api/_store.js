// In-memory store for serverless functions (shared within a single cold start)
// For production, replace with a real database (Firebase, MongoDB, Vercel KV, etc.)

const today = new Date().toISOString().split('T')[0];

const DEMO_REGISTRATIONS = [
  { id:'d1', teamName:'Team SouL', teamTag:'TSM', leaderName:'Naman Mathur', leaderWhatsApp:'+91 9876543210', leaderEmail:'soul@bgmi.com', txnId:'pay_demo_001', paymentStatus:'verified', date:today, players:[{ign:'SouLMortal',bgmiId:'5100000001'},{ign:'SouLRonak',bgmiId:'5100000002'},{ign:'SouLViper',bgmiId:'5100000003'},{ign:'SouLOwais',bgmiId:'5100000004'}], substitute:{ign:'SouLSub',bgmiId:'5100000005'}, payNote:'Razorpay', orderId:'order_demo_001' },
  { id:'d2', teamName:'GodLike Esports', teamTag:'GL', leaderName:'Chetan Chandgude', leaderWhatsApp:'+91 9876543211', leaderEmail:'godlike@bgmi.com', txnId:'pay_demo_002', paymentStatus:'submitted', date:today, players:[{ign:'GLKronten',bgmiId:'5200000001'},{ign:'GLJonathan',bgmiId:'5200000002'},{ign:'GLNeyoo',bgmiId:'5200000003'},{ign:'GLClutchgod',bgmiId:'5200000004'}], substitute:{ign:'',bgmiId:''}, payNote:'', orderId:'order_demo_002' },
  { id:'d3', teamName:'Team XSpark', teamTag:'XS', leaderName:'Tanmay Singh', leaderWhatsApp:'+91 9876543212', leaderEmail:'xspark@bgmi.com', txnId:'', paymentStatus:'pending', date:today, players:[{ign:'XSScout',bgmiId:'5300000001'},{ign:'XSGill',bgmiId:'5300000002'},{ign:'XSMavi',bgmiId:'5300000003'},{ign:'XSShadow',bgmiId:'5300000004'}], substitute:{ign:'XSSub',bgmiId:'5300000005'}, payNote:'', orderId:'' },
  { id:'d4', teamName:'Orangutan Gaming', teamTag:'OR', leaderName:'Ravi Kumar', leaderWhatsApp:'+91 9876543213', leaderEmail:'or@bgmi.com', txnId:'pay_demo_004', paymentStatus:'verified', date:'2026-03-30', players:[{ign:'ORManya',bgmiId:'5400000001'},{ign:'ORSanky',bgmiId:'5400000002'},{ign:'ORParas',bgmiId:'5400000003'},{ign:'ORDeep',bgmiId:'5400000004'}], substitute:{ign:'',bgmiId:''}, payNote:'', orderId:'order_demo_004' },
  { id:'d5', teamName:'Blind Esports', teamTag:'BL', leaderName:'Amit Sharma', leaderWhatsApp:'+91 9876543214', leaderEmail:'blind@bgmi.com', txnId:'pay_demo_005', paymentStatus:'submitted', date:'2026-03-30', players:[{ign:'BLiND',bgmiId:'5500000001'},{ign:'BLFury',bgmiId:'5500000002'},{ign:'BLStorm',bgmiId:'5500000003'},{ign:'BLAce',bgmiId:'5500000004'}], substitute:{ign:'BLSub',bgmiId:'5500000005'}, payNote:'', orderId:'order_demo_005' },
  { id:'d6', teamName:'Rivalry Esports', teamTag:'RV', leaderName:'Priya Patel', leaderWhatsApp:'+91 9876543215', leaderEmail:'rivalry@bgmi.com', txnId:'', paymentStatus:'pending', date:today, players:[{ign:'RVFlash',bgmiId:'5600000001'},{ign:'RVThunder',bgmiId:'5600000002'},{ign:'RVBlaze',bgmiId:'5600000003'},{ign:'RVFrost',bgmiId:'5600000004'}], substitute:{ign:'',bgmiId:''}, payNote:'', orderId:'' },
];

if (!global.__malwa_store) {
  global.__malwa_store = {
    users: [],
    registrations: [...DEMO_REGISTRATIONS],
    settings: {
      entryFee: 99,
      upiId: 'malwaesports@upi',
      whatsappLink: 'https://chat.whatsapp.com/demo',
    },
    roomInfo: {
      roomId: '87654321',
      roomPass: 'malwa2026',
      roomMessage: 'Match at 8 PM — Erangel TPP',
    },
    adminPassword: 'admin123',
  };
}

const store = global.__malwa_store;

module.exports = store;
