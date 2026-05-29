import { db } from '@/services/Firebase/firebase-service.js';
import { Timestamp } from 'firebase-admin/firestore';
import { Resend } from 'resend';
import crypto from 'crypto';

const APPROVAL_REQUESTS_COLLECTION = 'approval_requests';
const USER_COLLECTION = 'users';

type ApprovalDoc = {
  token: string;
  userId: string;
  expiresAt: Timestamp;
  used: boolean;
};

export function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

export async function addApprovalRequestEntry(userId: string, token: string) {
  try {
    const expiresAt = Timestamp.fromDate(new Date(Date.now() + 24 * 60 * 60 * 1000));
    const approvalDoc: ApprovalDoc = {
      token,
      userId,
      expiresAt: expiresAt,
      used: false
    };
    await db.collection(APPROVAL_REQUESTS_COLLECTION).doc().set(approvalDoc);
  } catch (error) {
    throw error;
  }
}

export async function createApprovalRequest(userId: string, userEmail: string, userName: string) {
  try {
    const token = await sendEmail(userId, userEmail, userName);
    await addApprovalRequestEntry(userId, token);
  } catch (err: any) {
    throw err;
  }
}

export async function sendEmail(userId: string, userEmail: string, userName: string) {
  try {
    const backendUrl = process.env.BACKEND_URL;
    const mailServerEmail = process.env.MAIL_SERVER_EMAIL;
    const supervisorEmail = process.env.SUPERVISOR_EMAIL;
    const resendApiKey = process.env.RESEND_API_KEY;

    if (!backendUrl || !mailServerEmail || !supervisorEmail || !resendApiKey) {
      throw new Error(
        'Missing one or more environment variables [BACKEND_URL, MAIL_SERVER_EMAIL, SUPERVISOR_EMAIL, RESEND_API_KEY].'
      );
    }

    const resend = new Resend(resendApiKey);

    if (!userEmail || !userId) {
      throw new Error('Missing userEmail or userId.');
    }

    const token = generateToken();

    const approveUrl = `${backendUrl}/api/verification/verifyEmail/${token}`;
    const content = `
  <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #333;">
    <p>A new user has requested access to the application.</p>

    <h3 style="margin-top: 20px;">User Details:</h3>
    <ul>
      <li><strong>Email:</strong> ${userEmail}</li>
      <li><strong>Username:</strong> ${userName}</li>
    </ul>

    <p style="margin-top: 20px;">
      To approve this user, visit:
    </p>

    <p>
      <a href="${approveUrl}" 
         style="display: inline-block; padding: 10px 14px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px;">
        Approve User
      </a>
    </p>

    <p style="margin-top: 20px; color: #555;">
      If you were not expecting this request, you can ignore this email.<br/>
      If 24 hours have passed since the request, please ask the student/instructor to resend the request.
    </p>
  </div>
`;

    const subject = 'ACTION REQUIRED: Verify New User Registration';

    const result = await resend.emails.send({
      from: mailServerEmail,
      to: supervisorEmail,
      subject: subject,
      html: content
    });

    console.log('RESEND RESULT:', result);

    return token;
  } catch (error) {
    throw error;
  }
}

export async function verifyAccount(userId: string): Promise<boolean> {
  try {
    const querySnapshot = await db.collection(USER_COLLECTION).where('userId', '==', userId).limit(1).get();

    if (querySnapshot.empty) {
      return false;
    }

    const doc = querySnapshot.docs[0];
    if (!doc) {
      throw new Error('User not found.');
    }
    const data = doc.data();

    return data.verified === true;
  } catch (error) {
    throw error;
  }
}

export async function setVerified(token: string) {
  try {
    const querySnapshot = await db.collection(APPROVAL_REQUESTS_COLLECTION).where('token', '==', token).limit(1).get();

    if (querySnapshot.empty) {
      throw new Error('Invalid token');
    }

    const approvalSnapshot = querySnapshot.docs[0];

    if (!approvalSnapshot) {
      throw new Error('Token not found');
    }

    const approvalDoc = approvalSnapshot.data() as ApprovalDoc;

    if (approvalDoc.used) {
      throw new Error('Token already used');
    }

    if (approvalDoc.expiresAt.toDate() < new Date()) {
      throw new Error('Token expired');
    }

    await db.collection(USER_COLLECTION).doc(approvalDoc.userId).update({
      verified: true
    });

    await approvalSnapshot.ref.update({
      used: true,
      usedAt: new Date()
    });
  } catch (error) {
    throw error;
  }
}

export async function getUserVerificationStatus(uid: string): Promise<boolean> {
  try {
    const userRef = db.collection(USER_COLLECTION).doc(uid);
    const snapshot = await userRef.get();

    if (!snapshot.exists) {
      throw new Error('User not found');
    }

    const data = snapshot.data();

    if (!data) {
      throw new Error('User data not found');
    }

    return data?.verified === true;
  } catch (error) {
    throw error;
  }
}
